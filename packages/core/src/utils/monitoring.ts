/**
 * monitoring.ts — API usage, performance metrics, and error tracking.
 *
 * - Immutable data model (all types are `readonly`)
 * - On-the-fly summary computation from raw entries
 * - 7-day auto-rotation on load/save
 * - Health checks: disk, LLM API, SQLite integrity, error rate, memory
 */

import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricEntry {
  readonly timestamp: number;
  readonly category: "api" | "pipeline" | "error" | "performance";
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly metadata?: Record<string, unknown>;
}

export interface MonitoringStore {
  readonly entries: ReadonlyArray<MetricEntry>;
  readonly summary: {
    readonly totalTokens: number;
    readonly totalApiCalls: number;
    readonly totalErrors: number;
    readonly avgResponseTimeMs: number;
    readonly uptime: number;
  };
}

export interface HealthCheckResult {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly checks: ReadonlyArray<{
    readonly name: string;
    readonly status: "pass" | "fail" | "warn";
    readonly message: string;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METRICS_FILE = ".inkos/metrics.json";
const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

const START_TIME = Date.now();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute summary from a filtered set of entries (used everywhere). */
function computeSummary(
  entries: ReadonlyArray<MetricEntry>,
  uptimeMs: number,
): MonitoringStore["summary"] {
  let totalTokens = 0;
  let totalApiCalls = 0;
  let totalErrors = 0;
  let totalResponseTime = 0;
  let responseCount = 0;

  for (const e of entries) {
    switch (e.category) {
      case "api":
        totalApiCalls += 1;
        if (e.name === "tokens") totalTokens += e.value;
        if (e.name === "response_time_ms") {
          totalResponseTime += e.value;
          responseCount += 1;
        }
        break;
      case "error":
        totalErrors += 1;
        break;
      case "performance":
        if (e.name === "response_time_ms") {
          totalResponseTime += e.value;
          responseCount += 1;
        }
        break;
      // "pipeline" — no special counters yet
    }
  }

  return {
    totalTokens,
    totalApiCalls,
    totalErrors,
    avgResponseTimeMs:
      responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
    uptime: uptimeMs,
  };
}

/** Drop entries older than RETENTION_MS from an array. */
function rotate(entries: MetricEntry[]): MetricEntry[] {
  const cutoff = Date.now() - RETENTION_MS;
  return entries.filter((e) => e.timestamp >= cutoff);
}

/** Build an empty store with zeroed summary. */
function emptyStore(): MonitoringStore {
  return { entries: [], summary: computeSummary([], 0) };
}

// ---------------------------------------------------------------------------
// Public API — CRUD
// ---------------------------------------------------------------------------

/** Append a metric entry and return a new store. */
export function recordMetric(
  store: MonitoringStore,
  entry: MetricEntry,
): MonitoringStore {
  const rotated = rotate([...store.entries, entry]);
  return {
    entries: rotated,
    summary: computeSummary(rotated, Date.now() - START_TIME),
  };
}

/** Return summary for entries within [startTime, endTime]. */
export function getSummary(
  store: MonitoringStore,
  startTime: number,
  endTime: number,
): MonitoringStore["summary"] {
  const filtered = store.entries.filter(
    (e) => e.timestamp >= startTime && e.timestamp <= endTime,
  );
  return computeSummary(filtered, endTime - startTime);
}

// ---------------------------------------------------------------------------
// Public API — Persistence
// ---------------------------------------------------------------------------

/** Save metrics to `.inkos/metrics.json`. */
export async function saveMetrics(
  store: MonitoringStore,
  projectRoot: string,
): Promise<void> {
  const dir = path.join(projectRoot, ".inkos");
  await fs.mkdir(dir, { recursive: true });
  const rotated = rotate([...store.entries]);
  const payload = JSON.stringify({ entries: rotated }, null, 2);
  await fs.writeFile(path.join(projectRoot, METRICS_FILE), payload, "utf-8");
}

/** Load metrics from `.inkos/metrics.json`, applying rotation. */
export async function loadMetrics(
  projectRoot: string,
): Promise<MonitoringStore> {
  const filePath = path.join(projectRoot, METRICS_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as { entries?: MetricEntry[] };
    const entries = rotate(parsed.entries ?? []);
    return {
      entries,
      summary: computeSummary(entries, Date.now() - START_TIME),
    };
  } catch {
    return emptyStore();
  }
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

interface SingleCheck {
  readonly name: string;
  readonly status: "pass" | "fail" | "warn";
  readonly message: string;
}

async function checkDiskSpace(projectRoot: string): Promise<SingleCheck> {
  try {
    const stat = await fs.statfs(projectRoot);
    const freeBytes = stat.bavail * stat.bsize;
    const freeGB = freeBytes / (1024 ** 3);
    if (freeGB < 0.5) {
      return { name: "disk_space", status: "fail", message: `Only ${freeGB.toFixed(2)} GB free` };
    }
    if (freeGB < 2) {
      return { name: "disk_space", status: "warn", message: `${freeGB.toFixed(2)} GB free` };
    }
    return { name: "disk_space", status: "pass", message: `${freeGB.toFixed(2)} GB free` };
  } catch {
    return { name: "disk_space", status: "warn", message: "Unable to check disk space" };
  }
}

async function checkLlmApiConnectivity(): Promise<SingleCheck> {
  // Lightweight probe — check that at least one LLM env var is set,
  // then do a DNS lookup on a known endpoint.
  const hasKey =
    process.env.OPENAI_API_KEY !== undefined ||
    process.env.ANTHROPIC_API_KEY !== undefined;
  if (!hasKey) {
    return { name: "llm_api", status: "warn", message: "No LLM API key detected in environment" };
  }

  try {
    const { lookup } = await import("node:dns/promises");
    // Resolve a well-known API hostname to verify network connectivity.
    await lookup("api.openai.com");
    return { name: "llm_api", status: "pass", message: "LLM endpoint reachable" };
  } catch {
    return { name: "llm_api", status: "fail", message: "Cannot resolve LLM endpoint" };
  }
}

async function checkSqliteIntegrity(projectRoot: string): Promise<SingleCheck> {
  // Walk .inkos looking for *.db / *.sqlite files and verify they exist
  // and are non-empty.  Full PRAGMA integrity_check would require native
  // sqlite3 bindings, so we do a structural check instead.
  const inkosDir = path.join(projectRoot, ".inkos");
  try {
    const entries = await fs.readdir(inkosDir);
    const dbFiles = entries.filter(
      (f) => f.endsWith(".db") || f.endsWith(".sqlite") || f.endsWith(".sqlite3"),
    );
    if (dbFiles.length === 0) {
      return { name: "sqlite", status: "pass", message: "No SQLite databases found (none expected)" };
    }
    for (const db of dbFiles) {
      const stat = await fs.stat(path.join(inkosDir, db));
      if (stat.size === 0) {
        return { name: "sqlite", status: "fail", message: `Database ${db} is empty` };
      }
    }
    return {
      name: "sqlite",
      status: "pass",
      message: `${dbFiles.length} database file(s) present and non-empty`,
    };
  } catch {
    return { name: "sqlite", status: "pass", message: "No .inkos directory (nothing to check)" };
  }
}

async function checkErrorRate(projectRoot: string): Promise<SingleCheck> {
  try {
    const store = await loadMetrics(projectRoot);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentErrors = store.entries.filter(
      (e) => e.category === "error" && e.timestamp >= oneHourAgo,
    ).length;
    if (recentErrors >= 20) {
      return {
        name: "error_rate",
        status: "fail",
        message: `${recentErrors} errors in the last hour`,
      };
    }
    if (recentErrors >= 5) {
      return {
        name: "error_rate",
        status: "warn",
        message: `${recentErrors} errors in the last hour`,
      };
    }
    return {
      name: "error_rate",
      status: "pass",
      message: `${recentErrors} error(s) in the last hour`,
    };
  } catch {
    return { name: "error_rate", status: "pass", message: "No metrics data available" };
  }
}

async function checkMemoryUsage(): Promise<SingleCheck> {
  const mem = os.totalmem();
  const free = os.freemem();
  const usedRatio = (mem - free) / mem;
  const usedGB = ((mem - free) / 1024 ** 3).toFixed(1);
  const totalGB = (mem / 1024 ** 3).toFixed(1);

  if (usedRatio > 0.95) {
    return { name: "memory", status: "fail", message: `${usedGB}/${totalGB} GB used (${(usedRatio * 100).toFixed(0)}%)` };
  }
  if (usedRatio > 0.85) {
    return { name: "memory", status: "warn", message: `${usedGB}/${totalGB} GB used (${(usedRatio * 100).toFixed(0)}%)` };
  }
  return { name: "memory", status: "pass", message: `${usedGB}/${totalGB} GB used (${(usedRatio * 100).toFixed(0)}%)` };
}

/** Run all health checks and return an aggregated result. */
export async function runHealthCheck(
  projectRoot: string,
): Promise<HealthCheckResult> {
  const checks: SingleCheck[] = await Promise.all([
    checkDiskSpace(projectRoot),
    checkLlmApiConnectivity(),
    checkSqliteIntegrity(projectRoot),
    checkErrorRate(projectRoot),
    checkMemoryUsage(),
  ]);

  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");

  let status: HealthCheckResult["status"] = "healthy";
  if (hasFail) status = "unhealthy";
  else if (hasWarn) status = "degraded";

  return { status, checks };
}
