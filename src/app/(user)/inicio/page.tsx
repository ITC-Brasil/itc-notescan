"use client";

import Link from "next/link";
import { ScanLine, AlertTriangle, Wifi, WifiOff, ClipboardList, Mouse, BatteryCharging, Headphones, CheckCircle2, XCircle, Cable, FileText } from "lucide-react";
import { ConferenceSummary } from "@/components/ConferenceSummary";
import { useSession } from "next-auth/react";
import { countsForMeta, useConferences, useInfiniteConferences, type ConferenceRecord } from "@/hooks/useConferences";
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
import { originalHostname } from "@/lib/notebook-hostname";
import { conferenceCounts } from "@/lib/meta-categoria";

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
  const faltantes = conferenceCounts(conference).faltantesList;
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
            {faltantes.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span className="text-sm tabular-nums text-foreground">{originalHostname(item.hostname)}</span>
                {item.detail && <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumoModal({ conference, onClose }: { conference: ConferenceRecord; onClose: () => void }) {
  const counts = conferenceCounts(conference);
  const um = conference.um;
  const hasPeripherals = um.mouses || um.carregadores || um.fones;

  const startDate = new Date(conference.dataInicio);
  const endDate = new Date(conference.dataFim);
  const subtitle = `${um.nome} · ${startDate.toLocaleDateString("pt-BR")} · ${startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às ${endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(SHEET_CLASS, "max-h-[85vh] overflow-y-auto")}>
        <DialogHeader>
          <DialogTitle>Resumo</DialogTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </DialogHeader>

        <ConferenceSummary
          tecnico={conference.user.nome}
          localizacao={conference.localizacao}
          escaneados={counts.escaneados}
          faltantes={counts.faltantes}
          manutencao={counts.manutencao}
          peripherals={hasPeripherals ? {
            ...(um.mouses && { mouses: conference.mousesQtd }),
            ...(um.carregadores && { carregadores: conference.carregadoresQtd }),
            ...(um.fones && { fones: conference.fonesQtd }),
          } : undefined}
          faltantesList={counts.faltantesList}
          manutencaoList={counts.manutencaoList}
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
  const { escaneados, ativos: totalAtivos } = conferenceCounts(conference);
  const um = conference.um;
  const hasPeripherals = um.mouses || um.carregadores || um.fones;
  const hasFaltantes = conference.status === "CONCLUIDO_FALTANTES";

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-1 px-3 py-3 space-y-2.5">
        {/* Row 1: UM + status */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: um.project.cor }} />
              <span className="text-sm font-bold text-foreground truncate">{um.nome}</span>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
              {d.toLocaleDateString("pt-BR")} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {escaneados}/{totalAtivos} escaneados
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

        {/* Row 2: ações */}
        <div className="flex items-center gap-1.5 flex-wrap">
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

  // Itinerantes acompanham a conferência da carreta: fora dos cards e da meta.
  const fixasHoje = conferences?.filter(countsForMeta);
  const todayTotal = fixasHoje?.length ?? 0;
  const todayOk = fixasHoje?.filter((c) => c.status === "CONCLUIDO_OK").length ?? 0;
  const todayFaltantes = fixasHoje?.filter((c) => c.status === "CONCLUIDO_FALTANTES").length ?? 0;
  const meta = session?.user.metaDiaria ?? 2;
  const dailyLimitReached = meta > 0 && todayTotal >= meta;

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Olá,</p>
          <p className="text-lg font-bold text-foreground leading-tight">{session?.user.nome}</p>
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
              "gap-1.5 px-2.5 py-1 font-semibold uppercase tracking-wide",
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
          <div className="rounded-xl border border-border bg-card shadow-1 p-3 text-center">
            <p className="text-3xl font-extrabold text-foreground tabular-nums">{todayTotal}</p>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground mt-1">de {meta} hoje</p>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-1 p-3 text-center">
            <p className="text-3xl font-extrabold text-itc-sucesso tabular-nums">{todayOk}</p>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground mt-1">OK</p>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-1 p-3 text-center">
            <p className={cn("text-3xl font-extrabold tabular-nums", todayFaltantes > 0 ? "text-destructive" : "text-foreground")}>
              {todayFaltantes}
            </p>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground mt-1">Incompletos</p>
          </div>
        </div>
      )}
      </div>

      {/* Aviso de meta diária (mobile) */}
      {dailyLimitReached ? (
        <div className="sm:hidden w-full rounded-2xl border border-itc-atencao/30 bg-itc-atencao/10 p-5 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-itc-atencao/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-7 w-7 text-itc-atencao" />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-itc-atencao leading-tight">Meta diária atingida</p>
            <p className="text-sm text-muted-foreground leading-tight">Conferências para notebooks de Pedagogas, Instrutores e Coordenadoras (SEDET) continuam liberadas em &quot;Nova conferência&quot;.</p>
          </div>
        </div>
      ) : null}
      {/* Sempre habilitado: com a meta atingida, o seletor desabilita só as UMs fixas. */}
        <Link href="/scanner" className="sm:hidden block">
          <div className="w-full min-h-14 rounded-2xl bg-primary px-5 py-4 flex items-center justify-center gap-3 shadow-1 active:scale-[0.98] transition-transform">
            <ScanLine className="h-6 w-6 text-primary-foreground shrink-0" />
            <span className="text-base font-bold uppercase tracking-wide text-primary-foreground">Nova Conferência</span>
          </div>
        </Link>

      {/* Histórico */}
      <div className="mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico recente</p>
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
