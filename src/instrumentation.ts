export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const port = process.env.PORT || "3080";
  const url = `http://127.0.0.1:${port}/api/notifications/dispatch`;

  const tick = async () => {
    try {
      const res = await fetch(url, { method: "POST", cache: "no-store" });
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

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), 60_000);
  }, 20_000);
}
