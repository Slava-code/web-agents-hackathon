using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;
using System.Collections.Generic;

public class MasterHUD : MonoBehaviour
{
    [Header("Layout")]
    public float panelWidth = 340f;
    public float rowHeight = 32f;
    public Color panelColor = new Color(0.03f, 0.05f, 0.08f, 0.88f);
    public Color accentColor = new Color(0.0f, 0.7f, 0.9f);

    private Canvas canvas;
    private Dictionary<string, DeviceRow> rows = new Dictionary<string, DeviceRow>();
    private TextMeshProUGUI headerText;
    private TextMeshProUGUI timerText;
    private Image headerLine;
    private float sequenceTimer = 0f;
    private bool timerRunning = false;

    struct DeviceRow
    {
        public TextMeshProUGUI nameText;
        public TextMeshProUGUI statusText;
        public Image dotImage;
        public Image rowBg;
    }

    // Device display order and names
    private string[][] deviceInfo = new string[][]
    {
        new string[] { "uv_robot", "UV-C Disinfection" },
        new string[] { "ptz_camera", "TUG Supply Delivery" },
        new string[] { "env_sensors", "Env. Sensors" },
        new string[] { "autoclave", "Autoclave Check" },
        new string[] { "room_scheduling", "Room Scheduling" },
    };

    void Start()
    {
        BuildOverlay();
        ConvexManager.OnDeviceStatusChanged += OnStatusChanged;
    }

    void OnDestroy()
    {
        ConvexManager.OnDeviceStatusChanged -= OnStatusChanged;
    }

    void BuildOverlay()
    {
        // === SCREEN SPACE CANVAS ===
        GameObject canvasObj = new GameObject("MasterHUD_Canvas");
        canvasObj.transform.SetParent(transform);
        canvas = canvasObj.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;

        CanvasScaler scaler = canvasObj.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        canvasObj.AddComponent<GraphicRaycaster>();

        // === MAIN PANEL ===
        float totalHeight = 70f + (deviceInfo.Length * rowHeight) + 40f;
        GameObject panel = MakeUI("Panel", canvasObj);
        RectTransform pRT = panel.GetComponent<RectTransform>();
        pRT.anchorMin = new Vector2(0, 1);
        pRT.anchorMax = new Vector2(0, 1);
        pRT.pivot = new Vector2(0, 1);
        pRT.anchoredPosition = new Vector2(20, -20);
        pRT.sizeDelta = new Vector2(panelWidth, totalHeight);
        Image panelImg = panel.AddComponent<Image>();
        panelImg.color = panelColor;

        // === ACCENT LINE TOP ===
        GameObject topLine = MakeUI("TopLine", panel);
        RectTransform tlRT = topLine.GetComponent<RectTransform>();
        tlRT.anchorMin = new Vector2(0, 1); tlRT.anchorMax = new Vector2(1, 1);
        tlRT.pivot = new Vector2(0.5f, 1);
        tlRT.anchoredPosition = Vector2.zero;
        tlRT.sizeDelta = new Vector2(0, 3);
        headerLine = topLine.AddComponent<Image>();
        headerLine.color = accentColor;

        // === HEADER: OR-3 TURNOVER ===
        GameObject hdr = MakeUI("Header", panel);
        RectTransform hRT = hdr.GetComponent<RectTransform>();
        hRT.anchorMin = new Vector2(0, 1); hRT.anchorMax = new Vector2(1, 1);
        hRT.pivot = new Vector2(0, 1);
        hRT.anchoredPosition = new Vector2(16, -10);
        hRT.sizeDelta = new Vector2(-32, 28);
        headerText = hdr.AddComponent<TextMeshProUGUI>();
        headerText.fontSize = 18;
        headerText.fontStyle = FontStyles.Bold;
        headerText.color = Color.white;
        headerText.text = "OR-3  TURNOVER";
        headerText.characterSpacing = 2;

        // === TIMER ===
        GameObject tmr = MakeUI("Timer", panel);
        RectTransform tRT = tmr.GetComponent<RectTransform>();
        tRT.anchorMin = new Vector2(1, 1); tRT.anchorMax = new Vector2(1, 1);
        tRT.pivot = new Vector2(1, 1);
        tRT.anchoredPosition = new Vector2(-16, -10);
        tRT.sizeDelta = new Vector2(80, 28);
        timerText = tmr.AddComponent<TextMeshProUGUI>();
        timerText.fontSize = 16;
        timerText.color = accentColor;
        timerText.text = "00:00";
        timerText.alignment = TextAlignmentOptions.Right;

        // === DIVIDER ===
        GameObject div = MakeUI("Divider", panel);
        RectTransform dRT = div.GetComponent<RectTransform>();
        dRT.anchorMin = new Vector2(0, 1); dRT.anchorMax = new Vector2(1, 1);
        dRT.pivot = new Vector2(0.5f, 1);
        dRT.anchoredPosition = new Vector2(0, -42);
        dRT.sizeDelta = new Vector2(-24, 1);
        Image divImg = div.AddComponent<Image>();
        divImg.color = new Color(0.2f, 0.25f, 0.3f);

        // === DEVICE ROWS ===
        float yStart = -52f;
        for (int i = 0; i < deviceInfo.Length; i++)
        {
            string id = deviceInfo[i][0];
            string displayName = deviceInfo[i][1];
            float y = yStart - (i * rowHeight);

            // Row bg (subtle alternation)
            GameObject rowObj = MakeUI("Row_" + id, panel);
            RectTransform rRT = rowObj.GetComponent<RectTransform>();
            rRT.anchorMin = new Vector2(0, 1); rRT.anchorMax = new Vector2(1, 1);
            rRT.pivot = new Vector2(0, 1);
            rRT.anchoredPosition = new Vector2(0, y);
            rRT.sizeDelta = new Vector2(0, rowHeight);
            Image rowBg = rowObj.AddComponent<Image>();
            rowBg.color = (i % 2 == 0) ? new Color(0.06f, 0.08f, 0.11f, 0.5f) : Color.clear;

            // Status dot
            GameObject dot = MakeUI("Dot", rowObj);
            RectTransform dotRT = dot.GetComponent<RectTransform>();
            dotRT.anchorMin = dotRT.anchorMax = new Vector2(0, 0.5f);
            dotRT.pivot = new Vector2(0, 0.5f);
            dotRT.anchoredPosition = new Vector2(16, 0);
            dotRT.sizeDelta = new Vector2(10, 10);
            Image dotImg = dot.AddComponent<Image>();
            dotImg.color = new Color(0.3f, 0.35f, 0.4f); // gray = idle

            // Device name
            GameObject nameObj = MakeUI("Name", rowObj);
            RectTransform nRT = nameObj.GetComponent<RectTransform>();
            nRT.anchorMin = new Vector2(0, 0); nRT.anchorMax = new Vector2(0.6f, 1);
            nRT.pivot = new Vector2(0, 0.5f);
            nRT.anchoredPosition = new Vector2(34, 0);
            nRT.sizeDelta = new Vector2(-34, 0);
            TextMeshProUGUI nameTMP = nameObj.AddComponent<TextMeshProUGUI>();
            nameTMP.fontSize = 14;
            nameTMP.color = new Color(0.7f, 0.75f, 0.8f);
            nameTMP.text = displayName;
            nameTMP.alignment = TextAlignmentOptions.MidlineLeft;

            // Status text
            GameObject statObj = MakeUI("Status", rowObj);
            RectTransform sRT = statObj.GetComponent<RectTransform>();
            sRT.anchorMin = new Vector2(0.6f, 0); sRT.anchorMax = new Vector2(1, 1);
            sRT.pivot = new Vector2(1, 0.5f);
            sRT.anchoredPosition = new Vector2(-12, 0);
            sRT.sizeDelta = new Vector2(-12, 0);
            TextMeshProUGUI statTMP = statObj.AddComponent<TextMeshProUGUI>();
            statTMP.fontSize = 12;
            statTMP.color = new Color(0.4f, 0.45f, 0.5f);
            statTMP.text = "STANDBY";
            statTMP.alignment = TextAlignmentOptions.MidlineRight;
            statTMP.fontStyle = FontStyles.Bold;

            rows[id] = new DeviceRow
            {
                nameText = nameTMP,
                statusText = statTMP,
                dotImage = dotImg,
                rowBg = rowBg
            };
        }

        // === FOOTER LINE ===
        GameObject foot = MakeUI("Footer", panel);
        RectTransform fRT = foot.GetComponent<RectTransform>();
        fRT.anchorMin = new Vector2(0, 0); fRT.anchorMax = new Vector2(1, 0);
        fRT.pivot = new Vector2(0.5f, 0);
        fRT.anchoredPosition = new Vector2(0, 8);
        fRT.sizeDelta = new Vector2(-24, 1);
        Image footImg = foot.AddComponent<Image>();
        footImg.color = new Color(0.2f, 0.25f, 0.3f);

        // === FOOTER TEXT ===
        GameObject footTxt = MakeUI("FooterText", panel);
        RectTransform ftRT = footTxt.GetComponent<RectTransform>();
        ftRT.anchorMin = new Vector2(0, 0); ftRT.anchorMax = new Vector2(1, 0);
        ftRT.pivot = new Vector2(0.5f, 0);
        ftRT.anchoredPosition = new Vector2(0, -8);
        ftRT.sizeDelta = new Vector2(-24, 20);
        TextMeshProUGUI ftText = footTxt.AddComponent<TextMeshProUGUI>();
        ftText.fontSize = 10;
        ftText.color = new Color(0.35f, 0.4f, 0.45f);
        ftText.text = "EVEROS — AUTONOMOUS OR MANAGEMENT";
        ftText.alignment = TextAlignmentOptions.Center;
        ftText.characterSpacing = 3;
    }

    GameObject MakeUI(string name, GameObject parent)
    {
        GameObject obj = new GameObject(name);
        obj.transform.SetParent(parent.transform, false);
        obj.AddComponent<RectTransform>();
        return obj;
    }

    void OnStatusChanged(string deviceId)
    {
        if (!rows.ContainsKey(deviceId)) return;
        if (!ConvexManager.Devices.ContainsKey(deviceId)) return;

        var state = ConvexManager.Devices[deviceId];
        var row = rows[deviceId];

        // Start timer on first non-idle event
        if (!timerRunning && state.status != "idle")
        {
            timerRunning = true;
            sequenceTimer = 0f;
        }

        switch (state.status)
        {
            case "idle":
                row.statusText.text = "STANDBY";
                row.statusText.color = new Color(0.4f, 0.45f, 0.5f);
                row.dotImage.color = new Color(0.3f, 0.35f, 0.4f);
                row.nameText.color = new Color(0.7f, 0.75f, 0.8f);
                break;

            case "active":
                row.statusText.text = "ACTIVE";
                row.statusText.color = new Color(0.2f, 0.9f, 0.4f);
                row.dotImage.color = new Color(0.2f, 0.9f, 0.4f);
                row.nameText.color = Color.white;
                break;

            case "running":
                row.statusText.text = "RUNNING";
                row.statusText.color = new Color(1f, 0.6f, 0.1f);
                row.dotImage.color = new Color(1f, 0.6f, 0.1f);
                row.nameText.color = Color.white;
                break;

            case "complete":
                row.statusText.text = "DONE ✓";
                row.statusText.color = new Color(0f, 1f, 0.5f);
                row.dotImage.color = new Color(0f, 1f, 0.5f);
                row.nameText.color = new Color(0.5f, 0.55f, 0.6f);
                break;

            case "error":
                row.statusText.text = "ERROR";
                row.statusText.color = new Color(1f, 0.2f, 0.2f);
                row.dotImage.color = new Color(1f, 0.2f, 0.2f);
                break;
        }

        // Check if all complete
        bool allDone = true;
        foreach (var info in deviceInfo)
        {
            if (ConvexManager.Devices.ContainsKey(info[0]))
            {
                if (ConvexManager.Devices[info[0]].status != "complete")
                {
                    allDone = false;
                    break;
                }
            }
            else
            {
                allDone = false;
                break;
            }
        }

        if (allDone)
        {
            timerRunning = false;
            headerText.text = "OR-3  READY";
            headerText.color = new Color(0f, 1f, 0.5f);
            headerLine.color = new Color(0f, 1f, 0.5f);
        }
    }

    void Update()
    {
        if (timerRunning)
        {
            sequenceTimer += Time.deltaTime;
        }

        if (timerText != null)
        {
            int mins = Mathf.FloorToInt(sequenceTimer / 60f);
            int secs = Mathf.FloorToInt(sequenceTimer % 60f);
            timerText.text = string.Format("{0:00}:{1:00}", mins, secs);
        }

        // Pulse active/running dots
        foreach (var kvp in rows)
        {
            if (ConvexManager.Devices.ContainsKey(kvp.Key))
            {
                string st = ConvexManager.Devices[kvp.Key].status;
                if (st == "active" || st == "running")
                {
                    float a = 0.5f + Mathf.Sin(Time.time * 3f) * 0.5f;
                    Color c = kvp.Value.dotImage.color;
                    c.a = a;
                    kvp.Value.dotImage.color = c;
                }
            }
        }
    }
}
