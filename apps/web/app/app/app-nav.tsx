"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "../components/theme-provider";

const navItems = [
  ["Dashboard", "/app"],
  ["Clients", "/app/clients"],
  ["Projects", "/app/projects"],
  ["Features", "/app/features"],
  ["Release Board", "/app/board"],
  ["GitHub", "/app/settings/github"],
  ["Billing", "/app/billing"]
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/85 px-5 py-3 text-[var(--text)] backdrop-blur-md sm:px-6 lg:px-8">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link href="/app" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mint)]/30 bg-[var(--mint)]/10 text-xs font-bold text-[var(--mint)]">
            MM
          </span>
          <span className="text-base font-semibold tracking-tight text-[var(--text)]">MergeMint</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {navItems.map(([label, href]) => {
              const active =
                href === "/app" ? pathname === href : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    active
                      ? "rounded-md border border-[var(--mint)]/35 bg-[var(--mint)]/10 px-3 py-1.5 text-[var(--mint)] shadow-xs"
                      : "rounded-md border border-transparent px-3 py-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
                  }
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
