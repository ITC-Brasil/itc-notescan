// Símbolo "Mira" do ITC NoteScan — 4 cantos de mira de QR Code + miolo arredondado.
// Geometria idêntica às fontes read-only em brand/symbol/notescan-symbol{,-small}-color.svg
// (viewBox 64×64). Componente puro (sem "use client", sem dependências).
//
// Cores via classe Tailwind nos grupos (não via atributo `fill`) para o dark mode
// funcionar sem duplicar componente. O hex literal #F5F0E8 do miolo no escuro é a
// exceção autorizada do design system para o componente de marca (não há token neutro
// equivalente na escala).

type NoteScanLogoProps = {
  variant?: "symbol" | "symbol-small"; // "symbol-small" sempre que renderizar a ≤24px
  size?: number; // px — default 32
  className?: string;
  title?: string; // quando presente, vira role="img" + <title>; senão aria-hidden
};

// [x, y, width, height] de cada um dos 8 cantos.
const CORNERS = {
  symbol: [
    [4, 4, 22, 8], [4, 4, 8, 22], [38, 4, 22, 8], [52, 4, 8, 22],
    [4, 52, 22, 8], [4, 38, 8, 22], [38, 52, 22, 8], [52, 38, 8, 22],
  ],
  "symbol-small": [
    [4, 4, 24, 10], [4, 4, 10, 24], [36, 4, 24, 10], [50, 4, 10, 24],
    [4, 50, 24, 10], [4, 36, 10, 24], [36, 50, 24, 10], [50, 36, 10, 24],
  ],
} as const;

const CORE = {
  symbol: { x: 23, y: 23, size: 18, rx: 3 },
  "symbol-small": { x: 24, y: 24, size: 16, rx: 2 },
} as const;

export function NoteScanLogo({
  variant = "symbol",
  size = 32,
  className,
  title,
}: NoteScanLogoProps) {
  const core = CORE[variant];
  const labelled = title != null;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {labelled && <title>{title}</title>}
      <g className="fill-itc-ciano-7 dark:fill-itc-ciano-6">
        {CORNERS[variant].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} />
        ))}
      </g>
      <rect
        className="fill-itc-ciano-12 dark:fill-[#F5F0E8]"
        x={core.x}
        y={core.y}
        width={core.size}
        height={core.size}
        rx={core.rx}
      />
    </svg>
  );
}
