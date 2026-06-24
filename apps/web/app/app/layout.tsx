import { AppNav } from "./app-nav";

export default function PrivateAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#060706] text-neutral-100">
      <AppNav />
      {children}
    </div>
  );
}
