"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, MapPin, Bell, Settings, CheckCircle2 } from "lucide-react";

type PermissionStatus = "checking" | "granted" | "denied" | "prompt";

interface PermissionsState {
  camera: PermissionStatus;
  location: PermissionStatus;
  notifications: PermissionStatus;
}

// Only active in the Capacitor APK — on the web, skip entirely.
function isCapacitorApp() {
  return typeof window !== "undefined" &&
    !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

async function requestCameraPermission(): Promise<boolean> {
  try {
    const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera === "granted" || camera === "limited";
  } catch {
    return false;
  }
}

async function requestLocationPermission(): Promise<boolean> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.requestPermissions();
    return status.location === "granted" || status.coarseLocation === "granted";
  } catch {
    return false;
  }
}

async function requestNotificationsPermission(): Promise<boolean> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const status = await LocalNotifications.requestPermissions();
    return status.display === "granted";
  } catch {
    return false;
  }
}

async function openAppSettings() {
  try {
    const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
    await BarcodeScanner.openSettings();
  } catch { /* noop */ }
}

const PERMISSION_LABELS = {
  camera: { label: "Câmera", desc: "Necessária para escanear QR Codes dos notebooks", icon: ScanLine },
  location: { label: "Localização", desc: "Necessária para registrar onde a conferência foi realizada", icon: MapPin },
  notifications: { label: "Notificações", desc: "Necessária para receber alertas do sistema", icon: Bell },
} as const;

export function PermissionsGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => !isCapacitorApp());
  const [checking, setChecking] = useState(() => isCapacitorApp());
  const [permissions, setPermissions] = useState<PermissionsState>({
    camera: "checking",
    location: "checking",
    notifications: "checking",
  });
  const [requesting, setRequesting] = useState<keyof PermissionsState | null>(null);

  useEffect(() => {
    if (!isCapacitorApp()) return;

    // Check existing permission status without prompting
    const checkAll = async () => {
      try {
        const [camGranted, locGranted, notifGranted] = await Promise.all([
          requestCameraPermission(),
          (async () => {
            try {
              const { Geolocation } = await import("@capacitor/geolocation");
              const status = await Geolocation.checkPermissions();
              return status.location === "granted" || status.coarseLocation === "granted";
            } catch { return false; }
          })(),
          (async () => {
            try {
              const { LocalNotifications } = await import("@capacitor/local-notifications");
              const status = await LocalNotifications.checkPermissions();
              return status.display === "granted";
            } catch { return false; }
          })(),
        ]);

        const allGranted = camGranted && locGranted && notifGranted;
        if (allGranted) {
          setReady(true);
        } else {
          setPermissions({
            camera: camGranted ? "granted" : "prompt",
            location: locGranted ? "granted" : "prompt",
            notifications: notifGranted ? "granted" : "prompt",
          });
        }
      } catch {
        setReady(true);
      } finally {
        setChecking(false);
      }
    };

    void checkAll();
  }, []);

  const handleRequest = async (key: keyof PermissionsState) => {
    setRequesting(key);
    let granted = false;
    if (key === "camera") granted = await requestCameraPermission();
    else if (key === "location") granted = await requestLocationPermission();
    else if (key === "notifications") granted = await requestNotificationsPermission();

    const next: PermissionsState = { ...permissions, [key]: granted ? "granted" : "denied" };
    setPermissions(next);
    setRequesting(null);

    if (next.camera === "granted" && next.location === "granted" && next.notifications === "granted") {
      setReady(true);
    }
  };

  if (checking) return null;
  if (ready) return <>{children}</>;

  const allDenied = Object.values(permissions).some((s) => s === "denied");

  return (
    <div className="flex flex-col min-h-screen bg-background px-6 py-12 items-center justify-center gap-8">
      {/* Header */}
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <ScanLine className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">ITC NoteScan</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Para funcionar corretamente, o app precisa das seguintes permissões:
        </p>
      </div>

      {/* Permissions list */}
      <div className="w-full max-w-sm space-y-3">
        {(Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[]).map((key) => {
          const { label, desc, icon: Icon } = PERMISSION_LABELS[key];
          const status = permissions[key];
          const isDenied = status === "denied";
          const isGranted = status === "granted";

          return (
            <div
              key={key}
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                isDenied
                  ? "border-destructive/30 bg-destructive/5"
                  : isGranted
                  ? "border-itc-sucesso/30 bg-itc-sucesso/5"
                  : "border-border bg-card"
              }`}
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isGranted ? "bg-itc-sucesso/15" : "bg-muted"}`}>
                {isGranted
                  ? <CheckCircle2 className="h-4 w-4 text-itc-sucesso" />
                  : <Icon className="h-4 w-4 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                {isDenied && (
                  <p className="text-xs text-destructive mt-1">
                    Permissão negada. Abra as configurações do app para habilitá-la.
                  </p>
                )}
              </div>
              {!isGranted && (
                <Button
                  size="sm"
                  variant={isDenied ? "outline" : "default"}
                  className="shrink-0"
                  disabled={requesting === key}
                  onClick={() => handleRequest(key)}
                >
                  {requesting === key ? "..." : isDenied ? "Config." : "Permitir"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {allDenied && (
        <Button variant="outline" className="gap-2" onClick={openAppSettings}>
          <Settings className="h-4 w-4" />
          Abrir Configurações do App
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Todas as permissões são necessárias. O app não funcionará corretamente sem elas.
      </p>
    </div>
  );
}
