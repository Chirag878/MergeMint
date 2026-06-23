import OpenAI from "openai";
import { getAIEnv } from "@veriflow/env";

let openAIClient: OpenAI | null = null;

export function getAIConfig() {
  return getAIEnv();
}

export function shouldUseMockAI() {
  const config = getAIConfig();

  return (
    config.AI_MOCK_MODE ||
    (!config.OPENAI_API_KEY && process.env.NODE_ENV !== "production")
  );
}

export function getOpenAIClient() {
  const config = getAIConfig();

  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when AI_MOCK_MODE is false.");
  }

  openAIClient ??= new OpenAI({
    apiKey: config.OPENAI_API_KEY
  });

  return openAIClient;
}
