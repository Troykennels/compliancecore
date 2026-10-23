import { prisma, withTenantSchema } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import {
  deliverPush,
  generatePushKeys,
  type DeviceSubscription,
} from "./push-core";

let initialization: Promise<void> | undefined;
async function init() {
  initialization ||= (async () => {
    await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS orion_push`;
    await prisma.$executeRaw`REVOKE ALL ON SCHEMA orion_push FROM PUBLIC`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS orion_push.compliance_keys (id integer PRIMARY KEY CHECK(id=1), keys jsonb NOT NULL)`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS orion_push.compliance_devices (endpoint text PRIMARY KEY, user_id uuid NOT NULL, schema_name text NOT NULL, subscription jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS orion_push.compliance_deliveries (notification_id uuid NOT NULL, endpoint text NOT NULL, claimed_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, attempts integer NOT NULL DEFAULT 1, PRIMARY KEY(notification_id,endpoint))`;
  })().catch((e) => {
    initialization = undefined;
    throw e;
  });
  await initialization;
}
let keysPromise: Promise<{ publicKey: string; privateKey: string }> | undefined;
export async function pushKeys() {
  return (keysPromise ||= loadPushKeys().catch((e) => {
    keysPromise = undefined;
    throw e;
  }));
}
async function loadPushKeys() {
  await init();
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  const pair = generatePushKeys();
  await prisma.$executeRaw`INSERT INTO orion_push.compliance_keys(id,keys) VALUES(1,${JSON.stringify(pair)}::jsonb) ON CONFLICT DO NOTHING`;
  const rows = await prisma.$queryRaw<
    { keys: { publicKey: string; privateKey: string } }[]
  >`SELECT keys FROM orion_push.compliance_keys WHERE id=1`;
  return rows[0].keys;
}
export async function subscribeDevice(
  schema: string,
  userId: string,
  sub: DeviceSubscription,
) {
  await init();
  await prisma.$executeRaw`INSERT INTO orion_push.compliance_devices(endpoint,user_id,schema_name,subscription) VALUES(${sub.endpoint},${userId}::uuid,${schema},${JSON.stringify(sub)}::jsonb) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,schema_name=EXCLUDED.schema_name,subscription=EXCLUDED.subscription,created_at=CASE WHEN orion_push.compliance_devices.user_id=EXCLUDED.user_id AND orion_push.compliance_devices.schema_name=EXCLUDED.schema_name THEN orion_push.compliance_devices.created_at ELSE now() END`;
}
export async function unsubscribeDevice(
  schema: string,
  userId: string,
  endpoint: string,
) {
  await init();
  await prisma.$executeRaw`DELETE FROM orion_push.compliance_devices WHERE schema_name=${schema} AND user_id=${userId}::uuid AND endpoint=${endpoint}`;
}
type Device = {
  endpoint: string;
  user_id: string;
  schema_name: string;
  subscription: DeviceSubscription;
  created_at: Date;
};
async function sendDevice(device: Device, test = false) {
  const keys = await pushKeys();
  // The schema comes only from tenant resolution, never from a request body.
  const notes = test
    ? [
        {
          id: "test",
          title: "ComplianceCore alerts are working",
          body: "This alert can arrive even when ComplianceCore is closed.",
          action_url: "/notifications",
        },
      ]
    : await withTenantSchema(
        device.schema_name,
        (tx) => tx.$queryRaw<
          {
            id: string;
            title: string;
            body: string | null;
            action_url: string | null;
          }[]
        >`
    SELECT n.id,n.title,n.body,n.action_url FROM notifications n
    WHERE n.user_id=${device.user_id}::uuid AND n.read_at IS NULL AND n.dismissed_at IS NULL
      AND n.created_at >= ${new Date(device.created_at)} AND n.created_at > now()-interval '24 hours'
      AND NOT EXISTS(SELECT 1 FROM orion_push.compliance_deliveries d WHERE d.notification_id=n.id AND d.endpoint=${device.endpoint} AND (d.delivered_at IS NOT NULL OR d.attempts>=5 OR d.claimed_at>now()-interval '2 minutes'))
    ORDER BY n.created_at LIMIT 30`,
      );
  for (const n of notes) {
    if (!test) {
      const claim = await prisma.$queryRaw<
        { notification_id: string }[]
      >`INSERT INTO orion_push.compliance_deliveries(notification_id,endpoint) VALUES(${n.id}::uuid,${device.endpoint}) ON CONFLICT(notification_id,endpoint) DO UPDATE SET claimed_at=now(),attempts=orion_push.compliance_deliveries.attempts+1 WHERE orion_push.compliance_deliveries.delivered_at IS NULL AND orion_push.compliance_deliveries.attempts<5 AND orion_push.compliance_deliveries.claimed_at<now()-interval '2 minutes' RETURNING notification_id`;
      if (!claim.length) continue;
    }
    try {
      await deliverPush(
        device.subscription,
        {
          title: n.title,
          body: n.body || undefined,
          url: n.action_url || "/notifications",
          tag: n.id,
        },
        keys,
      );
      if (!test)
        await prisma.$executeRaw`UPDATE orion_push.compliance_deliveries SET delivered_at=now() WHERE notification_id=${n.id}::uuid AND endpoint=${device.endpoint}`;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410)
        await unsubscribeDevice(
          device.schema_name,
          device.user_id,
          device.endpoint,
        );
      logger.warn(
        { status },
        "Device push failed; transient failures are retried",
      );
      if (test) throw error;
    }
  }
}
export async function testPush(schema: string, userId: string) {
  await init();
  const devices = await prisma.$queryRaw<
    Device[]
  >`SELECT * FROM orion_push.compliance_devices WHERE schema_name=${schema} AND user_id=${userId}::uuid`;
  if (!devices.length) throw new Error("Enable device alerts first");
  await Promise.all(devices.map((d) => sendDevice(d, true)));
}
export function startPushDelivery() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await init();
      const devices = await prisma.$queryRaw<
        Device[]
      >`SELECT d.* FROM orion_push.compliance_devices d JOIN global.tenants t ON t.schema_name=d.schema_name JOIN global.users u ON u.id=d.user_id JOIN global.tenant_memberships m ON m.tenant_id=t.id AND m.user_id=u.id WHERE t.is_active=TRUE AND t.deleted_at IS NULL AND u.is_active=TRUE AND u.deleted_at IS NULL AND m.is_active=TRUE AND m.deleted_at IS NULL`;
      for (const device of devices)
        await sendDevice(device).catch((e) =>
          logger.warn({ err: e }, "Device push processing failed"),
        );
    } catch (error) {
      logger.error({ err: error }, "Background push delivery is unavailable");
    } finally {
      running = false;
    }
  }, 15000);
  timer.unref();
  return () => clearInterval(timer);
}
