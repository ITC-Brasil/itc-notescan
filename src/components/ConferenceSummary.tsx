import {
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Mouse,
  BatteryCharging,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NamedItem {
  id: string;
  hostname: string;
}

export interface ConferenceSummaryProps {
  totalAtivos: number;
  escaneados: number;
  faltantes: number;
  manutencao: number;
  /** Only the keys the UM actually tracks should be present. */
  peripherals?: { mouses?: number | null; carregadores?: number | null; fones?: number | null };
  faltantesList?: NamedItem[];
  manutencaoList?: NamedItem[];
}

const PERIPHERALS: { key: "mouses" | "carregadores" | "fones"; label: string; icon: LucideIcon }[] = [
  { key: "mouses", label: "Mouses", icon: Mouse },
  { key: "carregadores", label: "Carregadores", icon: BatteryCharging },
  { key: "fones", label: "Fones de Ouvido", icon: Headphones },
];

/**
 * Shared read-only conference summary: device stats, peripherals and the
 * missing/maintenance lists. Used by the technician's live summary phase and
 * the saved-conference modal so both stay visually and structurally identical.
 */
export function ConferenceSummary({
  totalAtivos,
  escaneados,
  faltantes,
  manutencao,
  peripherals,
  faltantesList,
  manutencaoList,
}: ConferenceSummaryProps) {
  const peripheralRows = peripherals
    ? PERIPHERALS.filter((p) => peripherals[p.key] !== undefined)
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Device stats */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border text-sm">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Laptop className="h-4 w-4" />
            Dispositivos Ativos
          </span>
          <span className="font-semibold tabular-nums">{totalAtivos}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-itc-sucesso" />
            Escaneados
          </span>
          <span className="font-semibold text-itc-sucesso tabular-nums">{escaneados}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className={cn("h-4 w-4", faltantes > 0 && "text-destructive")} />
            Faltantes
          </span>
          <span className={cn("font-semibold tabular-nums", faltantes > 0 ? "text-destructive" : "text-foreground")}>
            {faltantes}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Wrench className="h-4 w-4 text-itc-atencao" />
            Em Manutenção
          </span>
          <span className={cn("font-semibold tabular-nums", manutencao > 0 ? "text-itc-atencao" : "text-foreground")}>{manutencao}</span>
        </div>
      </div>

      {/* Peripherals */}
      {peripheralRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border text-sm">
          {peripheralRows.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              <span className="font-semibold tabular-nums">{peripherals![key] ?? "—"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Faltantes list */}
      {faltantesList && faltantesList.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Notebooks faltantes</p>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 divide-y divide-destructive/10">
            {faltantesList.map((nb) => (
              <div key={nb.id} className="flex items-center gap-2 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span className="text-sm tabular-nums text-foreground">{nb.hostname}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance list */}
      {manutencaoList && manutencaoList.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Em manutenção</p>
          <div className="rounded-xl border border-itc-atencao/20 bg-itc-atencao/5 divide-y divide-itc-atencao/10">
            {manutencaoList.map((nb) => (
              <div key={nb.id} className="flex items-center gap-2 px-3 py-2">
                <Wrench className="h-3.5 w-3.5 text-itc-atencao shrink-0" />
                <span className="text-sm tabular-nums text-foreground">{nb.hostname}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
