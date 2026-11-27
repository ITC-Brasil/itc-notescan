"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Check,
  Loader2,
  Package,
  Mouse,
  BatteryCharging,
  Headphones,
  Laptop,
  Wrench,
  Eye,
  ArrowRight,
  Minus,
  Plus,
  Send,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  metaAtingida,
  metaProgress,
  useConference,
  type MetaProgress,
  type NotebookSlim,
  type UMSlim,
  type Peripherals,
} from "@/hooks/useConference";
import { CATEGORIA_LABEL } from "@/lib/constants";
import { useUMs } from "@/hooks/useUMs";
import { useNotebooks } from "@/hooks/useNotebooks";
import { countsForMeta, useConferences } from "@/hooks/useConferences";
import { usePlatform } from "@/hooks/usePlatform";
import { QRScanner } from "@/components/scanner/QRScanner";
import { ConferenceSummary } from "@/components/ConferenceSummary";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
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
  dailyLimitReached,
}: {
  onSelect: (um: UMSlim, notebooks: NotebookSlim[]) => void;
  dailyLimitReached: boolean;
}) {
  const { data: ums, isLoading: loadingUMs } = useUMs();
  const [selectedUmId, setSelectedUmId] = useState("");
  const [umFisicaId, setUmFisicaId] = useState("");

  const selectedUM = ums?.find((u) => u.id === selectedUmId);
  const itinerante = selectedUM?.tipo === "ITINERANTE";
  // UM física: uma UM FIXA do mesmo projeto da itinerante.
  const umsFisicas = itinerante
    ? (ums ?? []).filter((u) => u.tipo === "FIXA" && u.projectId === selectedUM.projectId)
    : [];
  const umFisica = umsFisicas.find((u) => u.id === umFisicaId);
  // A meta diária só bloqueia UM FIXA; itinerante acompanha a conferência da carreta.
  const bloqueadaPelaMeta = dailyLimitReached && !itinerante;
  const { data: notebooks, isLoading: loadingNotebooks } = useNotebooks(
    selectedUmId || undefined,
  );

  const ativos = notebooks?.filter((n) => n.status === "ATIVO").length ?? 0;
  const manutencao = notebooks?.filter((n) => n.status === "MANUTENCAO").length ?? 0;

  const handleStart = () => {
    if (!selectedUM || !notebooks) return;
    const um: UMSlim = {
      id: selectedUM.id,
      nome: selectedUM.nome,
      project: { nome: selectedUM.project.nome, cor: selectedUM.project.cor },
      mouses: selectedUM.mouses,
      carregadores: selectedUM.carregadores,
      fones: selectedUM.fones,
      ...(itinerante && umFisica && {
        itinerante: {
          umFisicaId: umFisica.id,
          umFisicaNome: umFisica.nome,
          metas: selectedUM.metas.filter((m) => m.meta > 0),
        },
      }),
    };
    const nbs: NotebookSlim[] = notebooks.filter((n) => n.status !== "ARQUIVADO").map((n) => ({
      id: n.id,
      hostname: n.hostname,
      serial: n.serial,
      status: n.status,
      categoria: n.categoria,
    }));
    onSelect(um, nbs);
  };

  const statRows = [
    { icon: Laptop, tint: "bg-itc-ciano-7/10", color: "text-itc-ciano-7", label: "Cadastrados", value: loadingNotebooks ? "..." : (notebooks?.length ?? 0) },
    { icon: CheckCircle2, tint: "bg-itc-sucesso/10", color: "text-itc-sucesso", label: "Ativos", value: loadingNotebooks ? "..." : ativos },
    { icon: Wrench, tint: "bg-itc-atencao/10", color: "text-itc-atencao", label: "Em manutenção", value: loadingNotebooks ? "..." : manutencao },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border bg-card">
        <Link
          href="/inicio"
          aria-label="Voltar"
          className="-ml-1 h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">Selecionar UM</h1>
          <p className="text-sm text-muted-foreground leading-tight">Escolha a unidade móvel a conferir</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-5 p-4 overflow-y-auto">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Unidade Móvel
          </label>
          <Select
            value={selectedUmId}
            onValueChange={(v) => {
              setSelectedUmId(v);
              setUmFisicaId("");
            }}
            disabled={loadingUMs}
          >
            <SelectTrigger className={cn("h-14 text-base", selectedUmId && "border-primary")}>
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
        </div>

        {itinerante && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Em qual carreta você está?
            </label>
            <Select value={umFisicaId} onValueChange={setUmFisicaId}>
              <SelectTrigger className={cn("h-14 text-base", umFisicaId && "border-primary")}>
                <SelectValue placeholder="Selecione a UM física" />
              </SelectTrigger>
              <SelectContent>
                {umsFisicas.map((um) => (
                  <SelectItem key={um.id} value={um.id}>
                    {um.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Meta por conferência:{" "}
              {selectedUM.metas
                .filter((m) => m.meta > 0)
                .map((m) => `${CATEGORIA_LABEL[m.categoria]} ${m.meta}`)
                .join(" · ")}
            </p>
          </div>
        )}

        {selectedUM && (
          <div className="rounded-xl border border-border bg-card shadow-1 divide-y divide-border">
            {statRows.map(({ icon: Icon, tint, color, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3.5">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", tint)}>
                  <Icon className={cn("h-5 w-5", color)} />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
                <span className="text-xl font-bold text-foreground tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        )}

        {bloqueadaPelaMeta && (
          <div className="rounded-xl border border-itc-atencao/30 bg-itc-atencao/10 p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-itc-atencao shrink-0" />
            <p className="text-sm text-itc-atencao">
              Você atingiu sua meta diária de conferências.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold uppercase tracking-wide"
          disabled={
            !selectedUmId || loadingNotebooks || !notebooks?.length || bloqueadaPelaMeta || (itinerante && !umFisica)
          }
          onClick={handleStart}
        >
          <ScanLine className="h-5 w-5 mr-2" />
          Iniciar Conferência
        </Button>
      </div>
    </div>
  );
}

/* ─── Phase: Scanning ─── */
function ScanningPhase({
  state,
  onScan,
  onNext,
  onReiniciar,
  onExit,
}: {
  state: ReturnType<typeof useConference>["state"];
  onScan: (rawValues: string[]) => void;
  onNext: () => void;
  onReiniciar: () => void;
  onExit: () => void;
}) {
  const platform = usePlatform();
  const [showManut, setShowManut] = useState(false);
  // Itinerante: progresso por categoria no lugar da lista de pendentes da UM inteira.
  const metas = state.um?.itinerante ? metaProgress(state) : null;
  const nextDisabled = !!metas && !metaAtingida(state);

  // On Android APK: hand off the entire scanning UI to the native overlay.
  // The NativeQRScanner renders top bar + viewfinder + feedback + buttons
  // inside a position:fixed overlay with pointer-events properly scoped.
  if (platform === "android") {
    return (
      <QRScanner
        onScan={onScan}
        active
        nativeUi={{
          umName: state.um?.nome ?? "",
          umColor: state.um?.project.cor ?? "#008f95",
          pending: state.pending,
          scanned: state.scanned,
          maintenance: state.maintenance,
          activeTotal: metas ? metas.reduce((a, m) => a + m.meta, 0) : state.activeTotal,
          metas: metas?.map((m) => ({ label: CATEGORIA_LABEL[m.categoria], lidos: m.lidos, meta: m.meta })),
          nextDisabled,
          lastScanned: state.lastScanned ?? null,
          scanError: state.error ?? null,
          onNext,
          onReiniciar,
          onExit,
        }}
      />
    );
  }

  // Denominador FIXO = ativos capturados no início. Overflow (lidos > total)
  // fica visível de propósito.
  const total = metas ? metas.reduce((a, m) => a + m.meta, 0) : state.activeTotal;
  const progress = total > 0 ? Math.min((state.scanned.length / total) * 100, 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* UM header */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-border bg-card">
        <button
          type="button"
          onClick={onExit}
          aria-label="Voltar"
          className="-ml-2 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: state.um?.project.cor }}
        />
        <span className="text-sm font-medium text-foreground">{state.um?.nome}</span>
        {state.um?.itinerante && (
          <span className="text-xs text-muted-foreground truncate">em {state.um.itinerante.umFisicaNome}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {state.scanned.length}/{total}
        </span>
      </div>

      {/* Itinerante: meta por categoria (ex.: Instrutores 3/5 · Pedagoga 0/1) */}
      {metas && <MetaPills metas={metas} />}

      {/* Stat pills: pendentes / lidos / manut. */}
      <div className={cn("flex gap-2 px-4 pt-2", metas && "hidden")}>
        <div className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/30 py-1">
          <span className="text-sm font-bold text-destructive tabular-nums">{state.pending.length}</span>
          <span className="text-xs text-destructive/90">pendentes</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-itc-sucesso/10 border border-itc-sucesso/30 py-1">
          <span className="text-sm font-bold text-itc-sucesso tabular-nums">{state.scanned.length}</span>
          <span className="text-xs text-itc-sucesso/90">lidos</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-itc-atencao/10 border border-itc-atencao/30 py-1">
          <span className="text-sm font-bold text-itc-atencao tabular-nums">{state.maintenance.length}</span>
          <span className="text-xs text-itc-atencao/90">manut.</span>
        </div>
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

      {/* Test-only scan input — visible only when NEXT_PUBLIC_E2E_TESTING=true */}
      {process.env.NEXT_PUBLIC_E2E_TESTING === "true" && (
        <div className="mx-4 mt-2">
          <input
            data-testid="scan-test-input"
            type="text"
            placeholder="[TESTE] Hostname + Enter"
            className="w-full text-xs border border-dashed border-border rounded px-2 py-1 bg-muted/50 text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const input = e.currentTarget;
                if (input.value) {
                  onScan([input.value]);
                  input.value = "";
                }
              }
            }}
          />
        </div>
      )}

      {/* Feedback */}
      {state.error && (
        <div className="mx-4 mt-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
          <p className="text-sm text-destructive font-medium">{state.error}</p>
        </div>
      )}
      {state.lastScanned && !state.error && (
        <div className="mx-4 mt-2 rounded-lg bg-itc-sucesso/10 border border-itc-sucesso/30 px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-itc-sucesso shrink-0" />
          <p className="text-sm text-itc-sucesso font-medium">
            {state.lastScanned}
          </p>
        </div>
      )}

      {/* Maintenance strip (yellow) */}
      {state.maintenance.length > 0 && (
        <div className="mx-4 mt-2 rounded-lg bg-itc-atencao/10 border border-itc-atencao/30 px-3 py-2 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-itc-atencao shrink-0" />
          <span className="text-sm text-itc-atencao">
            {state.maintenance.length} em manutenção · fora da meta
          </span>
          <button
            type="button"
            onClick={() => setShowManut((v) => !v)}
            aria-pressed={showManut}
            className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-md border border-itc-atencao/40 text-sm font-medium text-itc-atencao hover:bg-itc-atencao/10 transition-colors"
          >
            <Eye className="h-4 w-4" /> Ver
          </button>
        </div>
      )}

      {/* Lists */}
      <div className="flex-1 overflow-hidden flex gap-3 px-4 mt-3 pb-2">
        {showManut ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-itc-atencao">
                <Wrench className="h-3.5 w-3.5" /> Em manutenção ({state.maintenance.length})
              </span>
              <button
                type="button"
                onClick={() => setShowManut(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 rounded-lg bg-itc-atencao/5 border border-itc-atencao/20 p-1.5">
              {state.maintenance.map((nb) => (
                <div
                  key={nb.id}
                  className="text-xs tabular-nums px-2 py-1 rounded bg-itc-atencao/10 border border-itc-atencao/20 text-itc-atencao"
                >
                  {nb.hostname}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
        {/* Pending */}
        <div className={cn("flex-1 flex flex-col min-h-0", metas && "hidden")}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Pendentes ({state.pending.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 rounded-lg bg-muted/30 p-1.5">
            {state.pending.length === 0 ? (
              <div className="flex flex-col items-center gap-1 text-muted-foreground py-3">
                <CheckCircle2 className="h-5 w-5 text-itc-sucesso" />
                <p className="text-xs text-center">Todos escaneados!</p>
              </div>
            ) : (
              state.pending.map((nb) => (
                <div
                  key={nb.id}
                  className="text-xs tabular-nums px-2 py-1 rounded bg-card border border-border text-foreground"
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
            <CheckCircle2 className="h-3.5 w-3.5 text-itc-sucesso" />
            <span className="text-xs font-medium text-muted-foreground">
              Escaneados ({state.scanned.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 rounded-lg bg-muted/30 p-1.5">
            {state.scanned.length === 0 ? (
              <div className="flex flex-col items-center gap-1 text-muted-foreground py-3">
                <ScanLine className="h-5 w-5" />
                <p className="text-xs text-center">Nenhum ainda</p>
              </div>
            ) : (
              [...state.scanned].reverse().map((nb) => (
                <div
                  key={nb.id}
                  className="text-xs tabular-nums px-2 py-1 rounded bg-itc-sucesso/10 border border-itc-sucesso/20 text-itc-sucesso"
                >
                  {nb.hostname}
                </div>
              ))
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-2 flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="shrink-0"
          onClick={onReiniciar}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="lg" className="flex-1" onClick={onNext} disabled={nextDisabled}>
          Próximo
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Itinerante: pílulas de meta por categoria ─── */
function MetaPills({ metas }: { metas: MetaProgress[] }) {
  return (
    <div className="flex gap-2 px-4 pt-2">
      {metas.map((m) => {
        const ok = m.lidos >= m.meta;
        return (
          <div
            key={m.categoria}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-full border py-1",
              ok ? "bg-itc-sucesso/10 border-itc-sucesso/30 text-itc-sucesso" : "bg-muted border-border text-foreground",
            )}
          >
            <span className="text-xs">{CATEGORIA_LABEL[m.categoria]}</span>
            <span className="text-sm font-bold tabular-nums">
              {m.lidos}/{m.meta}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Quantity stepper with editable numeric input ─── */
function Stepper({ label, icon: Icon, value, onChange }: { label: string; icon: LucideIcon; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card shadow-1 p-4">
      <span className="flex items-center gap-2.5 text-sm font-medium text-foreground flex-1 min-w-0">
        <Icon className="h-5 w-5 text-primary shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 rounded-lg"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Diminuir ${label}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            onChange(Number.isFinite(n) && n > 0 ? n : 0);
          }}
          onFocus={(e) => e.target.select()}
          className="w-10 text-center text-2xl font-bold tabular-nums bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label={label}
        />
        <Button
          size="icon"
          className="h-11 w-11 rounded-lg"
          onClick={() => onChange(value + 1)}
          aria-label={`Aumentar ${label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Phase: Peripherals ─── */
function PeripheralsPhase({
  state,
  onFinalize,
  onExit,
}: {
  state: ReturnType<typeof useConference>["state"];
  onFinalize: (peripherals: Peripherals) => void;
  onExit: () => void;
}) {
  const um = state.um!;
  const [mouses, setMouses] = useState(0);
  const [carregadores, setCarregadores] = useState(0);
  const [fones, setFones] = useState(0);

  const handleFinalize = () => {
    onFinalize({ mouses, carregadores, fones });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border bg-card">
        <button
          type="button"
          onClick={onExit}
          aria-label="Voltar"
          className="-ml-1 h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">Periféricos</h1>
          <p className="text-sm text-muted-foreground leading-tight">Informe as quantidades conferidas</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
        {/* UM context */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card shadow-1 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: um.project.cor }} />
          <span className="text-sm font-bold text-foreground">{um.nome}</span>
          <span className="text-xs text-muted-foreground truncate">· {um.project.nome}</span>
          <span className="ml-auto text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
            Conferência
          </span>
        </div>

        <div className="space-y-3">
          {um.mouses && <Stepper label="Mouses" icon={Mouse} value={mouses} onChange={setMouses} />}
          {um.carregadores && <Stepper label="Carregadores" icon={BatteryCharging} value={carregadores} onChange={setCarregadores} />}
          {um.fones && <Stepper label="Fones de Ouvido" icon={Headphones} value={fones} onChange={setFones} />}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold uppercase tracking-wide"
          onClick={handleFinalize}
        >
          <Check className="h-5 w-5 mr-2" />
          Finalizar Conferência
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
  tecnico,
}: {
  state: ReturnType<typeof useConference>["state"];
  onConfirm: () => void;
  onBack: () => void;
  tecnico?: string;
}) {
  const um = state.um!;

  const startDate = state.startTime ? new Date(state.startTime) : null;
  const subtitle = startDate
    ? `${um.nome} · ${startDate.toLocaleDateString("pt-BR")} · ${startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : um.nome;
  const fisica = um.itinerante ? ` · em ${um.itinerante.umFisicaNome}` : "";

  const hasPeripherals = um.mouses || um.carregadores || um.fones;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border bg-card">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="-ml-1 h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground leading-tight">Resumo</h1>
          <p className="text-xs text-muted-foreground leading-tight truncate">{subtitle}{fisica}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <ConferenceSummary
          tecnico={tecnico}
          localizacao={state.location}
          escaneados={state.scanned.length}
          faltantes={um.itinerante ? 0 : state.pending.length}
          manutencao={state.maintenance.length}
          peripherals={hasPeripherals ? {
            ...(um.mouses && { mouses: state.peripherals.mouses }),
            ...(um.carregadores && { carregadores: state.peripherals.carregadores }),
            ...(um.fones && { fones: state.peripherals.fones }),
          } : undefined}
          faltantesList={um.itinerante ? [] : state.pending.map((n) => ({ id: n.id, hostname: n.hostname, detail: n.serial }))}
          manutencaoList={state.maintenance.map((n) => ({ id: n.id, hostname: n.hostname, detail: n.serial }))}
        />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold uppercase tracking-wide"
          onClick={onConfirm}
        >
          <Send className="h-5 w-5 mr-2" />
          Concluir e Enviar
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
      <CheckCircle2 className="h-16 w-16 text-itc-sucesso" />
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
  const { state, startConference, processScanBatch, setPeripherals, proceedToSummary, proceedFromPeripherals, backToScanning, finalize, reset } =
    useConference();
  const { data: session } = useSession();
  const [savedOnline, setSavedOnline] = useState(true);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  // Daily-limit gate — mirrors the server block so the technician can't start
  // a conference past metaDiaria (server still enforces it authoritatively).
  const meta = session?.user.metaDiaria ?? 0;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
  const { data: todayConferences } = useConferences({ from, to, userId: session?.user.id });
  const dailyLimitReached = meta > 0 && (todayConferences?.filter(countsForMeta).length ?? 0) >= meta;

  const [activeUM, setActiveUM] = useState<{ id: string; notebooks: NotebookSlim[] } | null>(null);
  // Lookup do scan inclui arquivados só para a mensagem "notebook arquivado";
  // a lista esperada vem de handleStart (sem arquivados) e o reducer ignora ARQUIVADO.
  const { data: rawNotebooks } = useNotebooks(activeUM?.id, { includeArchived: true });
  // Memoizado: identidade estável enquanto rawNotebooks não muda, para o
  // handleScan (e o efeito do scanner web que depende dele) não remontar por render.
  const allNotebooks = useMemo<NotebookSlim[]>(
    () =>
      (rawNotebooks ?? []).map((n) => ({
        id: n.id,
        hostname: n.hostname,
        serial: n.serial,
        status: n.status,
        categoria: n.categoria,
      })),
    [rawNotebooks],
  );

  const handleSelectUM = useCallback(
    (um: UMSlim, notebooks: NotebookSlim[]) => {
      setActiveUM({ id: um.id, notebooks });
      startConference(um, notebooks);
    },
    [startConference],
  );

  const handleScan = useCallback(
    (rawValues: string[]) => {
      // timestamp vem daqui (reducer é puro, não chama Date.now()).
      processScanBatch(rawValues, allNotebooks, Date.now());
    },
    [processScanBatch, allNotebooks],
  );

  const handleReiniciar = useCallback(() => {
    if (state.um && activeUM) {
      startConference(state.um, activeUM.notebooks);
    }
  }, [state.um, activeUM, startConference]);

  const handleFinalizePeripherals = useCallback((peripherals: Peripherals) => {
    setPeripherals(peripherals);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          proceedFromPeripherals(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        },
        () => proceedFromPeripherals(null),
        { timeout: 5_000 },
      );
    } else {
      proceedFromPeripherals(null);
    }
  }, [setPeripherals, proceedFromPeripherals]);

  // For UMs without peripherals, capture geolocation when clicking Próximo
  const handleNext = useCallback(() => {
    const um = state.um;
    if (um && (um.mouses || um.carregadores || um.fones)) {
      proceedToSummary("peripherals");
    } else {
      // No peripherals — capture location now and go directly to summary
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            proceedFromPeripherals(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
          },
          () => proceedFromPeripherals(null),
          { timeout: 5_000 },
        );
      } else {
        proceedFromPeripherals(null);
      }
    }
  }, [state.um, proceedToSummary, proceedFromPeripherals]);

  const handleFinalize = useCallback(async () => {
    const result = await finalize();
    if (result === "blocked") {
      toast.error("Você atingiu sua meta diária de conferências.");
      reset();
      setActiveUM(null);
      return;
    }
    setSavedOnline(result === "online");
  }, [finalize, reset]);

  const handleExit = useCallback(() => {
    setExitConfirmOpen(false);
    setActiveUM(null);
    reset();
  }, [reset]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100svh-4rem-3.5rem)]">
      {state.phase === "idle" && <UMSelectionPhase onSelect={handleSelectUM} dailyLimitReached={dailyLimitReached} />}
      {state.phase === "scanning" && (
        <ScanningPhase
          state={state}
          onScan={handleScan}
          onNext={handleNext}
          onReiniciar={handleReiniciar}
          onExit={() => setExitConfirmOpen(true)}
        />
      )}
      <ConfirmationDialog
        open={exitConfirmOpen}
        onOpenChange={setExitConfirmOpen}
        title="Abandonar conferência?"
        description="O progresso desta conferência será perdido e você voltará à seleção de UM."
        confirmLabel="Abandonar"
        cancelLabel="Continuar escaneando"
        destructive
        onConfirm={handleExit}
      />
      {state.phase === "peripherals" && (
        <PeripheralsPhase
          state={state}
          onFinalize={handleFinalizePeripherals}
          onExit={() => setExitConfirmOpen(true)}
        />
      )}
      {state.phase === "summary" && (
        <SummaryPhase
          state={state}
          onConfirm={handleFinalize}
          onBack={backToScanning}
          tecnico={session?.user.nome}
        />
      )}
      {state.phase === "saving" && <SavingPhase />}
      {state.phase === "done" && <DonePhase saved={savedOnline} onReset={reset} />}
    </div>
  );
}
