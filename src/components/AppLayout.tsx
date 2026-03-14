import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { usePresence } from "@/hooks/usePresence";

export function AppLayout({ children }: { children: ReactNode }) {
  usePresence();
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-lg pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
