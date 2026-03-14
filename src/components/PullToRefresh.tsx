import { useState, useRef, useCallback, ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 80;

export function PullToRefresh({ onRefresh, children, className = "" }: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistance = useMotionValue(0);

  const indicatorY = useTransform(pullDistance, [0, THRESHOLD], [0, THRESHOLD]);
  const indicatorOpacity = useTransform(pullDistance, [0, THRESHOLD * 0.4, THRESHOLD], [0, 0.5, 1]);
  const indicatorRotate = useTransform(pullDistance, [0, THRESHOLD], [0, 360]);
  const indicatorScale = useTransform(pullDistance, [0, THRESHOLD * 0.5, THRESHOLD], [0.5, 0.8, 1]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const el = containerRef.current;
    if (el && el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = Math.max(0, e.touches[0].clientY - startY.current);
    // Rubber band effect — diminishing returns past threshold
    const dampened = delta > THRESHOLD ? THRESHOLD + (delta - THRESHOLD) * 0.3 : delta;
    pullDistance.set(dampened);
  }, [refreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || refreshing) return;
    pulling.current = false;

    if (pullDistance.get() >= THRESHOLD) {
      setRefreshing(true);
      pullDistance.set(THRESHOLD * 0.6);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        pullDistance.set(0);
      }
    } else {
      pullDistance.set(0);
    }
  }, [refreshing, pullDistance, onRefresh]);

  return (
    <div className={`relative ${className}`}>
      {/* Pull indicator */}
      <motion.div
        style={{ y: indicatorY, opacity: indicatorOpacity, scale: indicatorScale }}
        className="absolute left-1/2 -translate-x-1/2 top-0 z-10 flex items-center justify-center"
      >
        <motion.div
          style={{ rotate: refreshing ? undefined : indicatorRotate }}
          animate={refreshing ? { rotate: 360 } : {}}
          transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-md border border-border"
        >
          <Loader2 className="h-4 w-4 text-primary" />
        </motion.div>
      </motion.div>

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="h-full overflow-y-auto overscroll-contain"
      >
        <motion.div style={{ y: indicatorY }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
