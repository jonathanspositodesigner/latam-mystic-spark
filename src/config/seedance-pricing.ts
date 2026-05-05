/**
 * Seedance 2.0 — Tabla de precios centralizada
 */

export type SeedanceSpeed = "standard" | "fast";
export type SeedanceQuality = "720p" | "480p";
export type SeedanceGenType = "t2v" | "i2v" | "r2v";

interface PricingEntry {
  speed: SeedanceSpeed;
  quality: SeedanceQuality;
  genType: SeedanceGenType;
  creditsPerSecond: number;
}

const PRICING_TABLE: PricingEntry[] = [
    { speed: "fast", quality: "480p", genType: "i2v", creditsPerSecond: 120 },
    { speed: "fast", quality: "480p", genType: "t2v", creditsPerSecond: 120 },
    { speed: "fast", quality: "480p", genType: "r2v", creditsPerSecond: 120 },
    { speed: "fast", quality: "720p", genType: "i2v", creditsPerSecond: 150 },
    { speed: "fast", quality: "720p", genType: "t2v", creditsPerSecond: 150 },
    { speed: "fast", quality: "720p", genType: "r2v", creditsPerSecond: 150 },
    { speed: "standard", quality: "480p", genType: "i2v", creditsPerSecond: 120 },
    { speed: "standard", quality: "480p", genType: "t2v", creditsPerSecond: 120 },
    { speed: "standard", quality: "480p", genType: "r2v", creditsPerSecond: 120 },
    { speed: "standard", quality: "720p", genType: "i2v", creditsPerSecond: 150 },
    { speed: "standard", quality: "720p", genType: "t2v", creditsPerSecond: 150 },
    { speed: "standard", quality: "720p", genType: "r2v", creditsPerSecond: 150 },
];

const priceMap = new Map<string, number>();
for (const entry of PRICING_TABLE) {
  priceMap.set(`${entry.speed}-${entry.quality}-${entry.genType}`, entry.creditsPerSecond);
}

export function getSeedanceCostPerSecond(
  speed: SeedanceSpeed,
  quality: SeedanceQuality,
  genType: SeedanceGenType,
  sourceTool?: string,
): number {
  if ((sourceTool === "flyer_motion" || sourceTool === "flyer_maker") && quality === "720p") {
    return 200;
  }
  return priceMap.get(`${speed}-${quality}-${genType}`) ?? 300;
}

export function getSeedanceTotalCost(
  speed: SeedanceSpeed,
  quality: SeedanceQuality,
  genType: SeedanceGenType,
  durationSeconds: number,
  sourceTool?: string,
): number {
  return getSeedanceCostPerSecond(speed, quality, genType, sourceTool) * durationSeconds;
}

export function modeToGenType(mode: string): SeedanceGenType {
  return mode === "text" ? "t2v" : "i2v";
}
