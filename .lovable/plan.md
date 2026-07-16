
# TikTok-style Live Sessions

Rework live from the current grid + Daily-iframe experience into a full-bleed vertical feed with a custom in-app broadcaster and viewer built on Daily's call-object (no iframe, no Daily branding).

## 1. Vertical live feed (replaces current LivePage grid)

- `LivePage.tsx` becomes a full-screen vertical pager of active live sessions.
- CSS scroll-snap container (`h-[100dvh] overflow-y-scroll snap-y snap-mandatory`), each session = one `snap-start` panel.
- Each panel renders the same `LiveRoom` view used for a direct link — video fills the screen, overlays on top.
- Only the currently-snapped panel mounts the Daily call (join on enter, leave on exit) so we never run more than 1–2 rooms at once. Adjacent panels show the thumbnail poster.
- Swipe up/down navigates between lives; pull-to-refresh stays disabled per project rules.
- Direct `/live/:sessionId` route keeps working — opens the same panel component standalone.

## 2. In-app broadcaster (host) — no Daily iframe

- Host side already has `HostBroadcaster.tsx` scaffolded with the beauty-filter canvas track. We wire it in as the host renderer inside the new live panel:
  - Full-bleed processed camera preview
  - Mic / cam toggles, beauty sheet, "End live" button
  - Top-left: host avatar + display name + LIVE badge
  - Top-right: viewer count + close button
  - Bottom: composer for pinned host messages (optional, uses existing overlay table)
- Remove the Daily-branded iframe entirely for hosts.

## 3. In-app viewer — Daily call-object with custom video tile

- New `LiveViewer.tsx`: uses `DailyIframe.createCallObject()` (audio+video off locally for viewers), joins the room with a viewer token, and renders the host's remote video track into a `<video>` element that fills the screen.
- No Daily UI chrome. Loading spinner + reconnect handling in our own styling.
- Viewers still gated by `live_passes` / host check exactly like today.

## 4. Live chat rail + floating hearts

- Right-side vertical column of scrolling chat messages (last ~30, auto-scroll, fades at top).
  - Reuses existing `live_overlay_messages` table + realtime channel we already have. Rename the visual placement from bottom-left to right-rail, TikTok-style.
  - Message row: small avatar circle + name + text bubble.
- Tap-anywhere-on-video sends a heart:
  - Realtime broadcast channel `live_reactions_${sessionId}` (Supabase Realtime broadcast — no DB write, cheap).
  - Local + remote hearts animate from bottom-right, drift up, random horizontal wobble, fade out (~2.5s).
- Bottom bar: comment input + heart button + gift button.

## 5. Viewer count, follow, gifts overlay

- **Viewer count**: derive from `live_passes` active-count already returned by `get_active_live_sessions`; also update via a lightweight realtime channel `live_presence_${sessionId}` (Supabase presence) so it moves in real time.
- **Follow host**: button next to host name in the top-left card. Uses existing `swipes` "like" as the follow signal (matches app's existing model). Hidden for the host's own panel.
- **Gifts**: reuse existing `GiftSheet.tsx` + `send_gift` RPC. Trigger from the bottom-bar gift button. On successful gift, broadcast an animated gift burst overlay to everyone via the same reactions channel.

## 6. Data / backend changes

Only additive:

- Add a Supabase Realtime broadcast channel usage — no schema change needed for hearts/gift bursts.
- Add `live_presence_${sessionId}` presence tracking on join/leave to compute a live viewer count without hammering the DB.
- Migration: enable Realtime on `live_overlay_messages` if not already (`ALTER PUBLICATION supabase_realtime ADD TABLE public.live_overlay_messages`) — verify first; skip if present.
- No new tables.

## 7. Files touched

Frontend:
- `src/pages/LivePage.tsx` — rewrite to vertical snap feed
- `src/pages/LiveRoomPage.tsx` — becomes a thin wrapper that renders one `LivePanel` for the given id
- New `src/components/live/LivePanel.tsx` — orchestrates host vs viewer rendering + all overlays
- New `src/components/live/LiveViewer.tsx` — Daily call-object viewer with custom `<video>` tile
- New `src/components/live/LiveChatRail.tsx` — right-side scrolling comments
- New `src/components/live/FloatingHearts.tsx` — heart burst animation layer
- New `src/components/live/LiveBottomBar.tsx` — comment input + heart + gift buttons
- New `src/components/live/LiveTopBar.tsx` — host card + follow + viewer count + close
- Edit `src/components/live/HostBroadcaster.tsx` — integrate with new overlays (share the same top/bottom bars via composition)
- Edit `src/pages/GoLiveSetupPage.tsx` — no behavior change; already permission-requests + starts a session

Backend:
- Migration (only if needed): enable realtime on `live_overlay_messages`.

## 8. Out of scope for this pass

- Multi-guest / co-host rooms
- Recorded replays
- Battles / PK mode
- Moderation tools inside the live (report/kick) beyond what already exists elsewhere
- Payments beyond the existing gift + live-pass flows

Ask me to add any of these as a follow-up if you want them next.
