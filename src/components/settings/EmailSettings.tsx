"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";

export default function EmailSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [maskedRecipient, setMaskedRecipient] = useState("configured");
  const [newRecipient, setNewRecipient] = useState("");
  const [showChange, setShowChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setEmailEnabled(data.emailEnabled ?? true);
        setMaskedRecipient(data.alertEmailMasked || "configured");
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, unknown> = { emailEnabled };
      if (showChange && newRecipient.trim()) {
        payload.alertEmail = newRecipient.trim();
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to save email settings");
      setMaskedRecipient(data.alertEmailMasked || maskedRecipient);
      setNewRecipient("");
      setShowChange(false);
      setMessage("Email alert settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      // Do not send recipient from the browser — server uses stored address
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test email failed");
      setMessage(`Test email sent to ${data.toMasked || "configured recipient"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test email failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading email settings…
      </div>
    );
  }

  return (
    <section className="mt-8 max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/50 p-5">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-emerald-400" />
        <h3 className="text-lg font-semibold text-slate-100">Email Alerts</h3>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        SMTP alerts for Strategy D goal volume, HT 0-0 stages, and corner compression.
        Deduped per match/stage.
      </p>

      <label className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-sm text-slate-200">
        <span>Enable email notifications</span>
        <input
          type="checkbox"
          checked={emailEnabled}
          onChange={(e) => setEmailEnabled(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
      </label>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">Alert recipient</div>
        <div className="mt-1 font-mono text-sm text-slate-300">{maskedRecipient}</div>
        <button
          type="button"
          onClick={() => setShowChange((v) => !v)}
          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
        >
          {showChange ? "Cancel change" : "Change recipient"}
        </button>
        {showChange && (
          <input
            type="email"
            autoComplete="off"
            placeholder="Enter new email address"
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Email Settings"}
        </button>
        <button
          onClick={sendTest}
          disabled={testing}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Test Email
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </section>
  );
}
