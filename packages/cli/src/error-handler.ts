import { isInkOSError } from "@actalk/inkos-core";
import { logError } from "./utils.js";

/**
 * CLI 统一错误处理器
 *
 * 根据错误类型输出用户友好的错误信息和恢复建议，
 * 并使用适当的退出码。
 */

interface CLIErrorOptions {
  /** JSON 输出模式 */
  readonly json?: boolean;
  /** 命令名称，用于错误上下文 */
  readonly command?: string;
}

/**
 * 处理 CLI 命令中的错误
 *
 * - InkOS 错误: 输出结构化错误信息 + 恢复建议
 * - 未知错误: 输出通用错误信息 + doctor 建议
 */
export function handleCLIError(e: unknown, opts: CLIErrorOptions = {}): never {
  const command = opts.command ? `[${opts.command}] ` : "";

  if (isInkOSError(e)) {
    if (opts.json) {
      console.log(JSON.stringify(e.toJSON()));
    } else {
      logError(`${command}${e.toUserMessage()}`);
    }
    process.exit(e.exitCode);
  }

  // 非 InkOS 错误（系统错误、未捕获异常等）
  const message = e instanceof Error ? e.message : String(e);

  if (opts.json) {
    console.log(JSON.stringify({
      error: message,
      code: "UNKNOWN",
      hint: "运行 inkos doctor 检查系统状态",
    }));
  } else {
    logError(`${command}意外错误: ${message}`);
    logError(`💡 建议: 运行 inkos doctor 检查系统状态，或在 GitHub 上报告问题`);
  }

  process.exit(1);
}

/**
 * 安全执行异步命令，自动捕获并处理错误
 */
export async function runSafely<T>(
  fn: () => Promise<T>,
  opts: CLIErrorOptions = {},
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    handleCLIError(e, opts);
  }
}
