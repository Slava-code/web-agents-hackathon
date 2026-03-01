const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://hardy-gnat-785.convex.site'

// Device IDs from seed data (adept-wren-805 / hardy-gnat-785 deployments)
export const DEVICE_IDS = {
  UV_ROBOT: 'jd73ve7m965tg28kbcffs4nhh582253p',
  TUG_ROBOT: 'jd79jwzj5893812hkgf68dz3vh822aa2',
  ENV_MONITORING: 'jd7a1249k2xq68q6b7yxwh9vnx822d6b',
  SCHEDULING: 'jd7drsdfe5h2d9hq06ap95gx9d82244t',
  SURVEILLANCE: 'jd7b0y7js7c8ye7064bfqys81h8229e2',
} as const

// Room IDs
export const ROOM_IDS = {
  OR_1: 'jn7awk9w6aa5jwwgk0j4127mqs823ryx',
  OR_2: 'jn73s1j1vfh59gn5tnwh2yxqtd822cty',
  OR_3: 'jn78kamvzt5ha8qscg8kd7esqx823etw',
  OR_4: 'jn7fnajq8wddgen4chq4r3asn982353h',
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
