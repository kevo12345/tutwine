## Go Live & Join Live

Replace the existing "Boost" feature with a live-streaming feature where users either **broadcast** ("Go Live") or **watch** ("Join Live"). Both sides pay per session.

### Pricing (pay-per-session, in hours)

- Hour 1: **$1.50**
- Hour 2: **$1.50** (total $3.00)
- Hour 3 and onward: **$0.35/hr**

Examples: 1h = $1.50 · 2h = $3.00 · 3h = $3.35 · 5h = $4.05.

Users pick a duration (1, 2, 3, 5, or 10 hours). Same price table for going live and for joining a stream. Payment is upfront; access expires automatically when the paid time ends.

### User experience

- **Go Live page** (`/live`)
  - Top: "Go Live" CTA. Picks duration → pays → a Daily.co room is created → user becomes the broadcaster.
  - Below: a real-time feed of currently active broadcasts (host name, photo, viewer count, time left). Each card has a **Join Live** button that prompts the viewer to pay for their own time window before entering.
- **In-call**: reuses the existing `VideoCall` component (Daily.co iframe). Broadcaster sees their stream + chat; viewers join muted-by-default with video off. When the timer hits zero, the client kicks them out and the room is closed.
- **Suggestions**
  - A bottom-sheet banner on Discover, Likes, and Chat pages: "3 users are live now — Join Live" (only shown when ≥1 stream is active).
  - A subtle pulse on the Live nav icon when streams are active.
  - One-time daily toast nudging users to try Go Live themselves.
- **Notifications**: realtime toast when a profile the user has matched with goes live ("Alex just went live — Join now").

### Replacing Boost

Fully removed from UI, pricing page, FAQ, landing page, bottom nav, and admin analytics. The `boost` constants/tiers are deleted. The Bottom Nav slot Boost occupied is replaced by a **Live** tab with a small red dot when streams are active.

### Technical design

**New tables**

- `live_sessions` — `id, host_id, daily_room_url, daily_room_name, duration_hours, amount_paid_usd, currency, provider (sellapay|nowpayments), provider_ref, status (pending_payment|active|ended|expired), started_at, expires_at, created_at`. RLS: anyone can SELECT active sessions; only host (or service role) can write.
- `live_passes` — `id, session_id, viewer_id, duration_hours, amount_paid_usd, currency, provider, provider_ref, status, started_at, expires_at, created_at`. RLS: viewer reads/writes own; service role full. Realtime enabled on both tables so the live feed and viewer counts update without polling.
- Both tables added to `supabase_realtime` publication.

**New edge functions**

- `live-create-payment` — input `{ kind: 'host'|'viewer', session_id?, duration_hours, provider, phone?|pay_currency? }`. Computes price from the table above. Inserts a `pending_payment` row in `live_sessions` or `live_passes`. Calls existing `sellapay-stk-push` or `nowpayments-create-payment` logic (refactor shared helpers into `_shared/payments.ts`) and stores the provider reference.
- Existing **`sellapay-callback`** and **`nowpayments-callback`** are extended: when the callback's `order_id` matches a `live_sessions.id` or `live_passes.id`, they activate that row (set `status=active`, `started_at=now()`, `expires_at=now()+duration`) and — for a host activation — call **`create-daily-room`** to provision the Daily room with `exp` set to `expires_at` and write `daily_room_url/name` back.
- `live-expire-sweeper` — cron-style edge function (every 5 min) that flips expired rows to `ended` and deletes the Daily room. Acts as a safety net; the primary expiry mechanism is Daily's `exp` parameter on the room itself.

**Frontend**

- New `src/pages/LivePage.tsx` (feed + Go Live CTA + duration picker sheet + payment sheet reusing pricing patterns).
- New `src/pages/LiveRoomPage.tsx` that mounts `VideoCall` with the session's Daily room URL, shows a countdown, auto-exits at zero.
- New `src/hooks/useActiveLiveSessions.ts` — realtime subscription to `live_sessions` where `status='active' AND expires_at > now()`.
- New `src/components/LiveSuggestionBanner.tsx` shown on Discover/Likes/Chat when streams are active.
- `BottomNav.tsx`: Boost slot → Live tab with active-stream dot.
- `PricingPage.tsx`, `LandingPage.tsx`, `FaqPage.tsx`: Boost copy replaced with Go Live copy and pricing table.
- `constants.ts`: drop boost tiers; add `LIVE_DURATION_OPTIONS` and `priceForLiveHours(hours)` helper.

**Removed**

- All `boost`-related entries in `src/lib/constants.ts`, `BottomNav.tsx`, `PricingPage.tsx`, `LandingPage.tsx`, `FaqPage.tsx`, `ProfilePage.tsx`, admin analytics tiles, and the 2026-03-06 migration's boost columns (kept in DB; just no longer read).

### Edge cases handled

- Browser tab closed mid-stream: host's `expires_at` still ticks; sweeper closes the room.
- Viewer pays for 1h but host stream ends at 30 min: viewer is refunded on the client side via a `status='ended_early'` flag and a manual-refund admin tile (no automatic refunds in v1; flagged for follow-up).
- Two payments race for the same host: unique partial index on `live_sessions (host_id) WHERE status IN ('pending_payment','active')`.
- M-Pesa amount must be whole KES: convert USD via existing `region_pricing` rate and round up; show the KES amount before confirming.

### Out of scope for v1

- Recording/replay, tipping inside the stream, gifts, multi-host streams, scheduled streams, public web sharing of a stream. Can be added later on top of the same `live_sessions` table.
