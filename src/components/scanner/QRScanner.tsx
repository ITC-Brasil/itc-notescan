"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/usePlatform";
import { NativeQRScanner, type NativeScanUi } from "./NativeQRScanner";

interface QRScannerProps {
  /** Todos os rawValue de um frame — um único callback por frame */
  onScan: (rawValues: string[]) => void;
  active?: boolean;
  className?: string;
  nativeUi?: NativeScanUi;
}

export function QRScanner({ onScan, active = true, className, nativeUi }: QRScannerProps) {
  // All hooks must be called unconditionally — branching happens in the JSX return.
  const platform = usePlatform();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    // Web scanner only runs in browser/PWA. On Android APK the native camera is used.
    if (platform === "android" || !active) return;

    let stopped = false;

    async function startScanner() {
      try {
        const { Scanner, setZXingModuleOverrides } = await import("@yudiel/react-qr-scanner");
        // Padrão da lib é baixar do jsdelivr (bloqueado pela CSP). Cópia local via predev/prebuild.
        setZXingModuleOverrides({
          locateFile: (path: string, prefix: string) =>
            path.endsWith(".wasm") ? `/${path}` : prefix + path,
        });
        if (stopped || !containerRef.current) return;

        // Mount by dynamically importing and rendering
        const React = await import("react");
        const ReactDOM = await import("react-dom/client");

        if (!containerRef.current) return;

        setReady(true);

        const root = ReactDOM.createRoot(containerRef.current);
        root.render(
          React.createElement(Scanner, {
            onScan: (results: { rawValue: string }[]) => {
              // v2 do @yudiel/react-qr-scanner entrega um array por detecção —
              // repassa o frame inteiro; a dedupe é do reducer (SCAN_BATCH).
              const rawValues = results
                .map((r) => r.rawValue)
                .filter((v): v is string => !!v);
              if (rawValues.length > 0) {
                onScan(rawValues);
              }
            },
            onError: (err: unknown) => {
              setError(err instanceof Error ? err.message : "Câmera não disponível");
            },
            styles: {
              container: { width: "100%", height: "100%" },
              video: { width: "100%", height: "100%", objectFit: "cover" },
            },
            constraints: { facingMode: "environment" },
            scanDelay: 500,
          }),
        );

        scannerRef.current = { stop: () => root.unmount() };
      } catch {
        setError("Câmera não disponível");
        setReady(false);
      }
    }

    void startScanner();

    return () => {
      stopped = true;
      scannerRef.current?.stop();
      setReady(false);
    };
  }, [active, onScan, platform]);

  // On Android APK: use the native camera scanner
  if (platform === "android") {
    return (
      <NativeQRScanner
        onScan={onScan}
        onError={(err) => console.error("Native scanner error:", err)}
        isActive={active}
        ui={nativeUi}
      />
    );
  }

  // Browser / PWA: web camera scanner
  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-xl border border-border",
          className,
        )}
      >
        <CameraOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center px-4">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-black", className)}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
          <Camera className="h-8 w-8 text-muted-foreground animate-pulse" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
      {/* Viewfinder overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-48 w-48 relative">
          <span className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-primary rounded-tl-sm" />
          <span className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-primary rounded-tr-sm" />
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary rounded-bl-sm" />
          <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-primary rounded-br-sm" />
        </div>
      </div>
    </div>
  );
}
