"use client";

import Link from "next/link";
import { useEntitlements } from "@/app/lib/use-entitlements";
import { PLAN_LABEL, type Plan } from "@/app/lib/pricing";
import CancelSubscriptionButton from "@/app/components/CancelSubscriptionButton";

export default function HomeClient() {
  const ent = useEntitlements();
  const plans = ent.entitlements?.entitlements;

  const isLoggedIn = !!ent.entitlements?.user_id;

  const hasNetworking = !!plans?.networking || !!plans?.bundle;
  const hasTalent = !!plans?.talent || !!plans?.bundle;
  const hasBundle = !!plans?.bundle;

  const items: { key: Plan; label: string; active: boolean }[] = [
    { key: "networking", label: PLAN_LABEL.networking, active: hasNetworking },
    { key: "talent", label: PLAN_LABEL.talent, active: hasTalent },
    { key: "bundle", label: PLAN_LABEL.bundle, active: hasBundle },
  ];

  const anyActive = hasNetworking || hasTalent || hasBundle;

  return (
    <div className="text-slate-600">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-600/25 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Welcome to Contactful
        </h1>

        <p className="mt-2 text-slate-600">Manage your access and upgrade anytime.</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href="/upgrade"
            className="rounded-xl border border-slate-600/25 bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Upgrade
          </Link>

          {!isLoggedIn && (
            <Link
              href="/login"
              className="rounded-xl border border-slate-600/25 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Login
            </Link>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-slate-600/20 bg-slate-50 p-4">
          <div className="text-sm text-slate-600">
            Your plan is{" "}
            <span className="font-semibold text-slate-900">
              {anyActive ? "active" : "inactive"}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold text-slate-900">Entitlements</div>

          <div className="grid grid-cols-1 gap-2">
            {items.map((it) => (
              <div
                key={it.key}
                className="rounded-2xl border border-slate-600/25 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{it.label}</div>

                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-xs",
                        it.active
                          ? "border-emerald-600/25 bg-emerald-50 text-emerald-700"
                          : "border-slate-600/25 bg-slate-50 text-slate-600",
                      ].join(" ")}
                    >
                      {it.active ? "Active" : "Inactive"}
                    </span>

                    {/* X tylko gdy aktywny plan */}
                    {it.active ? <CancelSubscriptionButton /> : null}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {it.active
                    ? "You have access to this plan."
                    : "You don’t have access to this plan yet."}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

