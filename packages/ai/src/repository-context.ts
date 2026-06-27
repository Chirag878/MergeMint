export type RepositoryContext = {
  repository: string;
  defaultBranch?: string | null;
  analyzedCommitSha?: string | null;
  analyzedAt?: string | null;
  summary?: string | null;
  techStack?: string[];
  appStructure?: unknown;
  importantFiles?: Array<{
    path: string;
    summary?: string;
    signals?: string[];
  }>;
  routes?: string[];
  apiEndpoints?: string[];
  databaseModels?: string[];
  authSummary?: string | null;
  testingSummary?: string | null;
  deploymentSummary?: string | null;
  riskAreas?: string[];
  suggestedFeatureAreas?: string[];
};

