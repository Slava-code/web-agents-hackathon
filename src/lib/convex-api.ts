const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://impartial-whale-32.convex.site'

// Device IDs from seed data
export const DEVICE_IDS = {
  UV_ROBOT: 'jd72bxwjgw87028ccbp6zzmaes823nys',
  TUG_ROBOT: 'jd74ec16aby2rbteq1rwjcc0t1822pfx',
  VARIABLE_TRACKER: 'placeholder-variable-tracker',
  ENV_MONITORING: 'placeholder-env-monitoring',
  SCHEDULING: 'placeholder-scheduling',
} as const

// Room IDs
export const ROOM_IDS = {
  OR_1: 'jn74ng7t47dm867bf9ysewzx61823jcd',
  OR_2: 'jn7dyd2x59n44q4bwxve0ghk3h822kr2',
  OR_3: 'jn7fbnzdjjxxsq1c5v03ptq2hx822h41',
  OR_4: 'jn7e11r2yq5mfbyz7v1x1e81wn823gmj',
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
