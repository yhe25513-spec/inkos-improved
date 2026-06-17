import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface CheckpointConfig {
  readonly enabled: boolean;
  readonly autoApproveTimeoutMs?: number; // auto-approve after timeout
  readonly stages: ReadonlyArray<string>; // stages that require checkpoint
}

export interface CheckpointRequest {
  readonly stage: string;
  readonly chapterNumber: number;
  readonly bookId: string;
  readonly content: string;
  readonly summary: string;
  readonly timestamp: number;
}

export interface CheckpointResponse {
  readonly approved: boolean;
  readonly feedback?: string;
  readonly adjustments?: Record<string, unknown>;
}

const DEFAULT_AUTO_APPROVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CHECKPOINT_POLL_INTERVAL_MS = 1000; // 1 second

/**
 * Request a manual approval checkpoint at a pipeline stage.
 *
 * If not enabled or the stage is not in the checkpoint list, auto-approves.
 * Otherwise, writes a checkpoint request file and waits for a response file.
 * If timeout is reached, auto-approves.
 *
 * @param config - Checkpoint configuration
 * @param request - Checkpoint request details
 * @param projectRoot - Root directory of the project (for resolving paths)
 * @returns Checkpoint response
 */
export async function requestCheckpoint(
  config: CheckpointConfig,
  request: CheckpointRequest,
  projectRoot: string,
): Promise<CheckpointResponse> {
  // If not enabled or stage not in checkpoint list, auto-approve
  if (!config.enabled || !config.stages.includes(request.stage)) {
    return { approved: true };
  }

  const checkpointsDir = join(projectRoot, "story", "checkpoints");
  await mkdir(checkpointsDir, { recursive: true });

  const timestamp = request.timestamp;
  const requestFileName = `checkpoint-${request.chapterNumber}-${request.stage}-${timestamp}.json`;
  const responseFileName = `response-${request.chapterNumber}-${request.stage}-${timestamp}.json`;
  const requestPath = join(checkpointsDir, requestFileName);
  const responsePath = join(checkpointsDir, responseFileName);

  // Write checkpoint request file
  const requestData: CheckpointRequest = {
    stage: request.stage,
    chapterNumber: request.chapterNumber,
    bookId: request.bookId,
    content: request.content,
    summary: request.summary,
    timestamp: request.timestamp,
  };
  await writeFile(requestPath, JSON.stringify(requestData, null, 2), "utf-8");

  // Wait for response file
  const timeoutMs = config.autoApproveTimeoutMs ?? DEFAULT_AUTO_APPROVE_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const raw = await readFile(responsePath, "utf-8");
      const parsed = JSON.parse(raw) as CheckpointResponse;
      return {
        approved: parsed.approved,
        feedback: parsed.feedback,
        adjustments: parsed.adjustments,
      };
    } catch {
      // Response file not yet present, wait and retry
      await sleep(CHECKPOINT_POLL_INTERVAL_MS);
    }
  }

  // Timeout: auto-approve
  return { approved: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
