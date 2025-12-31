// app/upgrade/upgrade-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { supabaseBrowser } from "@/app/lib/supabase-client";
import { useEntitlements } from "@/app/lib/use-entitlements";
import { PLAN_LABEL, BILLING_LABEL, type Plan, type Billing } from "@/app/lib/pricing";

type PriceRow = {
  plan: Plan;
  billing: Billing;
  amount: number; // cents
  currency: string;
  price_id: string;
};

function planFromQuery(v: string | null): Plan {
  if (v === "talent" || v === "networking" || v === "bundle") return v;
  return "talent";
}

function billingFromQuery(v: string | null): Billing {
  if (v === "monthly" || v === "yearly" || v === "lifetime") return v;
  return "monthly";
}

function formatMoney(cents: number, currency: string) {
  const n = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function isPriceRow(x: any): x is PriceRow {
  return (
    x &&
    (x.plan === "talent" || x.plan === "networking" || x.plan === "bundle") &&
    (x.billing === "monthly" || x.billing === "yearly" || x.billing === "lifetime") &&
    typeof x.amount === "number" &&
    typeof x.currency === "string" &&
    typeof x.price_id === "string"
  );
}

function normalizePrices(payload: any): PriceRow[] {
  const maybeArray = Array.isArray(payload) ? payload : Array.isArray(payload?.prices) ? payload.prices : null;
  if (!maybeArray) return [];
  return maybeArray.filter(isPriceRow);
}

export default function UpgradeClient() {
  const sp = useSearchParams();
  const initialPlan = useMemo(() => planFromQuery(sp.get("plan")), [sp]);
  const initialBilling = useMemo(() => billingFromQuery(sp.get("billing")), [sp]);

  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const ent = useEntitlements();
  const plans = ent.entitlements?.entitlements;

  const hasNetworking = !!plans?.networking || !!plans?.bundle;
  const hasTalent = !!plans?.talent || !!plans?.bundle;
  const hasBundle = !!plans?.bundle;

  const planDisabled = {
    networking: hasNetworking,
    talent: hasTalent,
    bundle: hasBundle,
  } as const;

  async function startCheckout() {
    try {
      setMsg(null);
      setLoading(true);

      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        setLoading(false);
        setMsg("You need to be logged in first.");
        window.location.href = `/login?upgrade=${plan}`;
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, billing }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.details || json?.error || `Checkout failed (${res.status})`);
      }

      if (!json?.url) throw new Error("Missing checkout URL.");
      window.location.href = json.url;
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
      setLoading(false);
    }
  }

  // ceny
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [pricesErr, setPricesErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPricesErr(null);
        const r = await fetch("/api/stripe/prices");
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.details || j?.error || "Failed to load prices");
        setPrices(normalizePrices(j));
      } catch (e: any) {
        setPrices([]);
        setPricesErr(e?.message || "Failed to load prices");
      } finally {
        setPricesLoaded(true);
      }
    })();
  }, []);

  const currentPrice = useMemo(() => {
    if (!prices?.length) return null;
    return prices.find((p) => p.plan === plan && p.billing === billing) || null;
  }, [prices, plan, billing]);

  const showNoPrice = pricesLoaded && !pricesErr && (!currentPrice || !prices.length);

  return (
    <div className="text-slate-600">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-600/25 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Upgrade</h1>
        <p className="mt-2 text-slate-600">
          Choose a plan and billing. You’ll be redirected to Stripe Checkout.
        </p>

        <div className="mt-5">
          <div className="text-sm font-semibold text-slate-900 mb-2">Plan</div>
          <div className="grid grid-cols-1 gap-2">
            <PlanOption
              title="Talent Pack"
              desc="Unlock Talent features in the extension and app."
              selected={plan === "talent"}
              disabled={planDisabled.talent}
              badge={planDisabled.talent ? "Active" : null}
              onClick={() => setPlan("talent")}
            />
            <PlanOption
              title="Networking Pack"
              desc="Unlock Networking features in the extension and app."
              selected={plan === "networking"}
              disabled={planDisabled.networking}
              badge={planDisabled.networking ? "Active" : null}
              onClick={() => setPlan("networking")}
            />
            <PlanOption
              title="Bundle"
              desc="Best value — includes Talent + Networking."
              selected={plan === "bundle"}
              disabled={planDisabled.bundle}
              badge={planDisabled.bundle ? "Active" : "Best value"}
              onClick={() => setPlan("bundle")}
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-slate-900 mb-2">Billing</div>
          <div className="grid grid-cols-3 gap-2">
            <BillingBtn active={billing === "monthly"} onClick={() => setBilling("monthly")}>
              Monthly
            </BillingBtn>
            <BillingBtn active={billing === "yearly"} onClick={() => setBilling("yearly")}>
              Yearly
            </BillingBtn>
            <BillingBtn active={billing === "lifetime"} onClick={() => setBilling("lifetime")}>
              Lifetime
            </BillingBtn>
          </div>

          <div className="mt-4 rounded-xl border border-slate-600/20 bg-slate-50 p-4">
            <div className="text-sm text-slate-600">
              Selected:{" "}
              <span className="font-semibold text-slate-900">{PLAN_LABEL[plan]}</span> ·{" "}
              <span className="font-semibold text-slate-900">{BILLING_LABEL[billing]}</span>
            </div>

            <div className="mt-2">
              {pricesErr && <span className="text-red-600">{pricesErr}</span>}

              {showNoPrice && (
                <span className="text-amber-700">
                  No Stripe price found for this option. Check price IDs / environment variables.
                </span>
              )}

              {!pricesErr && currentPrice && (
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-sm text-slate-600">Total</div>
                  <div className="text-3xl font-semibold tracking-tight text-slate-900">
                    {formatMoney(currentPrice.amount, currentPrice.currency)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={startCheckout}
          disabled={loading || !currentPrice || !!planDisabled[plan]}
          className={[
            "mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
            "border border-slate-600/25",
            "bg-violet-600 text-white hover:bg-violet-700",
            "disabled:opacity-40 disabled:hover:bg-violet-600",
          ].join(" ")}
        >
          {loading ? "Redirecting…" : "Continue to Checkout"}
        </button>

        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}

        {/* linki pod przyciskiem usunięte zgodnie z Twoją decyzją */}
      </div>
    </div>
  );
}

function BillingBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-sm font-semibold transition",
        "border-slate-600/25 text-slate-600 hover:bg-slate-50",
        active
          ? "bg-violet-50 ring-2 ring-violet-200 text-slate-900"
          : "bg-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PlanOption({
  title,
  desc,
  selected,
  disabled,
  badge,
  onClick,
}: {
  title: string;
  desc: string;
  selected: boolean;
  disabled: boolean;
  badge: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition",
        "border-slate-600/25",
        selected ? "bg-violet-50 ring-2 ring-violet-200" : "bg-white hover:bg-slate-50",
        disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{desc}</div>
        </div>

        {badge && (
          <span className="rounded-full border border-slate-600/25 bg-slate-50 px-2 py-1 text-xs text-slate-600">
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}

