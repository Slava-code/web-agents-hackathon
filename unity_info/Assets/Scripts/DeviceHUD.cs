using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;

public class DeviceHUD : MonoBehaviour
{
    [Header("HUD Settings")]
    public Vector3 offset = new Vector3(0f, 3f, 0f);
    public float hudScale = 0.008f;
    public bool billboardToCamera = true;
    public float fullCycleDuration = 25f;

    [Header("Colors")]
    public Color panelColor = new Color(0.05f, 0.08f, 0.12f, 0.85f);
    public Color idleAccent = new Color(0.3f, 0.5f, 0.9f);
    public Color activeAccent = new Color(0.2f, 0.9f, 0.4f);
    public Color runningAccent = new Color(1f, 0.6f, 0.1f);
    public Color completeAccent = new Color(0f, 1f, 0.5f);
    public Color errorAccent = new Color(1f, 0.2f, 0.2f);

    private Canvas canvas;
    private TextMeshProUGUI nameText;
    private TextMeshProUGUI actionText;
    private TextMeshProUGUI statusText;
    private TextMeshProUGUI percentText;
    private Image progressFill;
    private Image statusDot;
    private Image accentLine;
    private CanvasGroup canvasGroup;
    private ORDevice device;
    private string lastStatus = "";
    private float displayProgress = 0f;
    private float fadeTarget = 0f;
    private float currentFade = 0f;
    private Coroutine progressRoutine;

    void Start()
    {
        device = GetComponent<ORDevice>();
        BuildHUD();
        ConvexManager.OnDeviceStatusChanged += OnStatusChanged;
        if (canvasGroup != null) canvasGroup.alpha = 0f;
    }

    void OnDestroy()
    {
        ConvexManager.OnDeviceStatusChanged -= OnStatusChanged;
    }

    void BuildHUD()
    {
        GameObject canvasObj = new GameObject("DeviceHUD_Canvas");
        canvasObj.transform.SetParent(transform);
        canvasObj.transform.localPosition = offset;
        canvasObj.transform.localScale = Vector3.one * hudScale;
        canvas = canvasObj.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        canvasGroup = canvasObj.AddComponent<CanvasGroup>();
        RectTransform canvasRect = canvas.GetComponent<RectTransform>();
        canvasRect.sizeDelta = new Vector2(420, 180);

        GameObject panel = MakeUI("Panel", canvasObj, new Vector2(420, 180));
        panel.AddComponent<Image>().color = panelColor;

        GameObject accent = MakeUI("Accent", panel, Vector2.zero);
        RectTransform aRT = accent.GetComponent<RectTransform>();
        aRT.anchorMin = new Vector2(0, 1); aRT.anchorMax = new Vector2(1, 1);
        aRT.pivot = new Vector2(0.5f, 1f);
        aRT.anchoredPosition = Vector2.zero; aRT.sizeDelta = new Vector2(0, 4);
        accentLine = accent.AddComponent<Image>();
        accentLine.color = idleAccent;

        GameObject dot = MakeUI("Dot", panel, new Vector2(12, 12));
        RectTransform dRT = dot.GetComponent<RectTransform>();
        dRT.anchorMin = dRT.anchorMax = new Vector2(0, 1);
        dRT.pivot = new Vector2(0, 1); dRT.anchoredPosition = new Vector2(16, -20);
        statusDot = dot.AddComponent<Image>();
        statusDot.color = idleAccent;

        GameObject nameObj = MakeUI("Name", panel, Vector2.zero);
        RectTransform nRT = nameObj.GetComponent<RectTransform>();
        nRT.anchorMin = new Vector2(0, 1); nRT.anchorMax = new Vector2(1, 1);
        nRT.pivot = new Vector2(0, 1);
        nRT.anchoredPosition = new Vector2(36, -12); nRT.sizeDelta = new Vector2(-50, 30);
        nameText = nameObj.AddComponent<TextMeshProUGUI>();
        nameText.fontSize = 20; nameText.fontStyle = FontStyles.Bold;
        nameText.color = Color.white; nameText.text = GetDeviceDisplayName();

        GameObject actObj = MakeUI("Action", panel, Vector2.zero);
        RectTransform actRT = actObj.GetComponent<RectTransform>();
        actRT.anchorMin = new Vector2(0, 1); actRT.anchorMax = new Vector2(1, 1);
        actRT.pivot = new Vector2(0, 1);
        actRT.anchoredPosition = new Vector2(16, -46); actRT.sizeDelta = new Vector2(-32, 28);
        actionText = actObj.AddComponent<TextMeshProUGUI>();
        actionText.fontSize = 17; actionText.color = new Color(0.85f, 0.9f, 0.95f);
        actionText.text = "";

        GameObject statObj = MakeUI("Status", panel, Vector2.zero);
        RectTransform sRT = statObj.GetComponent<RectTransform>();
        sRT.anchorMin = new Vector2(0, 1); sRT.anchorMax = new Vector2(1, 1);
        sRT.pivot = new Vector2(0, 1);
        sRT.anchoredPosition = new Vector2(16, -72); sRT.sizeDelta = new Vector2(-32, 24);
        statusText = statObj.AddComponent<TextMeshProUGUI>();
        statusText.fontSize = 13; statusText.color = new Color(0.55f, 0.6f, 0.65f);
        statusText.text = "";

        GameObject lblObj = MakeUI("ProgLabel", panel, Vector2.zero);
        RectTransform lRT = lblObj.GetComponent<RectTransform>();
        lRT.anchorMin = lRT.anchorMax = new Vector2(0, 0);
        lRT.pivot = new Vector2(0, 0);
        lRT.anchoredPosition = new Vector2(16, 32); lRT.sizeDelta = new Vector2(100, 18);
        TextMeshProUGUI lblText = lblObj.AddComponent<TextMeshProUGUI>();
        lblText.fontSize = 11; lblText.color = new Color(0.4f, 0.45f, 0.5f);
        lblText.text = "PROGRESS"; lblText.characterSpacing = 3;

        GameObject pctObj = MakeUI("Percent", panel, Vector2.zero);
        RectTransform pRT = pctObj.GetComponent<RectTransform>();
        pRT.anchorMin = pRT.anchorMax = new Vector2(1, 0);
        pRT.pivot = new Vector2(1, 0);
        pRT.anchoredPosition = new Vector2(-16, 32); pRT.sizeDelta = new Vector2(60, 18);
        percentText = pctObj.AddComponent<TextMeshProUGUI>();
        percentText.fontSize = 13; percentText.fontStyle = FontStyles.Bold;
        percentText.color = new Color(0.6f, 0.65f, 0.7f);
        percentText.text = ""; percentText.alignment = TextAlignmentOptions.Right;

        GameObject barBg = MakeUI("BarBg", panel, Vector2.zero);
        RectTransform bbRT = barBg.GetComponent<RectTransform>();
        bbRT.anchorMin = new Vector2(0, 0); bbRT.anchorMax = new Vector2(1, 0);
        bbRT.pivot = new Vector2(0.5f, 0);
        bbRT.anchoredPosition = new Vector2(0, 14); bbRT.sizeDelta = new Vector2(-32, 10);
        barBg.AddComponent<Image>().color = new Color(0.15f, 0.18f, 0.22f);

        GameObject barFill = MakeUI("BarFill", barBg, Vector2.zero);
        RectTransform fRT = barFill.GetComponent<RectTransform>();
        fRT.anchorMin = new Vector2(0, 0); fRT.anchorMax = new Vector2(0, 1);
        fRT.pivot = new Vector2(0, 0.5f);
        fRT.anchoredPosition = Vector2.zero; fRT.sizeDelta = Vector2.zero;
        progressFill = barFill.AddComponent<Image>();
        progressFill.color = idleAccent;
    }

    GameObject MakeUI(string name, GameObject parent, Vector2 size)
    {
        GameObject obj = new GameObject(name);
        obj.transform.SetParent(parent.transform, false);
        RectTransform rt = obj.AddComponent<RectTransform>();
        rt.sizeDelta = size;
        return obj;
    }

    void OnStatusChanged(string deviceId)
    {
        if (device == null || device.deviceId != deviceId) return;
        if (!ConvexManager.Devices.ContainsKey(deviceId)) return;
        var state = ConvexManager.Devices[deviceId];
        lastStatus = state.status;
        Color accent = GetAccentColor(state.status);
        if (accentLine != null) accentLine.color = accent;
        if (statusDot != null) statusDot.color = accent;
        if (progressFill != null) progressFill.color = accent;

        switch (state.status)
        {
            case "idle":
                fadeTarget = 0f;
                displayProgress = 0f;
                if (progressRoutine != null) StopCoroutine(progressRoutine);
                break;
            case "active":
                fadeTarget = 1f;
                displayProgress = 0f;
                SetTexts(GetActiveAction(), GetActiveDetail());
                // Start progress immediately — spans the full cycle
                if (progressRoutine != null) StopCoroutine(progressRoutine);
                progressRoutine = StartCoroutine(AnimateProgress());
                break;
            case "running":
                fadeTarget = 1f;
                // Update text but do NOT restart progress — it's already running
                SetTexts(GetRunningAction(), GetRunningDetail());
                break;
            case "complete":
                fadeTarget = 1f;
                if (progressRoutine != null) StopCoroutine(progressRoutine);
                displayProgress = 1f;
                SetTexts(GetCompleteAction(), GetCompleteDetail());
                StartCoroutine(FadeOutAfterDelay(6f));
                break;
            case "error":
                fadeTarget = 1f;
                SetTexts("ERROR", "Check device manually");
                break;
        }
    }

    void SetTexts(string action, string detail)
    {
        if (actionText != null) actionText.text = action;
        if (statusText != null) statusText.text = detail;
    }

    IEnumerator AnimateProgress()
    {
        float elapsed = 0f;
        // Gradually fill to 95% over fullCycleDuration, complete snaps to 100%
        while (elapsed < fullCycleDuration && lastStatus != "complete" && lastStatus != "idle")
        {
            elapsed += Time.deltaTime;
            float t = elapsed / fullCycleDuration;
            float eased = 1f - (1f - t) * (1f - t);
            displayProgress = Mathf.Lerp(0f, 0.95f, eased);
            yield return null;
        }
    }

    IEnumerator FadeOutAfterDelay(float delay)
    {
        yield return new WaitForSeconds(delay);
        fadeTarget = 0f;
    }

    void Update()
    {
        if (billboardToCamera && canvas != null)
        {
            Camera cam = Camera.main;
            if (cam != null)
            {
                canvas.transform.LookAt(
                    canvas.transform.position + cam.transform.rotation * Vector3.forward,
                    cam.transform.rotation * Vector3.up);
            }
        }
        currentFade = Mathf.Lerp(currentFade, fadeTarget, Time.deltaTime * 4f);
        if (canvasGroup != null) canvasGroup.alpha = currentFade;

        if (progressFill != null)
        {
            RectTransform fRT = progressFill.GetComponent<RectTransform>();
            RectTransform pRT = fRT.parent.GetComponent<RectTransform>();
            float currentWidth = fRT.sizeDelta.x;
            float targetWidth = pRT.rect.width * displayProgress;
            fRT.sizeDelta = new Vector2(Mathf.Lerp(currentWidth, targetWidth, Time.deltaTime * 3f), 0);
        }
        if (percentText != null)
        {
            if (displayProgress > 0.01f)
                percentText.text = Mathf.RoundToInt(displayProgress * 100f) + "%";
            else
                percentText.text = "";
        }
        if (statusDot != null && (lastStatus == "active" || lastStatus == "running"))
        {
            float pulse = 0.5f + Mathf.Sin(Time.time * 3f) * 0.5f;
            Color c = statusDot.color; c.a = pulse; statusDot.color = c;
        }
    }

    Color GetAccentColor(string status)
    {
        switch (status)
        {
            case "active": return activeAccent;
            case "running": return runningAccent;
            case "complete": return completeAccent;
            case "error": return errorAccent;
            default: return idleAccent;
        }
    }

    string GetDeviceDisplayName()
    {
        if (device == null) return "DEVICE";
        switch (device.deviceId)
        {
            case "uv_robot": return "UV-C DISINFECTION ROBOT";
            case "ptz_camera": return "TUG DELIVERY BOT";
            default: return device.deviceId.ToUpper();
        }
    }
    string GetActiveAction()
    {
        if (device == null) return "Initializing...";
        switch (device.deviceId)
        {
            case "uv_robot": return "Navigating to position...";
            case "ptz_camera": return "En route to OR-3...";
            default: return "Activating...";
        }
    }
    string GetActiveDetail()
    {
        if (device == null) return "";
        switch (device.deviceId)
        {
            case "uv_robot": return "Xenon UV-C lamp warming up";
            case "ptz_camera": return "Sterile supply delivery in progress";
            default: return "";
        }
    }
    string GetRunningAction()
    {
        if (device == null) return "Running...";
        switch (device.deviceId)
        {
            case "uv_robot": return "UV-C Pulsed Xenon Active";
            case "ptz_camera": return "Unloading sterile supplies";
            default: return "Processing...";
        }
    }
    string GetRunningDetail()
    {
        if (device == null) return "";
        switch (device.deviceId)
        {
            case "uv_robot": return "Broad-spectrum germicidal irradiation — 200-315nm";
            case "ptz_camera": return "Tray #4521 — surgical instruments";
            default: return "";
        }
    }
    string GetCompleteAction()
    {
        if (device == null) return "Complete";
        switch (device.deviceId)
        {
            case "uv_robot": return "Disinfection Complete";
            case "ptz_camera": return "Delivery Complete";
            default: return "Complete";
        }
    }
    string GetCompleteDetail()
    {
        if (device == null) return "";
        switch (device.deviceId)
        {
            case "uv_robot": return "99.9% pathogen reduction — surface verified";
            case "ptz_camera": return "Sterile tray deposited at prep station";
            default: return "";
        }
    }
}
