"use client";

import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "./components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  );
}