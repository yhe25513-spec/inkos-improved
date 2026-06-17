// ── 情感深度增强模块 ──────────────────────────────────

export type {
  EmotionType,
  EmotionalChapter,
  EmotionalArc,
  StoryStructure,
  EmotionEnhanceResult,
  NaturalnessResult,
} from "./types.js";

export { EmotionAnalyzer } from "./emotion-analyzer.js";
export { ArcPlanner } from "./arc-planner.js";
export { EmotionInjector } from "./injector.js";
export { NaturalnessTester } from "./naturalness-tester.js";
