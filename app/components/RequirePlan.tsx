// app/components/RequirePlan.tsx
"use client";

import React from "react";
import type { Plan } from "../lib/pricing";
import { useRouter } from "next/navigation";

type Props = {
  required: Plan;
  supabase: any;
  entitlements: {
    status: "idle" | "loading" | "ready" | "error";
    hasPlan: (p: Plan) => boolean;
  };
  children: React.ReactNode;
};

export function RequirePlan({ required, entitlements, children }: Props) {
  const router = useRouter();

  if (entitlements.status === "loading" || entitlements.status === "idle") {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }

  if (entitlements.status === "error") {
    return <div style={{ padding: 16 }}>Couldn’t verify subscription.</div>;
  }

  if (!entitlements.hasPlan(required)) {
    router.push(`/upgrade?plan=${required}`);
    return null;
  }

  return <>{children}</>;
}

