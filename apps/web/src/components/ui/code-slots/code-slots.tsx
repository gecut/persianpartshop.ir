"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { animate, motion, motionValue, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

import "./code-slots.css";
import { CHECK_DELAY, CHECK_RISE, EASE_OUT, SINK_DELAY, SINK_STEP, WASH_IN, WASH_OUT } from "./_constants";
import { CheckMarkIcon } from "./_check-mark-icon";
import { Slot } from "./_slot";
import { clamp01, digitsOf, firstEmptyOf, isFull, toEnglishDigits, toPersianDigits, toSlots } from "./_digits"

export type CodeSlotsStatus = "idle" | "error" | "success";

export interface CodeSlotsProps {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  status?: CodeSlotsStatus;
  mask?: boolean;
  caret?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accentColor?: string;
  successColor?: string;
  inkColor?: string;
  slotColor?: string;
  digitColor?: string;
  dangerColor?: string;
  slotSize?: number;
  gap?: number;
  radius?: number;
  bounce?: number;
  settle?: number;
  rise?: number;
  cascade?: number;
  ariaLabel?: string;
  className?: string;
}

interface Live {
  settle: number;
  bounce: number;
  cascade: number;
  reduce: boolean | null;
}

export function CodeSlots({
  length = 4,
  value,
  defaultValue = "",
  onChange,
  onComplete,
  status = "idle",
  mask = false,
  caret = true,
  disabled = false,
  autoFocus = false,
  accentColor,
  successColor,
  inkColor,
  slotColor,
  digitColor,
  dangerColor,
  slotSize = 52,
  gap = 10,
  radius = 13,
  bounce = 0.2,
  settle = 0.3,
  rise = 9,
  cascade = 40,
  ariaLabel = "کد تأیید یکبار مصرف",
  className = "",
}: CodeSlotsProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // Apply controlled values through the effect so a complete code at mount also fires onComplete.
  const [slots, setSlots] = useState(() =>
    toSlots(value === undefined ? defaultValue : "", length),
  );
  const [active, setActive] = useState(() => firstEmptyOf(slots));
  const [focused, setFocused] = useState(false);
  const [veiled, setVeiled] = useState(status === "success");
  const activeMv = useMotionValue(active);
  const openMv = useMotionValue(status === "success" ? 1 : 0);
  const checkMv = useMotionValue(status === "success" ? 1 : 0);
  const glide = useRef<Set<number>>(new Set());
  const target = useRef<number[]>([]);
  const draining = useRef(false);
  const drainTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const statusRef = useRef(status);
  const emitted = useRef(slots.join(""));
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const live = useRef<Live>({} as Live);
  live.current = { settle, bounce, cascade, reduce };

  const springs = useMemo(
    () => ({
      mvs: Array.from({ length }, (_, i) =>
        motionValue(slotsRef.current[i] ? 1 : 0),
      ),
      drops: Array.from({ length }, () =>
        motionValue(statusRef.current === "success" ? 1 : 0),
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [length],
  );
  const { mvs, drops } = springs;
  const pitch = slotSize + gap;
  const height = slotSize;
  const washRadius = Math.min(radius, slotSize / 2);

  const drive = useCallback(
    (i: number, to: number, delayMs = 0) => {
      const mv = mvs[i];
      if (!mv) return;
      target.current[i] = to;
      const L = live.current;
      if (L.reduce) {
        mv.jump(to);
        return;
      }
      animate(mv, to, {
        type: "spring",
        duration: L.settle,
        bounce: L.bounce,
        delay: delayMs / 1000,
      });
    },
    [mvs],
  );
  const land = useCallback(
    (i: number, delayMs = 0) => {
      if (mvs[i].get() > 0) mvs[i].jump(0);
      drive(i, 1, delayMs);
    },
    [mvs, drive],
  );
  const moveActive = useCallback(
    (next: number, crossed: number[]) => {
      crossed.forEach((j) => glide.current.add(j));
      activeMv.jump(next);
      setActive(next);
    },
    [activeMv],
  );
  const jumpActive = useCallback(
    (next: number) => {
      glide.current.clear();
      activeMv.jump(next);
      setActive(next);
      if (inputRef.current) {
        try {
          inputRef.current.setSelectionRange(next + 1, next + 1);
        } catch {}
      }
    },
    [activeMv],
  );

  const caretX = useTransform(() => {
    const a = activeMv.get();
    let x = a * pitch;
    for (let j = 0; j < mvs.length; j++) {
      const h = clamp01(mvs[j].get());
      if (!glide.current.has(j)) continue;
      const to = target.current[j];
      if (to === undefined || h === clamp01(to)) {
        glide.current.delete(j);
        continue;
      }
      x += j < a ? -(1 - h) * pitch : h * pitch;
    }
    return Math.min(Math.max(x, 0), (mvs.length - 1) * pitch);
  });
  const caretTransform = useTransform(
    caretX,
    (x: number) => `translateX(${x}px)`,
  );
  const washClip = useTransform(
    openMv,
    (o: number) => `inset(0 ${(1 - clamp01(o)) * 50}% round ${washRadius}px)`,
  );
  const checkTransform = useTransform(
    checkMv,
    (c: number) =>
      `translateY(${(1 - c) * CHECK_RISE}px) scale(${0.85 + 0.15 * Math.max(c, 0)})`,
  );
  const checkOpacity = useTransform(checkMv, clamp01);

  const commit = useCallback(
    (next: string[]) => {
      const prev = slotsRef.current;
      slotsRef.current = next;
      setSlots(next);
      const code = next.join("");
      emitted.current = code;
      onChange?.(code);
      if (isFull(next) && (!isFull(prev) || statusRef.current === "error" || code !== prev.join(""))) {
        onComplete?.(code);
      }
    },
    [onChange, onComplete],
  );

  const insert = (raw: string, from = active) => {
    const digits = digitsOf(raw);
    if (!digits) return;
    const next = [...slotsRef.current];
    const crossed: number[] = [];
    const step = reduce ? 0 : cascade;
    let i = from;
    for (const ch of digits) {
      if (i >= length) break;
      next[i] = ch;
      land(i, (i - from) * step);
      crossed.push(i);
      i += 1;
    }
    if (!crossed.length) return;
    commit(next);
    moveActive(Math.min(i, length - 1), crossed);
  };
  const clearSlot = (i: number, stepBack = false) => {
    if (!slotsRef.current[i]) {
      if (stepBack) jumpActive(i);
      return;
    }
    const next = [...slotsRef.current];
    next[i] = "";
    drive(i, 0);
    commit(next);
    if (stepBack) moveActive(i, [i]);
  };

  const busy = disabled || draining.current || status === "success";
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (busy || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "Enter") {
      e.preventDefault();
      const code = slotsRef.current.filter(Boolean).join("");
      if (code.length === length) {
        onComplete?.(code);
      }
      return;
    }
    if (/^[0-9۰-۹٠-٩]$/.test(k)) {
      e.preventDefault();
      insert(toEnglishDigits(k));
    } else if (k === "Backspace") {
      e.preventDefault();
      if (slots[active]) clearSlot(active);
      else if (active > 0) clearSlot(active - 1, true);
    } else if (k === "Delete") {
      e.preventDefault();
      clearSlot(active);
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      jumpActive(Math.max(active - 1, 0));
    } else if (k === "ArrowRight") {
      e.preventDefault();
      jumpActive(Math.min(active + 1, length - 1));
    } else if (k === "Home") {
      e.preventDefault();
      jumpActive(0);
    } else if (k === "End") {
      e.preventDefault();
      jumpActive(length - 1);
    }
  };
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (busy) return;
    e.preventDefault();
    insert(e.clipboardData.getData("text"));
  };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (busy) return;
    const raw = e.target.value;
    const digits = digitsOf(raw).slice(0, length);
    const currentCode = slotsRef.current.filter(Boolean).join("");

    if (digits.length < currentCode.length) {
      if (slotsRef.current[active]) {
        clearSlot(active);
      } else if (active > 0) {
        clearSlot(active - 1, true);
      } else {
        clearSlot(0);
      }
      return;
    }

    if (digits.length > 0) {
      if (digits.length === 1) {
        insert(digits, active);
      } else {
        insert(digits, 0);
      }
    }
  };
  const onRowPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const row = rowRef.current;
    if (row && !draining.current && status !== "success") {
      const rect = row.getBoundingClientRect();
      const zoom = rect.width / (row.offsetWidth || rect.width) || 1;
      const i = Math.floor((e.clientX - rect.left) / zoom / pitch);
      jumpActive(Math.max(0, Math.min(i, firstEmptyOf(slotsRef.current))));
    }
    inputRef.current?.focus();
  };

  useEffect(() => {
    glide.current.clear();
    target.current = [];
    const next = Array.from({ length }, (_, i) => slotsRef.current[i] ?? "");
    slotsRef.current = next;
    setSlots(next);
    jumpActive(firstEmptyOf(next));
    const code = next.join("");
    if (code !== emitted.current) {
      emitted.current = code;
      onChange?.(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  useEffect(() => {
    if (value === undefined) return;
    const clean = digitsOf(value).slice(0, length);
    if (clean === emitted.current) return;
    emitted.current = clean;
    const prev = slotsRef.current;
    const next = toSlots(clean, length);
    const hidden = statusRef.current === "success";
    const landing: number[] = [];
    const leaving: number[] = [];
    next.forEach((ch, i) => {
      if (ch === prev[i]) return;
      (ch ? landing : leaving).push(i);
    });
    const step = live.current.reduce || hidden ? 0 : live.current.cascade;
    landing.forEach((i, k) => land(i, k * step));
    leaving.reverse().forEach((i, k) => {
      if (hidden) {
        target.current[i] = 0;
        mvs[i].jump(0);
        drops[i].jump(0);
      } else drive(i, 0, k * step);
    });
    slotsRef.current = next;
    setSlots(next);
    moveActive(firstEmptyOf(next), [...landing, ...leaving]);
    if (!isFull(prev) && isFull(next)) onComplete?.(clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  useEffect(() => {
    const was = statusRef.current;
    const L = live.current;
    if (status === "success") {
      setVeiled(true);
      if (L.reduce) {
        openMv.jump(1);
        drops.forEach((d) => d.jump(1));
        checkMv.jump(1);
        return;
      }
      animate(openMv, 1, { duration: WASH_IN, ease: EASE_OUT });
      drops.forEach((d, k) =>
        animate(d, 1, {
          type: "spring",
          duration: 0.45,
          bounce: 0,
          delay: SINK_DELAY + k * SINK_STEP,
        }),
      );
      animate(checkMv, 1, {
        type: "spring",
        duration: 0.55,
        bounce: L.bounce || 0.3,
        delay: CHECK_DELAY,
      });
      return;
    }
    if (was !== "success") return;
    if (L.reduce) {
      openMv.jump(0);
      checkMv.jump(0);
      drops.forEach((d) => d.jump(0));
      setVeiled(false);
      return;
    }
    animate(checkMv, 0, { duration: 0.15, ease: EASE_OUT });
    animate(openMv, 0, {
      duration: WASH_OUT,
      ease: EASE_OUT,
      delay: 0.06,
    }).then(() => {
      if (openMv.get() === 0) setVeiled(false);
    });
    drops.forEach((d) =>
      animate(d, 0, { type: "spring", duration: 0.3, bounce: 0, delay: 0.1 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== "error") return;
    // On error, keep numbers in slots and place active cursor on the last slot
    const filled = slotsRef.current
      .map((c, i) => (c ? i : -1))
      .filter((i) => i >= 0);
    if (filled.length > 0) {
      jumpActive(filled[filled.length - 1]);
    }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => () => clearTimeout(drainTimer.current), []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const view =
    slots.length === length
      ? slots
      : Array.from({ length }, (_, i) => slots[i] ?? "");
  const showCaret =
    caret &&
    focused &&
    !disabled &&
    !veiled &&
    status !== "success" &&
    (status === "error" || !view[active]);

  const cssVariables: Record<string, string> = {
    "--cs-size": `${slotSize}px`,
    "--cs-height": `${height}px`,
    "--cs-gap": `${gap}px`,
    "--cs-radius": `${Math.min(radius, slotSize / 2)}px`,
    "--cs-font": `${Math.round(slotSize * 0.46)}px`,
  };
  if (accentColor !== undefined) cssVariables["--cs-accent"] = accentColor;
  if (successColor !== undefined) cssVariables["--cs-success"] = successColor;
  if (dangerColor !== undefined) cssVariables["--cs-danger"] = dangerColor;
  if (inkColor) cssVariables["--cs-ink"] = inkColor;
  if (slotColor) cssVariables["--cs-slot"] = slotColor;
  if (digitColor) cssVariables["--cs-digit"] = digitColor;

  return (
    <div
      className={`code-slots${className ? ` ${className}` : ""}`}
      style={cssVariables as CSSProperties}
      dir="ltr"
    >
      <div
        ref={rowRef}
        className="code-slots__row flex w-full"
        data-status={status}
        data-focused={focused ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        onPointerDown={onRowPointerDown}
      >
        <input
          ref={inputRef}
          className="code-slots__input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value={slots.filter(Boolean).join("")}
          maxLength={length}
          aria-label={ariaLabel}
          aria-invalid={status === "error"}
          aria-describedby={`${uid}-count`}
          disabled={disabled}
          readOnly={status === "success"}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onChange={onInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {view.map((ch, i) => (
          <Slot
            key={i}
            mv={mvs[i]}
            drop={drops[i]}
            char={mask && ch ? "•" : toPersianDigits(ch)}
            active={focused && i === active}
            rise={rise}
            sink={Math.round(height * 0.5)}
          />
        ))}
        <motion.span
          className="code-slots__wash"
          aria-hidden="true"
          style={{ clipPath: washClip }}
        >
          <motion.span
            className="code-slots__check"
            style={{ transform: checkTransform, opacity: checkOpacity }}
          >
            <CheckMarkIcon
              size={Math.round(slotSize * 0.55)}
              strokeWidth={2.4}
            />
          </motion.span>
        </motion.span>
        <motion.span
          className="code-slots__caret"
          aria-hidden="true"
          data-show={showCaret ? "" : undefined}
          style={{ transform: caretTransform }}
        >
          <span key={active} className="code-slots__caret-line" />
        </motion.span>
      </div>
      <span id={`${uid}-count`} className="code-slots__sr" aria-live="polite">
        {status === "success"
          ? "کد تایید شد"
          : `${toPersianDigits(String(view.filter(Boolean).length))} از ${toPersianDigits(String(length))} رقم وارد شده`}
      </span>
    </div>
  );
}

export default CodeSlots;
