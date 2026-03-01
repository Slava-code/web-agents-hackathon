// ============================================
// ORDevice.cs — Put on each device GameObject in the OR scene
// ============================================
// Reacts to Convex state changes with visual effects:
// glow, pulse, color transitions, particles, floating status UI.
// ============================================

using System.Collections;
using UnityEngine;

public class ORDevice : MonoBehaviour
{
    [Header("Device Identity")]
    [Tooltip("Must match deviceId in Convex: uv_robot, env_sensors, autoclave, room_scheduling, ptz_camera")]
    public string deviceId;

    [Header("Visual References")]
    public Renderer deviceRenderer;
    public Light statusLight;
    public ParticleSystem activeParticles;
    public Transform statusPanelAnchor;
    public GameObject statusPanel;

    [Header("Colors")]
    public Color idleColor = new Color(0.2f, 0.4f, 0.8f, 1f);
    public Color activeColor = new Color(0.1f, 0.9f, 0.3f, 1f);
    public Color runningColor = new Color(0.8f, 0.5f, 0.1f, 1f);
    public Color completeColor = new Color(0.1f, 1f, 0.5f, 1f);
    public Color errorColor = new Color(1f, 0.2f, 0.2f, 1f);

    [Header("Animation")]
    public float pulseSpeed = 2f;
    public float pulseIntensity = 0.3f;
    public float colorTransitionSpeed = 3f;

    private string currentStatus = "idle";
    private Color targetColor;
    private Color currentColor;
    private Material deviceMaterial;
    private float pulseTimer;
    private bool isPulsing;

    void Start()
    {
        if (deviceRenderer != null)
        {
            deviceMaterial = new Material(deviceRenderer.material);
            deviceRenderer.material = deviceMaterial;
        }

        targetColor = idleColor;
        currentColor = idleColor;

        ConvexManager.OnDeviceStatusChanged += HandleStatusChange;
        ConvexManager.OnDevicesUpdated += HandleDevicesUpdated;

        if (activeParticles != null)
            activeParticles.Stop();
    }

    void OnDestroy()
    {
        ConvexManager.OnDeviceStatusChanged -= HandleStatusChange;
        ConvexManager.OnDevicesUpdated -= HandleDevicesUpdated;

        if (deviceMaterial != null)
            Destroy(deviceMaterial);
    }

    void Update()
    {
        currentColor = Color.Lerp(currentColor, targetColor, Time.deltaTime * colorTransitionSpeed);

        if (isPulsing)
        {
            pulseTimer += Time.deltaTime * pulseSpeed;
            float pulse = 1f + Mathf.Sin(pulseTimer) * pulseIntensity;
            Color pulsedColor = currentColor * pulse;

            if (deviceMaterial != null)
            {
                deviceMaterial.SetColor("_EmissionColor", pulsedColor);
                deviceMaterial.EnableKeyword("_EMISSION");
            }
            if (statusLight != null)
            {
                statusLight.color = pulsedColor;
                statusLight.intensity = 1f + Mathf.Sin(pulseTimer) * 0.5f;
            }
        }
        else
        {
            if (deviceMaterial != null)
            {
                deviceMaterial.SetColor("_EmissionColor", currentColor * 0.5f);
                deviceMaterial.EnableKeyword("_EMISSION");
            }
            if (statusLight != null)
            {
                statusLight.color = currentColor;
                statusLight.intensity = 0.5f;
            }
        }
    }

    void HandleStatusChange(string changedDeviceId)
    {
        if (changedDeviceId != deviceId) return;

        if (ConvexManager.Devices.TryGetValue(deviceId, out var state))
        {
            currentStatus = state.status;

            switch (state.status)
            {
                case "idle":
                    targetColor = idleColor;
                    isPulsing = false;
                    if (activeParticles != null) activeParticles.Stop();
                    break;

                case "active":
                    targetColor = activeColor;
                    isPulsing = true;
                    if (activeParticles != null) activeParticles.Play();
                    StartCoroutine(FlashEffect());
                    break;

                case "running":
                    targetColor = runningColor;
                    isPulsing = true;
                    if (activeParticles != null) activeParticles.Play();
                    break;

                case "complete":
                    targetColor = completeColor;
                    isPulsing = false;
                    if (activeParticles != null) activeParticles.Stop();
                    StartCoroutine(CompletionBurst());
                    break;

                case "error":
                    targetColor = errorColor;
                    isPulsing = true;
                    break;
            }

            UpdateStatusPanel(state);
        }
    }

    void HandleDevicesUpdated(ConvexManager.DeviceState[] devices)
    {
        if (ConvexManager.Devices.TryGetValue(deviceId, out var state))
        {
            UpdateStatusPanel(state);
        }
    }

    void UpdateStatusPanel(ConvexManager.DeviceState state)
    {
        if (statusPanel == null) return;

        var texts = statusPanel.GetComponentsInChildren<TMPro.TextMeshProUGUI>();
        if (texts.Length >= 2)
        {
            texts[0].text = state.name;
            texts[1].text = state.statusDetail;
        }

        statusPanel.SetActive(state.status != "idle");
    }

    IEnumerator FlashEffect()
    {
        if (deviceMaterial != null)
        {
            Color flash = Color.white * 3f;
            deviceMaterial.SetColor("_EmissionColor", flash);
            yield return new WaitForSeconds(0.15f);
        }
    }

    IEnumerator CompletionBurst()
    {
        if (activeParticles != null)
        {
            activeParticles.Play();
            yield return new WaitForSeconds(1.5f);
            activeParticles.Stop();
        }
    }
}
