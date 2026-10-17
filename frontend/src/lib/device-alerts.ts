// Remove only this browser's device registration when its user signs out.
export async function stopDeviceAlerts(
  remove: (endpoint: string) => Promise<unknown>,
) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  await Promise.allSettled([
    Promise.resolve().then(() => remove(subscription.endpoint)),
    subscription.unsubscribe(),
  ]);
}
