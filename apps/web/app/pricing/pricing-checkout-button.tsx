"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function PricingCheckoutButton({
  plan,
  className,
  children
}: {
  plan: BillingPlan;
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
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
      router.push("/app/billing");
      router.refresh();
    },
    onError: (error) => setMessage(error.message)
  });

  async function startCheckout() {
    setMessage(null);
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      setMessage("Could not load Razorpay checkout. Please try again.");
      return;
    }

    try {
      const order = await createOrder.mutateAsync({ planKey: plan.key });
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
      if (message.toLowerCase().includes("logged in")) {
        router.push(`/login?returnTo=${encodeURIComponent(`/pricing?plan=${plan.key}`)}`);
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
        disabled={createOrder.isPending || verifyPayment.isPending}
        className={className}
      >
        {createOrder.isPending || verifyPayment.isPending ? "Processing..." : children}
      </button>
      {message ? <p className="mt-2 text-xs text-[var(--text-muted)]">{message}</p> : null}
    </div>
  );
}
