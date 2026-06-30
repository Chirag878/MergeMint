import type { RepositoryAnalysisInput } from "./repository-analysis-agent";
import type { EngineeringTasksInput, PRDInput, RequirementAgentInput } from "./requirement-agent";
import type { QAReviewInput } from "./qa-review-agent";

export const REQUIREMENT_AGENT_SYSTEM_PROMPT = [
  "You are MergeMint's requirements agent for production SaaS engineering teams.",
  "Your job is to turn client feature requests into release-verifiable delivery artifacts for agencies, freelancers, AI automation studios, and founders working with outsourced developers.",
  "Return only data that satisfies the requested schema.",
  "For nullable schema fields, return null instead of omitting the field.",
  "For empty array schema fields, return [] instead of omitting the field.",
  "Be specific, testable, implementation-aware, and production-minded.",
  "Optimize every artifact for later verification against a GitHub pull request diff.",
  "Do not invent unrelated integrations, permissions, personas, data objects, or states that are not implied by the input.",
  "Do not use vague wording such as seamless, robust, intuitive, user-friendly, or scalable unless paired with observable behavior.",
  "Avoid duplicate requirements, overlapping REQ IDs, and acceptance criteria that cannot be tested."
].join(" ");

export function buildClarificationPrompt(input: RequirementAgentInput) {
  return [
    "Analyze the feature request and repository context carefully.",
    "If the feature request brief and repository context provide sufficient detail to write an unambiguous PRD, return an empty array [] of questions.",
    "Otherwise, generate 1 to 6 clarification questions for this exact feature request for missing critical information.",
    "Do not ask duplicate questions if the feature request or repository context already provides that information.",
    "Questions must be specific to the feature, answerable by a client/product owner, and useful for writing REQ IDs and acceptance criteria.",
    "Every question must help later PR verification against a GitHub diff.",
    "Use priority must_answer only when the PRD would be materially unsafe or ambiguous without the answer.",
    "Use priority nice_to_have for useful context that should not block PRD generation.",
    "Every question must include a clear reason that names the ambiguity it removes.",
    "Prefer these categories when relevant: scope boundaries, user roles and permissions, required workflow, expected behavior, edge cases, validation rules, data states, integrations or dependencies, release-blocking conditions, and client approval expectations.",
    "Do not ask generic checklist questions, do not ask about unrelated UI details, and do not repeat information already present in the request.",
    "Do not mention border radius, roles, integrations, billing, notifications, or approvals unless the feature request implies them.",
    "",
    formatFeatureInput(input),
    formatRepositoryContext(input.repositoryContext)
  ].join("\n");
}

export function buildPRDPrompt(input: PRDInput) {
  return [
    "Generate an implementation-ready PRD for the feature request.",
    "The PRD must feel useful to a real agency/client delivery team and clear enough for an outsourced developer to implement.",
    "Include a concrete problem statement, business goal, target users through userStories, in-scope behavior, out-of-scope behavior, user workflow, functional requirements, non-functional requirements when relevant, edge cases, release readiness criteria, assumptions, dependencies, and risks.",
    "Use existing schema fields to represent this content: goals for business goals and in-scope behavior; nonGoals for out-of-scope behavior, assumptions, and dependencies; userStories for target users and workflow; requirements for functional/non-functional/release-readiness requirements; edgeCases for edge cases; risks for delivery/release risks.",
    "Expand the raw request into concrete product behavior; do not simply copy the acceptance criteria.",
    "Use explicit requirement IDs starting at REQ-001 and increment sequentially.",
    "Each requirement must be a full sentence starting with exactly: The system must",
    "Each requirement must be atomic, concrete, testable, and include at least 2 acceptance criteria.",
    "Acceptance criteria must be observable from UI behavior, API behavior, persisted data, validation errors, authorization checks, or generated artifacts.",
    "Include permissions/security requirements when relevant.",
    "Include edge cases, failure states, data/state requirements, release readiness, sharing/access control, audit, and reporting requirements when relevant.",
    "Avoid vague requirements such as useful, seamless, robust, intuitive, scalable, or user-friendly unless backed by testable behavior.",
    "Avoid overengineering simple features. If a feature is small, still make the requirements verifiable without inventing unrelated systems.",
    "Prefer 5-9 requirements for a production SaaS feature unless the scope is genuinely smaller.",
    "Do not generate duplicate or overlapping REQ IDs. Do not skip numbers.",
    "",
    formatFeatureInput(input.feature),
    "",
    `Clarifications: ${JSON.stringify(input.clarifications)}`,
    formatRepositoryContext(input.repositoryContext)
  ].join("\n");
}

export function buildEngineeringTasksPrompt(input: EngineeringTasksInput) {
  return [
    "Generate actionable engineering tasks from this PRD.",
    "Do not create generic tasks like Implement REQ-001.",
    "Each task needs a meaningful engineering title, specific implementation details, and verification steps.",
    "Map every task to one or more relatedRequirementKeys.",
    "Map each task to related acceptance criteria by quoting or naming the acceptance criteria it helps satisfy.",
    "Avoid duplicate tasks and weak one-to-one copies of requirements.",
    "Use task type frontend, backend, auth, database, integration, test, docs, qa, devops, infra, or other.",
    "Set priority to must_have, should_have, or nice_to_have.",
    "Set riskLevel to low, medium, or high based on release risk and implementation uncertainty.",
    "Include suggestedFiles and suggestedModules when repository context gives enough evidence. Leave arrays empty instead of inventing paths.",
    "Put likely implementation area, constraints, and developer handoff details in implementationNotes.",
    "Put how to verify the task in verificationNotes.",
    "Include at least one test task.",
    "Separate frontend, backend/API, validation, persistence, integration, and testing tasks when those concerns are present.",
    "Mention likely files, modules, routes, services, components, or test targets when the PRD implies them, but do not invent a repository structure if none is implied.",
    "When repository context is provided, use it to name likely areas/modules and suggested files in the task description and checklist.",
    "Use the nearest supported task type for repo-aware work: frontend, backend, database, test, docs, infra, or other.",
    "Include backend, frontend, database, security, reporting, or docs tasks when relevant to the requirements.",
    "Include an acceptance checklist with at least 2 concrete checks for every task.",
    "Acceptance checklist items must be verifiable through tests, UI behavior, API responses, persisted state, or release artifacts.",
    "Prefer 5-10 tasks that a developer could pick up directly.",
    "",
    `PRD: ${JSON.stringify(input.prd)}`,
    `Requirements: ${JSON.stringify(input.requirements)}`,
    formatRepositoryContext(input.repositoryContext)
  ].join("\n");
}

function formatFeatureInput(input: RequirementAgentInput) {
  return `Feature request: ${JSON.stringify(input)}`;
}

function formatRepositoryContext(context: RequirementAgentInput["repositoryContext"]) {
  if (!context) {
    return "Repository context: not available. Do not invent repository structure.";
  }

  return [
    "Repository context summary only. Use this to improve specificity, but do not expose raw source content:",
    JSON.stringify(context)
  ].join("\n");
}

export function buildQAReviewPrompt(input: QAReviewInput) {
  return [
    "Review this GitHub pull request snapshot against the PRD requirements.",
    "Focus only on requirement satisfaction, release risk, security/access-control gaps, edge cases, and test evidence.",
    "Do not evaluate generic code style unless it creates requirement or release risk.",
    "For every requirement key provided, produce exactly one coverage item.",
    "Also produce taskCoverage for each engineering task. Compare changed files and diff evidence against task descriptions, suggested files, suggested modules, and acceptance checklists.",
    "Task coverage status must be implemented, partially_implemented, missing, or unclear.",
    "Coverage status must be covered, partially_covered, missing, or risky.",
    "If the diff does not prove coverage, mark partially_covered, missing, or risky and explain why.",
    "Create findings for missing, risky, or partially covered requirements.",
    "Findings should reference requirementKey when possible.",
    "Use null for concern, requirementKey, file, line, or suggestedFix when there is no truthful value.",
    "Do not invent files or line numbers unless visible in changed files or diff evidence.",
    "Treat missing tests as test_gap when the requirement needs verification.",
    "Treat missing access-control/security behavior as security_risk when relevant.",
    "Treat missing edge-case handling as edge_case_gap when relevant.",
    "Evaluate every enabled project verification rule when verificationRules are provided.",
    "For each verification rule, return ruleId, title, status, severity, evidence, and suggestedFix.",
    "Use failed for unmet blocking rules, warning for unmet warning/info rules, passed for satisfied rules, and not_applicable when the PR is outside the rule scope.",
    "Be strict. Do not approve just because a PR exists.",
    "",
    `Feature request: ${JSON.stringify(input.featureRequest)}`,
    `PRD: ${JSON.stringify(input.prd)}`,
    `Requirements: ${JSON.stringify(input.requirements)}`,
    `Engineering tasks: ${JSON.stringify(input.engineeringTasks)}`,
    `Verification rules: ${JSON.stringify(input.verificationRules ?? [])}`,
    `Pull request: ${JSON.stringify(input.pullRequest)}`,
    `Changed files: ${JSON.stringify(input.changedFiles)}`,
    formatRepositoryContext(input.repositoryContext),
    `Diff truncated: ${input.diffTruncated ? "yes" : "no"}`,
    `Diff text:\n${input.diffText}`
  ].join("\n");
}

export function buildRepositoryIntelligencePrompt(input: RepositoryAnalysisInput) {
  return [
    "Analyze this GitHub repository snapshot for MergeMint.",
    "Return only safe architecture and implementation context. Do not include secrets, raw file contents, private keys, env values, or long code snippets.",
    "Infer the tech stack, app type, package manager, monorepo structure, major apps/packages, routes, API endpoints, database/schema layer, auth/session layer, testing/build setup, deployment hints, risk areas, likely future change areas, and an overall summary.",
    "Base conclusions only on the file index and compact snippets provided.",
    "",
    `Repository metadata: ${JSON.stringify(input.repository)}`,
    `File index: ${JSON.stringify(input.fileIndex)}`,
    `Safe file snippets: ${JSON.stringify(input.files)}`
  ].join("\n");
}
