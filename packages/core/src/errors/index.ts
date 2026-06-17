/**
 * InkOS 错误类型统一导出
 *
 * 使用方式:
 *   import { InkOSError, LLMConnectionError, StateCorruptedError } from "@actalk/inkos-core";
 *   // 或
 *   import { InkOSError } from "@actalk/inkos-core/errors";
 */

// 基类
export { InkOSError } from "./base.js";
export type { InkOSErrorParams } from "./base.js";
import { InkOSError } from "./base.js";

// LLM 错误
export {
  LLMConnectionError,
  LLMAuthError,
  LLMForbiddenError,
  LLMRateLimitError,
  LLMBadRequestError,
  LLMUpstreamError,
  LLMContextWindowError,
  LLMPartialResponseError,
  LLMEmptyResponseError,
} from "./llm-errors.js";

// 状态错误
export {
  StateCorruptedError,
  BookLockError,
  SnapshotMissingError,
  ChapterNotFoundError,
  BookNotFoundError,
  StateRestoreError,
} from "./state-errors.js";

// 配置错误
export {
  ProjectNotInitializedError,
  InvalidConfigError,
  MissingConfigError,
  InvalidLLMConfigError,
  UnsupportedLanguageError,
  UnsupportedPlatformError,
} from "./config-errors.js";

// === 错误码枚举（用于程序化判断） ===

export const ErrorCode = {
  // LLM 错误 (退出码 2)
  LLM_CONNECTION: "LLM_CONNECTION",
  LLM_AUTH: "LLM_AUTH",
  LLM_FORBIDDEN: "LLM_FORBIDDEN",
  LLM_RATE_LIMIT: "LLM_RATE_LIMIT",
  LLM_BAD_REQUEST: "LLM_BAD_REQUEST",
  LLM_UPSTREAM: "LLM_UPSTREAM",
  LLM_CONTEXT_WINDOW: "LLM_CONTEXT_WINDOW",
  LLM_PARTIAL_RESPONSE: "LLM_PARTIAL_RESPONSE",
  LLM_EMPTY_RESPONSE: "LLM_EMPTY_RESPONSE",

  // 状态错误 (退出码 3)
  STATE_CORRUPTED: "STATE_CORRUPTED",
  BOOK_LOCKED: "BOOK_LOCKED",
  SNAPSHOT_MISSING: "SNAPSHOT_MISSING",
  CHAPTER_NOT_FOUND: "CHAPTER_NOT_FOUND",
  BOOK_NOT_FOUND: "BOOK_NOT_FOUND",
  STATE_RESTORE_FAILED: "STATE_RESTORE_FAILED",

  // 配置错误 (退出码 4)
  PROJECT_NOT_INIT: "PROJECT_NOT_INIT",
  INVALID_CONFIG: "INVALID_CONFIG",
  MISSING_CONFIG: "MISSING_CONFIG",
  INVALID_LLM_CONFIG: "INVALID_LLM_CONFIG",
  UNSUPPORTED_LANGUAGE: "UNSUPPORTED_LANGUAGE",
  UNSUPPORTED_PLATFORM: "UNSUPPORTED_PLATFORM",

  // 用户输入错误 (退出码 5)
  USER_INPUT: "USER_INPUT",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// === 错误分类工具 ===

/** 判断是否为 LLM 相关错误 */
export function isLLMError(error: unknown): boolean {
  return error instanceof Error && "code" in error && String((error as { code: string }).code).startsWith("LLM_");
}

/** 判断是否为状态相关错误 */
export function isStateError(error: unknown): boolean {
  return error instanceof Error && "code" in error && String((error as { code: string }).code).startsWith("STATE_") ||
    (error instanceof Error && "code" in error && ["BOOK_LOCKED", "SNAPSHOT_MISSING", "CHAPTER_NOT_FOUND", "BOOK_NOT_FOUND"].includes((error as { code: string }).code));
}

/** 判断是否为配置相关错误 */
export function isConfigError(error: unknown): boolean {
  return error instanceof Error && "code" in error && String((error as { code: string }).code).startsWith("PROJECT_") ||
    (error instanceof Error && "code" in error && ["INVALID_CONFIG", "MISSING_CONFIG", "INVALID_LLM_CONFIG", "UNSUPPORTED_LANGUAGE", "UNSUPPORTED_PLATFORM"].includes((error as { code: string }).code));
}

/** 判断是否为 InkOS 错误 */
export function isInkOSError(error: unknown): error is InkOSError {
  return error instanceof InkOSError;
}
