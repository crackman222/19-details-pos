# Nineteen Details POS — Claude Code Instructions

## Project overview
A point-of-sale web app for Nineteen Details, a car/motorcycle wash and detailing
service business in Indonesia. It replaces a manual process of WhatsApp group
reporting and handwritten receipts. Staff use it to record completed service
treatments and view digital receipts.

## What this system does
1. Staff opens the app — sees a list of active staff names
2. Staff taps their name and enters their 6-digit PIN
3. Staff creates a treatment — vehicle plate, services rendered, payment method
4. App saves the treatment and displays a digital receipt
5. Staff closes the treatment

That is the entire scope. No payment processing, no booking system, no inventory.

## Tech stack
- Frontend: React + Vite (JSX — not TypeScript, do not introduce TSX or TS files)
- Backend: Supabase (auth + database + auto-generated API)
- Database: PostgreSQL via Supabase
- Styling: CSS (existing app.css and index.css — expand, do not replace)
- Hosting: Vercel

## Language
All user-facing text, labels, button names, placeholder text, and error messages
must be in Indonesian (Bahasa Indonesia).
Code — variable names, function names, comments — stays in English.

---

## Project structure

### Current (already exists — do not recreate these files)
```
src/
├── lib/
│   └── supabase.jsx        # Supabase client — already working
├── app.css                 # Global styles
├── app.jsx                 # Root component
├── index.css               # Base styles
└── main.jsx                # Entry point
```

### Target (expand into this)
```
src/
├── lib/
│   └── supabase.jsx        # Already exists
├── api/
│   ├── index.js            # Barrel export
│   ├── auth.js             # login, logout, getCurrentProfile
│   ├── services.js         # getActiveServices
│   └── treatments.js       # createTreatment, closeTreatment, voidTreatment, search
├── components/             # Reusable UI components
├── pages/                  # One file per screen
├── app.css
├── app.jsx
├── index.css
└── main.jsx
```

---

## Database schema

These tables already exist in Supabase. Do not recreate or alter them
unless a migration file explicitly says to.

### `profiles`
Linked to Supabase auth.users via id (profiles.id IS the auth UUID).
- id uuid PK (FK → auth.users.id)
- full_name text
- role text (default: 'staff')
- created_at timestamptz

### `services`
The menu of available wash/detailing services.
- id bigint PK
- name text
- price numeric

### `treatments`
One row per vehicle visit. Core entity of the system.
- id bigint PK
- treatment_code text UNIQUE
- customer_name text
- plate_number text
- treatment_type text
- pic text
- status text (default: 'created')
- notes text
- subtotal numeric
- discount numeric
- total numeric
- created_at timestamptz
- updated_at timestamptz

### `treatment_items`
Itemized services per treatment. Added via migration 004.
- id bigint PK
- treatment_id bigint FK → treatments.id
- service_name text (snapshot — not a live FK to services.name)
- unit_price numeric (snapshot — not a live FK to services.price)
- quantity int
- subtotal numeric
- created_at timestamptz

### `payments`
One row per payment, linked to a treatment.
- id bigint PK
- treatment_id bigint FK → treatments.id
- amount numeric
- payment_method text (cash | qris | transfer)
- proof_url text
- paid_at timestamptz

### `photos`
Vehicle/payment photos linked to a treatment. Not yet used in the UI.
- id bigint PK
- treatment_id bigint FK → treatments.id
- image_url text
- photo_type text
- uploaded_at timestamptz

### `treatment_logs`
Audit log for status changes. Write to this on every status change.
- id bigint PK
- treatment_id bigint FK → treatments.id
- action text
- created_at timestamptz

### `treatment_summary` (view)
Joins treatments + profiles + payments + treatment_items into one query.
Use this for the receipt screen and treatment history list.

---

## Auth — name picker + PIN

### Flow
1. App loads → fetch all active profiles → display as name buttons
2. Staff taps their name
3. Staff enters 6-digit PIN on a number pad
4. App constructs the fake email: `{name_lowercase_no_spaces}@nineteendetails.internal`
5. App calls Supabase signInWithPassword with that email and the PIN as password
6. On success → redirect to main screen

### Fake email convention
`full_name` lowercased, spaces replaced with dots, plus the domain.
Examples:
- "Budi Santoso" → budi.santoso@nineteendetails.internal
- "Rina" → rina@nineteendetails.internal

This email is never shown in the UI anywhere.

### getCurrentProfile
Resolves the logged-in user's profile row:
```js
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)   // profiles.id IS the auth UUID
  .single()
```
Never use auth.uid() directly in frontend queries — always resolve to a profile first.

### Rules
- Never show email anywhere in the UI
- Never expose or log the PIN
- Never let staff change their own PIN from the app
- PINs are 6 digits only — validate before submitting (matches Supabase
  Auth's default 6-character minimum password length, since the PIN doubles
  as the account password)

### Creating a new staff member (manual, via Supabase dashboard)
1. Authentication → Users → Add user
   Email: name@nineteendetails.internal
   Password: their 6-digit PIN
2. Copy the UUID Supabase assigns
3. Insert into profiles: id (the UUID), full_name, role = 'staff'

---

## Key rules

### Never revamp — always expand
The project has existing working files. Build on top of them.
Do not delete or rewrite existing files unless explicitly instructed.
If something needs changing, edit the specific part that needs changing.

### Money
- All prices are numeric in the database
- Never use float arithmetic for totals
- Always display in Indonesian Rupiah format: Rp 15.000
  (dot as thousands separator, no decimal for whole amounts)
- Use this helper consistently across all components:
  ```js
  export function formatRupiah(amount) {
    return `Rp ${Number(amount).toLocaleString('id-ID')}`
  }
  ```

### Treatments
- Creating a treatment requires three inserts in order:
  1. Insert into `treatments` → get the id
  2. Insert all items into `treatment_items` with that treatment_id
  3. Insert into `payments` with that treatment_id
- treatment_items stores name and price as snapshots — not live FKs to services
- Never DELETE a treatment row — set status to 'voided' instead
- Write to treatment_logs on every status change
- plate_number must be .toUpperCase().trim() before saving

### Payment methods
Three options only: cash, qris, transfer
Do not add others without confirming with the client.

### Status values for treatments
- created — just opened
- paid — payment recorded
- completed — work done, ready to close
- closed — treatment finished
- voided — cancelled, do not delete

---

## Screens to build

1. **Login** — name picker grid + 6-digit PIN pad, no email/password fields
2. **Antrian Hari Ini** (dashboard home, `/`) — today's treatments still open
   (status `created`/`paid`/`completed`), read from `treatments`; a queue view,
   not a booking/scheduling system — no bay/tech/ETA concepts, those don't
   exist in the schema and aren't in scope
3. **Transaksi Baru** (`/transaksi-baru`) — service multi-picker, plate number
   input, vehicle type, payment method selector, discount input, notes, submit
4. **Katalog Layanan** (`/katalog`) — read-only listing of `services`; no
   add/edit UI (services stay managed via the Supabase dashboard, per "Do not
   build" below)
5. **Struk** (`/struk/:id`) — digital receipt using treatment_summary view;
   shows shop name, date/time, plate, vehicle type, staff name, itemized
   services, subtotal, discount, total, payment method
6. **Riwayat Transaksi** (`/riwayat`) — today's treatments list, searchable by
   plate number
7. **Laporan** (`/laporan`) — read-only daily numbers computed from
   `treatments`/`payments` (revenue today, transaction count, avg ticket,
   7-day revenue, payment-method split). Display only — it doesn't process or
   move money, just reports what's already been collected.
8. **Detail Treatment** (`/treatment/:id`) — single treatment view with
   close/void actions

The dashboard shell (sidebar with the 5 nav pages above + header) lives in
`src/components/AppShell.jsx`. Its 5-item nav is styled after
`POS Mockups Standalone.html`, adapted to this app's real screens, Indonesian
labels, and Rupiah — that mockup is a generic English/USD demo (card
payments, job-queue scheduling with bay/tech/ETA, in-app catalog editing) and
is a styling reference only, not a literal spec to replicate.

## Receipt
Digital on-screen display only — no print layout yet.
Printing format (thermal vs A4) is not decided and will be handled in a later phase.
Receipt must show: Nineteen Details, date/time, treatment code, plate number,
vehicle type, staff name (PIC), itemized services, subtotal, discount if any,
total, payment method.

---

## Do not build
- Admin panel for managing staff or services (done via Supabase dashboard)
- Photo upload feature (table exists but UI deferred)
- Multi-location support
- Customer loyalty or points system
- Payment processing of any kind — payment is collected physically
- Inventory management
- Print layout — digital display only for now

---

## Migrations applied
All SQL migrations have been run against the Supabase project in order:
- 001_initial_schema.sql — base tables
- 002_rls_policies.sql — row level security
- 003_auth_setup.sql — auth + staff link
- 004_add_treatment_items.sql — treatment_items table + view + columns
