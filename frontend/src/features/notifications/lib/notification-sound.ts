let context: AudioContext | null = null;
const key = (account: string) => `compliancecore:notification-sound:${account}`;
export function soundEnabled(account: string): boolean {
  try { return localStorage.getItem(key(account)) === 'on'; } catch { return false; }
}
export async function playNotificationSound(): Promise<void> {
  context ||= new AudioContext();
  if (context.state !== 'running') await context.resume();
  if (context.state !== 'running') throw new Error('Your browser has paused sound. Tap Enable sound again.');
  const now = context.currentTime;
  for (const [offset, frequency] of [[0, 660], [0.16, 880]]) {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.14, now + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(now + offset); oscillator.stop(now + offset + 0.24);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
export function setSoundEnabled(account: string, enabled: boolean) {
  try { localStorage.setItem(key(account), enabled ? 'on' : 'off'); } catch { /* Session still supports the test chime. */ }
  window.dispatchEvent(new Event('compliance-sound-preference'));
}
export function claimSound(account: string, ids: string[]): boolean {
  try {
    const storageKey = `compliancecore:sounded:${account}`;
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const previous: string[] = Array.isArray(stored) ? stored.filter(x => typeof x === 'string') : [];
    const fresh = ids.filter(id => !previous.includes(id));
    if (!fresh.length) return false;
    localStorage.setItem(storageKey, JSON.stringify([...previous, ...fresh].slice(-150)));
    return true;
  } catch { return true; }
}
