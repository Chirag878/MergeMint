import type { EngineeringTasksInput, PRDInput, RequirementAgentInput } from "./requirement-agent";
import type { QAReviewInput } from "./qa-review-agent";

export const REQUIREMENT_AGENT_SYSTEM_PROMPT = [
  "You are Veriflow's requirements agent for production SaaS engineering teams.",
  "Return only data that satisfies the requested schema.",
  "Be specific, testable, implementation-aware, and production-minded.",
  "Do not invent integrations, permissions, or states that are not implied by the input."
].join(" ");

export function buildClarificationPrompt(input: RequirementAgentInput) {
  return [
    "Generate at most 5 clarification questions.",
    "Ask only questions required to remove ambiguity before writing a PRD.",
    "Use priority must_answer for blockers and nice_to_have for helpful but non-blocking details.",
    "Focus on missing scope, edge cases, permissions, data states, acceptance criteria, UX expectations, and release readiness.",
    "",
    formatFeatureInput(input)
  ].join("\n");
}

export function buildPRDPrompt(input: PRDInput) {
  return [
    "Generate an implementation-ready PRD for the feature request.",
    "Expand the raw request into concrete product behavior; do not simply copy the acceptance criteria.",
    "Use explicit requirement IDs starting at REQ-001 and increment sequentially.",
    "Each requirement must be a full sentence starting with exactly: The system must",
    "Each requirement must be concrete, testable, and include at least 2 acceptance criteria.",
    "Include permissions/security requirements when relevant.",
    "Include edge cases, failure states, data/state requirements, release readiness, sharing/access control, audit, and reporting requirements when relevant.",
    "Avoid vague requirements such as useful, seamless, robust, intuitive, scalable, or user-friendly unless backed by testable behavior.",
    "Prefer 5-9 requirements for a production SaaS feature unless the scope is genuinely smaller.",
    "",
    formatFeatureInput(input.feature),
    "",
    `Clarifications: ${JSON.stringify(input.clarifications)}`
  ].join("\n");
}

export function buildEngineeringTasksPrompt(input: EngineeringTasksInput) {
  return [
    "Generate actionable engineering tasks from this PRD.",
    "Do not create generic tasks like Implement REQ-001.",
    "Each task needs a meaningful engineering title and specific implementation details.",
    "Map every task to one or more relatedRequirementKeys.",
    "Avoid duplicate tasks and weak one-to-one copies of requirements.",
    "Use task type frontend, backend, database, test, docs, infra, or other.",
    "Include at least one test task.",
    "Include backend, frontend, database, security, reporting, or docs tasks when relevant to the requirements.",
    "Include an acceptance checklist with at least 2 concrete checks for every task.",
    "Prefer 5-10 tasks that a developer could pick up directly.",
    "",
    `PRD: ${JSON.stringify(input.prd)}`,
    `Requirements: ${JSON.stringify(input.requirements)}`
  ].join("\n");
}

function formatFeatureInput(input: RequirementAgentInput) {
  return `Feature request: ${JSON.stringify(input)}`;
}

export function buildQAReviewPrompt(input: QAReviewInput) {
  return [
    "Review this GitHub pull request snapshot against the PRD requirements.",
    "Focus only on requirement satisfaction, release risk, security/access-control gaps, edge cases, and test evidence.",
    "Do not evaluate generic code style unless it creates requirement or release risk.",
    "For every requirement key provided, produce exactly one coverage item.",
    "Coverage status must be covered, partially_covered, missing, or risky.",
    "If the diff does not prove coverage, mark partially_covered, missing, or risky and explain why.",
    "Create findings for missing, risky, or partially covered requirements.",
    "Findings should reference requirementKey when possible.",
    "Do not invent files or line numbers unless visible in changed files or diff evidence.",
    "Treat missing tests as test_gap when the requirement needs verification.",
    "Treat missing access-control/security behavior as security_risk when relevant.",
    "Treat missing edge-case handling as edge_case_gap when relevant.",
    "Be strict. Do not approve just because a PR exists.",
    "",
    `Feature request: ${JSON.stringify(input.featureRequest)}`,
    `PRD: ${JSON.stringify(input.prd)}`,
    `Requirements: ${JSON.stringify(input.requirements)}`,
    `Engineering tasks: ${JSON.stringify(input.engineeringTasks)}`,
    `Pull request: ${JSON.stringify(input.pullRequest)}`,
    `Changed files: ${JSON.stringify(input.changedFiles)}`,
    `Diff truncated: ${input.diffTruncated ? "yes" : "no"}`,
    `Diff text:\n${input.diffText}`
  ].join("\n");
}
