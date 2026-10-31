import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import { cn } from "@/lib/utils";

export interface NavItem {
  name: string;
  link?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export interface FloatingNavProps {
  navItems: NavItem[];
  className?: string;
  ctaText?: string;
  ctaIcon?: React.ReactNode;
  onCtaClick?: () => void;
  brand?: React.ReactNode;
}

export const FloatingNav = ({
  navItems,
  className,
  ctaText = "Console",
  ctaIcon,
  onCtaClick,
  brand,
}: FloatingNavProps) => {
  const { scrollYProgress, scrollY } = useScroll();
  // Start visible so users immediately have navigation access
  const [visible, setVisible] = useState(true);

  useMotionValueEvent(scrollY, "change", (current) => {
    if (typeof current === "number") {
      const prev = scrollY.getPrevious() ?? 0;
      const direction = current - prev;

      // When near the top, always show
      if (current < 60) {
        setVisible(true);
      } else {
        // Scrolling up -> show, Scrolling down -> hide
        if (direction < -4) {
          setVisible(true);
        } else if (direction > 4) {
          setVisible(false);
        }
      }
    }
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{
          opacity: 1,
          y: -100,
        }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{
          duration: 0.25,
          ease: "easeInOut",
        }}
        className={cn(
          "flex max-w-fit fixed top-6 inset-x-0 mx-auto z-[5000] items-center justify-center px-2",
          className
        )}
      >
        <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-950/85 px-3 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
          {brand && (
            <div className="flex items-center pl-1 pr-2 border-r border-white/10">
              {brand}
            </div>
          )}

          {/* Nav items container */}
          <div className="flex items-center gap-1">
            {navItems.map((navItem, idx) => {
              const content = (
                <>
                  <span className="block sm:hidden text-cyan-400">{navItem.icon}</span>
                  <span className="hidden sm:inline-block font-mono tracking-tight text-xs">{navItem.name}</span>
                </>
              );

              if (navItem.onClick) {
                return (
                  <button
                    key={`nav-${idx}`}
                    type="button"
                    onClick={navItem.onClick}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      navItem.active
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "text-neutral-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <a
                  key={`link-${idx}`}
                  href={navItem.link || "#"}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                  )}
                >
                  {content}
                </a>
              );
            })}
          </div>

          {/* Divider */}
          {ctaText && <div className="h-5 w-px bg-white/10" />}

          {/* CTA Button */}
          {ctaText && (
            <button
              type="button"
              onClick={onCtaClick}
              className="relative rounded-full bg-cyan-500 hover:bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-all hover:shadow-[0_0_16px_rgba(6,182,212,0.4)] flex items-center gap-1.5 cursor-pointer font-mono"
            >
              <span>{ctaText}</span>
              {ctaIcon}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingNav;
