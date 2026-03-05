import { useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProfileCard } from "@/components/ProfileCard";
import { MatchAnimation } from "@/components/MatchAnimation";
import { Button } from "@/components/ui/button";
import { Heart, X, Star, SlidersHorizontal } from "lucide-react";
import { MOCK_PROFILES } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [likesLeft, setLikesLeft] = useState(10);
  const [viewsLeft, setViewsLeft] = useState(20);

  const currentProfile = MOCK_PROFILES[currentIndex];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleSwipe = useCallback((action: "like" | "pass") => {
    if (action === "like") {
      if (likesLeft <= 0) {
        toast.error("Daily like limit reached!", { description: "Upgrade for more likes.", action: { label: "Upgrade", onClick: () => navigate("/pricing") } });
        return;
      }
      setLikesLeft((l) => l - 1);
      // Simulate match on 3rd like
      if (currentIndex === 2) {
        setMatchName(currentProfile.displayName);
        setShowMatch(true);
      }
    }
    setDirection(action === "like" ? "right" : "left");
    setTimeout(() => {
      setDirection(null);
      setCurrentIndex((i) => (i + 1) % MOCK_PROFILES.length);
      setViewsLeft((v) => Math.max(0, v - 1));
    }, 300);
  }, [currentIndex, currentProfile, likesLeft, navigate]);

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Discover</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{viewsLeft} views · {likesLeft} likes left</span>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Card stack */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
          {/* Background card */}
          {MOCK_PROFILES[(currentIndex + 1) % MOCK_PROFILES.length] && (
            <div className="absolute inset-0 scale-[0.95] opacity-50">
              <ProfileCard profile={MOCK_PROFILES[(currentIndex + 1) % MOCK_PROFILES.length]} />
            </div>
          )}

          {/* Active card */}
          <AnimatePresence mode="wait">
            {currentProfile && (
              <motion.div
                key={currentProfile.id}
                style={{ x, rotate }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) handleSwipe("like");
                  else if (info.offset.x < -100) handleSwipe("pass");
                }}
                animate={direction === "right" ? { x: 500, rotate: 20, opacity: 0 } : direction === "left" ? { x: -500, rotate: -20, opacity: 0 } : {}}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
              >
                <ProfileCard profile={currentProfile} />
                {/* Like/Pass overlay */}
                <motion.div style={{ opacity: likeOpacity }} className="absolute left-4 top-6 rounded-lg border-4 border-success px-4 py-1 text-2xl font-bold text-success -rotate-12">
                  LIKE
                </motion.div>
                <motion.div style={{ opacity: passOpacity }} className="absolute right-4 top-6 rounded-lg border-4 border-destructive px-4 py-1 text-2xl font-bold text-destructive rotate-12">
                  NOPE
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full border-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
            onClick={() => handleSwipe("pass")}
          >
            <X className="h-7 w-7" />
          </Button>
          <Button
            size="icon"
            className="h-16 w-16 rounded-full gradient-warm border-0 text-primary-foreground shadow-glow"
            onClick={() => handleSwipe("like")}
          >
            <Heart className="h-8 w-8 fill-current" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full border-2 border-accent/30 text-accent hover:bg-accent/10 hover:border-accent"
            onClick={() => { toast("⭐ Super Like! (Pro feature)", { description: "Upgrade to send Super Likes.", action: { label: "Upgrade", onClick: () => navigate("/pricing") } }); }}
          >
            <Star className="h-7 w-7" />
          </Button>
        </div>

        {/* Free tier banner */}
        <div className="mt-6 rounded-2xl bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">
            🔒 Free plan: {likesLeft} likes & {viewsLeft} views remaining today
          </p>
          <Button variant="link" className="text-primary text-sm" onClick={() => navigate("/pricing")}>
            Upgrade for unlimited access →
          </Button>
        </div>
      </div>

      <MatchAnimation
        show={showMatch}
        matchName={matchName}
        onSendMessage={() => { setShowMatch(false); navigate("/chat"); }}
        onKeepSwiping={() => setShowMatch(false)}
      />
    </AppLayout>
  );
}
