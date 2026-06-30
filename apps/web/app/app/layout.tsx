import { AppNav } from "./app-nav";

export default function PrivateAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="vf-app-shell min-h-screen bg-[#050202] text-[#F8EEDF]">
      <div className="vf-app-ambient" aria-hidden="true" />
      <AppNav />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
