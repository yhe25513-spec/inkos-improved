// ── Humanity Module 入口 ─────────────────────────────────
// 真人感系统核心模块

// 数据结构
export type {
  HumanityProfile,
  HumanityFingerprint,
  StyleInjection,
  BreathingPoint,
  BreathingType,
  WritingContext,
} from "../models/humanity-profile.js";

export {
  createDefaultHumanityProfile,
  deriveStyleInjectionFromFingerprint,
  DEFAULT_HUMANITY_FINGERPRINT,
  DEFAULT_STYLE_INJECTION,
} from "../models/humanity-profile.js";

// 核心引擎
export { HumanityEngine } from "./humanity-engine.js";
export type { HumanityEngineConfig, InitializeOptions } from "./humanity-engine.js";

// 子模块
export { SampleAnalyzer } from "./sample-analyzer.js";
export { SceneBreaker } from "./scene-breaker.js";
export type { SceneInfo, ChapterOutline } from "./scene-breaker.js";
export { SilenceLayerInjector } from "./silence-layer.js";
export { SelfContradictionGenerator } from "./self-contradiction.js";
export type { ContradictionType } from "./self-contradiction.js";

// 模板
export {
  BREATHING_TEMPLATES,
  SILENCE_REPLACEMENTS,
  SELF_CONTRADICTION_TEMPLATES,
  getRandomTemplate,
  getRandomBreathingText,
  getRandomSilenceReplacement,
  generateSelfContradiction,
} from "./templates.js";
