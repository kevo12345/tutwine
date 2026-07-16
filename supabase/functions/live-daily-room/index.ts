// Daily.co room provisioning for the `lives` streaming feature.
//   POST { live_id, role: "host" | "viewer" }
// - host  → creates the Daily.co room on first call, stores name/url on the
//           `lives` row, returns an owner meeting token.
// - viewer → returns a non-owner meeting token for the existing room.
// Requires an authenticated caller. Hosts must own the live; viewers must
// find a live/paused row.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAILY_BASE = "https://api.daily.co/v1";
const ROOM_TTL_SECONDS = 4 * 60 * 60; // 4h max per Daily room

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) return json({ error: "DAILY_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: userRes,
      error: uErr,
    } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (uErr || !userRes.user) return json({ error: "unauthorized" }, 401);
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const liveId: string | undefined = body.live_id;
    const role: "host" | "viewer" = body.role === "host" ? "host" : "viewer";
    if (!liveId) return json({ error: "live_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: live, error: liveErr } = await admin
      .from("lives")
      .select("id, host_id, status, daily_room_name, daily_room_url, title")
      .eq("id", liveId)
      .maybeSingle();
    if (liveErr || !live) return json({ error: "live not found" }, 404);

    // Authorization
    if (role === "host") {
      if (live.host_id !== user.id) return json({ error: "not host" }, 403);
    } else {
      if (live.status !== "live" && live.status !== "paused") {
        return json({ error: "stream not active" }, 409);
      }
    }

    // Provision room on first host call
    let roomName = live.daily_room_name;
    let roomUrl = live.daily_room_url;

    if (!roomName || !roomUrl) {
      if (role !== "host") return json({ error: "room not ready" }, 409);

      const genName = `live-${liveId.slice(0, 8)}-${Date.now()}`;
      const exp = Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS;

      const roomRes = await fetch(`${DAILY_BASE}/rooms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: genName,
          privacy: "public",
          properties: {
            exp,
            enable_chat: true,
            enable_screenshare: false,
            start_video_off: false,
            start_audio_off: false,
          },
        }),
      });
      if (!roomRes.ok) {
        const errBody = await roomRes.text();
        return json({ error: `daily room error: ${errBody}` }, 502);
      }
      const room = await roomRes.json();
      roomName = room.name;
      roomUrl = room.url;

      await admin
        .from("lives")
        .update({ daily_room_name: roomName, daily_room_url: roomUrl })
        .eq("id", liveId);
    }

    // Mint meeting token
    const exp = Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS;
    const tokRes = await fetch(`${DAILY_BASE}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          exp,
          user_id: user.id,
          user_name: user.email?.split("@")[0] ?? "Guest",
          is_owner: role === "host",
          start_video_off: role === "viewer",
          start_audio_off: role === "viewer",
        },
      }),
    });
    if (!tokRes.ok) {
      const errBody = await tokRes.text();
      return json({ error: `daily token error: ${errBody}` }, 502);
    }
    const { token } = await tokRes.json();

    return json({ roomUrl, token, roomName, role });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
