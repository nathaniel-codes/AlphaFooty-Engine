export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const port = process.env.PORT || "3080";
  const base = `http://127.0.0.1:${port}`;

  const tickAlerts = async () => {
    try {
      const res = await fetch(`${base}/api/notifications/dispatch`, {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[alphafooty-alerts] dispatch HTTP", res.status);
        return;
      }
      const result = await res.json();
      if (result.sent > 0 || (result.errors && result.errors.length)) {
        console.log(
          `[alphafooty-alerts] sent=${result.sent} errors=${result.errors?.length || 0}`
        );
      }
    } catch (err) {
      console.error("[alphafooty-alerts] tick failed", err);
    }
  };

  const runDailyDigest = async () => {
    try {
      const headers: Record<string, string> = {};
      if (process.env.CRON_SECRET) {
        headers["x-cron-secret"] = process.env.CRON_SECRET;
      }
      const res = await fetch(`${base}/api/cron/daily-digest`, {
        method: "POST",
        headers,
        cache: "no-store",
      });
      const result = await res.json();
      console.log("[alphafooty-digest]", result.statusMessage || result);
    } catch (err) {
      console.error("[alphafooty-digest] failed", err);
    }
  };

  // Live opportunity dispatcher — every 60s
  setTimeout(() => {
    void tickAlerts();
    setInterval(() => void tickAlerts(), 60_000);
  }, 20_000);

  // Daily morning digest — 10:00 Africa/Nairobi (EAT, UTC+3)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cron = require("node-cron") as typeof import("node-cron");
    if (cron.validate("0 10 * * *")) {
      cron.schedule(
        "0 10 * * *",
        () => {
          void runDailyDigest();
        },
        { timezone: "Africa/Nairobi" }
      );
      console.log("[alphafooty-digest] scheduled daily at 10:00 Africa/Nairobi");
    }
  } catch (err) {
    console.error("[alphafooty-digest] cron schedule failed", err);
  }
}
