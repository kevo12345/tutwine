import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatchAnimationProps {
  show: boolean;
  matchName: string;
  onSendMessage: () => void;
  onKeepSwiping: () => void;
}

export function MatchAnimation({ show, matchName, onSendMessage, onKeepSwiping }: MatchAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="flex flex-col items-center gap-6 p-8 text-center"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="gradient-warm rounded-full p-6"
              >
                <Heart className="h-16 w-16 text-primary-foreground fill-primary-foreground" />
              </motion.div>
              <div className="absolute inset-0 animate-pulse-ring rounded-full gradient-warm opacity-40" />
            </div>
            <div>
              <h2 className="font-display text-4xl font-bold text-primary-foreground">
                It's a Match!
              </h2>
              <p className="mt-2 text-lg text-primary-foreground/80">
                You and {matchName} liked each other
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={onSendMessage} className="gradient-warm border-0 text-primary-foreground shadow-glow">
                Send a Message
              </Button>
              <Button variant="outline" onClick={onKeepSwiping} className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Keep Swiping
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
