// app/success/page.tsx
import { Suspense } from "react";
import Link from "next/link";

function SuccessInner({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const plan = typeof searchParams?.plan === "string" ? searchParams?.plan : "";
  const billing = typeof searchParams?.billing === "string" ? searchParams?.billing : "";
  const sessionId =
    typeof searchParams?.session_id === "string" ? searchParams?.session_id : "";

  return (
    <div className="text-slate-600">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-600/25 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Payment successful</h1>

        <p className="mt-2 text-slate-600">
          Thanks! Your access should be updated shortly.
        </p>

        {(plan || billing) && (
          <div className="mt-4 rounded-xl border border-slate-600/20 bg-slate-50 p-4 text-sm">
            <div className="text-slate-600">
              Activated:{" "}
              <span className="font-semibold text-slate-900">
                {plan || "—"}
              </span>{" "}
              ·{" "}
              <span className="font-semibold text-slate-900">
                {billing || "—"}
              </span>
            </div>

            {sessionId && (
              <div className="mt-2 break-all text-xs text-slate-600">
                Session: <span className="text-slate-900">{sessionId}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-2">
          <Link
            href="/"
            className="rounded-xl border border-slate-600/25 bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Go to Home
          </Link>

          <Link
            href="/upgrade"
            className="rounded-xl border border-slate-600/25 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Manage plan
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage(props: any) {
  return (
    <Suspense fallback={<div className="text-slate-600">Loading…</div>}>
      <SuccessInner {...props} />
    </Suspense>
  );
}

