import { useEffect, useState } from "react";

/**
 * Hook to track window innerHeight, useful for mobile layout calculations
 * where 100vh doesn't account for dynamic browser toolbars.
 * Optimized with requestAnimationFrame to avoid excessive re-renders.
 */
export function useViewportHeight() {
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    let raf: number | null = null;

    const update = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setHeight(window.innerHeight);
      });
    };

    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return height;
}
