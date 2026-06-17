import { InkOSError } from "./base.js";

// === 项目未初始化 ===

export class ProjectNotInitializedError extends InkOSError {
  readonly code = "PROJECT_NOT_INIT";
  readonly exitCode = 4;

  constructor(params: { readonly dir: string }) {
    super({
      message: `未找到 inkos.json (在 ${params.dir})`,
      code: "PROJECT_NOT_INIT",
      exitCode: 4,
      hint: "运行 inkos init 初始化项目，或切换到已初始化的 InkOS 项目目录",
    });
  }
}

// === 无效配置 ===

export class InvalidConfigError extends InkOSError {
  readonly code = "INVALID_CONFIG";
  readonly exitCode = 4;

  constructor(params: { readonly file: string; readonly detail: string }) {
    super({
      message: `配置文件 "${params.file}" 格式错误: ${params.detail}`,
      code: "INVALID_CONFIG",
      exitCode: 4,
      hint: "检查配置文件语法是否正确，可参考 inkos init 生成的模板",
    });
  }
}

// === 缺少必要配置 ===

export class MissingConfigError extends InkOSError {
  readonly code = "MISSING_CONFIG";
  readonly exitCode = 4;

  constructor(params: { readonly key: string; readonly file?: string }) {
    const fileInfo = params.file ? ` (在 ${params.file})` : "";
    super({
      message: `缺少必要配置: ${params.key}${fileInfo}`,
      code: "MISSING_CONFIG",
      exitCode: 4,
      hint: `运行 inkos config set-global 设置全局配置，或编辑 .env 文件添加 ${params.key}`,
    });
  }
}

// === LLM 配置无效 ===

export class InvalidLLMConfigError extends InkOSError {
  readonly code = "INVALID_LLM_CONFIG";
  readonly exitCode = 4;

  constructor(params: { readonly detail: string }) {
    super({
      message: `LLM 配置无效: ${params.detail}`,
      code: "INVALID_LLM_CONFIG",
      exitCode: 4,
      hint: "运行 inkos config set-global 重新配置，或检查 inkos.json 中的 llm 字段",
    });
  }
}

// === 语言不支持 ===

export class UnsupportedLanguageError extends InkOSError {
  readonly code = "UNSUPPORTED_LANGUAGE";
  readonly exitCode = 4;

  constructor(params: { readonly language: string }) {
    super({
      message: `不支持的语言: "${params.language}"`,
      code: "UNSUPPORTED_LANGUAGE",
      exitCode: 4,
      hint: "支持的语言: zh (中文), en (英文)",
    });
  }
}

// === 平台不支持 ===

export class UnsupportedPlatformError extends InkOSError {
  readonly code = "UNSUPPORTED_PLATFORM";
  readonly exitCode = 4;

  constructor(params: { readonly platform: string }) {
    super({
      message: `不支持的发布平台: "${params.platform}"`,
      code: "UNSUPPORTED_PLATFORM",
      exitCode: 4,
      hint: "支持的平台: qidian, tomato, jjwxc, royalroad, amazon-kdp",
    });
  }
}
