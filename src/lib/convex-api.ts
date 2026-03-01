const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://impartial-whale-32.convex.site'

// Device IDs from seed data
export const DEVICE_IDS = {
  UV_ROBOT: 'jd766xcd11tc7jbbfqpgmmr73s8225mg',
  TUG_ROBOT: 'jd76tazf69jdn56bafxb76zbfn823azs',
  ENV_MONITORING: 'jd7dq5j3qdhdt6j8eh0n4s63eh82211t',
  SCHEDULING: 'jd7fas480h1xaf65ny9t42xawd823k3p',
} as const

// Room IDs
export const ROOM_IDS = {
  OR_1: 'jn78nzxs95pfp15xrv43t5b6ks823tv4',
  OR_2: 'jn78n3nbtv60ead9xe81mwx24d822qrf',
  OR_3: 'jn70gpgs6pz5px867y7wak311s823sm0',
  OR_4: 'jn7bdjywxy9ks7fffc9ys96001823pfk',
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
