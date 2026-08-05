/**
 * Proves the app actually sends mail.
 *
 * Stands up a real SMTP server and drives the live API through every flow a
 * user depends on receiving an email from, asserting each one is delivered and
 * carries a working link.
 *
 * It exists because every send in this app is fire-and-forget and swallows its
 * own errors — the right behaviour, since a failed email must not fail a
 * registration, but it means a broken mail path has no symptom except a
 * customer who never hears from us. Nothing in the test suite would have
 * noticed that password reset silently sent nothing to unverified accounts.
 *
 * Usage:
 *   DATABASE_URL=… API_URL=… node scripts/email-checks.mjs
 * with the API running against SMTP_HOST=127.0.0.1 SMTP_PORT=2599.
 */
import net from 'node:net';

const API = process.env.API_URL ?? 'http://127.0.0.1:3002';
const received = [];

// Minimal SMTP server. Enough of the protocol for nodemailer to complete a
// session, so this exercises the real transport rather than a mock.
const server = net.createServer((sock) => {
  let data = '';
  let inData = false;
  sock.write('220 localhost ESMTP\r\n');
  sock.on('data', (chunk) => {
    const text = chunk.toString();
    if (inData) {
      data += text;
      if (data.includes('\r\n.\r\n')) {
        inData = false;
        received.push({ at: Date.now(), body: data });
        data = '';
        sock.write('250 OK queued\r\n');
      }
      return;
    }
    for (const line of text.split('\r\n').filter(Boolean)) {
      const cmd = line.toUpperCase();
      if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) {
        sock.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
      } else if (cmd.startsWith('AUTH')) {
        sock.write('235 Authentication successful\r\n');
      } else if (cmd.startsWith('MAIL FROM') || cmd.startsWith('RCPT TO')) {
        sock.write('250 OK\r\n');
      } else if (cmd.startsWith('DATA')) {
        inData = true;
        sock.write('354 Start mail input\r\n');
      } else if (cmd.startsWith('QUIT')) {
        sock.write('221 Bye\r\n');
        sock.end();
      } else {
        sock.write('250 OK\r\n');
      }
    }
  });
  sock.on('error', () => {});
});

await new Promise((r) => server.listen(2599, '127.0.0.1', r));
console.log('SMTP sink listening on 2599');

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

/** Waits for the next email to land, returning how long it took. */
async function waitForMail(sinceCount, timeoutMs = 15000) {
  const from = Date.now();
  while (received.length <= sinceCount && Date.now() - from < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return received.length > sinceCount ? received[received.length - 1] : null;
}

const email = `mail${Date.now()}@example.com`;
const started = Date.now();

const res = await post('/api/auth/register', {
  email, password: 'MailTest123!', firstName: 'Mail', lastName: 'Test',
});
const registerMs = Date.now() - started;
console.log(`register -> ${res.status} in ${registerMs}ms`);

if (!(await waitForMail(0))) {
  console.log('RESULT: FAIL — no email reached the SMTP server within 15s');
  server.close();
  process.exit(1);
}

// Full quoted-printable decode. Soft line breaks ("=\r\n") AND escaped bytes
// ("=3D" for "="). Decoding only the first made a perfectly good verification
// link look missing.
function decodeQp(raw) {
  return raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const mail = received[0];
const deliveryMs = mail.at - started;
const body = decodeQp(mail.body);
const hasLink = /verify-email\?token=[a-f0-9]{64}/.test(body);
const subject = (body.match(/Subject: (.*)/) ?? [])[1] ?? '(none)';
const link = (body.match(/https?:\/\/\S*verify-email[^"'\s<]*/) ?? [])[0] ?? null;
if (!hasLink) {
  console.log('--- body excerpt for diagnosis ---');
  const at = body.indexOf('verify-email');
  console.log(at >= 0 ? body.slice(Math.max(0, at - 120), at + 180) : body.slice(-600));
  console.log('----------------------------------');
}

console.log(JSON.stringify({
  result: hasLink ? 'PASS' : 'FAIL — delivered but no valid verification link',
  registerResponseMs: registerMs,
  emailDeliveredMs: deliveryMs,
  subject: subject.trim(),
  recipient: email,
  verificationLink: link,
}, null, 2));

// The question is not how long registration took — the first request after a
// boot pays for bcrypt and a cold connection pool — but whether the response
// waited for the mail. If the email lands AFTER the response, it did not.
const gap = deliveryMs - registerMs;
console.log(gap >= 0
  ? `mail delivered ${gap}ms after the response — the send is off the request path`
  : `WARNING: response returned ${-gap}ms after the mail — registration is blocking on the send`);

// ── The other flows that must send mail ─────────────────────────────────────
const flows = [{ name: 'verification (register)', ok: hasLink, ms: deliveryMs }];

async function check(name, fn, expect) {
  const before = received.length;
  const t0 = Date.now();
  await fn();
  const mail = await waitForMail(before);
  if (!mail) {
    flows.push({ name, ok: false, ms: null, note: 'no email delivered' });
    return;
  }
  const decoded = decodeQp(mail.body);
  const subj = (decoded.match(/Subject: (.*)/) ?? [])[1]?.trim() ?? '';
  flows.push({
    name,
    ok: expect.test(decoded),
    ms: mail.at - t0,
    subject: subj,
  });
}

// Registering the SAME address again. This used to return "check your email"
// and send nothing at all, so anyone whose first email went missing and simply
// signed up again waited forever. It is the single most likely reason a real
// user reports "registered fine, no email".
await check('re-register same address', () => post('/api/auth/register', {
  email, password: 'MailTest123!', firstName: 'Mail', lastName: 'Test',
}), /verify-email\?token=[a-f0-9]{64}/);

// Resend verification — the escape hatch for exactly the situation reported.
await check('resend verification', () => post('/api/auth/resend-verification', { email }),
  /verify-email\?token=[a-f0-9]{64}/);

// Password reset.
await check('password reset', () => post('/api/auth/forgot-password', { email }),
  /reset-password\?token=[a-f0-9]{64}/);

console.log('\n=== EMAIL FLOWS ===');
for (const f of flows) {
  console.log(`  ${f.ok ? 'PASS' : 'FAIL'}  ${f.name.padEnd(24)} ${f.ms !== null ? `${f.ms}ms` : ''} ${f.subject ?? ''} ${f.note ?? ''}`.trimEnd());
}
const allOk = flows.every((f) => f.ok);
console.log(`\n${flows.filter((f) => f.ok).length}/${flows.length} email flows delivered`);

server.close();
process.exit(allOk ? 0 : 1);
