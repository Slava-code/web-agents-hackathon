'use client'

import { useEffect, useRef } from 'react'
import { updateDeviceFields } from '@/lib/convex-api'

/**
 * Auto-syncs a flat fields object to Convex whenever it changes.
 * Debounces pushes by 300ms so rapid state changes batch together.
 */
export function useConvexSync(deviceId: string, fields: Record<string, string>) {
  const prevRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const serialized = JSON.stringify(fields)
    if (serialized === prevRef.current) return
    prevRef.current = serialized

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updateDeviceFields({ deviceId, fields }).then((result) => {
        if (!result.ok) console.warn('[ConvexSync] push failed for', deviceId)
      })
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [deviceId, fields])
}
