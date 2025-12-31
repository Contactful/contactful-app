// app/upgrade/page.tsx
import { Suspense } from "react";
import UpgradeClient from "./upgrade-client";

export const dynamic = "force-dynamic";

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="text-slate-600">Loading upgrade…</div>}>
      <UpgradeClient />
    </Suspense>
  );
}

