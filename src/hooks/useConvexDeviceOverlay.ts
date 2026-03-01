"use client"

import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Id } from "../../convex/_generated/dataModel"

export interface ConvexDeviceState {
  status: "idle" | "configuring" | "ready" | "error"
  currentAction?: string
  lastError?: string
  fields: Record<string, unknown>
  updatedAt: number
  roomStatus: string
  isLoading: boolean
}

export function useConvexDeviceOverlay(
  roomId: string,
  deviceName: string
): ConvexDeviceState {
  const data = useQuery(api.roomQueries.getRoomStatePublic, {
    roomId: roomId as Id<"rooms">,
  })

  if (!data) {
    return {
      status: "idle",
      currentAction: undefined,
      lastError: undefined,
      fields: {},
      updatedAt: 0,
      roomStatus: "idle",
      isLoading: true,
    }
  }

  const device = data.devices.find((d) => d.name === deviceName)

  if (!device) {
    return {
      status: "idle",
      currentAction: undefined,
      lastError: undefined,
      fields: {},
      updatedAt: 0,
      roomStatus: data.room.status,
      isLoading: false,
    }
  }

  return {
    status: device.status,
    currentAction: device.currentAction ?? undefined,
    lastError: device.lastError ?? undefined,
    fields: (device.fields as Record<string, unknown>) ?? {},
    updatedAt: device.updatedAt,
    roomStatus: data.room.status,
    isLoading: false,
  }
}
