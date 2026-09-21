# Digital Heroes

Digital Heroes is a purpose-led monthly draw for golfers. Members add Stableford scores, choose a charity, and participate in a transparent 3/4/5-number draw. The product puts community impact beside the competition.

## What is included

- Responsive public site with impact-led home, how-it-works and charity directory pages
- Signup/login flow with persistent local demo session and admin demo route
- Subscriber dashboard for membership state, score history, five-score rolling window, charity selection and contribution percentage
- Score validation: Stableford 1-45, required date, one score per date, newest five retained
- Random and score-weighted algorithmic draw number generation
- Admin hub with overview, members, charities, reports and non-publishing draw simulation
- Prize allocation at 40% for 5-match, 35% for 4-match and 25% for 3-match, including equal winner splits and jackpot rollover logic
- Supabase SQL migration with relational schema, RLS, private winner-proof storage policies and seed plans
- Vercel SPA rewrite and environment template
- Vitest coverage for the core score, charity, draw and prize rules

## Stack and architecture

React + Vite + TypeScript provides the client. `src/domain.ts` contains pure business rules and is deliberately independent of React. `src/store.tsx` is a small persistence boundary: it uses localStorage for a zero-credential demo and can be replaced by Supabase queries without moving business logic into components. `src/supabase.ts` only creates a client when public Vite variables exist; service-role and Stripe secret values are never read by the browser.

Production payment checkout and webhook handling should live in a Supabase Edge Function or separate server endpoint. This repository keeps that boundary explicit rather than pretending a client-only Stripe integration is secure.

## Local setup

```bash
npm install
npm run dev
```

Open the URL printed by Vite. For the local demo, any non-empty email and password work. An email containing `admin` enters the admin demo route. This is intentionally a demo convenience, not production authentication.

Run checks:

```bash
npm test
npm run build
```

## Supabase setup

1. Create a new Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL editor or through the Supabase CLI.
3. Enable email auth and set the site URL to the Vercel URL.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to local/Vercel environment variables.
5. Promote an account to admin only from a trusted SQL session: `update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';`.
6. Use the private `winner-proofs` bucket created by the migration. Never make it public.

## Stripe test setup

Create monthly and yearly prices in Stripe test mode. Put only the publishable key in `VITE_STRIPE_PUBLISHABLE_KEY`. Put `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` only in a server-side Edge Function environment. The server endpoint should create Checkout sessions, verify webhook signatures, and update `subscriptions`; the browser must never accept subscription status as truth.

## Deployment

```bash
npm run build
npx vercel --prod
```

Configure the same public Vite variables in Vercel and configure the Supabase Auth redirect URL. A live URL cannot be claimed from this workspace because no Vercel account or Supabase/Stripe credentials were supplied.

## Data model

`profiles` owns roles; `subscription_plans` and `subscriptions` represent billing; `scores` has a per-user/date unique constraint; `charities` and `charity_selections` represent impact preferences; `draws` and `draw_participants` store immutable draw entries; `winners`, `winner_proofs` and `payouts` model verification; `donations` keeps independent donations separate from subscription contributions.

## Business decisions

- A monthly membership is £12 and yearly is £120 in the demo/schema seed.
- The minimum charity contribution is 10% of the actual plan amount and can be raised to 100%.
- Algorithmic draw mode weights numbers from member Stableford scores while preserving uniqueness. Random mode samples 1-45.
- When a 5-match tier is unclaimed, its allocation is carried into the next jackpot. A draw is unique by month in PostgreSQL, preventing duplicate publishing.
- Winner proof paths are private and scoped to the authenticated winner; admins can review them through storage RLS.

## Compliance and limitations

The core product and rules are implemented and locally testable. Real Supabase persistence, Stripe Checkout/webhooks, proof upload UI, payout provider integration, and live deployment require the external credentials and Edge Function/server endpoints described above. They are not fabricated in this local workspace. The SQL/RLS migration is the production foundation for those integrations.
