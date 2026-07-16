import { useParams, useNavigate } from "react-router-dom";
import { LivePanel } from "@/components/live/LivePanel";

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  if (!sessionId) {
    navigate("/live", { replace: true });
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-full bg-black">
      <LivePanel sessionId={sessionId} active onExit={() => navigate("/live")} />
    </div>
  );
}
