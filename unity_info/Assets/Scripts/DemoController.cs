// ============================================
// DemoController.cs — Put on an empty GameObject called "DemoController"
// ============================================
// For testing without Convex connected.
// Press SPACE to run the full turnover sequence.
// Press 1-5 to trigger individual devices.
// This simulates what Convex would do.
// DELETE THIS before the final demo (or just disable it).
// ============================================

using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class DemoController : MonoBehaviour
{
    [Header("Sequence Timing")]
    public float delayBetweenDevices = 3f;
    public float uvRunDuration = 8f;

    private bool sequenceRunning = false;

    void Update()
    {
        // SPACE = full turnover sequence
        if (Input.GetKeyDown(KeyCode.Space) && !sequenceRunning)
        {
            StartCoroutine(RunFullTurnover());
        }

        // Individual device triggers for testing
        if (Input.GetKeyDown(KeyCode.Alpha1)) SimulateDevice("uv_robot", "running");
        if (Input.GetKeyDown(KeyCode.Alpha2)) SimulateDevice("env_sensors", "active");
        if (Input.GetKeyDown(KeyCode.Alpha3)) SimulateDevice("autoclave", "active");
        if (Input.GetKeyDown(KeyCode.Alpha4)) SimulateDevice("room_scheduling", "active");
        if (Input.GetKeyDown(KeyCode.Alpha5)) SimulateDevice("ptz_camera", "active");

        // R = reset all to idle
        if (Input.GetKeyDown(KeyCode.R))
        {
            ResetAll();
        }
    }

    IEnumerator RunFullTurnover()
    {
        sequenceRunning = true;
        Debug.Log(">>> TURNOVER SEQUENCE STARTED <<<");

        // Step 1: UV Robot starts
        SimulateDevice("uv_robot", "active");
        yield return new WaitForSeconds(1f);
        SimulateDevice("uv_robot", "running");

        // Step 2: While UV runs, check environmental sensors
        yield return new WaitForSeconds(delayBetweenDevices);
        SimulateDevice("env_sensors", "active");
        yield return new WaitForSeconds(1f);
        SimulateDevice("env_sensors", "running");
        yield return new WaitForSeconds(2f);
        SimulateDevice("env_sensors", "complete");

        // Step 3: Check autoclave
        yield return new WaitForSeconds(delayBetweenDevices);
        SimulateDevice("autoclave", "active");
        yield return new WaitForSeconds(1f);
        SimulateDevice("autoclave", "running");
        yield return new WaitForSeconds(2f);
        SimulateDevice("autoclave", "complete");

        // Step 4: UV completes
        yield return new WaitForSeconds(delayBetweenDevices);
        SimulateDevice("uv_robot", "complete");

        // Step 5: PTZ camera scans
        yield return new WaitForSeconds(2f);
        SimulateDevice("ptz_camera", "active");
        yield return new WaitForSeconds(1f);
        SimulateDevice("ptz_camera", "running");
        yield return new WaitForSeconds(15f);
        SimulateDevice("ptz_camera", "complete");

        // Step 6: Update room scheduling
        yield return new WaitForSeconds(delayBetweenDevices);
        SimulateDevice("room_scheduling", "active");
        yield return new WaitForSeconds(1f);
        SimulateDevice("room_scheduling", "complete");

        Debug.Log(">>> TURNOVER COMPLETE — OR 3 READY <<<");
        sequenceRunning = false;
    }

    void SimulateDevice(string deviceId, string status)
    {
        // Create or update the device in ConvexManager's static dictionary
        if (!ConvexManager.Devices.ContainsKey(deviceId))
        {
            ConvexManager.Devices[deviceId] = new ConvexManager.DeviceState
            {
                deviceId = deviceId,
                name = GetDeviceName(deviceId),
                status = status,
                statusDetail = GetStatusDetail(deviceId, status),
                progress = status == "complete" ? 100f : 0f
            };
        }
        else
        {
            var device = ConvexManager.Devices[deviceId];
            device.status = status;
            device.statusDetail = GetStatusDetail(deviceId, status);
            device.progress = status == "complete" ? 100f : 0f;
        }

        // Fire the event that all ORDevice scripts listen to
        // We need to use reflection or make the event invocable
        // Simpler: just directly invoke via a public method
        Debug.Log($"[DEMO] {deviceId} → {status}");

        // Fire the event through ConvexManager
        ConvexManager.SimulateStatusChange(deviceId);
    }

    void ResetAll()
    {
        string[] allDevices = { "uv_robot", "env_sensors", "autoclave", "room_scheduling", "ptz_camera" };
        foreach (var id in allDevices)
        {
            SimulateDevice(id, "idle");
        }
        Debug.Log(">>> ALL DEVICES RESET TO IDLE <<<");
    }

    string GetDeviceName(string deviceId)
    {
        switch (deviceId)
        {
            case "uv_robot": return "UV Disinfection Robot";
            case "env_sensors": return "Environmental Sensors";
            case "autoclave": return "Autoclave/Sterilizer";
            case "room_scheduling": return "Room Scheduling";
            case "ptz_camera": return "PTZ Camera";
            default: return deviceId;
        }
    }

    string GetStatusDetail(string deviceId, string status)
    {
        switch (deviceId)
        {
            case "uv_robot":
                if (status == "running") return "UV-C cycle in progress...";
                if (status == "complete") return "Disinfection complete — 99.9% pathogen kill";
                break;
            case "env_sensors":
                if (status == "active") return "Reading particulate levels...";
                if (status == "complete") return "Air quality: SAFE — PM2.5: 12µg/m³";
                break;
            case "autoclave":
                if (status == "active") return "Checking sterilization status...";
                if (status == "complete") return "Tray #4521 — STERILE — 134°C verified";
                break;
            case "room_scheduling":
                if (status == "active") return "Updating Epic Hyperspace...";
                if (status == "complete") return "OR 3 → READY | Next: Dr. Chen, 14:30";
                break;
            case "ptz_camera":
                if (status == "running") return "Visual inspection sweep...";
                if (status == "complete") return "Visual clearance confirmed";
                break;
        }
        return status;
    }
}
