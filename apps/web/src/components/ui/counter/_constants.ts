export const ROOT = "counter";
export const SR = "counter__sr";
export const ROW = "counter__row";
export const AFFIX = "counter__affix";
export const DIGIT = "counter__digit";
export const SIZER = "counter__sizer";
export const WINDOW = "counter__window";
export const STRIP = "counter__strip";
export const NUMERAL = "counter__numeral";
export const SYMBOL = "counter__symbol";
export const SYMBOL_TEXT = "counter__symbol-text";
export const BLUR = "counter__blur";
export const MEASURE = "counter__measure";

export const TAU = Math.PI * 2;
export const NUMERIC = new Set(["integer", "group", "decimal", "fraction"]);
export const DIRECTIONS = ["auto", "up", "down", "shortest"] as const;
export const MASK =
  "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.0355) calc(var(--counter-fade, 0em) * 0.1667), rgba(0, 0, 0, 0.2099) calc(var(--counter-fade, 0em) * 0.3333), rgba(0, 0, 0, 0.5) calc(var(--counter-fade, 0em) * 0.5), rgba(0, 0, 0, 0.7901) calc(var(--counter-fade, 0em) * 0.6667), rgba(0, 0, 0, 0.9645) calc(var(--counter-fade, 0em) * 0.8333), #000 var(--counter-fade, 0em), #000 calc(100% - var(--counter-fade, 0em)), rgba(0, 0, 0, 0.9645) calc(100% - var(--counter-fade, 0em) * 0.8333), rgba(0, 0, 0, 0.7901) calc(100% - var(--counter-fade, 0em) * 0.6667), rgba(0, 0, 0, 0.5) calc(100% - var(--counter-fade, 0em) * 0.5), rgba(0, 0, 0, 0.2099) calc(100% - var(--counter-fade, 0em) * 0.3333), rgba(0, 0, 0, 0.0355) calc(100% - var(--counter-fade, 0em) * 0.1667), rgba(0, 0, 0, 0) 100%)";
