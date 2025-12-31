// app/page.tsx
import { Suspense } from "react";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic"; // unikamy problemów z pre-renderem

export default function Page() {
  return (
    <Suspense fallback={<div className="text-slate-600">Loading…</div>}>
      <HomeClient />
    </Suspense>
  );
}

