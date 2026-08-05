'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, RotateCcw, ArrowRight, ArrowLeft, Flashlight, FlashlightOff, Wrench, Eye, X } from 'lucide-react'

export interface NativeScanUi {
  umName: string
  umColor: string
  /** Full list so the overlay can render hostnames */
  pending: { id: string; hostname: string }[]
  scanned: { id: string; hostname: string }[]
  /** Notebooks em manutenção (fora da meta) — mostrados via botão "Ver" */
  maintenance: { id: string; hostname: string }[]
  /** Total FIXO de ativos da UM (denominador do contador) — capturado no início */
  activeTotal: number
  lastScanned: string | null
  scanError: string | null
  onNext: () => void
  onReiniciar: () => void
  /** Back button in the top bar — asks for confirmation upstream */
  onExit: () => void
}

interface NativeQRScannerProps {
  /** Todos os rawValue de UM frame — um único callback por frame, nunca por código */
  onScan: (rawValues: string[]) => void
  onError: (error: string) => void
  isActive: boolean
  ui?: NativeScanUi
}

// Reusable inline-style constants.
//
// ⚠️ SINCRONIA COM globals.css: este overlay é desenhado com estilos inline
// porque sobrepõe camadas semi-transparentes sobre a câmera NATIVA — utilitários
// Tailwind com alpha não se aplicam à camada nativa. Os triplets rgb abaixo são
// cópia manual dos tokens funcionais ITC e DEVEM ser mantidos em sincronia com o
// globals.css numa futura troca de paleta:
//   --itc-sucesso #1a7f3c → 26,127,60
//   --itc-atencao #cc7a00 → 204,122,0
//   --itc-erro    #c0392b → 192,57,43
const ITC_SUCESSO_RGB = '26,127,60'
const ITC_ATENCAO_RGB = '204,122,0'
const ITC_ERRO_RGB    = '192,57,43'
// Amarelo clareado do --itc-atencao para contraste de texto sobre fundo escuro.
const ATENCAO_TEXT_DARK = '#eab34a'

const OPAQUE_DARK = 'rgba(14,14,14,0.94)'
const OPAQUE_BAR  = 'rgba(0,0,0,0.82)'
const WHITE_DIM   = 'rgba(255,255,255,0.55)'
const GREEN_DIM   = `rgba(${ITC_SUCESSO_RGB},0.85)`

export function NativeQRScanner({ onScan, onError, isActive, ui }: NativeQRScannerProps) {
  // Callbacks live in refs so the camera effect depends only on isActive.
  // If the effect re-ran on every new onScan identity (parent re-creates it
  // per render), each scan would tear down and restart the camera — the
  // un-awaited stopScan races the new startScan and kills the live preview.
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onScanRef.current = onScan
    onErrorRef.current = onError
  }, [onScan, onError])

  // Torch (flashlight) — only shown when the device reports it available.
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  // Maintenance list panel toggle (opened from the yellow strip's "Ver" button)
  const [showManut, setShowManut] = useState(false)

  const toggleTorch = async () => {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
      await BarcodeScanner.toggleTorch()
      setTorchOn((v) => !v)
    } catch {
      // Ignore — torch just won't toggle on unsupported hardware
    }
  }

  // App chrome (header/nav) must be hidden whenever the full-screen overlay is
  // mounted — independent of camera success, or a failed startScan leaves the
  // overlay drawn on top of the app bars.
  useEffect(() => {
    if (!isActive) return
    document.body.classList.add('scanner-active')
    return () => { document.body.classList.remove('scanner-active') }
  }, [isActive])

  useEffect(() => {
    const stopScan = async () => {
      try {
        const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
        await BarcodeScanner.removeAllListeners()
        await BarcodeScanner.stopScan()
        setTorchOn(false)
      } catch {
        // Ignore cleanup errors during unmount
      }
    }

    if (!isActive) {
      void stopScan()
      return
    }

    const startScan = async (): Promise<void> => {
      try {
        // 'barcodesScanned' delivers ALL codes ML Kit detected in a frame at
        // once (plugin >= 6.2), and 1080p analysis resolution makes several
        // small QR codes in the same frame resolvable — both required for
        // batch reading. O frame inteiro vira UM único onScan(rawValues): a
        // dedupe é feita no reducer (SCAN_BATCH), que enxerga o estado acumulado
        // — nunca um dispatch por código (isso causava a race de leitura dupla).
        const { BarcodeScanner, BarcodeFormat, Resolution } = await import('@capacitor-mlkit/barcode-scanning')

        const { camera } = await BarcodeScanner.requestPermissions()
        if (camera !== 'granted' && camera !== 'limited') {
          onErrorRef.current('Permissão de câmera negada')
          return
        }

        await BarcodeScanner.addListener('barcodesScanned', ({ barcodes }) => {
          const rawValues = barcodes
            .map((b) => b.rawValue)
            .filter((v): v is string => !!v)
          if (rawValues.length > 0) { onScanRef.current(rawValues) }
        })

        await BarcodeScanner.startScan({
          formats: [BarcodeFormat.QrCode],
          resolution: Resolution['1920x1080'],
        })

        const { available } = await BarcodeScanner.isTorchAvailable()
        setTorchAvailable(available)
      } catch {
        onErrorRef.current('Erro ao iniciar câmera')
      }
    }

    // Android may release the camera while the app is backgrounded, leaving a
    // frozen preview on return. Restart the scanner when the app comes back to
    // the foreground. Scanned state lives in useConference (parent) and is not
    // touched by restarting the camera, so nothing is lost.
    let restarting = false
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || restarting) return
      restarting = true
      void (async () => {
        await stopScan()
        await startScan()
        restarting = false
      })()
    }
    document.addEventListener('visibilitychange', onVisibility)

    void startScan()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void stopScan()
    }
  }, [isActive])

  // ─── No UI props: fallback to simple centered viewfinder ──────────
  if (!ui) {
    return (
      <div className="native-scanner-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="scanner-frame">
          <div className="scanner-corner top-left" />
          <div className="scanner-corner top-right" />
          <div className="scanner-corner bottom-left" />
          <div className="scanner-corner bottom-right" />
          <div className="scanner-line" />
        </div>
      </div>
    )
  }

  // ─── Split layout ─────────────────────────────────────────────────
  // The native camera view is always full-screen behind the WebView.
  // We show it only through the transparent camera section (top area).
  // The lists section has an opaque background that blocks the camera
  // in the lower half, letting both be visible simultaneously.

  // Denominador FIXO = total de ativos capturado no início. Se lidos > total,
  // aparece assim mesmo — o overflow tem de ser visível (era o mascaramento
  // desse número que escondia a leitura dupla).
  const total = ui.activeTotal

  return (
    <div
      className="native-scanner-overlay"
      style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}
    >
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          // top padding clears the Android status bar (overlay hides app chrome)
          padding: 'calc(10px + env(safe-area-inset-top)) 16px 10px 8px',
          background: OPAQUE_BAR,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={ui.onExit}
          aria-label="Voltar"
          style={{
            width: 40, height: 40, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
          }}
        >
          <ArrowLeft style={{ width: 20, height: 20 }} />
        </button>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: ui.umColor, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{ui.umName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: WHITE_DIM }}>
          {ui.scanned.length}/{total}
        </span>
        {torchAvailable && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label={torchOn ? 'Desligar flash' : 'Ligar flash'}
            aria-pressed={torchOn}
            style={{
              width: 40, height: 40, flexShrink: 0, marginLeft: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 10, cursor: 'pointer',
              border: torchOn ? '1.5px solid #f2c94c' : '1.5px solid rgba(255,255,255,0.3)',
              background: torchOn ? 'rgba(242,201,76,0.2)' : 'rgba(255,255,255,0.1)',
              color: torchOn ? '#f2c94c' : '#fff',
            }}
          >
            {torchOn
              ? <Flashlight style={{ width: 18, height: 18 }} />
              : <FlashlightOff style={{ width: 18, height: 18 }} />}
          </button>
        )}
      </div>

      {/* ── Stat pills: pendentes / lidos / manut. ─────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          gap: 8,
          padding: '0 12px 10px',
          background: OPAQUE_BAR,
          pointerEvents: 'auto',
        }}
      >
        {[
          { n: ui.pending.length, label: 'pendentes', rgb: ITC_ERRO_RGB },
          { n: ui.scanned.length, label: 'lidos', rgb: ITC_SUCESSO_RGB },
          { n: ui.maintenance.length, label: 'manut.', rgb: ITC_ATENCAO_RGB },
        ].map((p) => (
          <div
            key={p.label}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '5px 8px', borderRadius: 999,
              background: `rgba(${p.rgb},0.16)`, border: `1px solid rgba(${p.rgb},0.35)`,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: `rgb(${p.rgb})`, fontVariantNumeric: 'tabular-nums' }}>{p.n}</span>
            <span style={{ fontSize: 11, color: `rgba(${p.rgb},0.92)` }}>{p.label}</span>
          </div>
        ))}
      </div>

      {/* ── Camera area — TRANSPARENT — camera shows through ──────── */}
      <div
        style={{
          flexShrink: 0,
          height: 260,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="scanner-frame">
          <div className="scanner-corner top-left" />
          <div className="scanner-corner top-right" />
          <div className="scanner-corner bottom-left" />
          <div className="scanner-corner bottom-right" />
          <div className="scanner-line" />
        </div>
      </div>

      {/* ── Feedback strip (scan result / error) ──────────────────── */}
      {(ui.scanError ?? ui.lastScanned) ? (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 16px',
            background: ui.scanError ? `rgba(${ITC_ERRO_RGB},0.93)` : `rgba(${ITC_SUCESSO_RGB},0.93)`,
            pointerEvents: 'auto',
          }}
        >
          {ui.scanError
            ? <AlertTriangle style={{ width: 15, height: 15, color: '#fff', flexShrink: 0 }} />
            : <CheckCircle2 style={{ width: 15, height: 15, color: '#fff', flexShrink: 0 }} />
          }
          <span style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace' }}>
            {ui.scanError ?? ui.lastScanned}
          </span>
        </div>
      ) : (
        // Thin dark separator so the opaque zone starts cleanly
        <div style={{ flexShrink: 0, height: 4, background: OPAQUE_DARK }} />
      )}

      {/* ── Maintenance strip (yellow) — out-of-target notebooks ───── */}
      {ui.maintenance.length > 0 && (
        <div
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px 8px 16px',
            background: `rgba(${ITC_ATENCAO_RGB},0.18)`, borderTop: `1px solid rgba(${ITC_ATENCAO_RGB},0.3)`,
            pointerEvents: 'auto',
          }}
        >
          <Wrench style={{ width: 15, height: 15, color: ATENCAO_TEXT_DARK, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: ATENCAO_TEXT_DARK }}>
            {ui.maintenance.length} em manutenção · fora da meta
          </span>
          <button
            type="button"
            onClick={() => setShowManut((v) => !v)}
            aria-pressed={showManut}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
              height: 32, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid rgba(${ITC_ATENCAO_RGB},0.5)`, background: `rgba(${ITC_ATENCAO_RGB},0.15)`, color: ATENCAO_TEXT_DARK,
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Eye style={{ width: 15, height: 15 }} />
            Ver
          </button>
        </div>
      )}

      {/* ── Lists area — OPAQUE — blocks camera in lower half ──────── */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          background: OPAQUE_DARK,
          pointerEvents: 'auto',
        }}
      >
        {showManut ? (
          /* Maintenance panel (opened from the yellow strip) */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: ATENCAO_TEXT_DARK, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Em manutenção · {ui.maintenance.length}
              </p>
              <button
                type="button"
                onClick={() => setShowManut(false)}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: WHITE_DIM, fontSize: 12, cursor: 'pointer' }}
              >
                <X style={{ width: 14, height: 14 }} /> Fechar
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {ui.maintenance.map((nb) => (
                <div key={nb.id} style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: ATENCAO_TEXT_DARK, padding: '3px 5px', borderRadius: 4, marginBottom: 2, background: `rgba(${ITC_ATENCAO_RGB},0.12)` }}>
                  {nb.hostname}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Pendentes */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 10px 8px 14px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: WHITE_DIM, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Pendentes · {ui.pending.length}
              </p>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {ui.pending.length === 0 ? (
                  <p style={{ fontSize: 11, color: WHITE_DIM, textAlign: 'center', paddingTop: 6 }}>Todos escaneados!</p>
                ) : (
                  ui.pending.map((nb) => (
                    <div key={nb.id} style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.75)', padding: '3px 5px', borderRadius: 4, marginBottom: 2, background: 'rgba(255,255,255,0.05)' }}>
                      {nb.hostname}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Escaneados */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 14px 8px 10px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: GREEN_DIM, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Escaneados · {ui.scanned.length}
              </p>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {ui.scanned.length === 0 ? (
                  <p style={{ fontSize: 11, color: WHITE_DIM, textAlign: 'center', paddingTop: 6 }}>Nenhum ainda</p>
                ) : (
                  [...ui.scanned].reverse().map((nb) => (
                    <div key={nb.id} style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'rgba(74,222,128,0.9)', padding: '3px 5px', borderRadius: 4, marginBottom: 2, background: `rgba(${ITC_SUCESSO_RGB},0.14)` }}>
                      {nb.hostname}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom bar: Reiniciar + Próximo ───────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          gap: 10,
          // bottom padding clears the Android gesture/navigation bar
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom)) 16px',
          background: OPAQUE_BAR,
          pointerEvents: 'auto',
        }}
      >
        <button
          onClick={ui.onReiniciar}
          style={{
            flexShrink: 0, width: 56, height: 56, borderRadius: 12,
            border: '1.5px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <RotateCcw style={{ width: 20, height: 20 }} />
        </button>

        <button
          onClick={ui.onNext}
          style={{
            flex: 1, height: 56, borderRadius: 12, border: 'none',
            background: '#008f95',
            color: '#fff', fontSize: 15, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
          }}
        >
          Próximo
          <ArrowRight style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  )
}
