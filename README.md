# Tutwine

Build a full‑stack dating web app (mobile‑first) called “PulseMatch” that lets users create accounts, upload photos, show approximate location, discover other members, and chat in real time. Must support free and paid membership tiers with subscription packages priced from $3, $5, and $10 (and equivalents in local currencies depending on the user’s state/region). Free mode must limit profile views and certain actions.

1) Core goals
- Safe, modern dating app UX.
- Location-aware discovery (approximate distance, no precise address shown).
- In-app 1:1 chat between matched/connected users.
- Subscription billing with localized currency and price mapping.

2) User roles
- Guest (not logged in): can view marketing/landing pages only.
- Member (free): limited profile views and limited likes/messages.
- Member (paid): expanded limits depending on tier.
- Admin: manage users, reports, subscriptions, settings.

3) Required features
A. Authentication & Profiles
- Email + password signup/login, plus optional Google/Apple sign-in if available.
- Mandatory age gate: users must confirm they are 18+ to register.
- Profile fields: display name, age, gender, interested-in, bio, interests/tags, photos (up to 6), verification badge (optional), preferred distance, state/region selection.
- Photo upload with moderation flags (basic nudity/abuse detection placeholder + admin review queue).
- Privacy settings: hide/show state, hide distance, block user, remove account.

B. Location
- Ask user permission for approximate location; if denied, allow manual state/region selection.
- Store: country, state/region, city (optional), and approximate lat/lng (rounded/geohash). Never display exact coordinates.
- Discovery shows distance ranges (e.g., “within 5 km”, “within 20 km”).

C. Discovery & Matching
- Swipe/stack UI: like/pass.
- Match occurs when both like each other.
- Filters: age range, distance, gender preference, interests.
- Limitations in Free mode:
  - Profile views/day capped (configurable; default 20/day).
  - Likes/day capped (default 10/day).
  - Can only message after a match.
- Paid tiers expand these limits:
  - Tier Basic ($3): profile views 100/day, likes 50/day.
  - Tier Plus ($5): unlimited views, likes 200/day, one “boost”/week.
  - Tier Pro ($10): unlimited views/likes, daily boost, see who liked you.

D. Chat
- 1:1 chat only between matched users.
- Real-time updates (websockets or realtime DB).
- Message types: text, emoji, image (optional).
- Read receipts, typing indicator (nice-to-have).
- Safety: block/report from chat.

E. Subscription & Payments
- Subscription packages: Basic (3), Plus (5), Pro (10) USD base.
- Currency and pricing adapt based on user location (state/region + country):
  - Use a pricing table per country/state with currency code and converted prices.
  - Default conversion from USD using stored exchange rates (admin-editable), and allow overriding prices per region.
- Billing provider: Stripe (preferred) with Checkout/subscriptions; fallback stub if not available.
- Free trial: optional config (default none).
- Upgrade/downgrade/cancel flows with immediate UI updates.

F. Admin dashboard
- Users list, profile review, photo moderation queue.
- Reports: reported users/messages with actions (warn, suspend, ban).
- Subscription management: view status, refunds link (if supported), region pricing table editor.
- Content settings: daily limits per tier.

4) Pages / Routes
- Landing page (pricing, safety, how it works)
- Auth: login/signup/forgot password
- Onboarding: age gate, profile setup, photo upload, interests, location permissions
- Discovery (swipe)
- Matches (list)
- Chat (thread)
- Profile (view/edit)
- Settings (privacy, notifications, subscription)
- Pricing/Upgrade
- Admin (protected)

5) Data model (minimum)
- users: id, email, password_hash, created_at, role
- profiles: user_id, display_name, dob_or_age, gender, interested_in, bio, interests[], photos[], verified, country, state, city, geohash/rounded_latlng, prefs(distance, age_range)
- swipes: id, swiper_id, target_id, action(like/pass), created_at
- matches: id, user_a, user_b, created_at
- messages: id, match_id, sender_id, type, content, created_at, read_at
- subscriptions: id, user_id, tier, status, provider, provider_sub_id, currency, price, started_at, ends_at
- reports: id, reporter_id, target_user_id, reason, details, status, created_at
- region_pricing: id, country, state(optional), currency, basic_price, plus_price, pro_price, updated_at

6) Technical requirements
- Use a modern stack with auth, database, and realtime chat.
- Ensure secure storage, input validation, rate limiting, and basic anti-spam.
- Store images in object storage with signed URLs.
- Implement daily usage counters to enforce free/paid limits.
- Make UI mobile-first, clean, and modern.

7) UX / Design
- Brand: warm, modern, minimal.
- Use clear CTAs and a pricing card layout.
- Show “limited on free plan” gently with upgrade prompts.

8) Safety & compliance
- 18+ only; include Terms, Privacy Policy placeholders.
- Reporting & blocking required.
- Do not show precise user locations.

Deliverables
- Working app with seeded demo users (optional).
- Admin login credentials in env/config.
- Clear README for local dev + deployment.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tutwine.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/360adade-e28d-415a-a234-af87562af5ff).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
