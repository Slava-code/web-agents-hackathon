using UnityEngine;
using System.Collections;

public class UVDisinfectionEffect : MonoBehaviour
{
    [Header("UV Light")]
    public Light uvLight;
    public Color uvColor = new Color(0.53f, 0.27f, 0.8f);
    public float maxIntensity = 10f;
    public float pulseSpeed = 1.5f;
    public float uvDuration = 6f;

    [Header("Robot Movement")]
    public Transform driveTarget;
    public float moveSpeed = 2f;

    private bool isBusy = false;
    private ORDevice device;
    private Vector3 homePosition;

    void Start()
    {
        device = GetComponent<ORDevice>();
        homePosition = transform.position;

        if (uvLight != null)
        {
            uvLight.color = uvColor;
            uvLight.intensity = 0f;
            uvLight.range = 30f;
        }
        ConvexManager.OnDeviceStatusChanged += OnStatusChanged;
    }

    void OnDestroy()
    {
        ConvexManager.OnDeviceStatusChanged -= OnStatusChanged;
    }

    void OnStatusChanged(string deviceId)
    {
        if (device == null || device.deviceId != deviceId) return;

        string status = "unknown";
        if (ConvexManager.Devices.ContainsKey(deviceId))
            status = ConvexManager.Devices[deviceId].status;

        if ((status == "active" || status == "running") && !isBusy)
        {
            StartCoroutine(FullCycle());
        }
    }

    IEnumerator FullCycle()
    {
        isBusy = true;

        // STEP 1: Slide forward to target
        if (driveTarget != null)
        {
            Vector3 target = new Vector3(driveTarget.position.x, homePosition.y, driveTarget.position.z);
            while (Vector3.Distance(transform.position, target) > 0.2f)
            {
                transform.position = Vector3.MoveTowards(transform.position, target, moveSpeed * Time.deltaTime);
                yield return null;
            }
        }

        // STEP 2: Blast purple
        if (uvLight != null)
        {
            uvLight.color = uvColor;
            float t = 0f;
            while (t < 1f)
            {
                t += Time.deltaTime;
                uvLight.intensity = Mathf.Lerp(0f, maxIntensity, t);
                yield return null;
            }

            float elapsed = 0f;
            while (elapsed < uvDuration)
            {
                uvLight.intensity = maxIntensity + Mathf.Sin(Time.time * pulseSpeed) * (maxIntensity * 0.3f);
                elapsed += Time.deltaTime;
                yield return null;
            }

            // Flash white then fade
            uvLight.color = Color.white;
            uvLight.intensity = maxIntensity * 1.5f;
            yield return new WaitForSeconds(0.3f);
            t = 0f;
            while (t < 1f)
            {
                t += Time.deltaTime;
                uvLight.intensity = Mathf.Lerp(maxIntensity * 1.5f, 0f, t);
                yield return null;
            }
            uvLight.intensity = 0f;
            uvLight.color = uvColor;
        }

        // STEP 3: Slide backward to home
        while (Vector3.Distance(transform.position, homePosition) > 0.2f)
        {
            transform.position = Vector3.MoveTowards(transform.position, homePosition, moveSpeed * Time.deltaTime);
            yield return null;
        }
        transform.position = homePosition;

        isBusy = false;
    }
}