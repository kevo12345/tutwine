import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

export type FloatingHeart = {
  id: string;
  color: string;
  startX: number; // 0-1 (from right edge)
};

type Props = {
  hearts: FloatingHeart[];
  /** Called when a heart animation ends so parent can drop it from state. */
  onExpire: (id: string) => void;
};

const COLORS = ["text-red-500", "text-pink-500", "text-rose-400", "text-fuchsia-500", "text-amber-400"];
export const randomHeartColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

export function FloatingHearts({ hearts, onExpire }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {hearts.map((h) => (
        <FloatingHeartItem key={h.id} heart={h} onExpire={onExpire} />
      ))}
    </div>
  );
}

function FloatingHeartItem({ heart, onExpire }: { heart: FloatingHeart; onExpire: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [wobble] = useState(() => (Math.random() - 0.5) * 60);
  useEffect(() => {
    const t = setTimeout(() => onExpire(heart.id), 2500);
    return () => clearTimeout(t);
  }, [heart.id, onExpire]);
  return (
    <div
      ref={ref}
      className="absolute bottom-16 animate-heart-float"
      style={
        {
          right: `${8 + heart.startX * 40}px`,
          // custom CSS var for wobble
          ["--wobble" as any]: `${wobble}px`,
        } as React.CSSProperties
      }
    >
      <Heart className={`h-8 w-8 fill-current drop-shadow-lg ${heart.color}`} />
    </div>
  );
}
