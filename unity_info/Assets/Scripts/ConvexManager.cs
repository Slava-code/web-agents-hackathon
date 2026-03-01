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

    [Tooltip("How often to poll for updates (seconds)")]
    public float pollInterval = 0.5f;

    // Events that other scripts subscribe to
    public static event Action<DeviceState[]> OnDevicesUpdated;
    public static event Action<ActivityLogEntry[]> OnActivityUpdated;
    public static event Action<string> OnDeviceStatusChanged;

    // Current state (other scripts can read this directly)
    public static Dictionary<string, DeviceState> Devices = new Dictionary<string, DeviceState>();
    public static List<ActivityLogEntry> RecentActivity = new List<ActivityLogEntry>();

    private Dictionary<string, string> previousStatuses = new Dictionary<string, string>();

    void Start()
    {
        StartCoroutine(PollDevices());
        StartCoroutine(PollActivity());
    }

    IEnumerator PollDevices()
    {
        while (true)
        {
            yield return StartCoroutine(QueryConvex("queries:getAllDevices", "{}", (json) =>
            {
                var wrapper = JsonUtility.FromJson<DeviceArrayWrapper>("{\"devices\":" + json + "}");
                if (wrapper?.devices != null)
                {
                    foreach (var device in wrapper.devices)
                    {
                        if (previousStatuses.ContainsKey(device.deviceId) &&
                            previousStatuses[device.deviceId] != device.status)
                        {
                            OnDeviceStatusChanged?.Invoke(device.deviceId);
                        }
                        previousStatuses[device.deviceId] = device.status;
                        Devices[device.deviceId] = device;
                    }
                    OnDevicesUpdated?.Invoke(wrapper.devices);
                }
            }));
            yield return new WaitForSeconds(pollInterval);
        }
    }

    IEnumerator PollActivity()
    {
        while (true)
        {
            yield return StartCoroutine(QueryConvex("queries:getRecentActivity", "{}", (json) =>
            {
                var wrapper = JsonUtility.FromJson<ActivityArrayWrapper>("{\"entries\":" + json + "}");
                if (wrapper?.entries != null)
                {
                    RecentActivity = new List<ActivityLogEntry>(wrapper.entries);
                    OnActivityUpdated?.Invoke(wrapper.entries);
                }
            }));
            yield return new WaitForSeconds(pollInterval);
        }
    }

    IEnumerator QueryConvex(string functionName, string argsJson, Action<string> onSuccess)
    {
        string url = $"{convexUrl}/api/query";
        string body = $"{{\"path\":\"{functionName}\",\"args\":{{}}}}";

        using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(body);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                var response = JsonUtility.FromJson<ConvexResponse>(request.downloadHandler.text);
                if (response != null && response.status == "success")
                {
                    onSuccess?.Invoke(response.value);
                }
            }
            else
            {
                Debug.LogWarning($"Convex query failed: {request.error}");
            }
        }
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
    public class ConvexResponse
    {
        public string status;
        public string value;
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
    public class ActivityLogEntry
    {
        public long timestamp;
        public string deviceId;
        public string action;
        public string message;
    }

    [Serializable]
    public class DeviceArrayWrapper { public DeviceState[] devices; }

    [Serializable]
    public class ActivityArrayWrapper { public ActivityLogEntry[] entries; }
}
