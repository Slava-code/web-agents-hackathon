const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://adept-wren-805.convex.site'

// Device IDs from the adept-wren-805 deployment (OR-3 devices)
export const DEVICE_IDS = {
  UV_ROBOT: 'jd73ve7m965tg28kbcffs4nhh582253p',
  TUG_ROBOT: 'jd79jwzj5893812hkgf68dz3vh822aa2',
  ENV_MONITORING: 'jd7a1249k2xq68q6b7yxwh9vnx822d6b',
  SCHEDULING: 'jd7drsdfe5h2d9hq06ap95gx9d82244t',
} as const

// Room IDs
export const ROOM_IDS = {
  OR_1: 'jn77dth55k7d2600v9hx3dbk4s822646',
  OR_2: 'jn78nfx1s528tz8cknq4c8g44d823yvv',
  OR_3: 'jn7bw19xt7a818kvh3w5dhxvvd823j8a',
  OR_4: 'jn7caae78h5qg7pthmzav3yx4n8224ee',
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
