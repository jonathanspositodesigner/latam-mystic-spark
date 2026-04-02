/**
 * Generates a unique fingerprint for the current device
 * based on browser/screen/timezone/language characteristics.
 */
export function generateFingerprint(): string {
  const components: string[] = [];

  components.push(navigator.userAgent);
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  components.push(navigator.language);
  components.push(navigator.platform);

  const raw = components.join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36) + Date.now().toString(36).slice(-4);
}

/**
 * Gets or creates a persistent signup device fingerprint.
 * Stored in localStorage so the same device always returns the same value.
 */
export function getSignupDeviceFingerprint(): string {
  const storageKey = 'signup_device_fp';
  const stored = localStorage.getItem(storageKey);

  if (stored) return stored;

  const fp = generateFingerprint();
  localStorage.setItem(storageKey, fp);
  return fp;
}
