// Maps dashboard route paths to Convex device IDs.
// IDs from API_CONTRACT.md seed data (OR-3 devices).

export const ROUTE_TO_DEVICE: Record<string, { deviceId: string; name: string }> = {
  "/uv-robot":      { deviceId: "jd73ve7m965tg28kbcffs4nhh582253p", name: "UV Robot" },
  "/environmental": { deviceId: "jd7a1249k2xq68q6b7yxwh9vnx822d6b", name: "Env Monitoring" },
  "/tug-robot":     { deviceId: "jd79jwzj5893812hkgf68dz3vh822aa2", name: "Sterilizer" },
  "/ehr":           { deviceId: "jd7drsdfe5h2d9hq06ap95gx9d82244t", name: "Scheduling" },
};

export const CONVEX_URL =
  process.env.CONVEX_SITE_URL || process.env.CONVEX_URL || "https://adept-wren-805.convex.site";
