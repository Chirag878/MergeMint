export type BillingPlanKey =
  | "free"
  | "launch_pack"
  | "pilot"
  | "studio"
  | "scale"
  | "agency_max";

export type PaidBillingPlanKey = Exclude<BillingPlanKey, "free">;

export type BillingPlan = {
  key: BillingPlanKey;
  displayName: string;
  displayPrice: string;
  checkoutAmountInr: number;
  checkoutAmountPaise: number;
  credits: number;
  validityDays: number;
  offerNote?: string;
  recommended?: boolean;
  checkoutEnabled: boolean;
};

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlan> = {
  free: {
    key: "free",
    displayName: "Free",
    displayPrice: "1 free PR review",
    checkoutAmountInr: 0,
    checkoutAmountPaise: 0,
    credits: 1,
    validityDays: 0,
    offerNote: "1 free PR review included",
    checkoutEnabled: false
  },
  launch_pack: {
    key: "launch_pack",
    displayName: "Launch Pack",
    displayPrice: "Rs. 199",
    checkoutAmountInr: 199,
    checkoutAmountPaise: 19900,
    credits: 3,
    validityDays: 30,
    offerNote: "Valid until 30 June",
    checkoutEnabled: true
  },
  pilot: {
    key: "pilot",
    displayName: "Pilot",
    displayPrice: "$21/month",
    checkoutAmountInr: 1999,
    checkoutAmountPaise: 199900,
    credits: 30,
    validityDays: 30,
    checkoutEnabled: true
  },
  studio: {
    key: "studio",
    displayName: "Studio",
    displayPrice: "$51/month",
    checkoutAmountInr: 4999,
    checkoutAmountPaise: 499900,
    credits: 90,
    validityDays: 30,
    recommended: true,
    checkoutEnabled: true
  },
  scale: {
    key: "scale",
    displayName: "Scale",
    displayPrice: "$99/month",
    checkoutAmountInr: 9999,
    checkoutAmountPaise: 999900,
    credits: 220,
    validityDays: 30,
    checkoutEnabled: true
  },
  agency_max: {
    key: "agency_max",
    displayName: "Agency Max",
    displayPrice: "$199/month",
    checkoutAmountInr: 19999,
    checkoutAmountPaise: 1999900,
    credits: 600,
    validityDays: 30,
    checkoutEnabled: true
  }
};

export const PAID_BILLING_PLAN_KEYS = [
  "launch_pack",
  "pilot",
  "studio",
  "scale",
  "agency_max"
] as const satisfies PaidBillingPlanKey[];

export function getBillingPlan(planKey: string) {
  return BILLING_PLANS[planKey as BillingPlanKey];
}
