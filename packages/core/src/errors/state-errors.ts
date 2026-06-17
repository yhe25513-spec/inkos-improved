import { InkOSError } from "./base.js";

// === 状态损坏 ===

export class StateCorruptedError extends InkOSError {
  readonly code = "STATE_CORRUPTED";
  readonly exitCode = 3;

  constructor(params: { readonly bookId: string; readonly detail: string }) {
    super({
      message: `书籍 "${params.bookId}" 状态损坏: ${params.detail}`,
      code: "STATE_CORRUPTED",
      exitCode: 3,
      hint: "运行 inkos write repair-state <chapter> 修复，或使用 inkos write rewrite 从快照恢复",
    });
  }
}

// === 书籍锁定冲突 ===

export class BookLockError extends InkOSError {
  readonly code = "BOOK_LOCKED";
  readonly exitCode = 3;

  constructor(params: { readonly bookId: string; readonly lockFile: string; readonly ownerPid?: number }) {
    const ownerInfo = params.ownerPid ? ` (持有者 PID: ${params.ownerPid})` : "";
    super({
      message: `书籍 "${params.bookId}" 正在被其他进程操作${ownerInfo}`,
      code: "BOOK_LOCKED",
      exitCode: 3,
      hint: "等待其他操作完成，或检查是否有残留进程。锁文件: " + params.lockFile,
    });
  }
}

// === 快照缺失 ===

export class SnapshotMissingError extends InkOSError {
  readonly code = "SNAPSHOT_MISSING";
  readonly exitCode = 3;

  constructor(params: { readonly bookId: string; readonly chapter: number }) {
    super({
      message: `无法恢复章节 ${params.chapter}: 缺少快照 (书籍: ${params.bookId})`,
      code: "SNAPSHOT_MISSING",
      exitCode: 3,
      hint: "快照可能被删除。尝试使用 inkos write sync 重建状态，或删除该章节后重新生成",
    });
  }
}

// === 章节未找到 ===

export class ChapterNotFoundError extends InkOSError {
  readonly code = "CHAPTER_NOT_FOUND";
  readonly exitCode = 3;

  constructor(params: { readonly bookId: string; readonly chapter: number }) {
    super({
      message: `章节 ${params.chapter} 不存在 (书籍: ${params.bookId})`,
      code: "CHAPTER_NOT_FOUND",
      exitCode: 3,
      hint: "检查章节编号是否正确，或使用 inkos status 查看已有章节",
    });
  }
}

// === 书籍未找到 ===

export class BookNotFoundError extends InkOSError {
  readonly code = "BOOK_NOT_FOUND";
  readonly exitCode = 3;

  constructor(params: { readonly bookId: string }) {
    super({
      message: `书籍 "${params.bookId}" 不存在`,
      code: "BOOK_NOT_FOUND",
      exitCode: 3,
      hint: "运行 inkos book list 查看可用书籍，或 inkos book create 创建新书",
    });
  }
}

// === 状态恢复失败 ===

export class StateRestoreError extends InkOSError {
  readonly code = "STATE_RESTORE_FAILED";
  readonly exitCode = 3;

  constructor(params: { readonly bookId: string; readonly chapter: number; readonly cause?: unknown }) {
    super({
      message: `恢复书籍 "${params.bookId}" 章节 ${params.chapter} 的状态失败`,
      code: "STATE_RESTORE_FAILED",
      exitCode: 3,
      hint: "快照文件可能已损坏。尝试手动检查 books/<bookId>/story/snapshots/ 目录",
      cause: params.cause,
    });
  }
}
