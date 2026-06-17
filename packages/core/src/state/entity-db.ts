/**
 * 实体数据库
 * 基于 SQLite 的实体关系图谱存储
 */

import { createRequire } from "node:module";
import { join } from "node:path";
import type { Entity, Edge, EntityType, EntityDelta, StateChange } from "../models/entity.js";

const require = createRequire(import.meta.url);

export class EntityDB {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  constructor(bookDir: string) {
    const { DatabaseSync } = require("node:sqlite");
    const dbPath = join(bookDir, "story", "entities.db");
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        aliases TEXT DEFAULT '[]',
        attributes TEXT DEFAULT '{}',
        state TEXT DEFAULT '{}',
        first_appearance INTEGER,
        last_appearance INTEGER,
        status TEXT DEFAULT 'active',
        exit_chapter INTEGER,
        exit_reason TEXT,
        tags TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        type TEXT NOT NULL,
        attributes TEXT DEFAULT '{}',
        since INTEGER,
        until INTEGER,
        FOREIGN KEY (source) REFERENCES entities(id),
        FOREIGN KEY (target) REFERENCES entities(id)
      );

      CREATE TABLE IF NOT EXISTS state_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        timestamp INTEGER,
        FOREIGN KEY (entity_id) REFERENCES entities(id)
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
      CREATE INDEX IF NOT EXISTS idx_state_changes_entity ON state_changes(entity_id);
      CREATE INDEX IF NOT EXISTS idx_state_changes_chapter ON state_changes(chapter);
    `);
  }

  // ==================== Entity CRUD ====================

  upsertEntity(entity: Entity): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entities
      (id, type, name, aliases, attributes, state, first_appearance, last_appearance, status, exit_chapter, exit_reason, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entity.id,
      entity.type,
      entity.name,
      JSON.stringify(entity.aliases),
      JSON.stringify(entity.attributes),
      JSON.stringify(entity.state),
      entity.firstAppearance,
      entity.lastAppearance,
      entity.status,
      entity.exitChapter || null,
      entity.exitReason || null,
      JSON.stringify(entity.tags)
    );
  }

  getEntity(id: string): Entity | null {
    const row = this.db.prepare("SELECT * FROM entities WHERE id = ?").get(id);
    if (!row) return null;
    return this.rowToEntity(row);
  }

  getEntitiesByType(type: EntityType): Entity[] {
    const rows = this.db.prepare("SELECT * FROM entities WHERE type = ?").all(type);
    return rows.map((r: any) => this.rowToEntity(r));
  }

  getActiveCharacters(): Entity[] {
    const rows = this.db.prepare(
      "SELECT * FROM entities WHERE type = 'character' AND status = 'active'"
    ).all();
    return rows.map((r: any) => this.rowToEntity(r));
  }

  searchEntities(query: string): Entity[] {
    const rows = this.db.prepare(
      "SELECT * FROM entities WHERE name LIKE ? OR aliases LIKE ?"
    ).all(`%${query}%`, `%${query}%`);
    return rows.map((r: any) => this.rowToEntity(r));
  }

  // ==================== Edge CRUD ====================

  upsertEdge(edge: Edge): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO edges (id, source, target, type, attributes, since, until)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(edge.id, edge.source, edge.target, edge.type, JSON.stringify(edge.attributes), edge.since, edge.until || null);
  }

  getEdgesFrom(entityId: string): Edge[] {
    const rows = this.db.prepare("SELECT * FROM edges WHERE source = ?").all(entityId);
    return rows.map((r: any) => this.rowToEdge(r));
  }

  getEdgesTo(entityId: string): Edge[] {
    const rows = this.db.prepare("SELECT * FROM edges WHERE target = ?").all(entityId);
    return rows.map((r: any) => this.rowToEdge(r));
  }

  getEdgesByType(type: string): Edge[] {
    const rows = this.db.prepare("SELECT * FROM edges WHERE type = ?").all(type);
    return rows.map((r: any) => this.rowToEdge(r));
  }

  // ==================== State Changes ====================

  recordStateChange(change: StateChange): void {
    const stmt = this.db.prepare(`
      INSERT INTO state_changes (entity_id, chapter, field, old_value, new_value, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(change.entityId, change.chapter, change.field, JSON.stringify(change.oldValue), JSON.stringify(change.newValue), change.timestamp);
  }

  getEntityHistory(entityId: string): StateChange[] {
    const rows = this.db.prepare(
      "SELECT * FROM state_changes WHERE entity_id = ? ORDER BY chapter"
    ).all(entityId);
    return rows.map((r: any) => ({
      entityId: r.entity_id,
      chapter: r.chapter,
      field: r.field,
      oldValue: JSON.parse(r.old_value || 'null'),
      newValue: JSON.parse(r.new_value || 'null'),
      timestamp: r.timestamp,
    }));
  }

  getChapterChanges(chapter: number): StateChange[] {
    const rows = this.db.prepare(
      "SELECT * FROM state_changes WHERE chapter = ? ORDER BY entity_id"
    ).all(chapter);
    return rows.map((r: any) => ({
      entityId: r.entity_id,
      chapter: r.chapter,
      field: r.field,
      oldValue: JSON.parse(r.old_value || 'null'),
      newValue: JSON.parse(r.new_value || 'null'),
      timestamp: r.timestamp,
    }));
  }

  // ==================== Query Methods ====================

  findPath(source: string, target: string, maxDepth: number = 3): Edge[] {
    // BFS 查找两个实体之间的路径
    const visited = new Set<string>();
    const queue: Array<{ entityId: string; path: Edge[] }> = [{ entityId: source, path: [] }];

    while (queue.length > 0) {
      const { entityId, path } = queue.shift()!;
      if (entityId === target) return path;
      if (path.length >= maxDepth) continue;
      if (visited.has(entityId)) continue;

      visited.add(entityId);
      const edges = [...this.getEdgesFrom(entityId), ...this.getEdgesTo(entityId)];

      for (const edge of edges) {
        const nextId = edge.source === entityId ? edge.target : edge.source;
        if (!visited.has(nextId)) {
          queue.push({ entityId: nextId, path: [...path, edge] });
        }
      }
    }

    return [];
  }

  getEntityConnections(entityId: string, depth: number = 1): { entities: Entity[]; edges: Edge[] } {
    const entityIds = new Set<string>([entityId]);
    const edgeIds = new Set<string>();

    for (let d = 0; d < depth; d++) {
      const newIds = new Set<string>();
      for (const id of entityIds) {
        const edges = [...this.getEdgesFrom(id), ...this.getEdgesTo(id)];
        for (const edge of edges) {
          edgeIds.add(edge.id);
          const nextId = edge.source === id ? edge.target : edge.source;
          if (!entityIds.has(nextId)) {
            newIds.add(nextId);
          }
        }
      }
      newIds.forEach(id => entityIds.add(id));
    }

    const entities = Array.from(entityIds)
      .map(id => this.getEntity(id))
      .filter(Boolean) as Entity[];

    const edges = Array.from(edgeIds)
      .map(id => this.db.prepare("SELECT * FROM edges WHERE id = ?").get(id))
      .filter(Boolean)
      .map((r: any) => this.rowToEdge(r));

    return { entities, edges };
  }

  // ==================== Delta Application ====================

  applyDelta(delta: EntityDelta, chapter: number): void {
    // 更新实体
    for (const entity of [...delta.characters, ...delta.scenes, ...delta.organizations, ...delta.items, ...delta.concepts]) {
      const existing = this.getEntity(entity.id);
      if (existing) {
        // 记录状态变化
        for (const [key, value] of Object.entries(entity.state)) {
          if (existing.state[key] !== value) {
            this.recordStateChange({
              entityId: entity.id,
              chapter,
              field: key,
              oldValue: existing.state[key],
              newValue: value,
              timestamp: Date.now(),
            });
          }
        }

        // 更新现有实体
        existing.lastAppearance = chapter;
        Object.assign(existing.state, entity.state);
        this.upsertEntity(existing);
      } else {
        // 新增实体
        entity.firstAppearance = chapter;
        entity.lastAppearance = chapter;
        this.upsertEntity(entity);
      }
    }

    // 更新关系
    for (const edge of delta.relationships) {
      this.upsertEdge(edge);
    }
  }

  // ==================== Statistics ====================

  getStats(): {
    totalEntities: number;
    activeCharacters: number;
    totalEdges: number;
    entitiesByType: Record<EntityType, number>;
  } {
    const totalEntities = this.db.prepare("SELECT COUNT(*) as count FROM entities").get().count;
    const activeCharacters = this.db.prepare(
      "SELECT COUNT(*) as count FROM entities WHERE type = 'character' AND status = 'active'"
    ).get().count;
    const totalEdges = this.db.prepare("SELECT COUNT(*) as count FROM edges").get().count;

    const entitiesByType: Record<EntityType, number> = {
      character: 0,
      scene: 0,
      organization: 0,
      item: 0,
      concept: 0,
      relationship: 0,
    };

    for (const type of Object.keys(entitiesByType)) {
      const count = this.db.prepare("SELECT COUNT(*) as count FROM entities WHERE type = ?").get(type).count;
      entitiesByType[type as EntityType] = count;
    }

    return { totalEntities, activeCharacters, totalEdges, entitiesByType };
  }

  // ==================== Helper Methods ====================

  private rowToEntity(row: any): Entity {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      aliases: JSON.parse(row.aliases || '[]'),
      attributes: JSON.parse(row.attributes || '{}'),
      state: JSON.parse(row.state || '{}'),
      firstAppearance: row.first_appearance,
      lastAppearance: row.last_appearance,
      status: row.status,
      exitChapter: row.exit_chapter,
      exitReason: row.exit_reason,
      tags: JSON.parse(row.tags || '[]'),
    };
  }

  private rowToEdge(row: any): Edge {
    return {
      id: row.id,
      source: row.source,
      target: row.target,
      type: row.type,
      attributes: JSON.parse(row.attributes || '{}'),
      since: row.since,
      until: row.until,
    };
  }

  close(): void {
    this.db.close();
  }
}
