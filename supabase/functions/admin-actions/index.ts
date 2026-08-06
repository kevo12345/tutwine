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

    const body = await req.json();
    const { action, targetUserId, reason, reportId, email, password, displayName, role } = body;

    // Allow self-deletion without admin role
    if (action === "delete_own_account") {
      const { error: selfDeleteError } = await adminClient.auth.admin.deleteUser(caller.id);
      if (selfDeleteError) throw selfDeleteError;
      return new Response(JSON.stringify({ success: true, message: "Account deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require admin role
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

    let result: any = { success: true };

    switch (action) {
      case "get_stats": {
        const now = Date.now();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

        const head = (table: string) => adminClient.from(table).select("*", { count: "exact", head: true });

        const [
          usersRes, reportsRes, subsRes, recentRes, onlineRes, liveRes,
          purchasesRes, giftsRes, ticketsRes, passesRes, matchesRes,
          profileMoneyRes, sessionMoneyRes, livesMoneyRes, signupSeriesRes, purchaseSeriesRes, tiersRes, withdrawalsRes,
          presenceRes, sessionListRes, passListRes,
        ] = await Promise.all([
          head("profiles"),
          head("reports").eq("status", "pending"),
          adminClient.from("subscriptions").select("*", { count: "exact", head: true }).neq("tier", "free").eq("status", "active"),
          adminClient.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
          adminClient.from("user_presence").select("*", { count: "exact", head: true }).eq("is_online", true),
          adminClient.from("live_sessions").select("*", { count: "exact", head: true }).eq("status", "active"),
          adminClient.from("token_transactions").select("amount").eq("type", "purchase").eq("status", "completed"),
          adminClient.from("gifts").select("token_amount"),
          head("live_tickets"),
          head("live_passes"),
          head("matches"),
          adminClient.from("profiles").select("available_earnings, pending_withdrawals, total_lifetime_earnings, token_balance"),
          adminClient.from("live_sessions").select("platform_earning, host_earning"),
          adminClient.from("lives").select("platform_earning, host_earning"),
          adminClient.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo),
          adminClient.from("token_transactions").select("amount, created_at, type, status").gte("created_at", thirtyDaysAgo),
          adminClient.from("subscriptions").select("tier").eq("status", "active"),
          adminClient.from("withdrawals").select("amount, status"),
          adminClient.from("user_presence").select("last_seen_at"),
          adminClient.from("live_sessions").select("id, host_id, status, started_at, ended_at, created_at").gte("created_at", thirtyDaysAgo),
          adminClient.from("live_passes").select("session_id, viewer_id, created_at, expires_at").gte("created_at", thirtyDaysAgo),
        ]);


        const sum = (rows: any[] | null, key: string) =>
          (rows ?? []).reduce((acc: number, r: any) => acc + Number(r[key] ?? 0), 0);

        const days: string[] = [];
        for (let i = 29; i >= 0; i--) {
          days.push(new Date(now - i * 24 * 60 * 60 * 1000).toISOString().substring(0, 10));
        }
        const signupMap: Record<string, number> = {};
        (signupSeriesRes.data ?? []).forEach((p: any) => {
          const d = String(p.created_at).substring(0, 10);
          signupMap[d] = (signupMap[d] ?? 0) + 1;
        });
        const revenueMap: Record<string, number> = {};
        (purchaseSeriesRes.data ?? []).forEach((t: any) => {
          if (t.type !== "purchase" || t.status !== "completed") return;
          const d = String(t.created_at).substring(0, 10);
          revenueMap[d] = (revenueMap[d] ?? 0) + Number(t.amount ?? 0);
        });

        const tierCounts: Record<string, number> = {};
        (tiersRes.data ?? []).forEach((s: any) => { tierCounts[s.tier] = (tierCounts[s.tier] ?? 0) + 1; });

        // ---- Signup growth ----
        const today = new Date(now).toISOString().substring(0, 10);
        const yesterday = new Date(now - 86400000).toISOString().substring(0, 10);
        const signupsToday = signupMap[today] ?? 0;
        const signupsYesterday = signupMap[yesterday] ?? 0;
        const last7 = days.slice(-7).reduce((a, d) => a + (signupMap[d] ?? 0), 0);
        const prev7 = days.slice(-14, -7).reduce((a, d) => a + (signupMap[d] ?? 0), 0);
        const signupGrowthPct = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round(((last7 - prev7) / prev7) * 100);
        // Cumulative total users across the window (running total, ending at totalUsers)
        const totalUsers = usersRes.count ?? 0;
        const signupsWindow = days.reduce((a, d) => a + (signupMap[d] ?? 0), 0);
        let running = totalUsers - signupsWindow;

        // ---- Active users (presence based) ----
        const seen = (presenceRes.data ?? []).map((p: any) => new Date(p.last_seen_at).getTime());
        const activeSince = (ms: number) => seen.filter((t) => t >= now - ms).length;
        const dau = activeSince(86400000);
        const wau = activeSince(7 * 86400000);
        const mau = activeSince(30 * 86400000);

        // ---- Active users per live session ----
        const passesBySession = new Map<string, { viewers: Set<string>; active: Set<string> }>();
        (passListRes.data ?? []).forEach((p: any) => {
          const rec = passesBySession.get(p.session_id) ?? { viewers: new Set(), active: new Set() };
          rec.viewers.add(p.viewer_id);
          if (p.expires_at && new Date(p.expires_at).getTime() > now) rec.active.add(p.viewer_id);
          passesBySession.set(p.session_id, rec);
        });
        const sessionRows = (sessionListRes.data ?? []).map((s: any) => {
          const rec = passesBySession.get(s.id);
          const start = s.started_at ?? s.created_at;
          const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
          return {
            id: s.id,
            status: s.status,
            startedAt: start,
            minutes: Math.max(0, Math.round((end - new Date(start).getTime()) / 60000)),
            viewers: rec ? rec.viewers.size : 0,
            activeViewers: rec ? rec.active.size : 0,
          };
        });
        const sessionsWithViewers = sessionRows.filter((s) => s.viewers > 0);
        const avgViewersPerSession = sessionsWithViewers.length
          ? Number((sessionsWithViewers.reduce((a, s) => a + s.viewers, 0) / sessionsWithViewers.length).toFixed(1))
          : 0;
        const activeSessions = sessionRows
          .filter((s) => s.status === "active")
          .sort((a, b) => b.activeViewers - a.activeViewers)
          .slice(0, 8);
        const sessionActivity = sessionRows
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          .slice(0, 12)
          .reverse()
          .map((s, i) => ({
            label: `S${i + 1}`,
            startedAt: s.startedAt,
            viewers: s.viewers,
            activeViewers: s.activeViewers,
            minutes: s.minutes,
          }));

        result = {
          totalUsers,
          pendingReports: reportsRes.count ?? 0,
          subscribers: subsRes.count ?? 0,
          recentSignups: recentRes.count ?? 0,
          onlineNow: onlineRes.count ?? 0,
          liveNow: liveRes.count ?? 0,
          totalMatches: matchesRes.count ?? 0,
          ticketsSold: (ticketsRes.count ?? 0) + (passesRes.count ?? 0),
          giftsSent: (giftsRes.data ?? []).length,
          giftTokens: sum(giftsRes.data, "token_amount"),
          tokensSold: sum(purchasesRes.data, "amount"),
          platformEarnings: sum(sessionMoneyRes.data, "platform_earning") + sum(livesMoneyRes.data, "platform_earning"),
          hostEarnings: sum(sessionMoneyRes.data, "host_earning") + sum(livesMoneyRes.data, "host_earning"),
          availableEarnings: sum(profileMoneyRes.data, "available_earnings"),
          lifetimeEarnings: sum(profileMoneyRes.data, "total_lifetime_earnings"),
          coinsInCirculation: sum(profileMoneyRes.data, "token_balance"),
          pendingWithdrawalCount: (withdrawalsRes.data ?? []).filter((w: any) => w.status === "pending").length,
          pendingWithdrawalTokens: (withdrawalsRes.data ?? [])
            .filter((w: any) => w.status === "pending")
            .reduce((a: number, w: any) => a + Number(w.amount ?? 0), 0),
          paidWithdrawalTokens: (withdrawalsRes.data ?? [])
            .filter((w: any) => w.status === "paid")
            .reduce((a: number, w: any) => a + Number(w.amount ?? 0), 0),
          tierCounts,
          signupsToday,
          signupsYesterday,
          signupGrowthPct,
          dau,
          wau,
          mau,
          avgViewersPerSession,
          activeSessions,
          sessionActivity,
          series: days.map((d) => {
            const s = signupMap[d] ?? 0;
            running += s;
            return {
              date: d,
              signups: s,
              cumulativeUsers: running,
              revenue: Number((revenueMap[d] ?? 0).toFixed(2)),
            };
          }),
        };

        break;
      }

      case "get_users": {
        const { data: users } = await adminClient.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000);
        const userIds = (users ?? []).map((u: any) => u.user_id);
        const { data: subs } = await adminClient.from("subscriptions").select("*").in("user_id", userIds).eq("status", "active");
        const { data: blockedUsers } = await adminClient.from("blocked_users").select("blocked_id");
        const blockedIds = new Set((blockedUsers ?? []).map((b: any) => b.blocked_id));

        // Emails live in auth.users — page through the admin list API.
        const emailMap = new Map<string, string>();
        const confirmedMap = new Map<string, string | null>();
        const lastSignInMap = new Map<string, string | null>();
        for (let page = 1; page <= 20; page++) {
          const { data: authPage, error: authErr } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
          if (authErr) break;
          const list = authPage?.users ?? [];
          list.forEach((au: any) => {
            if (au.email) emailMap.set(au.id, au.email);
            confirmedMap.set(au.id, au.email_confirmed_at ?? null);
            lastSignInMap.set(au.id, au.last_sign_in_at ?? null);
          });
          if (list.length < 1000) break;
        }

        result = (users ?? []).map((u: any) => {
          const sub = (subs ?? []).find((s: any) => s.user_id === u.user_id);
          return {
            ...u,
            email: emailMap.get(u.user_id) ?? null,
            email_confirmed_at: confirmedMap.get(u.user_id) ?? null,
            last_sign_in_at: lastSignInMap.get(u.user_id) ?? null,
            tier: sub?.tier ?? "free",
            status: blockedIds.has(u.user_id) ? "suspended" : "active",
            onboarding_complete: u.onboarding_complete ?? false,
            onboarding_step: u.onboarding_step ?? 0,
          };
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
        await adminClient.from("profiles").update({ suspended: true }).eq("user_id", targetUserId);
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
