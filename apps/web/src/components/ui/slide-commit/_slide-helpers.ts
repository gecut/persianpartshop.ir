export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const onColor = (hex: string) => {
  if (hex.startsWith("rgba") || hex.startsWith("color-mix")) return "#ffffff";
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3 ? [...raw].map((ch) => ch + ch).join("") : raw.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const yiq =
    (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq >= 140 ? "#111111" : "#ffffff";
};

export const velocityOf = (hist: [number, number][]) => {
  if (hist.length < 2) return 0;
  const [t0, x0] = hist[0];
  const [t1, x1] = hist[hist.length - 1];
  return ((x1 - x0) / Math.max(1, t1 - t0)) * 1000;
};

export const finePointer = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
