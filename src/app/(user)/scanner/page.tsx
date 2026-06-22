"use client";

import { useCallback, useState } from "react";
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Check,
  Loader2,
  Package,
  Wrench,
} from "lucide-react";
import { useConference, type NotebookSlim, type UMSlim } from "@/hooks/useConference";
import { useUMs } from "@/hooks/useUMs";
import { useNotebooks } from "@/hooks/useNotebooks";
import { QRScanner } from "@/components/scanner/QRScanner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ─── Phase: UM Selection ─── */
function UMSelectionPhase({
  onSelect,
}: {
  onSelect: (um: UMSlim, notebooks: NotebookSlim[]) => void;
}) {
  const { data: ums, isLoading: loadingUMs } = useUMs();
  const [selectedUmId, setSelectedUmId] = useState("");

  const selectedUM = ums?.find((u) => u.id === selectedUmId);
  const { data: notebooks, isLoading: loadingNotebooks } = useNotebooks(
    selectedUmId || undefined,
  );

  const handleStart = () => {
    if (!selectedUM || !notebooks) return;
    const um: UMSlim = {
      id: selectedUM.id,
      nome: selectedUM.nome,
      project: { nome: selectedUM.project.nome, cor: selectedUM.project.cor },
    };
    const nbs: NotebookSlim[] = notebooks.map((n) => ({
      id: n.id,
      hostname: n.hostname,
      serial: n.serial,
      status: n.status,
    }));
    onSelect(um, nbs);
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 gap-8">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <ScanLine className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Iniciar Conferência</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione a Unidade Móvel para conferir
        </p>
      </div>

      <div className="w-full space-y-4">
        <Select value={selectedUmId} onValueChange={setSelectedUmId} disabled={loadingUMs}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder={loadingUMs ? "Carregando..." : "Selecione a UM"} />
          </SelectTrigger>
          <SelectContent>
            {ums?.map((um) => (
              <SelectItem key={um.id} value={um.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: um.project.cor }}
                  />
                  {um.project.nome} / {um.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedUM && (
          <div className="rounded-xl border border-border bg-card p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Esperados</span>
              <span className="font-medium">{selectedUM.quantidadeEsperada}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cadastrados</span>
              <span className="font-medium">
                {loadingNotebooks ? "..." : (notebooks?.length ?? 0)}
              </span>
            </div>
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!selectedUmId || loadingNotebooks || !notebooks?.length}
          onClick={handleStart}
        >
          Iniciar
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Phase: Scanning ─── */
function ScanningPhase({
  state,
  onScan,
  onFinish,
}: {
  state: ReturnType<typeof useConference>["state"];
  onScan: (value: string) => void;
  onFinish: () => void;
}) {
  const total = state.pending.length + state.scanned.length;
  const progress = total > 0 ? (state.scanned.length / total) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* UM header */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-border bg-card">
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: state.um?.project.cor }}
        />
        <span className="text-sm font-medium text-foreground">{state.um?.nome}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {state.scanned.length}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Camera */}
      <QRScanner onScan={onScan} active className="mx-4 mt-3 h-52" />

      {/* Feedback */}
      {state.error && (
        <div className="mx-4 mt-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
          <p className="text-sm text-destructive font-medium">{state.error}</p>
        </div>
      )}
      {state.lastScanned && !state.error && (
        <div className="mx-4 mt-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            {state.lastScanned}
          </p>
        </div>
      )}

      {/* Lists */}
      <div className="flex-1 overflow-hidden flex gap-3 px-4 mt-3 pb-2">
        {/* Pending */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Pendentes ({state.pending.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 rounded-lg bg-muted/30 p-1.5">
            {state.pending.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-2">Todos escaneados!</p>
            ) : (
              state.pending.map((nb) => (
                <div
                  key={nb.id}
                  className="text-xs font-mono px-2 py-1 rounded bg-card border border-border text-foreground"
                >
                  {nb.hostname}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scanned */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Escaneados ({state.scanned.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 rounded-lg bg-muted/30 p-1.5">
            {state.scanned.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-2">Nenhum ainda</p>
            ) : (
              [...state.scanned].reverse().map((nb) => (
                <div
                  key={nb.id}
                  className="text-xs font-mono px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400"
                >
                  {nb.hostname}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Finish button */}
      <div className="px-4 pb-2">
        <Button
          variant={state.pending.length > 0 ? "destructive" : "default"}
          size="lg"
          className="w-full"
          onClick={onFinish}
        >
          {state.pending.length > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Finalizar com {state.pending.length} faltante{state.pending.length !== 1 ? "s" : ""}
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Finalizar — todos escaneados
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─── Phase: Summary ─── */
function SummaryPhase({
  state,
  onConfirm,
  onBack,
}: {
  state: ReturnType<typeof useConference>["state"];
  onConfirm: () => void;
  onBack: () => void;
}) {
  const isOk = state.pending.length === 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Status header */}
      <div
        className={cn(
          "rounded-2xl p-4 text-center",
          isOk ? "bg-green-500/10 border border-green-500/30" : "bg-destructive/10 border border-destructive/30",
        )}
      >
        {isOk ? (
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
        ) : (
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-2" />
        )}
        <h2 className="font-bold text-lg text-foreground">
          {isOk ? "Conferência OK" : `${state.pending.length} Faltante${state.pending.length !== 1 ? "s" : ""}`}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {state.um?.project.nome} / {state.um?.nome}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-green-500 tabular-nums">{state.scanned.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Escaneados</p>
        </div>
        <div className={cn("rounded-xl border p-3 text-center", state.pending.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card")}>
          <p className={cn("text-2xl font-bold tabular-nums", state.pending.length > 0 ? "text-destructive" : "text-foreground")}>
            {state.pending.length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Faltantes</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground tabular-nums">{state.maintenance.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Manutenção</p>
        </div>
      </div>

      {/* Faltantes list */}
      {state.pending.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Notebooks faltantes</p>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 divide-y divide-destructive/10">
            {state.pending.map((nb) => (
              <div key={nb.id} className="flex items-center gap-2 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                <span className="text-sm font-mono text-foreground">{nb.hostname}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance list */}
      {state.maintenance.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Em manutenção</p>
          <div className="rounded-xl border border-border divide-y divide-border">
            {state.maintenance.map((nb) => (
              <div key={nb.id} className="flex items-center gap-2 px-3 py-2">
                <Wrench className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-mono text-foreground">{nb.hostname}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location */}
      {state.location && (
        <p className="text-xs text-muted-foreground text-center">
          📍 {state.location}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Continuar
        </Button>
        <Button
          className={cn("flex-1", !isOk && "bg-destructive hover:bg-destructive/90")}
          onClick={onConfirm}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Confirmar
        </Button>
      </div>
    </div>
  );
}

/* ─── Phase: Saving ─── */
function SavingPhase() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Salvando conferência...</p>
    </div>
  );
}

/* ─── Phase: Done ─── */
function DonePhase({
  saved,
  onReset,
}: {
  saved: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 text-center">
      <CheckCircle2 className="h-16 w-16 text-green-500" />
      <div>
        <h2 className="text-xl font-bold text-foreground">Conferência salva!</h2>
        {!saved && (
          <p className="text-sm text-muted-foreground mt-1">
            Sem conexão — será sincronizada automaticamente quando online.
          </p>
        )}
      </div>
      <Button size="lg" className="w-full" onClick={onReset}>
        <ScanLine className="h-4 w-4 mr-2" />
        Nova Conferência
      </Button>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ScannerPage() {
  const { state, startConference, processScan, proceedToSummary, backToScanning, finalize, reset } =
    useConference();
  const [savedOnline, setSavedOnline] = useState(true);

  const [activeUM, setActiveUM] = useState<{ id: string; notebooks: NotebookSlim[] } | null>(null);
  const { data: rawNotebooks } = useNotebooks(activeUM?.id);
  const allNotebooks: NotebookSlim[] = (rawNotebooks ?? []).map((n) => ({
    id: n.id,
    hostname: n.hostname,
    serial: n.serial,
    status: n.status,
  }));

  const handleSelectUM = useCallback(
    (um: UMSlim, notebooks: NotebookSlim[]) => {
      setActiveUM({ id: um.id, notebooks });
      startConference(um, notebooks);
    },
    [startConference],
  );

  const handleScan = useCallback(
    (value: string) => {
      processScan(value, allNotebooks);
    },
    [processScan, allNotebooks],
  );

  const handleFinalize = useCallback(async () => {
    const ok = await finalize();
    setSavedOnline(ok);
  }, [finalize]);


  return (
    <div className="flex flex-col h-full min-h-[calc(100svh-4rem-3.5rem)]">
      {state.phase === "idle" && <UMSelectionPhase onSelect={handleSelectUM} />}
      {state.phase === "scanning" && (
        <ScanningPhase
          state={state}
          onScan={handleScan}
          onFinish={proceedToSummary}
        />
      )}
      {state.phase === "summary" && (
        <SummaryPhase
          state={state}
          onConfirm={handleFinalize}
          onBack={backToScanning}
        />
      )}
      {state.phase === "saving" && <SavingPhase />}
      {state.phase === "done" && <DonePhase saved={savedOnline} onReset={reset} />}
    </div>
  );
}
