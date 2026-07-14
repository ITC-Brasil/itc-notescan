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

        // Pre-warm autofocus before scanning — critical for small labels (12×40mm).
        await BarcodeScanner.prepare()

        // startScanning() with callback keeps the camera open between reads.
        // targetedFormats limits detection to QR_CODE only for higher sensitivity.
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

  return (
    // pointer-events: none on overlay so touches fall through.
    // Interactive areas re-enable with pointer-events: auto.
    <div className="native-scanner-overlay">

      {/* ── Top bar: UM name + count ── */}
      {ui && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.65)',
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

      {/* ── Center: viewfinder + feedback ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          // shift up slightly to clear the top bar
          marginTop: ui ? 56 : 0,
        }}
      >
        <div className="scanner-frame">
          <div className="scanner-corner top-left" />
          <div className="scanner-corner top-right" />
          <div className="scanner-corner bottom-left" />
          <div className="scanner-corner bottom-right" />
          <div className="scanner-line" />
        </div>

        {/* Feedback strip — only show while scanner is active */}
        {ui && ui.scanError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'rgba(192,57,43,0.9)',
              borderRadius: 10,
              color: '#fff',
              fontSize: 13,
              maxWidth: 280,
            }}
          >
            <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{ui.scanError}</span>
          </div>
        )}
        {ui && !ui.scanError && ui.lastScanned && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'rgba(26,127,60,0.9)',
              borderRadius: 10,
              color: '#fff',
              fontSize: 13,
              maxWidth: 280,
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{ui.lastScanned}</span>
          </div>
        )}
      </div>

      {/* ── Bottom bar: Reiniciar + Próximo ── */}
      {ui && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            gap: 10,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.65)',
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
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: 20, height: 20 }} />
          </button>

          {/* Próximo / Finalizar */}
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
