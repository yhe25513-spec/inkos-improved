/**
 * Agnes (Sapiens AI)
 *
 * - 官网：https://agnes-ai.com/
 * - API 文档：https://apihub.agnes-ai.com/
 * - API Base：https://apihub.agnes-ai.com/v1
 *
 * Agnes 提供 OpenAI 兼容的 Chat Completions API，支持流式响应、
 * 工具调用、推理/思考模式。主要写作模型：agnes-2.0-flash
 */
import type { InkosEndpoint } from "../types.js";

export const AGNES: InkosEndpoint = {
  id: "agnes",
  label: "Agnes (Sapiens AI)",
  group: "aggregator",
  api: "openai-completions",
  baseUrl: "https://apihub.agnes-ai.com/v1",
  checkModel: "agnes-2.0-flash",
  temperatureRange: [0, 2],
  defaultTemperature: 0.7,
  writingTemperature: 0.9,
  models: [
    {
      id: "agnes-2.0-flash",
      maxOutput: 65_536,
      contextWindowTokens: 256_000,
      enabled: true,
      capabilities: { text: true, imageInput: true, tools: true, reasoning: true },
    },
  ],
};
