## Problem
On `/live`, next to the **Go Live** button, a banner currently says:

> Hosting a live is free.
> Joining a live costs $1.50/hr, becoming $0.35/hr after 2 hours. Pay once, broadcast until time runs out.

That pricing sits in the host-facing area and reads as if the host is being charged. Charges should only appear where a viewer taps **Join Now**.

## Change
In `src/pages/LivesPage.tsx`, simplify the banner (lines 134–145) so it only reassures the host that hosting is free. Remove the "$1.50/hr… $0.35/hr… Pay once, broadcast until time runs out" line.

New banner copy:

> **Hosting a live is free.**
> Start streaming anytime — you keep 60% of gifts sent by viewers.

Leave the existing "Start a live" dialog payout notice (60% / 10% early-end) untouched — it's about host earnings, not charges.

## What is NOT changing
- Viewer join pricing UI on `LiveViewPage` (`JoinLivePayDialog`, `TicketRemainingPill`) — that's the correct place for charge information and it stays exactly as is.
- The in-room rate/countdown on `LiveRoomPage` for viewers.
- Any backend billing logic.

## Files
- `src/pages/LivesPage.tsx` — banner text only.
