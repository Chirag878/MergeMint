import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "mergemint",
  name: "MergeMint"
});

export const inngestEvents = {
  generatePrd: "mergemint/prd.generate",
  generateEngineeringTasks: "mergemint/engineering-tasks.generate",
  runQaReview: "mergemint/qa-review.run",
  checkReleaseReadiness: "mergemint/release-readiness.check"
} as const;
