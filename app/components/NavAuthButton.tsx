"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/app/lib/supabase-client";

export default function NavAuthButton() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setIsSignedIn(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!isSignedIn) {
    return (
      <Link
        href="/login"
        className="rounded-xl px-3 py-2 hover:bg-black/5 transition"
      >
        Login
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-xl px-3 py-2 hover:bg-black/5 transition"
    >
      Sign out
    </button>
  );
}

