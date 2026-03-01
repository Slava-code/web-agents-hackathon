const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'https://impartial-whale-32.convex.site'

// Device IDs from the impartial-whale-32 deployment (OR-3 devices)
export const DEVICE_IDS = {
  UV_ROBOT: 'jd710yedg9y0jjceyermx7qcbs822r2t',
  TUG_ROBOT: 'jd7ccfh8ngy32dr8yq53kmbc9x822pp2',
  ENV_MONITORING: 'jd795pyyc96w6y2mp6rm7g4y5h8222n6',
  SCHEDULING: 'jd708khpf32tx1wek415dsjefx822zha',
} as const

// Room IDs from the impartial-whale-32 deployment
export const ROOM_IDS = {
  OR_1: 'jn761zbp8x7sqz9k4c19n1c3wx822dkh',
  OR_2: 'jn76k8vm6z93n90wrf9f8bb74x8226z3',
  OR_3: 'jn7ejjf7fv8pnq8vrp4qn79xwd8238x8',
  OR_4: 'jn7cgfefkep7zmw3bzeh2kg33n823ztx',
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
