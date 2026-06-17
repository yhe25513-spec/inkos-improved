// ── 去AI味模块 ────────────────────────────────────────

export { PerplexityAnalyzer, type PerplexityResult } from "./perplexity-analyzer.js";
export {
  SentenceReconstructor,
  type ReconstructStrategy,
  type ReconstructOptions,
} from "./sentence-reconstructor.js";
export {
  GenreAdapter,
  type GenreType,
  type GenreAdapterConfig,
} from "./genre-adapters.js";
export { BurstinessAdjuster } from "./burstiness-adjuster.js";
export { VocabularyEnhancer } from "./vocabulary-enhancer.js";
export { Humanizer } from "./humanizer.js";
