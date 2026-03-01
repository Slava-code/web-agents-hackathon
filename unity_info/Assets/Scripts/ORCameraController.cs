using UnityEngine;

public class ORCameraController : MonoBehaviour
{
    [Header("Orbit Settings")]
    public Transform orbitCenter;
    public float orbitRadius = 8f;
    public float orbitHeight = 3f;
    public float orbitSpeed = 5f;

    [Header("Pendulum Sweep")]
    public float sweepAngleMin = -90f;
    public float sweepAngleMax = 90f;
    public float startAngle = 0f;

    [Header("Device Focus")]
    public float focusShiftSpeed = 2f;
    public float focusAngleOffset = 15f;
    public float focusHoldTime = 4f;

    [System.Serializable]
    public class DeviceTarget
    {
        public string deviceId;
        public Transform target;
    }
    public DeviceTarget[] deviceTargets;

    private float currentAngle;
    private float sweepDirection = 1f;
    private float targetAngleOffset = 0f;
    private float currentAngleOffset = 0f;
    private bool isFrozen = false;
    private int activeDeviceCount = 0;

    void Start()
    {
        currentAngle = startAngle;
        ConvexManager.OnDeviceStatusChanged += OnDeviceChanged;
    }

    void OnDestroy()
    {
        ConvexManager.OnDeviceStatusChanged -= OnDeviceChanged;
    }

    void OnDeviceChanged(string deviceId)
    {
        if (!ConvexManager.Devices.ContainsKey(deviceId)) return;
        string status = ConvexManager.Devices[deviceId].status;

        // Count how many devices are currently active/running
        activeDeviceCount = 0;
        foreach (var kvp in ConvexManager.Devices)
        {
            if (kvp.Value.status == "active" || kvp.Value.status == "running")
                activeDeviceCount++;
        }

        // Freeze camera when anything is happening, resume when all done
        isFrozen = activeDeviceCount > 0;

        // Shift angle toward active device
        if (deviceTargets == null || orbitCenter == null) return;
        if (status == "active" || status == "running")
        {
            foreach (var dt in deviceTargets)
            {
                if (dt.deviceId == deviceId && dt.target != null)
                {
                    Vector3 toDevice = dt.target.position - orbitCenter.position;
                    float deviceAngle = Mathf.Atan2(toDevice.x, toDevice.z) * Mathf.Rad2Deg;
                    float angleDiff = Mathf.DeltaAngle(currentAngle, deviceAngle);
                    targetAngleOffset = Mathf.Clamp(angleDiff * 0.3f, -focusAngleOffset, focusAngleOffset);
                    break;
                }
            }
        }
    }

    void Update()
    {
        if (orbitCenter == null) return;

        // Only sweep when NOT frozen
        if (!isFrozen)
        {
            currentAngle += orbitSpeed * sweepDirection * Time.deltaTime;

            if (currentAngle >= sweepAngleMax)
            {
                currentAngle = sweepAngleMax;
                sweepDirection = -1f;
            }
            else if (currentAngle <= sweepAngleMin)
            {
                currentAngle = sweepAngleMin;
                sweepDirection = 1f;
            }

            // Ease offset back to zero when not focused
            targetAngleOffset = Mathf.MoveTowards(targetAngleOffset, 0f, Time.deltaTime * 3f);
        }

        currentAngleOffset = Mathf.Lerp(currentAngleOffset, targetAngleOffset, focusShiftSpeed * Time.deltaTime);

        float finalAngle = (currentAngle + currentAngleOffset) * Mathf.Deg2Rad;

        Vector3 offset = new Vector3(
            Mathf.Sin(finalAngle) * orbitRadius,
            orbitHeight,
            Mathf.Cos(finalAngle) * orbitRadius
        );

        transform.position = orbitCenter.position + offset;
        transform.LookAt(orbitCenter.position);
    }
}