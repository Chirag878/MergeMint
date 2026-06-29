"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@veriflow/auth/client";
import type { BillingPlan } from "@veriflow/shared";
import { trpc } from "@/trpc/react";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      prefill?: {
        name?: string;
        email?: string;
      };
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => void;
      modal?: {
        ondismiss?: () => void;
      };
      theme?: {
        color?: string;
      };
    }) => { open: () => void };
  }
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function checkoutLoginPath(planKey: string) {
  return `/login?callbackURL=${encodeURIComponent(`/pricing?checkoutPlan=${planKey}`)}`;
}

export function PricingCheckoutButton({
  plan,
  className,
  children,
  signedOutChildren = "Sign in to start",
  initialIsSignedIn = false
}: {
  plan: BillingPlan;
  className: string;
  children: React.ReactNode;
  signedOutChildren?: React.ReactNode;
  initialIsSignedIn?: boolean;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const session = authClient.useSession();
  const clientHasSession = Boolean(session.data?.user);
  const isCheckingSession = session.isPending && !initialIsSignedIn;
  const isSignedIn = session.isPending ? initialIsSignedIn : clientHasSession;
  const [message, setMessage] = useState<string | null>(null);
  const createOrder = trpc.billing.createCheckoutOrder.useMutation();
  const verifyPayment = trpc.billing.verifyCheckoutPayment.useMutation({
    onSuccess: async () => {
      setMessage("Payment verified. Redirecting...");
      await Promise.all([
        utils.billing.getCurrentEntitlement.invalidate(),
        utils.billing.getPaymentHistory.invalidate(),
        utils.billing.getCreditEvents.invalidate()
      ]);
      router.push("/app/welcome?payment=success");
      router.refresh();
    },
    onError: (error) => setMessage(error.message)
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.info("[billing] Checkout session state.", {
      initialIsSignedIn,
      clientSessionLoading: session.isPending,
      clientHasSession,
      resolvedIsSignedIn: isSignedIn,
      planKey: plan.key
    });
  }, [clientHasSession, initialIsSignedIn, isSignedIn, plan.key, session.isPending]);

  async function startCheckout() {
    setMessage(null);
    const route =
      typeof window === "undefined"
        ? "unknown"
        : `${window.location.pathname}${window.location.search}`;

    if (isCheckingSession) {
      return;
    }

    if (!isSignedIn) {
      const redirectTarget = checkoutLoginPath(plan.key);
      if (process.env.NODE_ENV === "development") {
        console.info("[billing] Redirecting signed-out checkout.", {
          route,
          initialIsSignedIn,
          clientSessionLoading: session.isPending,
          clientHasSession,
          resolvedIsSignedIn: isSignedIn,
          hasSession: false,
          planKey: plan.key,
          action: "redirect_to_login",
          redirectTarget
        });
      }
      router.push(redirectTarget);
      return;
    }

    try {
      if (process.env.NODE_ENV === "development") {
        console.info("[billing] Starting authenticated checkout.", {
          route,
          initialIsSignedIn,
          clientSessionLoading: session.isPending,
          clientHasSession,
          resolvedIsSignedIn: isSignedIn,
          hasSession: true,
          planKey: plan.key,
          action: "create_order"
        });
      }

      const order = await createOrder.mutateAsync({ planKey: plan.key });
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        setMessage("Could not load Razorpay checkout. Please try again.");
        return;
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "MergeMint",
        description: `${order.plan.displayName} - ${order.plan.credits} PR reviews`,
        order_id: order.orderId,
        prefill: order.prefill,
        handler: (response) => {
          verifyPayment.mutate({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          });
        },
        modal: {
          ondismiss: () => setMessage("Checkout cancelled.")
        },
        theme: {
          color: "#62d9a3"
        }
      });
      checkout.open();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Sign in before choosing a plan.";
      if (
        message.toLowerCase().includes("logged in") ||
        message.toLowerCase().includes("unauthorized")
      ) {
        const redirectTarget = checkoutLoginPath(plan.key);
        if (process.env.NODE_ENV === "development") {
          console.info("[billing] Checkout auth required.", {
            route,
            initialIsSignedIn,
            clientSessionLoading: session.isPending,
            clientHasSession,
            resolvedIsSignedIn: false,
            hasSession: false,
            planKey: plan.key,
            action: "redirect_to_login",
            redirectTarget
          });
        }
        router.push(redirectTarget);
        return;
      }
      setMessage(message);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={isCheckingSession || createOrder.isPending || verifyPayment.isPending}
        className={className}
      >
        {isCheckingSession
          ? "Checking session..."
          : createOrder.isPending || verifyPayment.isPending
            ? "Processing..."
          : isSignedIn
            ? children
            : signedOutChildren}
      </button>
      {message ? <p className="mt-2 text-xs text-[var(--text-muted)]">{message}</p> : null}
    </div>
  );
}
