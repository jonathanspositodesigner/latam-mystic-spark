export type SeedanceSpeed = "standard" | "fast";
export type SeedanceQuality = "720p" | "480p";
export type SeedanceGenType = "t2v" | "i2v" | "r2v";

export function getSeedanceCostPerSecond(
  speed: SeedanceSpeed,
  quality: SeedanceQuality,
  genType: SeedanceGenType,
  sourceTool?: string,
): number {
  if ((sourceTool === "flyer_motion" || sourceTool === "flyer_maker") && quality === "720p") {
    return 200;
  }
  const key = `${speed}-${quality}-${genType}`;
  const prices: Record<string, number> = {
    "fast-480p-i2v": 120, "fast-480p-t2v": 120, "fast-480p-r2v": 120,
    "fast-720p-i2v": 150, "fast-720p-t2v": 150, "fast-720p-r2v": 150,
    "standard-480p-i2v": 120, "standard-480p-t2v": 120, "standard-480p-r2v": 120,
    "standard-720p-i2v": 150, "standard-720p-t2v": 150, "standard-720p-r2v": 150,
  };
  return prices[key] ?? 300;
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
