import { zodResponseFormat } from "openai/helpers/zod";
import { getAIConfig, getOpenAIClient, shouldUseMockAI } from "./client";
import {
  RepositoryIntelligenceOutputSchema,
  type RepositoryIntelligenceOutput
} from "./schemas";
import { buildRepositoryIntelligencePrompt, REQUIREMENT_AGENT_SYSTEM_PROMPT } from "./prompts";
import type { AITokenUsage, AIResult } from "./requirement-agent";

export type RepositoryAnalysisInput = {
  repository: {
    fullName: string;
    owner: string;
    name: string;
    defaultBranch?: string | null;
    analyzedCommitSha?: string | null;
  };
  fileIndex: Array<{
    path: string;
    size?: number;
    category?: string;
  }>;
  files: Array<{
    path: string;
    size?: number;
    snippet: string;
  }>;
};

export async function generateRepositoryIntelligence(
  input: RepositoryAnalysisInput
): Promise<AIResult<RepositoryIntelligenceOutput>> {
  if (shouldUseMockAI()) {
    return {
      data: RepositoryIntelligenceOutputSchema.parse(fallbackRepositoryAnalysis(input)),
      model: "mock",
      mock: true
    };
  }

  const config = getAIConfig();
  const client = getOpenAIClient();
  const completion = await client.chat.completions.parse({
    model: config.OPENAI_MODEL ?? "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: REQUIREMENT_AGENT_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: buildRepositoryIntelligencePrompt(input)
      }
    ],
    response_format: zodResponseFormat(
      RepositoryIntelligenceOutputSchema,
      "repository_intelligence"
    )
  });
  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error("OpenAI returned no repository intelligence output.");
  }

  return {
    data: RepositoryIntelligenceOutputSchema.parse(parsed),
    model: config.OPENAI_MODEL ?? "gpt-4.1-mini",
    tokenUsage: toTokenUsage(completion.usage),
    mock: false
  };
}

function fallbackRepositoryAnalysis(
  input: RepositoryAnalysisInput
): RepositoryIntelligenceOutput {
  const paths = input.fileIndex.map((file) => file.path);
  const packageJson = input.files.find((file) => file.path.endsWith("package.json"));
  const packageManager = paths.includes("pnpm-workspace.yaml")
    ? "pnpm"
    : paths.some((path) => path.endsWith("yarn.lock"))
      ? "yarn"
      : paths.some((path) => path.endsWith("package-lock.json"))
        ? "npm"
        : null;
  const techStack = inferTechStack(paths, packageJson?.snippet);
  const majorApps = topLevelChildren(paths, "apps/");
  const majorPackages = topLevelChildren(paths, "packages/");
  const keyDirectories = unique(
    paths
      .map((path) => path.split("/").slice(0, 2).join("/"))
      .filter((path) => path && !path.includes("."))
  ).slice(0, 20);
  const routes = paths
    .filter((path) => /(^|\/)(app|pages)\/.*(page|route|api)\.(t|j)sx?$/.test(path))
    .slice(0, 30);
  const apiEndpoints = paths
    .filter((path) => path.includes("/api/") || path.endsWith(".router.ts"))
    .slice(0, 30);
  const databaseModels = paths
    .filter((path) =>
      /schema|drizzle|prisma|migration|model/i.test(path)
    )
    .slice(0, 30);

  return {
    techStack,
    packageManager,
    appType: techStack.includes("Next.js") ? "Next.js application" : "Web application",
    monorepo: majorApps.length > 0 || majorPackages.length > 0,
    appStructure: {
      workspaceType: paths.includes("pnpm-workspace.yaml") ? "pnpm workspace" : null,
      majorApps,
      majorPackages,
      keyDirectories
    },
    importantFiles: input.files.slice(0, 20).map((file) => ({
      path: file.path,
      summary: summarizeFile(file.path),
      signals: signalsForPath(file.path)
    })),
    routes,
    apiEndpoints,
    databaseModels,
    authSummary: paths.some((path) => /auth|session/i.test(path))
      ? "Repository includes auth or session-related files."
      : null,
    testingSummary: paths.some((path) => /test|spec|vitest|playwright|jest/i.test(path))
      ? "Repository includes test files or test configuration."
      : null,
    deploymentSummary: paths.some((path) => /vercel|docker|workflow|deploy/i.test(path))
      ? "Repository includes deployment or CI configuration."
      : null,
    riskAreas: [
      ...databaseModels.slice(0, 4).map((path) => `Database/schema changes near ${path}`),
      ...apiEndpoints.slice(0, 4).map((path) => `API behavior near ${path}`)
    ].slice(0, 10),
    suggestedFeatureAreas: unique([...routes, ...apiEndpoints, ...databaseModels]).slice(
      0,
      20
    ),
    likelyChangeAreas: unique([...routes, ...apiEndpoints, ...databaseModels]).slice(
      0,
      20
    ),
    summary: `${input.repository.fullName} appears to be a ${techStack.join(", ") || "software"} repository with ${paths.length} indexed files.`
  };
}

function inferTechStack(paths: string[], packageJson?: string) {
  const haystack = `${paths.join("\n")}\n${packageJson ?? ""}`.toLowerCase();
  const stack: string[] = [];

  if (haystack.includes("next")) stack.push("Next.js");
  if (haystack.includes("react")) stack.push("React");
  if (haystack.includes("trpc")) stack.push("tRPC");
  if (haystack.includes("drizzle")) stack.push("Drizzle ORM");
  if (haystack.includes("prisma")) stack.push("Prisma");
  if (haystack.includes("postgres")) stack.push("PostgreSQL");
  if (haystack.includes("tailwind")) stack.push("Tailwind CSS");
  if (haystack.includes("typescript") || paths.some((path) => path.endsWith(".ts"))) {
    stack.push("TypeScript");
  }

  return unique(stack).slice(0, 16);
}

function topLevelChildren(paths: string[], prefix: string) {
  return unique(
    paths
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length).split("/")[0])
      .filter(Boolean)
  ).slice(0, 12);
}

function summarizeFile(path: string) {
  if (path.endsWith("package.json")) return "Package manifest and script/dependency signals.";
  if (/schema|drizzle|prisma/i.test(path)) return "Database schema or migration signal.";
  if (/auth|session/i.test(path)) return "Authentication or session signal.";
  if (/route|router|api/i.test(path)) return "Route or API behavior signal.";
  if (/test|spec|vitest|jest|playwright/i.test(path)) return "Testing signal.";
  return "Important project structure signal.";
}

function signalsForPath(path: string) {
  return [
    /package\.json$/.test(path) ? "dependencies" : null,
    /schema|drizzle|prisma/i.test(path) ? "database" : null,
    /auth|session/i.test(path) ? "auth" : null,
    /route|router|api/i.test(path) ? "api" : null,
    /test|spec|vitest|jest|playwright/i.test(path) ? "testing" : null
  ].filter((value): value is string => Boolean(value));
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function toTokenUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | null
    | undefined
): AITokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens
  };
}

