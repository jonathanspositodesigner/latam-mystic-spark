/**
 * UUID v4 generator that works in BOTH secure (HTTPS/localhost) and non-secure
 * contexts (HTTP on LAN IPs).
 *
 * `crypto.randomUUID()` is only available in secure contexts. On LAN access
 * (e.g. http://192.168.x.x) it throws "crypto.randomUUID is not a function".
 *
 * This util uses `crypto.getRandomValues()` (always available) to generate a
 * compliant v4 UUID, falling back to Math.random for ancient browsers.
 */
export function safeRandomUUID(): string {
  // Preferred: native randomUUID (HTTPS/localhost)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Polyfill via getRandomValues (works on HTTP too)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort fallback (não deveria nunca cair aqui em browsers modernos)
  const rand = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${rand()}${rand()}-${rand()}-4${rand().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rand().slice(1)}-${rand()}${rand()}${rand()}`;
}
