"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  ["Dashboard", "/app"],
  ["Clients", "/app/clients"],
  ["Projects", "/app/projects"],
  ["Features", "/app/features"]
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060706]/82 px-5 py-4 text-neutral-100 backdrop-blur-xl sm:px-6 lg:px-8">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link href="/app" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
            VF
          </span>
          <span className="text-base font-semibold tracking-tight">Veriflow</span>
        </Link>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          {navItems.map(([label, href]) => {
            const active =
              href === "/app" ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-emerald-100 shadow-sm shadow-emerald-950/30"
                    : "rounded-md border border-white/10 bg-white/[0.025] px-3 py-2 text-neutral-300 transition hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-white/[0.055] hover:text-white"
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
