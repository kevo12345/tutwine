import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useDailyUsage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: usage } = useQuery({
    queryKey: ["daily_usage", user?.id, today],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("daily_usage")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      return data ?? { profile_views: 0, likes_count: 0, boosts_count: 0 };
    },
    enabled: !!user,
  });

  const increment = useMutation({
    mutationFn: async (field: "profile_views" | "likes_count" | "boosts_count") => {
      if (!user) return;
      const current = usage ?? { profile_views: 0, likes_count: 0, boosts_count: 0 };
      const newVal = ((current as any)[field] ?? 0) + 1;

      await supabase.from("daily_usage").upsert(
        { user_id: user.id, date: today, [field]: newVal },
        { onConflict: "user_id,date" }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily_usage"] }),
  });

  return { usage, increment };
}
