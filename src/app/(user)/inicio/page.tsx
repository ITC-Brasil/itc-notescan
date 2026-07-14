"use client";

import Link from "next/link";
import { ScanLine, CheckCircle2, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { useConferences } from "@/hooks/useConferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getOutboxCount } from "@/lib/offline/sync";
import { processOutbox } from "@/lib/offline/sync";

function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof window !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function useOutboxCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => getOutboxCount().then(setCount).catch(() => undefined);
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, []);
  return count;
}

export default function InicioPage() {
  const { data: session } = useSession();
  const online = useOnlineStatus();
  const outboxCount = useOutboxCount();

  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

  const { data: conferences, isLoading } = useConferences({
    limit: 50,
    from,
    to,
    userId: session?.user.id,
  });

  const { data: allConferences, isLoading: loadingHistory } = useConferences({
    limit: 20,
    userId: session?.user.id,
  });

  useEffect(() => {
    if (online && outboxCount > 0) {
      processOutbox().catch(() => undefined);
    }
  }, [online, outboxCount]);

  const todayTotal = conferences?.length ?? 0;
  const todayOk = conferences?.filter((c) => c.status === "CONCLUIDO_OK").length ?? 0;
  const todayFaltantes = conferences?.filter((c) => c.status === "CONCLUIDO_FALTANTES").length ?? 0;
  const meta = session?.user.metaDiaria ?? 2;

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Olá,</p>
          <p className="font-semibold text-foreground">{session?.user.nome}</p>
        </div>
        <div className="flex items-center gap-2">
          {outboxCount > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              <WifiOff className="h-3 w-3" />
              {outboxCount} pendente{outboxCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <div className={cn("flex items-center gap-1 text-xs", online ? "text-green-500" : "text-muted-foreground")}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{online ? "Online" : "Offline"}</span>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground tabular-nums">{todayTotal}</p>
            <p className="text-xs text-muted-foreground mt-0.5">de {meta} hoje</p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 text-center">
            <p className="text-2xl font-bold text-green-500 tabular-nums">{todayOk}</p>
            <p className="text-xs text-muted-foreground mt-0.5">OK</p>
          </div>
          <div className={cn(
            "rounded-xl border p-3 text-center",
            todayFaltantes > 0
              ? "border-destructive/30 bg-destructive/5"
              : "border-border bg-card",
          )}>
            <p className={cn("text-2xl font-bold tabular-nums", todayFaltantes > 0 ? "text-destructive" : "text-foreground")}>
              {todayFaltantes}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Faltantes</p>
          </div>
        </div>
      )}

      {/* INICIAR button — hidden on desktop (sm+) */}
      <Link href="/scanner" className="sm:hidden block">
        <div className="w-full rounded-2xl bg-primary p-5 flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform">
          <div className="h-12 w-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
            <ScanLine className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-primary-foreground leading-tight">Iniciar Conferência</p>
            <p className="text-sm text-primary-foreground/70 leading-tight">Escanear notebooks da UM</p>
          </div>
        </div>
      </Link>

      {/* Histórico */}
      <div className="mt-2">
        <p className="text-sm font-semibold text-foreground mb-3">Histórico recente</p>
        {loadingHistory ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !allConferences?.length ? (
          <div className="rounded-xl border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma conferência realizada.</p>
            <p className="text-xs text-muted-foreground mt-1">Inicie sua primeira conferência acima.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allConferences.map((c) => {
              const d = new Date(c.dataInicio);
              const isOk = c.status === "CONCLUIDO_OK";
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  {isOk ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.um.project.cor }}
                      />
                      <span className="text-sm font-medium text-foreground truncate">
                        {c.um.nome}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.toLocaleDateString("pt-BR")} {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}{c._count.items} notebooks
                    </p>
                  </div>
                  <Badge
                    variant={isOk ? "secondary" : "destructive"}
                    className="text-xs flex-shrink-0"
                  >
                    {isOk ? "OK" : "Faltantes"}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
