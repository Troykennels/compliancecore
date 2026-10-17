import { describe, it, expect } from "vitest";
import {
  validSubscription,
  safePushPath,
} from "../../src/modules/notifications/push-core";
const sub = {
  endpoint: "https://fcm.googleapis.com/path",
  keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
};
describe("device push subscription boundary", () => {
  it("accepts browser push endpoints", () =>
    expect(validSubscription(sub)).toBe(true));
  it.each([
    "http://fcm.googleapis.com/path",
    "https://localhost/path",
    "https://127.0.0.1/path",
    "https://wns2-/path",
    "https://fcm.googleapis.com.evil.example/path",
    "https://user:password@fcm.googleapis.com/path",
    "https://fcm.googleapis.com:8443/path",
  ])("rejects unsafe destination %s", (endpoint) =>
    expect(validSubscription({ ...sub, endpoint })).toBe(false),
  );
  it("rejects broken encryption keys", () =>
    expect(
      validSubscription({ ...sub, keys: { auth: "x", p256dh: "x" } }),
    ).toBe(false));
  it.each(["https://evil.example", "//evil.example", "/\\evil.example"])(
    "keeps notification clicks on the app: %s",
    (path) => expect(safePushPath(path)).toBe("/notifications"),
  );
});
