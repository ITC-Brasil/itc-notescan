import { useEffect, useState } from 'react'

type Platform = 'web' | 'android' | 'ios'

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web')

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        const p = Capacitor.getPlatform()
        if (p === 'android') setPlatform('android')
        else if (p === 'ios') setPlatform('ios')
      } catch {
        // Not running inside Capacitor — stay on 'web'
      }
    })()
  }, [])

  return platform
}
