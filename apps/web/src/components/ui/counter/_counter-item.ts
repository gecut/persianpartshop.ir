import type { SlotInfo } from "./_counter-format";

export interface CounterItem {
  kind: "digit" | "symbol";
  rank: number;
  pos: number;
  vel: number;
  target: number;
  shown: number;
  shownVel: number;
  shownTarget: number;
  wait: number;
  exiting: boolean;
  natural: number;
  el: HTMLElement | null;
  numerals: HTMLElement[] | null;
  strip: HTMLElement | null;
  blur: SVGElement | null;
  filter: string;
  blurred: boolean;
}

export const makeItem = (
  slot: SlotInfo,
  position: number,
  shown: number,
): CounterItem => ({
  kind: slot.kind,
  rank: slot.rank,
  pos: position,
  vel: 0,
  target: position,
  shown,
  shownVel: 0,
  shownTarget: shown,
  wait: 0,
  exiting: false,
  natural: 0,
  el: null,
  numerals: null,
  strip: null,
  blur: null,
  filter: "",
  blurred: false,
});
