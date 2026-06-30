# MergeMint Demo Readiness Checklist

Use this checklist to demo the full ShipFlow AI / MergeMint proof chain without claiming sample data is real production evidence.

## Core Demo Path

- [ ] Feature request is created or sample project is clearly labeled as demo data.
- [ ] Requirement Review is started.
- [ ] Product Discovery verdict is visible:
  - Proceed to PRD
  - Needs clarification
  - Already exists
  - Duplicate request
  - Not worth building now
  - Out of scope
- [ ] Required clarification answers are saved.
- [ ] PRD is generated from the feature request and answers.
- [ ] Engineering tasks are generated from the PRD.
- [ ] GitHub PR is linked or selected from the connected repository.
- [ ] PR snapshot is refreshed from real GitHub data when available.
- [ ] AI QA Review runs against PRD requirements, tasks, PR evidence, and verification rules.
- [ ] Requirement coverage map is shown.
- [ ] Developer Fix Pack is available when QA finds gaps.
- [ ] Human approval decision is recorded.
- [ ] Client/developer/internal release report is generated as appropriate.
- [ ] GitHub Proof remains manual-only and is not faked.

## Async Workflow Talking Points

- PRD generation, task generation, AI QA review, and readiness check have async workflow wrappers.
- Status states are `queued`, `running`, `completed`, and `failed`.
- The wrappers reuse existing services instead of forking logic.
- The implementation is Inngest-ready: hosted events can replace the in-memory demo queue later.

## Safety Notes

- Do not run Razorpay during the demo unless specifically showing protected billing.
- Do not claim fake GitHub proof; use real GitHub App proof or clearly label placeholders.
- AI QA Review is the only credit-consuming workflow.
- GitHub Proof publishing does not rerun AI and does not consume credits.
