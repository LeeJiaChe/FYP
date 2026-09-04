import "server-only";

import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import { z } from "zod";

import type { GeminiOperationsAdapter } from "../application/gemini-adapter";
import {
  askIntelligenceAnswerSchema,
  geminiIntelligenceSchema,
  type AnalyticsSnapshot,
} from "../contracts/intelligence.schemas";
import { buildGeminiContext } from "../domain/gemini-grounding";
import {
  analyticsToolDeclarations,
  APPROVED_ANALYTICS_TOOL_NAMES,
  executeReadOnlyAnalyticsTool,
} from "../domain/read-only-tools";

const SYSTEM_INSTRUCTION = `You are a read-only operations interpretation layer for a university shuttle prototype.
Authoritative metrics and signal severity are supplied by the application. Never calculate or invent a KPI, causal claim, passenger fact, or operational action. Copy signal IDs, severity, category, confidence and evidence keys exactly. Use cautious wording such as consistent with, suggests, or warrants review. Recommendations cannot exceed the level encoded in the signal. Never request or reveal passenger identity. Do not output Markdown or HTML.`;

function parsedJson(text: string | undefined) {
  if (!text) throw new Error("Gemini returned no structured content");
  return JSON.parse(text) as unknown;
}

export class GoogleGeminiOperationsAdapter implements GeminiOperationsAdapter {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly timeoutMs = 7_000,
  ) {
    this.client = new GoogleGenAI({ apiKey, apiVersion: "v1" });
  }

  async interpret(snapshot: AnalyticsSnapshot) {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: JSON.stringify({
        task: "Explain and prioritise up to five supplied deterministic signals.",
        context: buildGeminiContext(snapshot),
      }),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 1_800,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(geminiIntelligenceSchema),
        httpOptions: { timeout: this.timeoutMs },
      },
    });
    return geminiIntelligenceSchema.parse(parsedJson(response.text));
  }

  async answer(question: string, snapshot: AnalyticsSnapshot) {
    const chat = this.client.chats.create({
      model: this.model,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 1_500,
        httpOptions: { timeout: this.timeoutMs },
        tools: [
          {
            functionDeclarations:
              [...analyticsToolDeclarations] as FunctionDeclaration[],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [...APPROVED_ANALYTICS_TOOL_NAMES],
          },
        },
      },
    });
    const toolRequest = await chat.sendMessage({
      message: JSON.stringify({
        question,
        availableScope: {
          period: snapshot.period,
          lineIds: snapshot.serviceLines.map((line) => line.lineId),
          signalIds: snapshot.signals.map((signal) => signal.id),
        },
      }),
    });
    const calls = toolRequest.functionCalls ?? [];
    if (calls.length === 0) throw new Error("Gemini did not request analytics evidence");
    const toolResults: Part[] = calls.map((call) => ({
      functionResponse: {
        id: call.id,
        name: call.name,
        response: {
          output: executeReadOnlyAnalyticsTool(
            snapshot,
            call.name ?? "",
            call.args,
          ),
        },
      },
    }));
    const response = await chat.sendMessage({
      message: toolResults,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 1_500,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(askIntelligenceAnswerSchema),
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.NONE },
        },
        httpOptions: { timeout: this.timeoutMs },
      },
    });
    return askIntelligenceAnswerSchema.parse(parsedJson(response.text));
  }
}
