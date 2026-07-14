'use client'

import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, RotateCcw, Check } from 'lucide-react'

export interface NativeScanUi {
  umName: string
  umColor: string
  pendingCount: number
  scannedCount: number
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

        // startScanning() keeps the camera open between reads and fires the callback
        // for each QR code detected. targetedFormats improves sensitivity on small labels.
        // Note: prepare() is intentionally omitted — startScanning() handles camera
        // setup internally via _prepare(savedCall), and calling prepare() separately
        // can interfere with the keepAlive callback registration.
        await BarcodeScanner.startScanning(
          { targetedFormats: [SupportedFormat.QR_CODE] },
          (result, err) => {
            if (err) {
              onError('Erro durante leitura')
              return
            }
            if (result?.hasContent) {
              onScan(result.content)
            }
          },
        )
      } catch {
        onError('Erro ao iniciar câmera')
        document.body.classList.remove('scanner-active')
      }
    }

    void startScan()

    return () => {
      void stopScan()
    }
  }, [isActive, onScan, onError])

  const total = ui ? ui.pendingCount + ui.scannedCount : 0

  // z-index layers inside the overlay (all are within stacking context z-50):
  //   1 — scanner-frame (with box-shadow spotlight mask)
  //   2 — top bar, feedback strip, bottom bar (above the mask)

  return (
    // pointer-events: none on overlay; interactive areas use pointer-events: auto.
    // The flex centering is applied via .native-scanner-overlay CSS class.
    <div className="native-scanner-overlay">

      {/* ── Top bar: UM name + count ─────────────────────────────── */}
      {ui && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.72)',
            pointerEvents: 'auto',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: ui.umColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
            {ui.umName}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 14, fontFamily: 'monospace', color: '#fff' }}>
            {ui.scannedCount}/{total}
          </span>
        </div>
      )}

      {/* ── Viewfinder frame (centered by parent flex) ────────────── */}
      {/* box-shadow spotlight is applied via .scanner-frame CSS rule  */}
      <div className="scanner-frame" style={{ zIndex: 1 }}>
        <div className="scanner-corner top-left" />
        <div className="scanner-corner top-right" />
        <div className="scanner-corner bottom-left" />
        <div className="scanner-corner bottom-right" />
        <div className="scanner-line" />
      </div>

      {/* ── Feedback strip (below viewfinder, above mask) ─────────── */}
      {ui && (ui.scanError || ui.lastScanned) && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            // sits between the viewfinder bottom and the bottom bar (approx)
            bottom: 88,
            zIndex: 2,
          }}
        >
          {ui.scanError ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'rgba(192,57,43,0.92)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{ui.scanError}</span>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'rgba(26,127,60,0.92)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
              }}
            >
              <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{ui.lastScanned}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom bar: Reiniciar + Próximo ───────────────────────── */}
      {ui && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            display: 'flex',
            gap: 10,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.72)',
            pointerEvents: 'auto',
          }}
        >
          {/* Reiniciar */}
          <button
            onClick={ui.onReiniciar}
            style={{
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: 12,
              border: '1.5px solid rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: 20, height: 20 }} />
          </button>

          {/* Próximo */}
          <button
            onClick={ui.onNext}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 12,
              border: 'none',
              background: ui.pendingCount > 0 ? '#c0392b' : '#008f95',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            {ui.pendingCount > 0 ? (
              <>
                <AlertTriangle style={{ width: 18, height: 18 }} />
                Próximo — {ui.pendingCount} faltante{ui.pendingCount !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <Check style={{ width: 18, height: 18 }} />
                Próximo — todos escaneados
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
