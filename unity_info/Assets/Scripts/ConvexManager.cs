// ============================================
// ConvexManager.cs — Put on an empty GameObject called "ConvexManager"
// ============================================
// Polls Convex HTTP API every 500ms for device state updates.
// Other scripts subscribe to events to react to changes.
// ============================================

using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

public class ConvexManager : MonoBehaviour
{
    [Header("Convex Configuration")]
    [Tooltip("Your Convex deployment URL, e.g. https://your-project-123.convex.cloud")]
    public string convexUrl = "https://YOUR_DEPLOYMENT.convex.cloud";

    [Tooltip("Room ID to poll state for")]
    public string roomId = "";

    [Tooltip("How often to poll for updates (seconds)")]
    public float pollInterval = 0.5f;

    // Events that other scripts subscribe to
    public static event Action<DeviceState[]> OnDevicesUpdated;
    public static event Action<EnvironmentReading[]> OnActivityUpdated;
    public static event Action<string> OnDeviceStatusChanged;

    // Current state (other scripts can read this directly)
    public static Dictionary<string, DeviceState> Devices = new Dictionary<string, DeviceState>();
    public static List<EnvironmentReading> RecentReadings = new List<EnvironmentReading>();

    private Dictionary<string, string> previousStatuses = new Dictionary<string, string>();

    // Status mapping from Convex values to Unity values
    private static readonly Dictionary<string, string> StatusMap = new Dictionary<string, string>
    {
        { "idle", "idle" },
        { "configuring", "active" },
        { "ready", "complete" },
        { "error", "error" },
    };

    void Start()
    {
        StartCoroutine(PollRoomState());
    }

    IEnumerator PollRoomState()
    {
        while (true)
        {
            if (!string.IsNullOrEmpty(roomId))
            {
                string url = $"{convexUrl}/room-state?roomId={UnityWebRequest.EscapeURL(roomId)}";

                using (UnityWebRequest request = UnityWebRequest.Get(url))
                {
                    yield return request.SendWebRequest();

                    if (request.result == UnityWebRequest.Result.Success)
                    {
                        string json = request.downloadHandler.text;
                        ParseRoomState(json);
                    }
                    else
                    {
                        Debug.LogWarning($"Room state poll failed: {request.error}");
                    }
                }
            }

            yield return new WaitForSeconds(pollInterval);
        }
    }

    void ParseRoomState(string json)
    {
        var response = JsonUtility.FromJson<RoomStateResponse>(json);
        if (response == null) return;

        // --- Devices ---
        if (response.devices != null)
        {
            var mapped = new List<DeviceState>();
            foreach (var raw in response.devices)
            {
                var device = new DeviceState
                {
                    deviceId = raw._id,
                    name = raw.name,
                    vendor = raw.category,
                    dashboardUrl = raw.url,
                    status = MapStatus(raw.status),
                    statusDetail = raw.currentAction ?? "",
                    progress = raw.status == "ready" ? 100f : 0f,
                    lastUpdated = raw.updatedAt,
                };
                mapped.Add(device);

                if (previousStatuses.ContainsKey(device.deviceId) &&
                    previousStatuses[device.deviceId] != device.status)
                {
                    OnDeviceStatusChanged?.Invoke(device.deviceId);
                }
                previousStatuses[device.deviceId] = device.status;
                Devices[device.deviceId] = device;
            }
            OnDevicesUpdated?.Invoke(mapped.ToArray());
        }

        // --- Environment Readings ---
        if (response.environmentReadings != null)
        {
            RecentReadings = new List<EnvironmentReading>(response.environmentReadings);
            OnActivityUpdated?.Invoke(response.environmentReadings);
        }
    }

    static string MapStatus(string convexStatus)
    {
        if (convexStatus != null && StatusMap.TryGetValue(convexStatus, out string mapped))
            return mapped;
        return convexStatus ?? "idle";
    }

    // ---- Data Classes ----

    // Called by DemoController to simulate status changes without Convex
    public static void SimulateStatusChange(string deviceId)
    {
        OnDeviceStatusChanged?.Invoke(deviceId);
    }

    public static void SimulateDevicesUpdated()
    {
        OnDevicesUpdated?.Invoke(new List<DeviceState>(Devices.Values).ToArray());
    }

    [Serializable]
    public class DeviceState
    {
        public string deviceId;
        public string name;
        public string vendor;
        public string dashboardUrl;
        public string status;       // "idle" | "active" | "running" | "complete" | "error"
        public string statusDetail;
        public float progress;       // 0-100
        public long lastUpdated;
    }

    [Serializable]
    public class EnvironmentReading
    {
        public string _id;
        public string roomId;
        public float temperature;
        public float humidity;
        public float bacterialConcentration;
        public float co2;
        public float oxygen;
        public float particulateCount;
        public float pressureDifferential;
        public bool allWithinRange;
        public string[] outOfRangeFields;
        public long timestamp;
    }

    // Intermediate class matching raw Convex device JSON fields
    [Serializable]
    public class RawDevice
    {
        public string _id;
        public string name;
        public string category;
        public string roomId;
        public string url;
        public string status;
        public string currentAction;
        public string lastError;
        public long updatedAt;
    }

    [Serializable]
    public class RoomInfo
    {
        public string _id;
        public string name;
        public string status;
        public string procedure;
        public int deviceCount;
        public int devicesReady;
        public long updatedAt;
    }

    [Serializable]
    public class RoomStateResponse
    {
        public RoomInfo room;
        public RawDevice[] devices;
        public EnvironmentReading[] environmentReadings;
    }
}
