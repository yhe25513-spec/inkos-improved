/**
 * InkOS 统一错误基类
 *
 * 所有 InkOS 领域错误继承此基类，提供：
 * - 结构化错误码 (code) 用于程序化判断
 * - 用户友好的恢复建议 (hint)
 * - 明确的 CLI 退出码 (exitCode)
 */

export interface InkOSErrorParams {
  readonly message: string;
  readonly code: string;
  readonly exitCode: number;
  readonly hint?: string;
  readonly cause?: unknown;
}

export abstract class InkOSError extends Error {
  /** 机器可读的错误码，如 "LLM_AUTH"、"STATE_CORRUPTED" */
  abstract readonly code: string;

  /** CLI 退出码 */
  abstract readonly exitCode: number;

  /** 用户可读的恢复建议 */
  readonly hint?: string;

  constructor(params: InkOSErrorParams) {
    super(params.message, { cause: params.cause });
    this.name = this.constructor.name;
    this.hint = params.hint;
  }

  /** 格式化为 CLI 用户可读的消息 */
  toUserMessage(): string {
    const parts = [this.message];
    if (this.hint) {
      parts.push(`\n💡 建议: ${this.hint}`);
    }
    return parts.join("");
  }

  /** 格式化为 JSON 输出 */
  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      hint: this.hint ?? null,
      name: this.name,
    };
  }
}
