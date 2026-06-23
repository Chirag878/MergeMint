export type JsonObject = Record<string, unknown>;
export type StringList = string[];

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
};

export type ChangedFile = {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
};

export type GitHubCommitSnapshot = {
  sha: string;
  message?: string;
  authorName?: string;
  authorEmail?: string;
  authoredAt?: string;
};

export type GitHubCheckSnapshot = {
  name: string;
  status?: string;
  conclusion?: string;
  url?: string;
  completedAt?: string;
};

export type RequirementEvidence = {
  summary?: string;
  files?: string[];
  checks?: string[];
  notes?: string[];
};
