import { notFound } from "next/navigation";
import {
  getReleaseReportByShareToken,
  type DeveloperFixReportData,
  type InternalReleaseReportData
} from "@veriflow/api";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PublicReleaseReportPage({
  params
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const report = await getReleaseReportByShareToken(shareToken);

  if (!report) {
    notFound();
  }

  const data = report.reportData;
  if (data.reportType === "developer_fix") {
    return <DeveloperFixReportPage data={data} />;
  }

  if (data.reportType === "internal_release") {
    return <InternalReleaseReportPage data={data} />;
  }

  const coverageSummary = getCoverageSummary(data.coverage, data.findings);
  const decisionBanner = getDecisionBanner(
    data.approval.decision,
    data.qaReview.overallStatus
  );
  const openFindings = data.findings.filter(
    (finding) => finding.status === "open"
  );

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-8 text-neutral-100 print:bg-white print:text-neutral-950 md:px-8">
      <article className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-2xl shadow-black/20 print:border-neutral-300 print:bg-white print:shadow-none md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-md border border-blue-800 bg-blue-950/50 text-sm font-semibold text-blue-200">
                  M
                </div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-300">
                  MergeMint
                </p>
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-5xl">
                Client Delivery Report
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400 md:text-base">
                A client-ready verification report showing requirement coverage,
                PR evidence, QA risks, and final approval decision.
              </p>
            </div>
            <div className="space-y-3 text-right">
              <PrintButton />
              <StatusPill status={data.reportStatus} />
              <p className="text-xs text-neutral-500">
                Generated {formatDate(data.generatedAt)}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Readiness" value={`${data.qaReview.readinessScore ?? 0}`} />
          <Metric label="Confidence" value={`${data.qaReview.confidenceScore ?? 0}`} />
          <Metric
            label="Final Decision"
            value={formatDecision(data.approval.decision)}
          />
          <Metric
            label="AI Verdict"
            value={formatLabel(data.qaReview.overallStatus)}
          />
        </section>

        <DecisionBanner banner={decisionBanner} />

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="Executive summary" title={data.feature.title} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm leading-6 text-neutral-300">
                {data.feature.summary}
              </p>
              {data.qaReview.summary ? (
                <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm leading-6 text-neutral-300">
                  {data.qaReview.summary}
                </p>
              ) : null}
              <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Coverage Summary
                </p>
                <p className="mt-2 text-sm text-neutral-200">
                  {coverageSummary.covered} covered | {coverageSummary.partial}{" "}
                  partial | {coverageSummary.missing} missing |{" "}
                  {coverageSummary.risky} risky | {coverageSummary.openFindings}{" "}
                  open finding{coverageSummary.openFindings === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Project" value={data.project.name} />
              <KeyValue label="Feature status" value={formatLabel(data.feature.status)} />
              <KeyValue label="PRD" value={data.prd.title} />
              <KeyValue label="Review version" value={`v${data.qaReview.reviewVersion}`} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="Pull request" title={data.pullRequest.title} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Repository" value={data.pullRequest.repository} />
              <KeyValue label="PR number" value={`#${data.pullRequest.number}`} />
              <KeyValue
                label="Branches"
                value={`${data.pullRequest.sourceBranch} -> ${data.pullRequest.targetBranch}`}
              />
              <KeyValue label="Author" value={data.pullRequest.author ?? "Unknown"} />
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="State" value={formatLabel(data.pullRequest.state)} />
              <KeyValue label="Merged" value={data.pullRequest.merged ? "Yes" : "No"} />
              <KeyValue
                label="Latest commit"
                value={shortSha(data.pullRequest.latestCommitSha)}
              />
              <a
                href={data.pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
              >
                Open GitHub PR
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading
            eyebrow="Requirement Coverage Evidence"
            title={`${data.coverage.length} requirements reviewed`}
          />
          <div className="mt-5 space-y-3">
            {data.requirements.map((requirement) => {
              const coverage = data.coverage.find(
                (item) => item.requirementKey === requirement.key
              );

              return (
                <article
                  key={requirement.key}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-blue-200">
                        {requirement.key}
                      </p>
                      <h3 className="mt-1 font-medium text-neutral-100">
                        {requirement.description}
                      </h3>
                    </div>
                    <StatusPill status={coverage?.status ?? "not_reviewed"} />
                  </div>
                  <StringList
                    title="Acceptance criteria"
                    items={requirement.acceptanceCriteria}
                  />
                  <EvidenceBlock evidence={coverage?.evidence} />
                  {coverage?.concern ? (
                    <p className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
                      Concern: {coverage.concern}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading
            eyebrow="Open Findings and Release Risks"
            title={
              openFindings.length > 0
                ? `${openFindings.length} open finding${openFindings.length === 1 ? "" : "s"}`
                : "No open findings recorded"
            }
          />
          {openFindings.length > 0 ? (
            <div className="mt-5 space-y-3">
              {openFindings.map((finding, index) => (
                <article
                  key={`${finding.title}-${index}`}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-neutral-100">
                        {finding.title}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        {finding.requirementKey ?? "No requirement"} -{" "}
                        {formatLabel(finding.category)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SeverityPill severity={finding.severity} />
                      <StatusPill status={finding.status} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-300">
                    {finding.description}
                  </p>
                  {finding.file ? (
                    <p className="mt-3 font-mono text-xs text-neutral-500">
                      {finding.file}
                      {finding.line ? `:${finding.line}` : ""}
                    </p>
                  ) : null}
                  {finding.suggestedFix ? (
                    <p className="mt-3 rounded-md border border-blue-900 bg-blue-950/30 p-3 text-sm text-blue-100">
                      Suggested fix: {finding.suggestedFix}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">
              No open findings were recorded for this review.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading
            eyebrow="Human approval"
            title={formatDecision(data.approval.decision)}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Approved by" value={data.approval.approvedBy} />
              <KeyValue label="Approved at" value={formatDate(data.approval.createdAt)} />
              <KeyValue label="Decision" value={formatDecision(data.approval.decision)} />
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                Note
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-300">
                {data.approval.note ?? "No note recorded."}
              </p>
              {data.approval.remainingRisks.length > 0 ? (
                <StringList
                  title="Remaining risks"
                  items={data.approval.remainingRisks}
                />
              ) : (
                <p className="mt-4 text-sm text-neutral-500">
                  No remaining risks were documented by the reviewer.
                </p>
              )}
            </div>
          </div>
        </section>

        <footer className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Generated by MergeMint</p>
            <p>{formatDate(data.generatedAt)}</p>
          </div>
          <p className="mt-3">
            This report is generated from linked PR, PRD, QA review, and human
            approval data.
          </p>
        </footer>
      </article>
    </main>
  );
}

function InternalReleaseReportPage({
  data
}: {
  data: InternalReleaseReportData;
}) {
  const coverageSummary = getCoverageSummary(data.coverage, data.findings);

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-8 text-neutral-100 print:bg-white print:text-neutral-950 md:px-8">
      <article className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-sky-800 bg-neutral-900 p-6 shadow-2xl shadow-black/20 print:border-neutral-300 print:bg-white print:shadow-none md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid size-9 place-items-center rounded-md border border-sky-800 bg-sky-950/50 text-sm font-semibold text-sky-200">
                  M
                </div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-300">
                  MergeMint
                </p>
                <StatusPill status="internal_release" />
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-5xl">
                Internal Release Report
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400 md:text-base">
                {data.summary}
              </p>
            </div>
            <div className="space-y-3 text-right">
              <PrintButton />
              <StatusPill status={data.reportStatus} />
              <p className="text-xs text-neutral-500">
                Generated {formatDate(data.generatedAt)}
              </p>
            </div>
          </div>
        </header>

        <DecisionBanner
          banner={{
            tone:
              data.releaseReadinessVerdict === "Approved with Risks"
                ? "amber"
                : "green",
            message: data.mergeRecommendation
          }}
        />

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Readiness" value={`${data.qaReview.readinessScore ?? 0}`} />
          <Metric label="Coverage" value={`${coverageSummary.covered}/${data.coverage.length}`} />
          <Metric label="Partial" value={`${coverageSummary.partial}`} />
          <Metric label="Open Risks" value={`${coverageSummary.openFindings}`} />
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="Release readiness" title={data.feature.title} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm leading-6 text-neutral-300">
                {data.qaReview.summary ?? data.feature.summary}
              </p>
              <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Merge recommendation
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {data.mergeRecommendation}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Project" value={data.project.name} />
              <KeyValue label="Verdict" value={data.releaseReadinessVerdict} />
              <KeyValue label="PRD" value={data.prd.title} />
              <KeyValue label="Review version" value={`v${data.qaReview.reviewVersion}`} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="PR evidence" title={data.pullRequest.title} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Repository" value={data.pullRequest.repository} />
              <KeyValue label="PR number" value={`#${data.pullRequest.number}`} />
              <KeyValue
                label="Branches"
                value={`${data.pullRequest.sourceBranch} -> ${data.pullRequest.targetBranch}`}
              />
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="State" value={formatLabel(data.pullRequest.state)} />
              <KeyValue label="Latest commit" value={shortSha(data.pullRequest.latestCommitSha)} />
              <a
                href={data.pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
              >
                Open GitHub PR
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading
            eyebrow="Requirement coverage"
            title={`${data.coverage.length} requirements reviewed`}
          />
          <div className="mt-5 space-y-3">
            {data.requirements.map((requirement) => {
              const coverage = data.coverage.find(
                (item) => item.requirementKey === requirement.key
              );

              return (
                <article
                  key={requirement.key}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-sky-200">
                        {requirement.key}
                      </p>
                      <h3 className="mt-1 font-medium text-neutral-100">
                        {requirement.description}
                      </h3>
                    </div>
                    <StatusPill status={coverage?.status ?? "not_reviewed"} />
                  </div>
                  <EvidenceBlock evidence={coverage?.evidence} />
                  {coverage?.concern ? (
                    <p className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
                      Concern: {coverage.concern}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="Technical risks" title="Known risks and notes" />
          <StringList
            title="Risks"
            items={
              data.technicalRisks.length > 0
                ? data.technicalRisks
                : ["No open technical risks were recorded."]
            }
          />
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading
            eyebrow="Human approval"
            title={formatDecision(data.approval.decision)}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Approved by" value={data.approval.approvedBy} />
              <KeyValue label="Approved at" value={formatDate(data.approval.createdAt)} />
              <KeyValue label="Decision" value={formatDecision(data.approval.decision)} />
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                Approval note
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-300">
                {data.approval.note ?? "No note recorded."}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="Timeline" title="Release evidence timeline" />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.timeline.map((item) => (
              <div
                key={`${item.label}-${item.at}`}
                className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
              >
                <p className="text-sm font-medium text-neutral-100">{item.label}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {item.at ? formatDate(item.at) : "Not recorded"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-500">
          <p>Generated by MergeMint for internal release review.</p>
        </footer>
      </article>
    </main>
  );
}

function DeveloperFixReportPage({ data }: { data: DeveloperFixReportData }) {
  const failedKeys = new Set([
    ...data.failedRequirements.map((requirement) => requirement.key),
    ...data.partialRequirements.map((requirement) => requirement.key)
  ]);
  const priorityRequirements = data.requirements.filter((requirement) =>
    failedKeys.has(requirement.key)
  );

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-8 text-neutral-100 print:bg-white print:text-neutral-950 md:px-8">
      <article className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-amber-800 bg-neutral-900 p-6 shadow-2xl shadow-black/20 print:border-neutral-300 print:bg-white print:shadow-none md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid size-9 place-items-center rounded-md border border-amber-800 bg-amber-950/50 text-sm font-semibold text-amber-200">
                  M
                </div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-300">
                  Developer Fix Report
                </p>
                <StatusPill status="internal" />
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-5xl">
                {data.feature.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400 md:text-base">
                This report explains what needs to be fixed before this PR can
                be approved.
              </p>
            </div>
            <div className="space-y-3 text-right">
              <PrintButton />
              <StatusPill status={data.reportStatus} />
              <p className="text-xs text-neutral-500">
                Generated {formatDate(data.generatedAt)}
              </p>
            </div>
          </div>
        </header>

        <DecisionBanner
          banner={{
            tone: data.reportStatus === "rejected" ? "red" : "amber",
            message: data.instruction
          }}
        />

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Failed" value={`${data.failedRequirements.length}`} />
          <Metric label="Partial" value={`${data.partialRequirements.length}`} />
          <Metric label="Open Findings" value={`${data.findings.filter((finding) => isOpenFindingStatus(finding.status)).length}`} />
          <Metric label="Readiness" value={`${data.qaReview.readinessScore ?? 0}`} />
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="Pull request" title={data.pullRequest.title} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Repository" value={data.pullRequest.repository} />
              <KeyValue label="PR number" value={`#${data.pullRequest.number}`} />
              <KeyValue
                label="Branches"
                value={`${data.pullRequest.sourceBranch} -> ${data.pullRequest.targetBranch}`}
              />
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
              <KeyValue label="Verdict" value={formatLabel(data.reportStatus)} />
              <KeyValue label="AI verdict" value={formatLabel(data.qaReview.overallStatus)} />
              <a
                href={data.pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500"
              >
                Open GitHub PR
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading
            eyebrow="Fix these first"
            title={`${priorityRequirements.length} requirements need attention`}
          />
          <div className="mt-5 space-y-3">
            {priorityRequirements.map((requirement) => {
              const coverage = data.coverage.find(
                (item) => item.requirementKey === requirement.key
              );
              const relatedFindings = data.findings.filter(
                (finding) => finding.requirementKey === requirement.key
              );

              return (
                <article
                  key={requirement.key}
                  className="rounded-md border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-amber-200">
                        {requirement.key}
                      </p>
                      <h3 className="mt-1 font-medium text-neutral-100">
                        {requirement.description}
                      </h3>
                    </div>
                    <StatusPill status={coverage?.status ?? "not_reviewed"} />
                  </div>
                  <EvidenceBlock evidence={coverage?.evidence} />
                  {coverage?.concern ? (
                    <p className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
                      Concern: {coverage.concern}
                    </p>
                  ) : null}
                  {relatedFindings.map((finding, index) => (
                    <div
                      key={`${finding.title}-${index}`}
                      className="mt-3 rounded-md border border-neutral-800 bg-neutral-900 p-3"
                    >
                      <div className="flex flex-wrap gap-2">
                        <SeverityPill severity={finding.severity} />
                        <StatusPill status={finding.status} />
                      </div>
                      <p className="mt-2 text-sm font-medium text-neutral-100">
                        {finding.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-neutral-300">
                        {finding.description}
                      </p>
                      {finding.suggestedFix ? (
                        <p className="mt-3 rounded-md border border-blue-900 bg-blue-950/30 p-3 text-sm text-blue-100">
                          Suggested fix: {finding.suggestedFix}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <SectionHeading eyebrow="Next actions" title="How to get this PR approved" />
          <StringList title="Steps" items={data.suggestedNextActions} />
          {data.approval?.note ? (
            <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm leading-6 text-neutral-300">
              Reviewer note: {data.approval.note}
            </p>
          ) : null}
        </section>

        <footer className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-500">
          <p>This is an internal/developer-facing report, not a client delivery report.</p>
          <p className="mt-3">{data.instruction}</p>
        </footer>
      </article>
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-blue-300">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-100">
        {title}
      </h2>
    </div>
  );
}

type DecisionBannerView = {
  message: string;
  tone: "green" | "amber" | "red";
};

function DecisionBanner({ banner }: { banner: DecisionBannerView }) {
  const classes =
    banner.tone === "green"
      ? "border-emerald-800 bg-emerald-950/30 text-emerald-100"
      : banner.tone === "red"
        ? "border-red-800 bg-red-950/30 text-red-100"
        : "border-amber-800 bg-amber-950/30 text-amber-100";

  return (
    <section className={`rounded-lg border p-4 text-sm leading-6 ${classes}`}>
      {banner.message}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-neutral-800 py-3 last:border-b-0">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-neutral-200">{value}</p>
    </div>
  );
}

function StringList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-neutral-300">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceBlock({ evidence }: { evidence: unknown }) {
  if (!isRecord(evidence)) {
    return null;
  }

  const notes = toStringArray(evidence.notes);
  const files = toStringArray(evidence.files);
  const checks = toStringArray(evidence.checks);
  const summary = typeof evidence.summary === "string" ? evidence.summary : null;

  if (!summary && notes.length === 0 && files.length === 0 && checks.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        Evidence
      </p>
      {summary ? <p className="mt-2 text-sm text-neutral-300">{summary}</p> : null}
      <StringList title="Notes" items={notes} />
      <StringList title="Files" items={files} />
      <StringList title="Checks" items={checks} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const classes =
    status === "approved" ||
    status === "covered" ||
    status === "passed" ||
    status === "generated"
      ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
      : status === "approved_with_risk" ||
          status === "partial" ||
          status === "needs_human_review"
        ? "border-amber-800 bg-amber-950/30 text-amber-200"
        : status === "rejected" ||
            status === "changes_requested" ||
            status === "missing" ||
            status === "failed"
          ? "border-red-800 bg-red-950/30 text-red-200"
          : "border-neutral-700 bg-neutral-950 text-neutral-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${classes}`}>
      {formatLabel(status)}
    </span>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const classes =
    severity === "critical" || severity === "high"
      ? "border-red-800 bg-red-950/30 text-red-200"
      : severity === "medium"
        ? "border-amber-800 bg-amber-950/30 text-amber-200"
        : "border-neutral-700 bg-neutral-950 text-neutral-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${classes}`}>
      {formatLabel(severity)}
    </span>
  );
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString();
}

function formatDecision(value: string) {
  if (value === "approved") {
    return "Approved";
  }

  if (value === "approved_with_risk") {
    return "Approved with risk";
  }

  if (value === "changes_requested") {
    return "Changes requested";
  }

  if (value === "rejected") {
    return "Rejected";
  }

  return formatLabel(value);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shortSha(value?: string | null) {
  return value ? value.slice(0, 7) : "Unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getCoverageSummary(
  coverage: Array<{ status: string }>,
  findings: Array<{ status: string }>
) {
  return {
    covered: coverage.filter((item) => item.status === "covered").length,
    partial: coverage.filter((item) => item.status === "partial").length,
    missing: coverage.filter((item) => item.status === "missing").length,
    risky: coverage.filter((item) => item.status === "risky").length,
    openFindings: findings.filter((finding) => finding.status === "open").length
  };
}

function getDecisionBanner(
  finalDecision: string,
  aiVerdict: string
): DecisionBannerView {
  if (finalDecision === "approved_with_risk") {
    return {
      tone: "amber",
      message: "This release was approved with documented risks."
    };
  }

  if (finalDecision === "changes_requested") {
    return {
      tone: "amber",
      message: "Changes were requested before this release should proceed."
    };
  }

  if (finalDecision === "rejected") {
    return {
      tone: "red",
      message: "This release was rejected by the human reviewer."
    };
  }

  if (finalDecision === "approved" && !isApprovedAiVerdict(aiVerdict)) {
    return {
      tone: "green",
      message:
        "Human reviewer approved this release despite unresolved AI review concerns. See coverage and risks below."
    };
  }

  return {
    tone: "green",
    message: "This release was approved by the human reviewer."
  };
}

function isApprovedAiVerdict(value: string) {
  return value === "approved" || value === "passed";
}

function isOpenFindingStatus(value: string) {
  return value === "open" || value === "needs_human_review";
}
