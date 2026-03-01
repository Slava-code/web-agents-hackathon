// Maps dashboard route paths to Convex device IDs.
// IDs from API_CONTRACT.md seed data (OR-3 devices).

export const ROUTE_TO_DEVICE: Record<string, { deviceId: string; name: string }> = {
  "/uv-robot":      { deviceId: "jd74zb957j4a83r2q1y5zxjwsh8237by", name: "UV Robot" },
  "/environmental": { deviceId: "jd7a5wdr3kc9p7krjep93paptn8235qk", name: "Env Monitoring" },
  "/sterilizer":    { deviceId: "jd7eh4r1c2fxc3rq1axt30zha5823x6m", name: "Sterilizer" },
  "/ehr":           { deviceId: "jd7ekvwvtgs4y560qmr61983v1823ewy", name: "Scheduling" },
  "/camera":        { deviceId: "jd79cdv4fn4d2jyk562vhtz0p58226e8", name: "Surveillance" },
};

export const CONVEX_URL =
  process.env.CONVEX_URL || "https://impartial-whale-32.convex.site";
