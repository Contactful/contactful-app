import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SignOutButton from "./components/SignOutButton";

export const metadata: Metadata = {
  title: "Contactful",
  description: "Contactful App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* body bez cf-bg, żeby nic nie “przebijało” poza app shell */}
      <body className="bg-white" suppressHydrationWarning>
        {/* cf-bg przeniesione na wrapper */}
        <div className="min-h-dvh flex flex-col cf-bg">
          <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur">
            <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="https://contactful.app/wp-content/uploads/2025/11/Contactful.app-logo.png"
                  alt="Contactful"
                  width={180}
                  height={46}
                  priority
                  className="h-10 w-auto object-contain"
                />
              </Link>

              <nav className="flex items-center gap-2 text-sm">
                <Link
                  className="rounded-full px-4 py-2 bg-white/70 hover:bg-slate-100 border border-slate-200 transition"
                  href="/"
                >
                  Home
                </Link>
                <Link
                  className="rounded-full px-4 py-2 bg-white/70 hover:bg-slate-100 border border-slate-200 transition"
                  href="/upgrade"
                >
                  Upgrade
                </Link>

                <span className="ml-1">
                  <SignOutButton />
                </span>
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
            {children}
          </main>

          {/* footer z tłem nieprzezroczystym, żeby nie było “fioletowych pasów” */}
          <footer className="border-t border-slate-200/70 bg-white">
            <div className="mx-auto max-w-6xl px-5 py-6 text-sm text-slate-500 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>© {new Date().getFullYear()} Contactful</div>
              <div className="flex items-center gap-3">
                <a
                  href="https://contactful.app/privacy-policy/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:text-brand-800"
                >
                  Privacy Policy
                </a>
                <span className="text-slate-300">•</span>
                <a
                  href="https://contactful.app/terms-of-use/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:text-brand-800"
                >
                  Terms of Use
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

