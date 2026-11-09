export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const mod = (value: number, base: number) => ((value % base) + base) % base;

export const wrap = (offset: number) => mod(offset + 5, 10) - 5;

export const prefersReduced = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

export const stepBetween = (
  from: number,
  to: number,
  direction: "auto" | "up" | "down" | "shortest",
) => {
  const up = mod(to - from, 10);
  if (direction === "up") return up;
  if (direction === "down") return up === 0 ? 0 : up - 10;
  return up > 5 ? up - 10 : up;
};
