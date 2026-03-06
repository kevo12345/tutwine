import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { matchId } = await req.json();
    if (!matchId) throw new Error("matchId is required");

    // Verify user is part of this match
    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (!match || (match.user_a !== user.id && match.user_b !== user.id)) {
      throw new Error("Not authorized for this match");
    }

    // Verify user has Pro subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("tier", "pro")
      .maybeSingle();

    if (!subscription) {
      return new Response(
        JSON.stringify({ error: "Video chat requires a Pro subscription" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a Daily.co room with expiry (1 hour)
    const roomName = `match-${matchId}-${Date.now()}`;
    const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp,
          max_participants: 2,
          enable_chat: false,
          enable_screenshare: false,
        },
      }),
    });

    if (!dailyRes.ok) {
      const err = await dailyRes.text();
      throw new Error(`Daily API error [${dailyRes.status}]: ${err}`);
    }

    const room = await dailyRes.json();

    // Create a meeting token for the user
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          exp,
          user_name: user.email?.split("@")[0] ?? "User",
          is_owner: false,
        },
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Daily token error [${tokenRes.status}]: ${err}`);
    }

    const { token } = await tokenRes.json();

    return new Response(
      JSON.stringify({ roomUrl: room.url, token }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating Daily room:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
