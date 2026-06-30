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

function AppBrandMark() {
  return (
    <span className="vf-app-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" role="img">
        <path className="vf-app-brand-frame" d="M9 7.5H31L34.5 11V29L31 32.5H9L5.5 29V11L9 7.5Z" />
        <path className="vf-app-brand-path" d="M12 14.5H17.8C19.5 14.5 20.5 15.4 20.5 17V23C20.5 24.6 21.5 25.5 23.2 25.5H28" />
        <path className="vf-app-brand-path" d="M28 14.5H22.2C20.5 14.5 19.5 15.4 19.5 17V23C19.5 24.6 18.5 25.5 16.8 25.5H12" />
        <path className="vf-app-brand-check" d="M15.2 20.4L18.1 23.2L24.9 16.8" />
        <circle className="vf-app-brand-dot" cx="12" cy="14.5" r="1.6" />
        <circle className="vf-app-brand-dot" cx="28" cy="25.5" r="1.6" />
      </svg>
    </span>
  );
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[#E8C999]/10 bg-[#050202]/82 px-5 py-3 text-[#F8EEDF] backdrop-blur-xl sm:px-6 lg:px-8">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link href="/app" className="flex items-center gap-2.5">
          <AppBrandMark />
          <span className="text-base font-semibold tracking-tight text-[#F8EEDF]">MergeMint</span>
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
                      ? "rounded-md border border-[#E8C999]/28 bg-[#E8C999]/10 px-3 py-1.5 text-[#F8EEDF] shadow-[0_0_18px_rgba(232,201,153,0.07)]"
                      : "rounded-md border border-transparent px-3 py-1.5 text-[#ECD5BC]/62 transition hover:border-[#E8C999]/12 hover:bg-[#F8EEDF]/[0.045] hover:text-[#F8EEDF]"
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
