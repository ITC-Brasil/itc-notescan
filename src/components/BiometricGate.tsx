"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

// Only active in the Capacitor APK — on the web there is nothing to lock.
function isCapacitorApp() {
  return typeof window !== "undefined" &&
    !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

// Pure helper (no React state) so it can be called from the mount effect and
// the retry handler alike. Devices without enrolled biometrics report
// "unavailable" and are let through — never lock a technician out.
async function verifyBiometric(): Promise<"ok" | "unavailable" | "failed"> {
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    const { isAvailable } = await NativeBiometric.isAvailable();
    if (!isAvailable) return "unavailable";
    await NativeBiometric.verifyIdentity({
      title: "ITC NoteScan",
      subtitle: "Autenticação necessária",
      description: "Use sua digital para desbloquear o app",
    });
    return "ok";
  } catch {
    return "failed";
  }
}

/**
 * Biometric lock shown once at cold start on the APK. It does not replace
 * NextAuth — it only gates the UI behind the device fingerprint. Only mounted
 * inside the technician layout, so it runs on launch, not on every resume.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => isCapacitorApp());
  const [checking, setChecking] = useState(() => isCapacitorApp());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // On web `locked` already starts false; only the APK authenticates.
    if (!isCapacitorApp()) return;
    const run = async () => {
      const result = await verifyBiometric();
      if (result === "failed") setFailed(true);
      else setLocked(false);
      setChecking(false);
    };
    void run();
  }, []);

  const retry = async () => {
    setChecking(true);
    setFailed(false);
    const result = await verifyBiometric();
    if (result === "failed") setFailed(true);
    else setLocked(false);
    setChecking(false);
  };

  if (!locked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <ScanLine className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground">ITC NoteScan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {failed ? "Autenticação necessária para continuar." : "Desbloqueando..."}
        </p>
      </div>
      {checking ? (
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      ) : (
        <Button size="lg" className="w-full max-w-xs" onClick={() => void retry()}>
          <Fingerprint className="h-5 w-5 mr-2" />
          Desbloquear
        </Button>
      )}
    </div>
  );
}
