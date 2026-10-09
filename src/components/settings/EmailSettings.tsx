"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";

interface EmailSettingsState {
  emailEnabled: boolean;
  alertEmail: string;
}

export default function EmailSettings() {
  const [state, setState] = useState<EmailSettingsState>({
    emailEnabled: true,
    alertEmail: "nathanielmwaipopo@gmail.com",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setState({
          emailEnabled: data.emailEnabled ?? true,
          alertEmail: data.alertEmail || "nathanielmwaipopo@gmail.com",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error("Failed to save email settings");
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
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: state.alertEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test email failed");
      setMessage(`Test email sent to ${data.to}`);
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
          checked={state.emailEnabled}
          onChange={(e) => setState((s) => ({ ...s, emailEnabled: e.target.checked }))}
          className="h-4 w-4 accent-emerald-500"
        />
      </label>

      <label className="mt-3 block text-sm text-slate-300">
        Alert recipient
        <input
          type="email"
          value={state.alertEmail}
          onChange={(e) => setState((s) => ({ ...s, alertEmail: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
      </label>

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
