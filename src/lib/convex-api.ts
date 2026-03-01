const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://impartial-whale-32.convex.site'

// Device IDs from seed data
export const DEVICE_IDS = {
  UV_ROBOT: 'jd74zb957j4a83r2q1y5zxjwsh8237by',
  ENV_MONITORING: 'jd7a5wdr3kc9p7krjep93paptn8235qk',
  TUG_ROBOT: 'jd7eh4r1c2fxc3rq1axt30zha5823x6m', // was Sterilizer
  SCHEDULING: 'jd7ekvwvtgs4y560qmr61983v1823ewy',
  VARIABLE_TRACKER: 'jd79cdv4fn4d2jyk562vhtz0p58226e8', // was Surveillance
} as const

// Room IDs
export const ROOM_IDS = {
  OR_1: 'jn79y9jj2g38wjmv81vmhweq4n823s1x',
  OR_2: 'jn75c2eryk3rm98y3q7d4vtmd9823zbn',
  OR_3: 'jn7ewfpj0keefnvbt5c9s9wcws822edy',
  OR_4: 'jn7etvj27d8rmsrdj50trkwz0n823v78',
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
