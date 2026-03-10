"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Scanner from "@/components/Scanner";
import SpotifyPlayer from "@/components/SpotifyPlayer";
import { Loader2 } from "lucide-react";

export default function PlayPage() {
  const { status } = useSession();
  const router = useRouter();

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);

  useEffect(() => {
    // Redirect unauthenticated users
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // Automatically handled by useEffect
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--color-background)] text-slate-100 selection:bg-green-500/30">
      <div className="w-full max-w-lg bg-slate-800/80 p-8 rounded-3xl border border-slate-700/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-green-500/10 blur-[60px] pointer-events-none" />

        <div className="relative z-10 w-full min-h-[400px] flex items-center justify-center">
          <div className={`w-full ${!currentTrackId ? "block" : "hidden"}`}>
            <Scanner onScan={(trackId) => setCurrentTrackId(trackId)} />
          </div>
          <div className={`w-full ${currentTrackId ? "block" : "hidden"}`}>
            <SpotifyPlayer
              trackId={currentTrackId || ""}
              onScanNext={() => setCurrentTrackId(null)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
