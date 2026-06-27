import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  approvals,
  clarificationQuestions,
  db,
  engineeringTasks,
  featureRequests,
  githubAppInstallations,
  prdRequirements,
  prds,
  projectGithubRepositories,
  projects,
  pullRequests,
  qaFindings,
  qaReviews,
  releaseReports,
  repositoryAnalyses,
  repositories
} from "@veriflow/db";
import { assertRoleCan } from "../authz";
import type { TRPCContext } from "../context";
import { ensureUserWorkspace } from "./workspace-bootstrap.service";

type ProtectedContext = TRPCContext & {
  user: NonNullable<TRPCContext["user"]>;
  session: NonNullable<TRPCContext["session"]>;
};

type GuidedStepStatus = "completed" | "current" | "blocked" | "upcoming";

type GuidedStep = {
  id: string;
  label: string;
  status: GuidedStepStatus;
};

type GuidedWorkflowState = {
  status: string;
  title: string;
  description: string;
  primaryActionLabel: string;
  primaryActionHref?: string;
  primaryActionKey?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  blockedReason?: string;
  completionPercentage: number;
  completedSteps: GuidedStep[];
  upcomingSteps: GuidedStep[];
  steps: GuidedStep[];
};

function toBootstrapInput(ctx: ProtectedContext) {
  return {
    user: ctx.user,
    session: ctx.session
  };
}

function makeSteps(
  steps: Array<{ id: string; label: string; done: boolean }>,
  currentId: string,
  blockedId?: string
) {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    status: step.done
      ? "completed"
      : blockedId === step.id
        ? "blocked"
        : currentId === step.id
          ? "current"
          : "upcoming"
  })) satisfies GuidedStep[];
}

function completionPercentage(steps: GuidedStep[]) {
  if (steps.length === 0) {
    return 0;
  }

  return Math.round(
    (steps.filter((step) => step.status === "completed").length / steps.length) *
      100
  );
}

function toState(input: Omit<GuidedWorkflowState, "completedSteps" | "upcomingSteps" | "completionPercentage">) {
  const completedSteps = input.steps.filter((step) => step.status === "completed");
  const upcomingSteps = input.steps.filter((step) => step.status !== "completed");

  return {
    ...input,
    completionPercentage: completionPercentage(input.steps),
    completedSteps,
    upcomingSteps
  };
}

function isClientDeliveryReport(report: typeof releaseReports.$inferSelect) {
  const reportData = report.reportData as { reportType?: string };
  return !reportData.reportType || reportData.reportType === "client_delivery";
}

function isOpenFinding(finding: typeof qaFindings.$inferSelect) {
  return finding.status === "open" || finding.status === "needs_human_review";
}

async function getWorkspaceBasics(organizationId: string) {
  const [
    installationRows,
    repositoryRows,
    projectRows,
    projectRepositoryRows,
    featureRows,
    pullRequestRows,
    qaReviewRows,
    approvalRows,
    releaseReportRows
  ] = await Promise.all([
    db
      .select()
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.organizationId, organizationId)),
    db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          isNotNull(repositories.githubAppInstallationId),
          eq(repositories.githubAppSelected, true)
        )
      ),
    db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.createdAt)),
    db
      .select()
      .from(projectGithubRepositories)
      .where(eq(projectGithubRepositories.organizationId, organizationId)),
    db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.organizationId, organizationId))
      .orderBy(desc(featureRequests.createdAt)),
    db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.organizationId, organizationId)),
    db
      .select()
      .from(qaReviews)
      .where(eq(qaReviews.organizationId, organizationId)),
    db
      .select()
      .from(approvals)
      .where(eq(approvals.organizationId, organizationId)),
    db
      .select()
      .from(releaseReports)
      .where(eq(releaseReports.organizationId, organizationId))
  ]);

  return {
    installations: installationRows,
    repositories: repositoryRows,
    projects: projectRows,
    projectRepositories: projectRepositoryRows,
    features: featureRows,
    pullRequests: pullRequestRows,
    qaReviews: qaReviewRows,
    approvals: approvalRows,
    reports: releaseReportRows
  };
}

function getWorkspaceNextAction(input: Awaited<ReturnType<typeof getWorkspaceBasics>>) {
  if (input.installations.length === 0) {
    return {
      status: "github_not_connected",
      title: "Connect GitHub",
      description: "Connect GitHub so MergeMint can verify PRs against requirements.",
      primaryActionLabel: "Connect GitHub",
      primaryActionHref: "/app/settings/github"
    };
  }

  if (input.repositories.length === 0) {
    return {
      status: "github_installed_not_synced",
      title: "Sync repositories",
      description: "GitHub is installed. Sync selected repositories so projects can use them.",
      primaryActionLabel: "Sync repositories",
      primaryActionHref: "/app/settings/github"
    };
  }

  if (input.projects.length === 0) {
    return {
      status: "repositories_synced",
      title: "Create your first project",
      description: "Create a project before drafting feature requests.",
      primaryActionLabel: "Create project",
      primaryActionHref: "/app/projects"
    };
  }

  const projectWithoutRepository = input.projects.find(
    (project) =>
      !input.projectRepositories.some((row) => row.projectId === project.id)
  );
  if (projectWithoutRepository) {
    return {
      status: "ready",
      title: "Connect repository",
      description: "Choose the repository this project ships from.",
      primaryActionLabel: "Connect repository",
      primaryActionHref: `/app/projects?projectId=${projectWithoutRepository.id}`
    };
  }

  const featureWithoutPr = input.features.find(
    (feature) =>
      !input.pullRequests.some((pullRequest) => pullRequest.featureRequestId === feature.id)
  );
  if (featureWithoutPr) {
    return {
      status: "ready",
      title: "Link pull request",
      description: "Link the pull request that implements this feature.",
      primaryActionLabel: "Link PR",
      primaryActionHref: `/app/features/${featureWithoutPr.id}`
    };
  }

  const featureWithoutQa = input.features.find(
    (feature) =>
      input.pullRequests.some((pullRequest) => pullRequest.featureRequestId === feature.id) &&
      !input.qaReviews.some((review) => review.featureRequestId === feature.id)
  );
  if (featureWithoutQa) {
    return {
      status: "ready",
      title: "Run QA review",
      description: "Run QA to compare this PR against the original requirement.",
      primaryActionLabel: "Run QA review",
      primaryActionHref: `/app/features/${featureWithoutQa.id}`
    };
  }

  const featureWithoutApproval = input.features.find(
    (feature) =>
      input.qaReviews.some((review) => review.featureRequestId === feature.id) &&
      !input.approvals.some((approval) => approval.featureRequestId === feature.id)
  );
  if (featureWithoutApproval) {
    return {
      status: "ready",
      title: "Approve or request changes",
      description: "Make the final release decision.",
      primaryActionLabel: "Approve release",
      primaryActionHref: `/app/features/${featureWithoutApproval.id}`
    };
  }

  const featureWithoutReport = input.features.find(
    (feature) =>
      input.approvals.some(
        (approval) =>
          approval.featureRequestId === feature.id &&
          (approval.decision === "approved" ||
            approval.decision === "approved_with_risk")
      ) &&
      !input.reports.some(
        (report) =>
          report.featureRequestId === feature.id && isClientDeliveryReport(report)
      )
  );
  if (featureWithoutReport) {
    return {
      status: "ready",
      title: "Generate report",
      description: "Generate a shareable proof of delivery.",
      primaryActionLabel: "Generate report",
      primaryActionHref: `/app/features/${featureWithoutReport.id}`
    };
  }

  const reportReady = input.reports.find(isClientDeliveryReport);
  if (reportReady) {
    return {
      status: "ready",
      title: "Share report",
      description: "A release report is ready to share with stakeholders.",
      primaryActionLabel: "Open report",
      primaryActionHref: `/reports/${reportReady.shareToken}`
    };
  }

  return {
    status: "ready",
    title: "Create your first feature request",
    description: "Create your first feature request to start a release proof.",
    primaryActionLabel: "Create feature request",
    primaryActionHref: "/app/features"
  };
}

export async function getWorkspaceSetup(ctx: ProtectedContext) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");

  const basics = await getWorkspaceBasics(workspace.activeOrganization.id);
  const nextAction = getWorkspaceNextAction(basics);
  const steps = makeSteps(
    [
      {
        id: "github",
        label: "Connect GitHub",
        done: basics.installations.length > 0
      },
      {
        id: "sync",
        label: "Sync repositories",
        done: basics.repositories.length > 0
      },
      {
        id: "project",
        label: "Create project",
        done: basics.projects.length > 0
      },
      {
        id: "project_repository",
        label: "Connect project repository",
        done: basics.projectRepositories.length > 0
      },
      {
        id: "feature",
        label: "Create feature request",
        done: basics.features.length > 0
      }
    ],
    nextAction.status === "github_not_connected"
      ? "github"
      : nextAction.status === "github_installed_not_synced"
        ? "sync"
        : basics.projects.length === 0
          ? "project"
          : basics.projectRepositories.length === 0
            ? "project_repository"
            : "feature"
  );

  return toState({
    ...nextAction,
    secondaryActionLabel: "Open features",
    secondaryActionHref: "/app/features",
    steps
  });
}

export async function getProjectSetup(
  ctx: ProtectedContext,
  input: { projectId?: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");
  const organizationId = workspace.activeOrganization.id;

  const [projectRows, installationRows, repositoryRows] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.createdAt)),
    db
      .select()
      .from(githubAppInstallations)
      .where(eq(githubAppInstallations.organizationId, organizationId)),
    db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.organizationId, organizationId),
          isNotNull(repositories.githubAppInstallationId),
          eq(repositories.githubAppSelected, true)
        )
      )
  ]);

  const project =
    (input.projectId
      ? projectRows.find((row) => row.id === input.projectId)
      : projectRows[0]) ?? null;

  if (!project) {
    const steps = makeSteps(
      [
        { id: "project", label: "Project created", done: false },
        { id: "repository", label: "Repository connected", done: false },
        { id: "feature", label: "Feature request added", done: false },
        { id: "verification", label: "PR verification started", done: false }
      ],
      "project"
    );

    return toState({
      status: "no_project",
      title: "Create your first project",
      description: "Projects organize releases before feature requests and PR verification.",
      primaryActionLabel: "Create project",
      primaryActionHref: "/app/projects",
      steps
    });
  }

  const [projectRepositoryRows, featureRows, pullRequestRows, analysisRows] =
    await Promise.all([
    db
      .select()
      .from(projectGithubRepositories)
      .where(
        and(
          eq(projectGithubRepositories.organizationId, organizationId),
          eq(projectGithubRepositories.projectId, project.id)
        )
      ),
    db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.projectId, project.id)),
    db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.projectId, project.id)),
    db
      .select()
      .from(repositoryAnalyses)
      .where(
        and(
          eq(repositoryAnalyses.organizationId, organizationId),
          eq(repositoryAnalyses.projectId, project.id)
        )
      )
      .orderBy(desc(repositoryAnalyses.createdAt))
  ]);

  const hasRepository = projectRepositoryRows.length > 0;
  const hasAnalysis = analysisRows.some((analysis) => analysis.status === "completed");
  const hasFeature = featureRows.length > 0;
  const hasVerification = pullRequestRows.length > 0;
  const steps = makeSteps(
    [
      { id: "project", label: "Project created", done: true },
      { id: "repository", label: "Repository connected", done: hasRepository },
      { id: "analysis", label: "Repository analyzed", done: hasAnalysis },
      { id: "feature", label: "Feature request added", done: hasFeature },
      { id: "verification", label: "PR verification started", done: hasVerification }
    ],
    !hasRepository
      ? "repository"
      : !hasAnalysis
        ? "analysis"
        : !hasFeature
          ? "feature"
          : "verification",
    installationRows.length === 0 || repositoryRows.length === 0
      ? "repository"
      : undefined
  );

  if (!hasRepository) {
    if (installationRows.length === 0) {
      return toState({
        status: "no_repository_connected",
        title: "Connect GitHub first",
        description: "Connect GitHub so this project can choose a repository.",
        primaryActionLabel: "Connect GitHub first",
        primaryActionHref: "/app/settings/github",
        blockedReason: "No workspace GitHub App installation exists.",
        steps
      });
    }

    if (repositoryRows.length === 0) {
      return toState({
        status: "no_repository_connected",
        title: "Sync repositories",
        description: "GitHub is connected. Sync repositories before choosing one for this project.",
        primaryActionLabel: "Sync repositories",
        primaryActionHref: "/app/settings/github",
        blockedReason: "No synced repositories are available.",
        steps
      });
    }

    return toState({
      status: "no_repository_connected",
      title: "Connect repository",
      description: "Choose the repository this project ships from.",
      primaryActionLabel: "Connect repository",
      primaryActionKey: "connect_project_repository",
      steps
    });
  }

  if (!hasAnalysis) {
    return toState({
      status: "repository_connected",
      title: "Analyze repository",
      description:
        "Build a codebase snapshot so PRDs, engineering tasks, and QA reviews can use real repo context.",
      primaryActionLabel: "Analyze repository",
      primaryActionKey: "analyze_repository",
      secondaryActionLabel: "Create feature request",
      secondaryActionHref: `/app/features?projectId=${project.id}`,
      steps
    });
  }

  if (!hasFeature) {
    return toState({
      status: "repository_connected",
      title: "Create a feature request",
      description: "Create your first feature request to start a release proof.",
      primaryActionLabel: "Create feature request",
      primaryActionHref: `/app/features?projectId=${project.id}`,
      steps
    });
  }

  return toState({
    status: "ready_for_feature",
    title: "Project is ready",
    description: "This project has a repository and feature request. Continue verification from the feature page.",
    primaryActionLabel: "Open features",
    primaryActionHref: "/app/features",
    steps
  });
}

export async function getFeatureWorkflow(
  ctx: ProtectedContext,
  input: { featureRequestId: string }
) {
  const workspace = await ensureUserWorkspace(toBootstrapInput(ctx));
  assertRoleCan(workspace.membership.role, "project:read");
  const organizationId = workspace.activeOrganization.id;

  const [feature] = await db
    .select()
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.id, input.featureRequestId),
        eq(featureRequests.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!feature) {
    throw new Error("Feature request not found.");
  }

  const [questions, prdRows, pullRequestRows, qaReviewRows, approvalRows, reportRows] =
    await Promise.all([
      db
        .select()
        .from(clarificationQuestions)
        .where(eq(clarificationQuestions.featureRequestId, feature.id)),
      db
        .select()
        .from(prds)
        .where(eq(prds.featureRequestId, feature.id))
        .orderBy(desc(prds.version), desc(prds.createdAt)),
      db
        .select()
        .from(pullRequests)
        .where(
          and(
            eq(pullRequests.featureRequestId, feature.id),
            eq(pullRequests.organizationId, organizationId)
          )
        )
        .orderBy(desc(pullRequests.updatedAt)),
      db
        .select()
        .from(qaReviews)
        .where(
          and(
            eq(qaReviews.featureRequestId, feature.id),
            eq(qaReviews.organizationId, organizationId)
          )
        )
        .orderBy(desc(qaReviews.reviewVersion), desc(qaReviews.createdAt)),
      db
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.featureRequestId, feature.id),
            eq(approvals.organizationId, organizationId)
          )
        )
        .orderBy(desc(approvals.createdAt)),
      db
        .select()
        .from(releaseReports)
        .where(
          and(
            eq(releaseReports.featureRequestId, feature.id),
            eq(releaseReports.organizationId, organizationId)
          )
        )
        .orderBy(desc(releaseReports.createdAt))
    ]);

  const latestPrd = prdRows[0] ?? null;
  const latestPullRequest = pullRequestRows[0] ?? null;
  const latestQaReview = qaReviewRows[0] ?? null;
  const latestApproval = approvalRows[0] ?? null;
  const latestReport = reportRows.find(isClientDeliveryReport) ?? null;
  const [requirements, tasks, findings] = await Promise.all([
    latestPrd
      ? db
          .select()
          .from(prdRequirements)
          .where(eq(prdRequirements.prdId, latestPrd.id))
      : Promise.resolve([] as Array<typeof prdRequirements.$inferSelect>),
    latestPrd
      ? db
          .select()
          .from(engineeringTasks)
          .where(eq(engineeringTasks.prdId, latestPrd.id))
      : Promise.resolve([] as Array<typeof engineeringTasks.$inferSelect>),
    latestQaReview
      ? db
          .select()
          .from(qaFindings)
          .where(eq(qaFindings.qaReviewId, latestQaReview.id))
      : Promise.resolve([] as Array<typeof qaFindings.$inferSelect>)
  ]);

  const unansweredRequired = questions.filter(
    (question) =>
      (question.priority === "high" || question.priority === "urgent") &&
      !question.answer
  );
  const hasPrd = Boolean(latestPrd && requirements.length > 0);
  const hasTasks = tasks.length > 0;
  const hasQa = Boolean(latestQaReview);
  const openFindings = findings.filter(isOpenFinding);
  const approved =
    latestApproval?.decision === "approved" ||
    latestApproval?.decision === "approved_with_risk";
  const rejected =
    latestApproval?.decision === "rejected" ||
    latestApproval?.decision === "changes_requested";
  const shipped = Boolean(latestReport && approved);

  const steps = makeSteps(
    [
      { id: "request", label: "Request", done: true },
      { id: "prd_tasks", label: "PRD & Tasks", done: hasPrd && hasTasks },
      { id: "pull_request", label: "Pull Request", done: Boolean(latestPullRequest) },
      { id: "qa_review", label: "QA Review", done: hasQa },
      { id: "approval", label: "Approval", done: Boolean(latestApproval) },
      { id: "report", label: "Report", done: Boolean(latestReport) }
    ],
    !hasPrd || !hasTasks
      ? "prd_tasks"
      : !latestPullRequest
        ? "pull_request"
        : !hasQa
          ? "qa_review"
          : !latestApproval
            ? "approval"
            : !latestReport
              ? "report"
              : "report",
    unansweredRequired.length > 0 ? "prd_tasks" : undefined
  );

  if (unansweredRequired.length > 0) {
    return toState({
      status: "clarification_needed",
      title: "Answer clarification questions",
      description: "Answer required clarification questions before generating the PRD.",
      primaryActionLabel: "Answer questions",
      primaryActionKey: "answer_clarifications",
      blockedReason: "Required clarification questions are unanswered.",
      steps
    });
  }

  if (!hasPrd) {
    return toState({
      status: "draft_request",
      title: "Generate PRD",
      description: "Turn this feature request into requirements and acceptance criteria.",
      primaryActionLabel: "Generate PRD",
      primaryActionKey: "generate_prd",
      steps
    });
  }

  if (!hasTasks) {
    return toState({
      status: "prd_ready",
      title: "Review engineering tasks",
      description: "Generate or review engineering tasks before PR verification.",
      primaryActionLabel: "Generate tasks",
      primaryActionKey: "generate_tasks",
      steps
    });
  }

  if (!latestPullRequest) {
    return toState({
      status: "tasks_ready",
      title: "Link pull request",
      description: "Link the pull request that implements this feature.",
      primaryActionLabel: "Link pull request",
      primaryActionKey: "link_pr",
      steps
    });
  }

  if (!hasQa) {
    return toState({
      status: "pr_linked",
      title: "Run QA review",
      description: "Run QA to compare this PR against the original requirement.",
      primaryActionLabel: "Run QA review",
      primaryActionKey: "run_qa",
      steps
    });
  }

  if (openFindings.length > 0) {
    return toState({
      status: "qa_needs_changes",
      title: "Review QA findings",
      description: "QA found unresolved risks. Review them before approval.",
      primaryActionLabel: "Review risks",
      primaryActionKey: "review_risks",
      steps
    });
  }

  if (!latestApproval) {
    return toState({
      status: "qa_ready",
      title: "Approve release",
      description: "Make the final release decision.",
      primaryActionLabel: "Approve release",
      primaryActionKey: "approve_release",
      steps
    });
  }

  if (rejected) {
    return toState({
      status: "rejected",
      title: "Changes requested",
      description: "The latest human decision asks for changes before release.",
      primaryActionLabel: "Review decision",
      primaryActionKey: "review_approval",
      steps
    });
  }

  if (!latestReport) {
    return toState({
      status: approved ? "approved" : "approval_pending",
      title: "Generate client delivery report",
      description: "Generate a shareable proof of delivery.",
      primaryActionLabel: "Generate report",
      primaryActionKey: "generate_report",
      steps
    });
  }

  return toState({
    status: shipped ? "shipped" : "report_ready",
    title: "Share report",
    description: "The release report is ready to share.",
    primaryActionLabel: "Share report",
    primaryActionHref: `/reports/${latestReport.shareToken}`,
    steps
  });
}
