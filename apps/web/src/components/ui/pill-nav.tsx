"use client";

import React, { useState, type ElementType, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import "./pill-nav.css";

export interface PillNavItem {
  label: string;
  href?: string;
  icon?: ReactNode;
  ariaLabel?: string;
}

export interface PillNavProps {
  items?: PillNavItem[];
  activeHref?: string;
  defaultActiveIndex?: number;
  onItemClick?: (
    item: PillNavItem,
    index: number,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
  linkComponent?: ElementType;
  theme?: "dark" | "light";
  layout?: "split" | "joined";
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  surface?: "glass" | "solid" | "none";
  itemStyle?: "pill" | "plain";
  hoverEffect?: "fill" | "glide" | "none";
  indicator?: "dot" | "pill" | "none";
  highlightColor?: string;
  highlightTextColor?: string;
  tileColor?: string;
  textColor?: string;
  bounce?: number;
  stretch?: number;
  collapse?: "auto" | "always" | "never";
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PillNav({
  items = [],
  activeHref,
  defaultActiveIndex = 0,
  onItemClick,
  linkComponent,
  orientation = "vertical",
  hoverEffect = "glide",
  indicator = "pill",
  bounce = 0.7,
  className = "",
  style,
  ariaLabel = "ناوبری",
}: PillNavProps) {
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  const LinkComponent = linkComponent || "a";

  const isVertical = orientation === "vertical";

  return (
    <div
      className={cn("pill-nav-root select-none", className)}
      style={style}
      aria-label={ariaLabel}
      onMouseLeave={() => setHoveredHref(null)}
    >
      <div
        className={cn(
          "w-full h-full",
          isVertical
            ? "grid grid-cols-4 items-center gap-1"
            : "flex items-center justify-between gap-1",
        )}
      >
        {items.map((item, index) => {
          const href = item.href || "#";
          const isActive = activeHref
            ? activeHref === href ||
              (href !== "/" && activeHref.startsWith(href))
            : index === defaultActiveIndex;

          const isHovered = hoveredHref === href;

          return (
            <motion.div
              key={href}
              className="relative h-full flex items-center justify-center"
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
            >
              <LinkComponent
                to={item.href}
                href={item.href}
                onClick={(e: React.MouseEvent<HTMLElement>) =>
                  onItemClick?.(item, index, e)
                }
                onMouseEnter={() => {
                  if (hoverEffect === "glide") setHoveredHref(href);
                }}
                className={cn(
                  "relative z-10 flex w-full h-full cursor-pointer items-center justify-center transition-all duration-200 outline-none rounded-2xl touch-manipulation active:scale-95",
                  isVertical ? "flex-col gap-0.5 px-2" : "flex-row gap-2 px-3 ",
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.ariaLabel || item.label}
              >
                {/* ReactBits Animated Active Pill Indicator */}
                {indicator === "pill" && isActive && (
                  <motion.div
                    layoutId="pill-nav-active-indicator"
                    className="absolute inset-0 rounded-2xl bg-white/12 pointer-events-none border-none shadow-none"
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 22,
                      mass: 0.8,
                      bounce,
                    }}
                  />
                )}

                {/* ReactBits Animated Hover Glide Indicator (for desktop pointer) */}
                {hoverEffect === "glide" && isHovered && !isActive && (
                  <motion.div
                    layoutId="pill-nav-hover-indicator"
                    className="absolute inset-0 rounded-2xl  text-white hover:text-white/6 pointer-events-none border-none shadow-none"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 26,
                    }}
                  />
                )}

                <div
                  className={cn(
                    "relative flex items-center justify-center transition-colors duration-200 group",
                    isVertical
                      ? "flex-col gap-0.5 px-2 py-1"
                      : "flex-row gap-2 px-3 py-1.5",
                    isActive
                      ? "text-white"
                      : "text-[#9da0b5] hover:text-background",
                  )}
                >
                  {item.icon && (
                    <div
                      className={cn(
                        "relative flex items-center justify-center rounded-xl px-3 py-1 transition-colors duration-200",
                        isActive
                          ? "[&_svg]:stroke-[2.2]"
                          : "[&_svg]:stroke-2 group-hover:text-background",
                      )}
                    >
                      {item.icon}
                    </div>
                  )}

                  <span
                    className={cn(
                      "text-[11px] font-bold tracking-tight transition-colors duration-200",
                      isActive ? "text-white" : "group-hover:text-background",
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              </LinkComponent>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default PillNav;
