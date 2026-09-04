import type {
  AnalyticsSnapshot,
  AskIntelligenceAnswer,
  GeminiIntelligence,
} from "../contracts/intelligence.schemas";

export interface GeminiOperationsAdapter {
  interpret(snapshot: AnalyticsSnapshot): Promise<GeminiIntelligence>;
  answer(question: string, snapshot: AnalyticsSnapshot): Promise<AskIntelligenceAnswer>;
}
