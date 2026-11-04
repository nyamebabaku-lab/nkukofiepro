# PoultryPro — Poultry Farm Management

A web app for running several poultry farms (layers, broilers, hatchery, turkeys, guinea fowl, ducks) plus a customer shop for booking eggs, birds, meat, chicks, drugs and feed. It runs in any browser and installs on iOS, Android and desktop as an app (PWA).

**Live:** https://nyamebabaku-lab.github.io/poultrypro/

## Demo logins (password `demo123`)

| Role | Email | Sees |
|---|---|---|
| Owner | owner@poultrypro.app | Everything: all farms, finance, wallet, payroll, settings |
| Farm manager | akosua@poultrypro.app | Dodowa & Kasoa farms, sales, customers, staff, reports |
| Worker | kojo@poultrypro.app | Daily records, tasks, attendance, vaccinations |
| Customer | kofi@demo.com | Shop, bookings, balance, paying debts |

- Wallet PIN: `1234`
- Demo payments: a MoMo number ending in `000` or a card ending in `0002` is declined.
- Clock-in code for Dodowa: shown on the Farms page.

## What's inside

- **Farms & pens**: multiple sites, house capacity, clock-in codes
- **Flocks**: live counts, age, laying % and growth vs breed standard, FCR, cost per bird
- **Daily records**: eggs by size, feed and water, deaths/culls, weights, house temperature and humidity (two-tap "Quick log" on phones)
- **Health**: vaccination schedules created automatically per flock, a calendar, treatments, and drug withdrawal periods that warn the shop
- **Hatchery**: incubation batches, candling, hatch rate, chicks go to shop stock or a new flock
- **Inventory**: feed, vaccines, drugs, packaging and equipment per farm, reorder alerts, transfers, suppliers
- **Sales**: point of sale, bookings, pick-up calendar, receipts/invoices, WhatsApp sharing
- **Customers & debts**: deposit + balance, debt ageing, SMS reminders, statements
- **Finance & wallet**: profit & loss per farm, expenses, wallet, cash on hand, withdrawals to MoMo/bank
- **Staff**: tasks & checklists, attendance, payroll with SSNIT and advances, equipment & repairs
- **Reports**: eggs, mortality, feed, sales, vaccination compliance, CSV export
- **Customer shop**: browse, choose farm and pick-up day, pay deposit or in full with MoMo/card or cash at the farm

## Android app

Download: https://github.com/nyamebabaku-lab/poultrypro/releases/latest/download/PoultryPro.apk

Every push to `main` builds a signed APK (and a Play Store `.aab`) with Capacitor in GitHub Actions (`.github/workflows/android.yml`) and attaches it to a new GitHub release. The upload signing key is stored in the repository secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`); keep an offline backup of it, as Google Play updates need the same key. App icon and splash sources are in `assets/` and `public/hero/`.

## Run it locally

```bash
npm install
npm run dev
```

## This version vs phase 2

This first version keeps data **in the browser** (each device has its own copy; use Settings → Backup) and **simulates** MoMo, card and SMS. Phase 2 adds a Supabase backend (shared data, real logins), real Paystack/Hubtel payments and payouts, real SMS, and App Store / Play Store builds. Data access goes through `src/data/store.js` and payments through `src/lib/payments.js`; those are the two places to change.
