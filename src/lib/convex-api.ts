const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://impartial-whale-32.convex.site'

// Device IDs from seed data
export const DEVICE_IDS = {
  UV_ROBOT: 'jd7746s4q8nf1qz7mm12sctdch823n4y',
  TUG_ROBOT: 'jd79qkkb7hts62yqxkv5srwapd823an9',
  VARIABLE_TRACKER: 'placeholder-variable-tracker',
  ENV_MONITORING: 'placeholder-env-monitoring',
  SCHEDULING: 'placeholder-scheduling',
} as const

// Room IDs
export const ROOM_IDS = {
  OR_1: 'jn727k23ar820y8tgx894c39k5822emc',
  OR_2: 'jn73m907ax98083sk0brmhp55h823tty',
  OR_3: 'jn73r5arpm1m4trqt44ean1hhh822j46',
  OR_4: 'jn70f574pbckmsqd36jp1t1q5d822mvj',
} as const

export type DeviceStatus = 'idle' | 'configuring' | 'ready' | 'error'

interface DeviceUpdatePayload {
  deviceId: string
  status: DeviceStatus
  currentAction?: string
  lastError?: string
}

interface FieldUpdatePayload {
  deviceId: string
  fields: Record<string, unknown>
}

interface RoomStateResponse {
  room: {
    _id: string
    name: string
    status: string
    deviceCount: number
    devicesReady: number
    updatedAt: number
  }
  devices: Array<{
    _id: string
    name: string
    category: string
    roomId: string
    url: string
    status: string
    fields: Record<string, unknown>
    updatedAt: number
  }>
  environmentReadings: unknown[]
}

export async function updateDeviceStatus(payload: DeviceUpdatePayload): Promise<{ ok: boolean }> {
  try {
    const response = await fetch(`${CONVEX_SITE_URL}/device-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return await response.json()
  } catch (error) {
    console.error('Failed to update device status:', error)
    return { ok: false }
  }
}

export async function updateDeviceFields(payload: FieldUpdatePayload): Promise<{ ok: boolean }> {
  try {
    const response = await fetch(`${CONVEX_SITE_URL}/field-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return await response.json()
  } catch (error) {
    console.error('Failed to update device fields:', error)
    return { ok: false }
  }
}

export async function getRoomState(roomId: string): Promise<RoomStateResponse | null> {
  try {
    const response = await fetch(`${CONVEX_SITE_URL}/room-state?roomId=${roomId}`)
    return await response.json()
  } catch (error) {
    console.error('Failed to get room state:', error)
    return null
  }
}
