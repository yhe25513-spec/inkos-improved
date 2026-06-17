import { InkOSError } from "./base.js";

// === LLM 连接错误 ===

export class LLMConnectionError extends InkOSError {
  readonly code = "LLM_CONNECTION";
  readonly exitCode = 2;

  constructor(params: { readonly baseUrl?: string; readonly detail?: string; readonly cause?: unknown }) {
    const ctx = params.baseUrl ? ` (${params.baseUrl})` : "";
    const detail = params.detail ? `: ${params.detail}` : "";
    super({
      message: `无法连接到 API 服务${ctx}${detail}`,
      code: "LLM_CONNECTION",
      exitCode: 2,
      hint: "检查 .env 中的 INKOS_LLM_BASE_URL 是否正确，以及网络连接是否正常",
      cause: params.cause,
    });
  }
}

// === LLM 认证错误 ===

export class LLMAuthError extends InkOSError {
  readonly code = "LLM_AUTH";
  readonly exitCode = 2;

  constructor(params: { readonly detail?: string; readonly cause?: unknown }) {
    super({
      message: `API 认证失败${params.detail ? `: ${params.detail}` : ""}`,
      code: "LLM_AUTH",
      exitCode: 2,
      hint: "检查 .env 中的 INKOS_LLM_API_KEY 是否正确，或运行 inkos doctor 测试连通性",
      cause: params.cause,
    });
  }
}

// === LLM 请求被拒绝 (403) ===

export class LLMForbiddenError extends InkOSError {
  readonly code = "LLM_FORBIDDEN";
  readonly exitCode = 2;

  constructor(params: { readonly detail?: string; readonly cause?: unknown }) {
    super({
      message: `API 请求被拒绝 (403)${params.detail ? `: ${params.detail}` : ""}`,
      code: "LLM_FORBIDDEN",
      exitCode: 2,
      hint: "可能是 API Key 无效、账户余额不足，或内容审查拦截。尝试运行 inkos doctor 检查",
      cause: params.cause,
    });
  }
}

// === LLM 频率限制 ===

export class LLMRateLimitError extends InkOSError {
  readonly code = "LLM_RATE_LIMIT";
  readonly exitCode = 2;

  constructor(params: { readonly retryAfter?: number; readonly cause?: unknown }) {
    const retryMsg = params.retryAfter ? `，${params.retryAfter}s 后可重试` : "";
    super({
      message: `API 请求过多 (429)${retryMsg}`,
      code: "LLM_RATE_LIMIT",
      exitCode: 2,
      hint: "稍后重试，或检查 API 配额。可考虑降低并发或使用其他 API 提供方",
      cause: params.cause,
    });
  }
}

// === LLM 请求参数错误 (400) ===

export class LLMBadRequestError extends InkOSError {
  readonly code = "LLM_BAD_REQUEST";
  readonly exitCode = 2;

  constructor(params: { readonly upstreamDetail?: string; readonly cause?: unknown }) {
    const detail = params.upstreamDetail ? `\n上游详情: ${params.upstreamDetail}` : "";
    super({
      message: `API 返回 400 (请求参数错误)${detail}`,
      code: "LLM_BAD_REQUEST",
      exitCode: 2,
      hint: "常见原因: temperature/max_tokens 超出模型约束、模型名称不正确、消息格式不兼容",
      cause: params.cause,
    });
  }
}

// === LLM 上游服务异常 (5xx) ===

export class LLMUpstreamError extends InkOSError {
  readonly code = "LLM_UPSTREAM";
  readonly exitCode = 2;

  constructor(params: { readonly status?: number; readonly upstreamDetail?: string; readonly cause?: unknown }) {
    const status = params.status ? ` (${params.status})` : "";
    const detail = params.upstreamDetail ? `\n上游详情: ${params.upstreamDetail}` : "";
    super({
      message: `API 上游服务异常${status}${detail}`,
      code: "LLM_UPSTREAM",
      exitCode: 2,
      hint: "服务端临时故障，请稍后重试。如果持续出现，检查模型是否已上架",
      cause: params.cause,
    });
  }
}

// === LLM 上下文窗口溢出 ===

export class LLMContextWindowError extends InkOSError {
  readonly code = "LLM_CONTEXT_WINDOW";
  readonly exitCode = 2;

  readonly estimatedInputTokens: number;
  readonly reservedOutputTokens: number;
  readonly contextWindow: number;
  readonly model: string;

  constructor(params: {
    readonly estimatedInputTokens: number;
    readonly reservedOutputTokens: number;
    readonly contextWindow: number;
    readonly model: string;
  }) {
    super({
      message:
        `上下文窗口溢出: 估算输入 ${params.estimatedInputTokens} tokens + ` +
        `预留输出 ${params.reservedOutputTokens} tokens 超过模型 "${params.model}" 的上下文窗口 ${params.contextWindow}`,
      code: "LLM_CONTEXT_WINDOW",
      exitCode: 2,
      hint: "压缩当前书籍/会话上下文，或使用支持更大上下文窗口的模型",
    });
    this.estimatedInputTokens = params.estimatedInputTokens;
    this.reservedOutputTokens = params.reservedOutputTokens;
    this.contextWindow = params.contextWindow;
    this.model = params.model;
  }
}

// === LLM 流式响应中断（部分可用） ===

export class LLMPartialResponseError extends InkOSError {
  readonly code = "LLM_PARTIAL_RESPONSE";
  readonly exitCode = 2;

  readonly partialContent: string;

  constructor(params: { readonly partialContent: string; readonly cause?: unknown }) {
    super({
      message: `流式响应中断，已收到 ${params.partialContent.length} 字符`,
      code: "LLM_PARTIAL_RESPONSE",
      exitCode: 2,
      hint: "网络不稳定导致流式响应中断。内容已部分保存，可尝试重新运行",
      cause: params.cause,
    });
    this.partialContent = params.partialContent;
  }
}

// === LLM 返回空内容 ===

export class LLMEmptyResponseError extends InkOSError {
  readonly code = "LLM_EMPTY_RESPONSE";
  readonly exitCode = 2;

  constructor(params: { readonly model?: string; readonly cause?: unknown }) {
    const modelInfo = params.model ? ` (模型: ${params.model})` : "";
    super({
      message: `LLM 返回空内容${modelInfo}`,
      code: "LLM_EMPTY_RESPONSE",
      exitCode: 2,
      hint: "模型可能不支持当前消息格式，或触发了内容过滤。尝试更换模型",
      cause: params.cause,
    });
  }
}
