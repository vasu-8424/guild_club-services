"use client";

import * as React from "react";

/**
 * Mobile Virtual Viewport & Keyboard Handler
 * Detects keyboard opening on mobile and calculates bottom offset
 * so sticky form action buttons stay visible above the virtual keyboard.
 */
export function useKeyboardOffset() {
  const [offsetBottom, setOffsetBottom] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      const windowHeight = window.innerHeight;
      const vpHeight = vv.height;
      const vpTop = vv.offsetTop;

      // Distance from bottom of visual viewport to bottom of layout viewport
      const keyboardOverlap = Math.max(0, windowHeight - (vpTop + vpHeight));
      setOffsetBottom(keyboardOverlap > 100 ? keyboardOverlap : 0);
    };

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  return offsetBottom;
}

/**
 * Focus listener to keep input visible in middle of viewport
 */
export function scrollInputIntoViewOnFocus(e: React.FocusEvent<HTMLElement>) {
  setTimeout(() => {
    try {
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // fallback
    }
  }, 300);
}
