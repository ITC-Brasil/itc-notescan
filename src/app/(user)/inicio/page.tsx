"use client";

import Link from "next/link";
import { ScanLine, AlertTriangle, Wifi, WifiOff, ClipboardList, Mouse, BatteryCharging, Headphones, CheckCircle2, XCircle, Cable, FileText } from "lucide-react";
import { ConferenceSummary } from "@/components/ConferenceSummary";
import { useSession } from "next-auth/react";
import { useConferences, useInfiniteConferences, type ConferenceRecord } from "@/hooks/useConferences";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/* ─── Modals ─── */

// Bottom-sheet styling for mobile dialogs — anchored to the bottom edge
const SHEET_CLASS =
  "max-w-sm top-auto bottom-0 translate-y-0 rounded-t-2xl rounded-b-none p-5 pb-8";

function PeripheralsModal({ conference, onClose }: { conference: ConferenceRecord; onClose: () => void }) {
  const um = conference.um;
  const hasAny = (um.mouses && conference.mousesQtd !== null) ||
    (um.carregadores && conference.carregadoresQtd !== null) ||
    (um.fones && conference.fonesQtd !== null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={SHEET_CLASS}>
        <DialogHeader>
          <DialogTitle>Periféricos</DialogTitle>
        </DialogHeader>
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">Nenhum periférico registrado.</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {um.mouses && (
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Mouse className="h-4 w-4" />
                  Mouses
                </span>
                <span className="font-semibold">{conference.mousesQtd ?? "—"}</span>
              </div>
            )}
            {um.carregadores && (
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <BatteryCharging className="h-4 w-4" />
                  Carregadores
                </span>
                <span className="font-semibold">{conference.carregadoresQtd ?? "—"}</span>
              </div>
            )}
            {um.fones && (
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Headphones className="h-4 w-4" />
                  Fones de Ouvido
                </span>
                <span className="font-semibold">{conference.fonesQtd ?? "—"}</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FaltantesModal({ conference, onClose }: { conference: ConferenceRecord; onClose: () => void }) {
  const faltantes = conference.items.filter((i) => i.status === "FALTANTE");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={SHEET_CLASS}>
        <DialogHeader>
          <DialogTitle>Dispositivos Faltantes</DialogTitle>
        </DialogHeader>
        {faltantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dispositivo faltante.</p>
        ) : (
          <div className="divide-y divide-destructive/10 rounded-xl border border-destructive/20 bg-destructive/5 max-h-64 overflow-y-auto">
            {faltantes.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span className="text-sm tabular-nums text-foreground">{item.notebook.hostname}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumoModal({ conference, onClose }: { conference: ConferenceRecord; onClose: () => void }) {
  const isOk = conference.status === "CONCLUIDO_OK";
  const escaneados = conference.items.filter((i) => i.status === "ESCANEADO").length;
  const faltantes = conference.items.filter((i) => i.status === "FALTANTE");
  const manutencao = conference.items.filter((i) => i.status === "MANUTENCAO");
  const um = conference.um;
  const hasPeripherals = um.mouses || um.carregadores || um.fones;

  const startDate = new Date(conference.dataInicio);
  const endDate = new Date(conference.dataFim);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(SHEET_CLASS, "max-h-[85vh] overflow-y-auto")}>
        <DialogHeader>
          <DialogTitle>Resumo</DialogTitle>
        </DialogHeader>

        <div className={cn("rounded-xl p-3 text-center text-sm", isOk ? "bg-itc-sucesso/10 border border-itc-sucesso/30" : "bg-destructive/10 border border-destructive/30")}>
          <p className="font-bold text-foreground">{um.project.nome} / {um.nome}</p>
          <p className="text-muted-foreground">
            {startDate.toLocaleDateString("pt-BR")} · {startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às {endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          {conference.localizacao && <p className="text-muted-foreground text-xs mt-0.5">📍 {conference.localizacao}</p>}
        </div>

        <ConferenceSummary
          totalAtivos={escaneados + faltantes.length}
          escaneados={escaneados}
          faltantes={faltantes.length}
          manutencao={manutencao.length}
          peripherals={hasPeripherals ? {
            ...(um.mouses && { mouses: conference.mousesQtd }),
            ...(um.carregadores && { carregadores: conference.carregadoresQtd }),
            ...(um.fones && { fones: conference.fonesQtd }),
          } : undefined}
          faltantesList={faltantes.map((item, i) => ({ id: String(i), hostname: item.notebook.hostname }))}
          manutencaoList={manutencao.map((item, i) => ({ id: String(i), hostname: item.notebook.hostname }))}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ─── Conference Row ─── */
function ConferenceRow({ conference }: { conference: ConferenceRecord }) {
  const [modal, setModal] = useState<"perifericos" | "faltantes" | "resumo" | null>(null);
  const isOk = conference.status === "CONCLUIDO_OK";
  const d = new Date(conference.dataInicio);
  const escaneados = conference.items.filter((i) => i.status === "ESCANEADO").length;
  const totalAtivos = escaneados + conference.items.filter((i) => i.status === "FALTANTE").length;
  const um = conference.um;
  const hasPeripherals = um.mouses || um.carregadores || um.fones;
  const hasFaltantes = conference.status === "CONCLUIDO_FALTANTES";

  return (
    <>
      <div className="rounded-xl border border-border bg-card px-3 py-3 space-y-2">
        {/* Row 1: date + UM + status */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: um.project.cor }} />
              <span className="text-sm font-medium text-foreground truncate">{um.nome}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {d.toLocaleDateString("pt-BR")} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <Badge
            className={cn("text-xs shrink-0", isOk ? "bg-itc-sucesso/15 text-itc-sucesso border-itc-sucesso/30" : "bg-destructive/10 text-destructive border-destructive/30")}
            variant="outline"
          >
            {isOk ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isOk ? "COMPLETO" : "INCOMPLETO"}
          </Badge>
        </div>

        {/* Row 2: contagem + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground tabular-nums">
            {escaneados}/{totalAtivos} escaneados
          </span>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
            {hasPeripherals && (
              <button
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                onClick={() => setModal("perifericos")}
              >
                <Cable className="h-3 w-3" />
                Periféricos
              </button>
            )}
            {hasFaltantes && (
              <button
                className="text-xs px-2 py-0.5 rounded-md border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => setModal("faltantes")}
              >
                Ver Faltantes
              </button>
            )}
            <button
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
              onClick={() => setModal("resumo")}
            >
              <FileText className="h-3 w-3" />
              Ver Resumo
            </button>
          </div>
        </div>
      </div>

      {modal === "perifericos" && <PeripheralsModal conference={conference} onClose={() => setModal(null)} />}
      {modal === "faltantes" && <FaltantesModal conference={conference} onClose={() => setModal(null)} />}
      {modal === "resumo" && <ResumoModal conference={conference} onClose={() => setModal(null)} />}
    </>
  );
}

/* ─── Main Page ─── */
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

  const {
    data: historyPages,
    isLoading: loadingHistory,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteConferences({ userId: session?.user.id }, 10);
  const allConferences = historyPages?.pages.flat();

  useEffect(() => {
    if (online && outboxCount > 0) {
      processOutbox().catch(() => undefined);
    }
  }, [online, outboxCount]);

  const todayTotal = conferences?.length ?? 0;
  const todayOk = conferences?.filter((c) => c.status === "CONCLUIDO_OK").length ?? 0;
  const todayFaltantes = conferences?.filter((c) => c.status === "CONCLUIDO_FALTANTES").length ?? 0;
  const meta = session?.user.metaDiaria ?? 2;
  const dailyLimitReached = meta > 0 && todayTotal >= meta;

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
          <Badge
            variant="outline"
            className={cn(
              "gap-1 font-medium",
              online
                ? "bg-itc-sucesso/10 border-itc-sucesso/40 text-itc-sucesso shadow-[0_0_8px_-1px_var(--itc-sucesso)]"
                : "bg-destructive/10 border-destructive/40 text-destructive shadow-[0_0_8px_-1px_var(--destructive)]",
            )}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{online ? "Online" : "Offline"}</span>
          </Badge>
        </div>
      </div>

      {/* Stats cards */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Conferências diárias
        </p>
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
          <div className="rounded-xl border border-itc-sucesso/30 bg-itc-sucesso/5 p-3 text-center">
            <p className="text-2xl font-bold text-itc-sucesso tabular-nums">{todayOk}</p>
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
            <p className="text-xs text-muted-foreground mt-0.5">Incompletos</p>
          </div>
        </div>
      )}
      </div>

      {/* INICIAR button — hidden on desktop (sm+); blocked when daily meta reached */}
      {dailyLimitReached ? (
        <div className="sm:hidden w-full rounded-2xl border border-itc-atencao/30 bg-itc-atencao/10 p-5 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-itc-atencao/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-7 w-7 text-itc-atencao" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-itc-atencao leading-tight">Meta diária atingida</p>
            <p className="text-sm text-muted-foreground leading-tight">Você já concluiu {meta} conferência{meta !== 1 ? "s" : ""} hoje.</p>
          </div>
        </div>
      ) : (
        <Link href="/scanner" className="sm:hidden block">
          <div className="w-full rounded-2xl bg-primary p-5 flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform">
            <div className="h-12 w-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
              <ScanLine className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-primary-foreground leading-tight">Iniciar Conferência</p>
              <p className="text-sm text-primary-foreground/70 leading-tight">Escanear notebooks da UM</p>
            </div>
          </div>
        </Link>
      )}

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
          <div className="rounded-xl border border-border p-6 text-center flex flex-col items-center">
            <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center mb-3">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma conferência realizada.</p>
            <p className="text-xs text-muted-foreground mt-1">Inicie sua primeira conferência acima.</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {allConferences.map((c) => (
              <ConferenceRow key={c.id} conference={c} />
            ))}
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
              >
                {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
