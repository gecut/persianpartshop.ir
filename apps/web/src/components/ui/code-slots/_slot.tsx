import { useState } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { SINK_FADE } from "./_constants";
import { clamp01 } from "./_digits";

interface SlotProps {
  mv: MotionValue<number>;
  drop: MotionValue<number>;
  char: string;
  active: boolean;
  rise: number;
  sink: number;
}

export function Slot({ mv, drop, char, active, rise, sink }: SlotProps) {
  const [shown, setShown] = useState(char);
  if (char !== shown) setShown(char);
  const fill = useTransform(mv, (t: number) => `scale(${Math.max(t, 0)})`);
  const lift = useTransform(
    [mv, drop],
    ([t, d]: number[]) =>
      `translateY(${(1 - t) * rise + Math.max(d, 0) * sink}px)`,
  );
  const ink = useTransform(
    [mv, drop],
    ([t, d]: number[]) => clamp01(t) * (1 - clamp01(d / SINK_FADE)),
  );
  return (
    <span
      className="code-slots__slot"
      data-active={active ? "" : undefined}
      data-filled={char ? "" : undefined}
      aria-hidden="true"
    >
      <motion.span className="code-slots__fill" style={{ transform: fill }} />
      {shown ? (
        <motion.span
          className="code-slots__digit"
          style={{ transform: lift, opacity: ink }}
        >
          {shown}
        </motion.span>
      ) : null}
    </span>
  );
}
