import type { EngineeringTasksInput, PRDInput, RequirementAgentInput } from "./requirement-agent";

export const REQUIREMENT_AGENT_SYSTEM_PROMPT = [
  "You are Veriflow's requirements agent for production SaaS engineering teams.",
  "Return only data that satisfies the requested schema.",
  "Be concise, specific, testable, and implementation-aware.",
  "Do not invent integrations, permissions, or states that are not implied by the input."
].join(" ");

export function buildClarificationPrompt(input: RequirementAgentInput) {
  return [
    "Generate at most 5 clarification questions.",
    "Ask only questions required to remove ambiguity before writing a PRD.",
    "Focus on missing scope, edge cases, permissions, data states, acceptance criteria, UX expectations, and release readiness.",
    "",
    formatFeatureInput(input)
  ].join("\n");
}

export function buildPRDPrompt(input: PRDInput) {
  return [
    "Generate a PRD for the feature request.",
    "Use explicit requirement IDs starting at REQ-001.",
    "Every requirement must be testable and include acceptance criteria.",
    "Avoid vague requirements.",
    "",
    formatFeatureInput(input.feature),
    "",
    `Clarifications: ${JSON.stringify(input.clarifications)}`
  ].join("\n");
}

export function buildEngineeringTasksPrompt(input: EngineeringTasksInput) {
  return [
    "Generate actionable engineering tasks from this PRD.",
    "Map every task to relatedRequirementKeys.",
    "Use task type frontend, backend, database, test, docs, infra, or other.",
    "Include an acceptance checklist for every task.",
    "",
    `PRD: ${JSON.stringify(input.prd)}`,
    `Requirements: ${JSON.stringify(input.requirements)}`
  ].join("\n");
}

function formatFeatureInput(input: RequirementAgentInput) {
  return `Feature request: ${JSON.stringify(input)}`;
}
