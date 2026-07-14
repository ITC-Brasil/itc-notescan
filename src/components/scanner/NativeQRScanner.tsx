'use client'

import { useEffect, useRef } from 'react'

interface NativeQRScannerProps {
  onScan: (hostname: string) => void
  onError: (error: string) => void
  isActive: boolean
}

export function NativeQRScanner({ onScan, onError, isActive }: NativeQRScannerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

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

        // startScanning() with callback keeps the camera open between reads,
        // eliminating the stop/restart gap of the recursive startScan() pattern.
        // targetedFormats limits detection to QR_CODE only, which increases
        // sensitivity and scan speed compared to scanning all barcode formats.
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

  // The native scanner uses the device camera directly behind the WebView.
  // This overlay renders the viewfinder UI on top of the transparent background.
  return (
    <div className="native-scanner-overlay" ref={overlayRef}>
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
