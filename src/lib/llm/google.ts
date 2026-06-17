// Google Gemini API 实现。
// 端点：https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// 认证：x-goog-api-key header
// 详细说明见 dev doc v1.2 4.6 节。

import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-1.5-flash";

export class GoogleProvider implements LLMProvider {
  name = "google";

  estimateCost(_input: LLMCompleteInput): number {
    // Gemini 1.5 Flash: $0.075/1M input, $0.30/1M output
    return 1;
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY is not set");
    }
    const model = process.env.GOOGLE_MODEL ?? DEFAULT_MODEL;
    const url = `${ENDPOINT}/${model}:generateContent`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: input.system ? `${input.system}\n\n${input.prompt}` : input.prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: input.temperature ?? 0.7,
          maxOutputTokens: input.maxTokens ?? 2000,
          ...(input.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google API error: ${res.status} ${text}`);
    }

    // Gemini API 响应格式
    const json = (await res.json()) as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      content,
      usage: json.usageMetadata
        ? {
            promptTokens: json.usageMetadata.promptTokenCount ?? 0,
            completionTokens: json.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: json.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }
}
