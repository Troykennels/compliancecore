"use client";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from '@/stores/auth.store';
import { playNotificationSound, setSoundEnabled, soundEnabled } from '../lib/notification-sound';
async function call(method: string, body?: unknown) {
  const r = await apiClient.request({
    url: "/notifications/push",
    method,
    data: body,
  });
  return r.data;
}
function keyBytes(key: string) {
  const raw = atob(
    key
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(key.length / 4) * 4, "="),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export default function DeviceAlerts() {
  const { user, activeTenant } = useAuthStore();
  const account = user && activeTenant ? `${user.id}:${activeTenant.id}` : '';
  const [sound, setSound] = useState(false);
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setEnabled(false);
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    navigator.serviceWorker
      .getRegistration("/")
      .then((r) => r?.pushManager.getSubscription())
      .then(async (s) => {
        if (s && Notification.permission === "granted") {
          await call("POST", s.toJSON());
          setEnabled(true);
        }
      })
      .catch(() => setMessage('Device registration could not be confirmed. Select Enable device alerts to reconnect.'));
  }, [account]);
  useEffect(() => {
    const refresh = () => setSound(!!account && soundEnabled(account));
    refresh(); window.addEventListener('storage', refresh); window.addEventListener('compliance-sound-preference', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('compliance-sound-preference', refresh); };
  }, [account]);
  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      if (!window.isSecureContext)
        throw new Error(
          "Device alerts need HTTPS, or localhost on this computer.",
        );
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
        throw new Error(
          "On iPhone, add this app to your Home Screen and open it from its icon first.",
        );
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error(
          "Allow notifications in your browser and phone settings to receive alerts.",
        );
      const { publicKey } = await call("GET");
      if (!publicKey)
        throw new Error("The server has not enabled device alerts yet.");
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const key = keyBytes(publicKey);
      if (
        sub?.options.applicationServerKey &&
        Array.from(new Uint8Array(sub.options.applicationServerKey)).join() !==
          Array.from(key).join()
      ) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ||= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await call("POST", sub.toJSON());
      setEnabled(true);
      setMessage(
        "Device alerts enabled. Phone notification and Focus settings control sound.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not enable alerts.");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await call("DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMessage("Device alerts disabled.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not disable alerts.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ padding: 12, borderTop: "1px solid #dbe3eb", fontSize: 12 }}>
      <p className="mb-2 font-semibold text-slate-800">Sound & background alerts</p>
      <p className="mb-3 text-slate-600">Device alerts can arrive while you use another app or close this tab. Your phone/computer controls their sound.</p>
      <button type="button" className="mb-3 rounded-md border border-slate-300 px-3 py-2 font-medium" onClick={async () => {
        try {
          if (!account) throw new Error('Sign in to choose a sound preference.');
          if (!sound) await playNotificationSound();
          setSoundEnabled(account, !sound);
          setMessage(sound ? 'In-app sound turned off.' : 'In-app sound enabled. You should hear a short chime now.');
        } catch (err) { setMessage(err instanceof Error ? err.message : 'Sound is unavailable in this browser.'); }
      }}>{sound ? 'Turn off in-app sound' : 'Enable & test in-app sound'}</button>
      <div>
      <button
        type="button"
        disabled={busy}
        onClick={enabled ? disable : enable}
        style={{
          border: "1px solid #94a3b8",
          borderRadius: 6,
          padding: "6px 10px",
          cursor: "pointer",
        }}
      >
        {busy
          ? "Please wait…"
          : enabled
            ? "Disable device alerts"
            : "Enable device alerts"}
      </button>
      {enabled && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await call("POST", { action: "test" });
              setMessage("Test alert sent to your registered devices.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Test failed.");
            } finally { setBusy(false); }
          }}
          style={{ marginLeft: 8 }}
        >
          Test alert
        </button>
      )}
      </div>
      <details className="mt-3 text-slate-600"><summary className="cursor-pointer font-medium">Make alerts sound outside the app</summary><ol className="mt-2 list-decimal space-y-2 pl-5">
        <li>Choose Enable device alerts above and allow the browser permission on each device.</li>
        <li>iPhone/iPad: add ComplianceCore to the Home Screen, open its icon, then enable alerts there.</li>
        <li>In phone/computer notification settings, allow this browser/app and turn on notification sounds. Check volume, Silent mode and Focus/Do Not Disturb.</li>
        <li>Send a Test alert, then switch to another app and test again. Keep internet/background activity available.</li>
      </ol><p className="mt-2">A website cannot override Silent/Focus settings or force a custom sound when closed. In-app chimes require an open, active page; background alerts use the device’s notification sound.</p></details>
      {message && (
        <p role="status" style={{ marginBottom: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
