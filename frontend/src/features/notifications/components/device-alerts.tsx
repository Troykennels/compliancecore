"use client";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
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
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker
      .getRegistration("/")
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => {
        setEnabled(!!s && Notification.permission === "granted");
        if (s && Notification.permission === "granted")
          call("POST", s.toJSON()).catch(() => {});
      })
      .catch(() => {});
  }, []);
  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      if (!window.isSecureContext)
        throw new Error(
          "Device alerts need HTTPS, or localhost on this computer.",
        );
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
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
            try {
              await call("POST", { action: "test" });
              setMessage("Test alert sent to your registered devices.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Test failed.");
            }
          }}
          style={{ marginLeft: 8 }}
        >
          Test alert
        </button>
      )}
      {message && (
        <p role="status" style={{ marginBottom: 0 }}>
          {message}
        </p>
      )}
    </div>
  );
}
