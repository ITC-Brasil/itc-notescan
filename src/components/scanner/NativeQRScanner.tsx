'use client'

import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, RotateCcw, Check } from 'lucide-react'

export interface NativeScanUi {
  umName: string
  umColor: string
  /** Full list so the overlay can render hostnames */
  pending: { id: string; hostname: string }[]
  scanned: { id: string; hostname: string }[]
  lastScanned: string | null
  scanError: string | null
  onNext: () => void
  onReiniciar: () => void
}

interface NativeQRScannerProps {
  onScan: (hostname: string) => void
  onError: (error: string) => void
  isActive: boolean
  ui?: NativeScanUi
}

// Reusable inline-style constants
const OPAQUE_DARK = 'rgba(14,14,14,0.94)'
const OPAQUE_BAR  = 'rgba(0,0,0,0.82)'
const WHITE_DIM   = 'rgba(255,255,255,0.55)'
const GREEN_DIM   = 'rgba(26,127,60,0.85)'

export function NativeQRScanner({ onScan, onError, isActive, ui }: NativeQRScannerProps) {
  useEffect(() => {
    const stopScan = async () => {
      try {
        const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner')
        await BarcodeScanner.stopScan()
        BarcodeScanner.showBackground()
        document.body.classList.remove('scanner-active')
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
        const { BarcodeScanner, SupportedFormat } = await import('@capacitor-community/barcode-scanner')

        const status = await BarcodeScanner.checkPermission({ force: true })
        if (!status.granted) {
          onError('Permissão de câmera negada')
          return
        }

        document.body.classList.add('scanner-active')
        BarcodeScanner.hideBackground()

        // startScanning() drives the full camera setup internally (_prepare + scan loop).
        // targetedFormats: QR_CODE only — improves sensitivity on small 12×40mm labels.
        await BarcodeScanner.startScanning(
          { targetedFormats: [SupportedFormat.QR_CODE] },
          (result, err) => {
            if (err) { onError('Erro durante leitura'); return }
            if (result?.hasContent) { onScan(result.content) }
          },
        )
      } catch {
        onError('Erro ao iniciar câmera')
        document.body.classList.remove('scanner-active')
      }
    }

    void startScan()
    return () => { void stopScan() }
  }, [isActive, onScan, onError])

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

  const total = ui.pending.length + ui.scanned.length

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
          padding: '10px 16px',
          background: OPAQUE_BAR,
          pointerEvents: 'auto',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: ui.umColor, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{ui.umName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontFamily: 'monospace', color: WHITE_DIM }}>
          {ui.scanned.length}/{total}
        </span>
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
            background: ui.scanError ? 'rgba(192,57,43,0.93)' : 'rgba(26,127,60,0.93)',
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
        {/* Pendentes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 10px 8px 14px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: WHITE_DIM, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Pendentes ({ui.pending.length})
          </p>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {ui.pending.length === 0 ? (
              <p style={{ fontSize: 11, color: WHITE_DIM, textAlign: 'center', paddingTop: 6 }}>Todos escaneados!</p>
            ) : (
              ui.pending.map((nb) => (
                <div key={nb.id} style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)', padding: '3px 5px', borderRadius: 4, marginBottom: 2, background: 'rgba(255,255,255,0.05)' }}>
                  {nb.hostname}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Escaneados */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 14px 8px 10px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: GREEN_DIM, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Escaneados ({ui.scanned.length})
          </p>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {ui.scanned.length === 0 ? (
              <p style={{ fontSize: 11, color: WHITE_DIM, textAlign: 'center', paddingTop: 6 }}>Nenhum ainda</p>
            ) : (
              [...ui.scanned].reverse().map((nb) => (
                <div key={nb.id} style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(74,222,128,0.9)', padding: '3px 5px', borderRadius: 4, marginBottom: 2, background: 'rgba(26,127,60,0.14)' }}>
                  {nb.hostname}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom bar: Reiniciar + Próximo ───────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          gap: 10,
          padding: '12px 16px',
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
            background: ui.pending.length > 0 ? '#c0392b' : '#008f95',
            color: '#fff', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
          }}
        >
          {ui.pending.length > 0 ? (
            <><AlertTriangle style={{ width: 18, height: 18 }} />Próximo — {ui.pending.length} faltante{ui.pending.length !== 1 ? 's' : ''}</>
          ) : (
            <><Check style={{ width: 18, height: 18 }} />Próximo — todos escaneados</>
          )}
        </button>
      </div>
    </div>
  )
}
