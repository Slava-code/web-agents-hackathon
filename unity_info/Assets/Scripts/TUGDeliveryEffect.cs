using UnityEngine;
using System.Collections;

public class TUGDeliveryEffect : MonoBehaviour
{
    public Transform deliveryPoint;
    public Transform trayDropPoint;
    public float moveSpeed = 1.5f;
    public float unloadTime = 5f;
    public Light statusLight;
    public Color movingColor = new Color(1f, 0.7f, 0f);
    public Color deliveryColor = new Color(0f, 1f, 0.3f);
    public float lightIntensity = 3f;
    public float lightRange = 8f;
    private bool isBusy = false;
    private ORDevice device;
    private Vector3 homePosition;
    private float pulseTimer;
    private GameObject depositedTray;

    void Start()
    {
        device = GetComponent<ORDevice>();
        homePosition = transform.position;
        if (statusLight != null) { statusLight.intensity = 0f; statusLight.range = lightRange; }
        ConvexManager.OnDeviceStatusChanged += OnStatusChanged;
    }

    void OnDestroy() { ConvexManager.OnDeviceStatusChanged -= OnStatusChanged; }

    void OnStatusChanged(string deviceId)
    {
        if (device == null || device.deviceId != deviceId) return;
        string status = "unknown";
        if (ConvexManager.Devices.ContainsKey(deviceId)) status = ConvexManager.Devices[deviceId].status;
        if ((status == "active" || status == "running") && !isBusy) StartCoroutine(DeliveryRun());
    }

    IEnumerator DeliveryRun()
    {
        isBusy = true;
        if (depositedTray != null) Destroy(depositedTray);

        // PHASE 1: Drive to delivery point
        if (statusLight != null) { statusLight.color = movingColor; statusLight.intensity = lightIntensity; }
        if (deliveryPoint != null)
        {
            Vector3 target = new Vector3(deliveryPoint.position.x, homePosition.y, deliveryPoint.position.z);
            while (Vector3.Distance(transform.position, target) > 0.2f)
            {
                transform.position = Vector3.MoveTowards(transform.position, target, moveSpeed * Time.deltaTime);
                if (statusLight != null) { pulseTimer += Time.deltaTime * 3f; statusLight.intensity = lightIntensity + Mathf.Sin(pulseTimer) * (lightIntensity * 0.3f); }
                yield return null;
            }
        }

        // PHASE 2: Arrived - green flash, unload
        if (statusLight != null) { statusLight.color = deliveryColor; statusLight.intensity = lightIntensity * 3f; }
        yield return new WaitForSeconds(0.2f);
        if (statusLight != null) statusLight.intensity = lightIntensity * 1.5f;
        yield return new WaitForSeconds(unloadTime);

        // PHASE 3: Deposit tray
        if (deliveryPoint != null)
        {
            depositedTray = GameObject.CreatePrimitive(PrimitiveType.Cube);
            depositedTray.name = "SterileTray";
            depositedTray.transform.position = new Vector3(
                trayDropPoint != null ? trayDropPoint.position.x : deliveryPoint.position.x, trayDropPoint != null ? trayDropPoint.position.y + 0.2f : deliveryPoint.position.y + 1.2f, trayDropPoint != null ? trayDropPoint.position.z : deliveryPoint.position.z);
            depositedTray.transform.localScale = new Vector3(0.6f, 0.15f, 0.4f);
            Renderer rend = depositedTray.GetComponent<Renderer>();
            Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            mat.SetColor("_BaseColor", new Color(0.7f, 0.85f, 0.9f));
            mat.SetColor("_EmissionColor", new Color(0f, 1f, 1.2f));
            mat.EnableKeyword("_EMISSION");
            rend.material = mat;
            GameObject trayLight = new GameObject("TrayLight");
            trayLight.transform.SetParent(depositedTray.transform);
            trayLight.transform.localPosition = new Vector3(0, 1f, 0);
            Light lt = trayLight.AddComponent<Light>();
            lt.type = LightType.Point;
            lt.color = new Color(0f, 0.5f, 0.6f);
            lt.intensity = 2f;
            lt.range = 4f;
        }

        if (statusLight != null) statusLight.intensity = lightIntensity * 2f;
        yield return new WaitForSeconds(1f);

        // PHASE 4: Drive back
        if (statusLight != null) { statusLight.color = movingColor; statusLight.intensity = lightIntensity; }
        while (Vector3.Distance(transform.position, homePosition) > 0.2f)
        {
            transform.position = Vector3.MoveTowards(transform.position, homePosition, moveSpeed * Time.deltaTime);
            if (statusLight != null) { pulseTimer += Time.deltaTime * 3f; statusLight.intensity = lightIntensity + Mathf.Sin(pulseTimer) * (lightIntensity * 0.3f); }
            yield return null;
        }
        transform.position = homePosition;
        if (statusLight != null) statusLight.intensity = 0f;
        isBusy = false;
    }
}
