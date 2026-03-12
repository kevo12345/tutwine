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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, targetUserId, reason, reportId, email, password, displayName, role } = body;

    let result: any = { success: true };

    switch (action) {
      case "get_stats": {
        const { count: totalUsers } = await adminClient.from("profiles").select("*", { count: "exact", head: true });
        const { count: pendingReports } = await adminClient.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending");
        const { count: subscribers } = await adminClient.from("subscriptions").select("*", { count: "exact", head: true }).neq("tier", "free").eq("status", "active");
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: recentSignups } = await adminClient.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo);
        result = { totalUsers: totalUsers ?? 0, pendingReports: pendingReports ?? 0, subscribers: subscribers ?? 0, recentSignups: recentSignups ?? 0 };
        break;
      }

      case "get_users": {
        const { data: users } = await adminClient.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
        const userIds = (users ?? []).map((u: any) => u.user_id);
        const { data: subs } = await adminClient.from("subscriptions").select("*").in("user_id", userIds).eq("status", "active");
        const { data: blockedUsers } = await adminClient.from("blocked_users").select("blocked_id");
        const blockedIds = new Set((blockedUsers ?? []).map((b: any) => b.blocked_id));
        result = (users ?? []).map((u: any) => {
          const sub = (subs ?? []).find((s: any) => s.user_id === u.user_id);
          return { ...u, tier: sub?.tier ?? "free", status: blockedIds.has(u.user_id) ? "suspended" : "active" };
        });
        break;
      }

      case "get_reports": {
        const { data: reports } = await adminClient.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
        const allUserIds = new Set<string>();
        (reports ?? []).forEach((r: any) => { allUserIds.add(r.reporter_id); allUserIds.add(r.target_user_id); });
        const { data: profiles } = await adminClient.from("profiles").select("user_id, display_name, photos").in("user_id", Array.from(allUserIds));
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        result = (reports ?? []).map((r: any) => ({
          ...r,
          reporter_name: profileMap.get(r.reporter_id)?.display_name ?? "Unknown",
          target_name: profileMap.get(r.target_user_id)?.display_name ?? "Unknown",
          target_photo: profileMap.get(r.target_user_id)?.photos?.[0] ?? null,
        }));
        break;
      }

      case "get_analytics": {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentProfiles } = await adminClient.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: true });
        const signupsByDay: Record<string, number> = {};
        (recentProfiles ?? []).forEach((p: any) => { const day = p.created_at.substring(0, 10); signupsByDay[day] = (signupsByDay[day] ?? 0) + 1; });
        const { data: allSubs } = await adminClient.from("subscriptions").select("tier, status").eq("status", "active");
        const tierCounts: Record<string, number> = {};
        (allSubs ?? []).forEach((s: any) => { tierCounts[s.tier] = (tierCounts[s.tier] ?? 0) + 1; });
        const { data: recentMatches } = await adminClient.from("matches").select("created_at").gte("created_at", thirtyDaysAgo);
        const matchesByDay: Record<string, number> = {};
        (recentMatches ?? []).forEach((m: any) => { const day = m.created_at.substring(0, 10); matchesByDay[day] = (matchesByDay[day] ?? 0) + 1; });
        result = { signupsByDay, tierCounts, matchesByDay };
        break;
      }

      case "create_user": {
        if (!email || !password) {
          return new Response(JSON.stringify({ error: "Email and password are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: displayName || email.split("@")[0] },
        });
        if (createError) throw createError;

        // Assign role if not default 'user'
        if (role && role !== "user" && newUser?.user) {
          await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });
        }

        result = { success: true, userId: newUser?.user?.id, message: `Account created for ${email}` };
        break;
      }

      case "suspend_user": {
        await adminClient.from("blocked_users").upsert({ blocker_id: caller.id, blocked_id: targetUserId });
        await adminClient.from("profiles").update({ suspended: true }).eq("user_id", targetUserId);
        result = { success: true, message: "User suspended" };
        break;
      }

      case "unsuspend_user": {
        await adminClient.from("blocked_users").delete().eq("blocked_id", targetUserId);
        await adminClient.from("profiles").update({ suspended: false }).eq("user_id", targetUserId);
        result = { success: true, message: "User unsuspended" };
        break;
      }

      case "warn_user": {
        await adminClient.from("reports").insert({
          reporter_id: caller.id, target_user_id: targetUserId,
          reason: reason ?? "Admin warning", status: "resolved", details: "Admin warning issued",
        });
        result = { success: true, message: "Warning issued" };
        break;
      }

      case "resolve_report": {
        await adminClient.from("reports").update({ status: "resolved" }).eq("id", reportId);
        result = { success: true, message: "Report resolved" };
        break;
      }

      case "dismiss_report": {
        await adminClient.from("reports").update({ status: "dismissed" }).eq("id", reportId);
        result = { success: true, message: "Report dismissed" };
        break;
      }

      case "ban_user": {
        await adminClient.from("blocked_users").upsert({ blocker_id: caller.id, blocked_id: targetUserId });
        await adminClient.from("reports").update({ status: "resolved" }).eq("target_user_id", targetUserId).eq("status", "pending");
        result = { success: true, message: "User banned" };
        break;
      }

      case "delete_user": {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "targetUserId is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Delete from auth (cascades to profiles via trigger/FK)
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (deleteError) throw deleteError;
        result = { success: true, message: "User deleted permanently" };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
