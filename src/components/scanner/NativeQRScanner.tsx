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
        const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner')

        const status = await BarcodeScanner.checkPermission({ force: true })
        if (!status.granted) {
          onError('Permissão de câmera negada')
          return
        }

        document.body.classList.add('scanner-active')
        BarcodeScanner.hideBackground()

        const result = await BarcodeScanner.startScan()

        document.body.classList.remove('scanner-active')
        BarcodeScanner.showBackground()

        if (result.hasContent) {
          onScan(result.content)
          // Continue scanning after a successful read
          void startScan()
        }
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
