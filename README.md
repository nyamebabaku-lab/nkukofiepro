# Nkukɔ Fie Pro — Poultry Farm Management

A web app for running several poultry farms (layers, broilers, hatchery, turkeys, guinea fowl, ducks) plus a customer shop for booking eggs, birds, meat, chicks, drugs and feed. It runs in any browser and installs on iOS, Android and desktop as an app (PWA).

**Live:** https://nyamebabaku-lab.github.io/nkukofiepro/

## Demo logins (password `demo123`)

| Role | Email | Sees |
|---|---|---|
| Owner | owner@nkukofie.app | Everything: all farms, finance, wallet, payroll, settings |
| Farm manager | akosua@nkukofie.app | Dodowa & Kasoa farms, sales, customers, staff, reports |
| Worker | kojo@nkukofie.app | Daily records, tasks, attendance, vaccinations |
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

## Apps and links

| App | Who | Web | Android |
|---|---|---|---|
| **Nkukɔ Fie Pro** | Customers | https://nyamebabaku-lab.github.io/nkukofiepro/ | [NkukoFiePro.apk](https://github.com/nyamebabaku-lab/nkukofiepro/releases/latest/download/NkukoFiePro.apk) |
| **Nkukɔ Fie Pro Farm** | Farm owners, managers, workers | https://nyamebabaku-lab.github.io/nkukofiepro/farm/ | [NkukoFiePro-Farm.apk](https://github.com/nyamebabaku-lab/nkukofiepro/releases/latest/download/NkukoFiePro-Farm.apk) |
| **Nkukɔ Fie Pro Admin** | Platform super admin | https://nyamebabaku-lab.github.io/nkukofiepro/admin/ | [NkukoFiePro-Admin.apk](https://github.com/nyamebabaku-lab/nkukofiepro/releases/latest/download/NkukoFiePro-Admin.apk) |
| Demo | Anyone (sample farm) | https://nyamebabaku-lab.github.io/nkukofiepro/demo/ | — |

QR-friendly download pages: `/get/`, `/get-farm/`, `/get-admin/` (Android → APK, iPhone/computer → web app).

**Branding.** The super admin changes the app name and logo in Admin → Platform → Branding (stored in `platform_settings`). Each farm owner uploads their farm logo in Farm → Settings (stored on `businesses.logo`); it shows in the farm app, the customer shop and on receipts. Installed APKs keep the name and icon they were built with.

**Android builds.** Every push to `main` builds three signed APKs plus Play Store `.aab` files with Capacitor (`.github/workflows/android.yml`; `capacitor.config.ts` picks the app with `APP=main|farm|admin`; projects in `android/`, `android-farm/`, `android-admin/`). The upload key is in the repository secrets; keep the offline backup safe.

## SMS (mNotify)

Real SMS go through the `send-sms` Supabase Edge Function, so the mNotify API key never ships in the apps. Put the key and the approved sender ID in `supabase/functions/.env` (git-ignored; see `.env.example`), sign in once with `npx supabase@2.54.11 login`, then run `npm run sms:setup` to store the secrets and deploy the function. Each farm business can send up to `MNOTIFY_DAILY_LIMIT` SMS a day; customers can only be texted on their own number. Sent messages are logged in `public.sms_log` (Platform → Data → SMS in Nkukɔ Fie Pro Admin).

## Run it locally

```bash
npm install
npm run dev
```

## This version vs phase 2

This first version keeps data **in the browser** (each device has its own copy; use Settings → Backup) and **simulates** MoMo, card and SMS. Phase 2 adds a Supabase backend (shared data, real logins), real Paystack/Hubtel payments and payouts, real SMS, and App Store / Play Store builds. Data access goes through `src/data/store.js` and payments through `src/lib/payments.js`; those are the two places to change.
