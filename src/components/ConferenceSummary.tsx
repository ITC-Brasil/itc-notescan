import {
  User,
  MapPin,
  ExternalLink,
  Wrench,
  Mouse,
  BatteryCharging,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { originalHostname } from "@/lib/notebook-hostname";

interface NamedItem {
  id: string;
  hostname: string;
  /** Optional right-aligned detail (serial/model) when available. */
  detail?: string | null;
}

export interface ConferenceSummaryProps {
  /** Optional context cards (shown when provided). */
  tecnico?: string;
  localizacao?: string | null;
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
  { key: "carregadores", label: "Carreg.", icon: BatteryCharging },
  { key: "fones", label: "Fones", icon: Headphones },
];

const CAPTION = "text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground";

/**
 * Shared read-only conference summary: técnico/localização context, status tiles
 * (escaneados/faltantes/manutenção), peripherals and the missing/maintenance
 * lists. Used by the technician live summary, the saved-conference modal and the
 * admin "Ver" modal, so they stay visually and structurally identical.
 * Maintenance is always yellow (--itc-atencao).
 */
export function ConferenceSummary({
  tecnico,
  localizacao,
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

  const tiles = [
    { label: "Escaneados", value: escaneados, cls: "border-itc-sucesso/30 bg-itc-sucesso/10 text-itc-sucesso" },
    { label: "Faltantes", value: faltantes, cls: "border-destructive/30 bg-destructive/10 text-destructive" },
    { label: "Manutenção", value: manutencao, cls: "border-itc-atencao/30 bg-itc-atencao/10 text-itc-atencao" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {tecnico && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card shadow-1 px-4 py-3">
          <div className="h-10 w-10 rounded-lg bg-itc-ciano-7/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-itc-ciano-7" />
          </div>
          <div className="min-w-0">
            <p className={CAPTION}>Técnico</p>
            <p className="text-sm font-bold text-foreground truncate">{tecnico}</p>
          </div>
        </div>
      )}

      {localizacao && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card shadow-1 px-4 py-3">
          <div className="h-10 w-10 rounded-lg bg-itc-ciano-7/10 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-itc-ciano-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={CAPTION}>Localização</p>
            <p className="text-sm font-semibold text-itc-ciano-7 tabular-nums truncate">{localizacao}</p>
          </div>
          <a
            href={`https://www.google.com/maps?q=${encodeURIComponent(localizacao)}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir no mapa"
            className="h-10 w-10 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Status tiles */}
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={cn("rounded-xl border p-3 text-center", t.cls)}>
            <p className="text-2xl font-extrabold tabular-nums">{t.value}</p>
            <p className={cn(CAPTION, "mt-0.5")}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* Peripherals */}
      {peripheralRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-1 p-4">
          <p className={cn(CAPTION, "mb-3")}>Periféricos conferidos</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {peripheralRows.map(({ key, label, icon: Icon }) => (
              <div key={key}>
                <Icon className="h-5 w-5 text-itc-ciano-7 mx-auto mb-1.5" />
                <p className="text-xl font-bold text-foreground tabular-nums">{peripherals![key] ?? "—"}</p>
                <p className={CAPTION}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Faltantes list */}
      {faltantesList && faltantesList.length > 0 && (
        <div>
          <p className={cn(CAPTION, "text-destructive mb-2")}>Faltantes · {faltantesList.length}</p>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 divide-y divide-destructive/10">
            {faltantesList.map((nb) => (
              <div key={nb.id} className="flex items-center gap-2 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                <span className="text-sm tabular-nums text-foreground">{originalHostname(nb.hostname)}</span>
                {nb.detail && <span className="ml-auto text-xs text-muted-foreground">{nb.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance list */}
      {manutencaoList && manutencaoList.length > 0 && (
        <div>
          <p className={cn(CAPTION, "text-itc-atencao mb-2")}>Em manutenção · {manutencaoList.length}</p>
          <div className="rounded-xl border border-itc-atencao/20 bg-itc-atencao/5 divide-y divide-itc-atencao/10">
            {manutencaoList.map((nb) => (
              <div key={nb.id} className="flex items-center gap-2 px-3 py-2">
                <Wrench className="h-3.5 w-3.5 text-itc-atencao shrink-0" />
                <span className="text-sm tabular-nums text-foreground">{originalHostname(nb.hostname)}</span>
                {nb.detail && <span className="ml-auto text-xs text-muted-foreground">{nb.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
