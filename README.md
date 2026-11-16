# StockFlow Pro — Modern Inventory & Stock Reporting Web Application

**StockFlow Pro** is an enterprise-grade, responsive inventory management and daily stock reporting system built specifically for wholesale pipes, fittings, and water tanks distribution businesses.

---

## 🌟 Key Capabilities & Workflows

### 📱 Staff Mobile-First Portal
- **Designed for Phones (320px – 430px) & Tablets**: Safe-area padding, large touch targets, numeric mobile keypads, compact product cards.
- **Add Today's Stock (Core Workflow)**:
  - Step 1: Select date, warehouse (locked to assigned godown), check/resume existing drafts.
  - Step 2: Category selection grid with progress indicator (`X of Y categories completed`).
  - Step 3: Product card view with locked opening stock (derived from ledger balance), input for Inward received, input for Sold/Outward, and pale-teal highlighted Closing Stock (`Opening + Inward - Outward`).
  - Category Workflow: `Save Draft` or `Save & Add Category` to progress through PVC, HDPE, SWR, CPVC, fittings, and tanks seamlessly in a single session.
  - Final Submission: Sends report to supervisor/admin for approval without prematurely mutating live ledger balances.
- **Inward / Outward Movements**: Fast logging of supplier arrivals and customer dispatches with available stock checks.
- **Physical Count & Verification**: Spot check physical yard inventory against system ledger, calculate variances (`Counted - System`), and flag discrepancies for audit.
- **My Entries History**: View past shift reports, check status badges (`Draft`, `Submitted`, `Approved`, `Rejected`), and resume drafts or edit rejected submissions with feedback.
- **Staff Profile**: View assigned warehouse, contact details, and secure session management.

### 💻 Admin Desktop & Laptop Dashboard
- **250px Persistent Navy Sidebar**: Quick navigation across 14 modules with responsive drawer on tablet/phone.
- **Executive KPI Dashboard**: Live SKU counts, today's shift submissions, pending approvals queue, active staff/locations, and low-stock reorder alerts.
- **Stock Movement Ledger**: Searchable, multi-filtered ledger register (Date, Warehouse, Category, Product, Type, Status) with unit-separated grand totals, Excel (`.xlsx`), and CSV (`.csv`) export.
- **Approvals Management**: Dedicated queue with tabs for `Pending`, `Approved`, and `Rejected` requests with mandatory reasons on rejection.
- **Physical Count Reconciliation**: Review variances, inspect staff discrepancy notes, and post adjustment movements to balance records with physical inventory.
- **Product Master (SKU Catalog)**: Full CRUD for pipes and fittings with technical specifications (grade, diameter mm, pressure rating kg, coil length m, unit, rate, GST %, reorder thresholds).
- **Category & Warehouse Masters**: Multi-location support for `Main Office Central`, `Godown 1 (North Yard)`, `Godown 2 (East Hub)`, `Godown 3 (South Depot)`.
- **Rates, GST & Discount Rules**: Commercial pricing rules engine (category-level, product overrides, quantity discounts) with an **Interactive Price & GST Calculator Simulator**.
- **Excel & CSV Import/Export Center**: Batch data import wizard for Product Master, Opening Stock, and Rates with column preview, type validation, row-level error reporting, downloadable error report, and confirmation summary.
- **Operational Reports**: 4 primary reports with unit separation (Pcs, Coils, Metres, Tanks never mixed into misleading sums):
  1. *Daily Stock Register*
  2. *Stock Movement Ledger*
  3. *Physical Verification Audits*
  4. *Staff Activity Report*
- **Append-Only Audit History**: Immutable compliance log tracking actor, action, timestamp, entity reference, and change summaries.
- **Business & Database Settings**: Supabase configuration status and company profile settings.

---

## 🎨 Theme & Brand Identity
- **Primary Navy**: `#102C42`
- **Primary Teal**: `#0D827D`
- **Light Page Background**: `#F4F7FA`
- **Card Background**: `#FFFFFF`
- **Pale Teal Table Header**: `#E7F3F1`
- **Primary Typography**: `#20384A` (Inter Font)
- **Secondary Text**: `#72869A`
- **Border**: `#DCE5EB`
- **Success / Warning / Error**: `#16845B` / `#D97706` / `#DC4C4C`

---

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 with Vite & TypeScript |
| **Styling** | Tailwind CSS v3 |
| **Icons** | Lucide React |
| **Forms & Validation** | React Hook Form + Zod |
| **Excel Export / Import** | SheetJS (`xlsx`) |
| **CSV Export / Import** | Papa Parse |
| **Authentication** | Supabase Auth |
| **Operational Data** | Legacy browser `localStorage` repository; not yet migrated to Supabase |
| **Database** | Supabase PostgreSQL schema and RLS policies are present but not verified against the configured project |

---

## 📁 Project Structure

```
d:\SaaS\stockflow-pro\
├── public\                     # Static assets & favicons
├── src\
│   ├── components\
│   │   ├── shared\
│   │   │   ├── AdminLayout.tsx # 250px navy sidebar + top bar + profile dropdown
│   │   │   └── StaffLayout.tsx # Mobile-first header + bottom nav + safe areas
│   │   └── ui\
│   │       ├── Badge.tsx       # Status badges
│   │       ├── ConfirmDialog.tsx# Confirmation modals
│   │       ├── EmptyState.tsx  # Empty table placeholders
│   │       ├── KPICard.tsx     # Executive KPI summary cards
│   │       ├── LoadingSkeleton.tsx # Pulse skeletons
│   │       ├── Modal.tsx       # Reusable responsive modal
│   │       └── Toast.tsx       # Slide-in notifications
│   ├── lib\
│   │   ├── dataService.ts      # Legacy localStorage-based business data repository
│   │   ├── supabase.ts         # Supabase client initializer
│   │   └── utils.ts            # Formatting, calculations & helpers
│   ├── pages\
│   │   ├── admin\
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminProducts.tsx
│   │   │   ├── AdminCategories.tsx
│   │   │   ├── AdminWarehouses.tsx
│   │   │   ├── AdminStaff.tsx
│   │   │   ├── AdminApprovals.tsx
│   │   │   ├── AdminStockLedger.tsx
│   │   │   ├── AdminReports.tsx
│   │   │   ├── AdminRatesDiscounts.tsx
│   │   │   ├── AdminImportExport.tsx
│   │   │   ├── AdminMovements.tsx
│   │   │   ├── AdminReconciliation.tsx
│   │   │   ├── AdminAuditHistory.tsx
│   │   │   └── AdminSettings.tsx
│   │   ├── auth\
│   │   │   └── LoginPage.tsx   # Supabase Auth login
│   │   └── staff\
│   │       ├── StaffHome.tsx
│   │       ├── StaffStockEntry.tsx
│   │       ├── StaffMovements.tsx
│   │       ├── StaffPhysicalCount.tsx
│   │       ├── StaffMyEntries.tsx
│   │       └── StaffProfile.tsx
│   ├── store\
│   │   ├── AuthContext.tsx     # Supabase Auth state and profile lookup
│   │   └── ToastContext.tsx    # Notification system
│   ├── types\
│   │   └── index.ts            # Complete TypeScript domain interfaces
│   ├── App.tsx                 # Protected route navigation & role authorization
│   ├── index.css               # Tailwind components & design tokens
│   └── main.tsx                # App entrypoint
├── supabase\
│   ├── migrations\
│   │   ├── 001_initial_schema.sql # Initial schema and RLS policies
│   │   ├── 002_seed_data.sql      # Retained no-op migration; no longer seeds production
│   │   └── 003_operational_entities.sql # Additive app entities and RLS policies
│   ├── seeds\
│   │   └── development_seed.sql   # Optional development-only sample data
│   ├── create_admin.sql           # Template to bind first admin user
│   └── README.md                  # Database setup instructions
├── .env.example                # Supabase environment variables template
├── package.json
└── tailwind.config.js
```

---

## ⚡ How to Run Locally

### 1. Install Dependencies
```bash
cd D:\VM\stockflow-pro
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Build & Verification
```bash
npm run build
```
Builds the optimized production bundle with full TypeScript type-checks (`tsc -b && vite build`).

---

## Supabase Status and Configuration

Supabase Auth is used for sign-in. Business data still reads from and writes to legacy browser storage; it is **not yet** persisted to Supabase. Do not use the current build for multi-device production operations.

Set `VITE_SUPABASE_URL` to the project root URL (`https://<project-ref>.supabase.co`) and `VITE_SUPABASE_ANON_KEY` to the publishable/anon key in `.env.local` or the deployment environment. Never put a service-role key in the frontend.

The configured project could not be fully inspected with authenticated database access. **Do not run the current schema migrations, seed scripts, or `supabase db push` against the existing project until its schema and migration history have been reviewed.** The previous sample seed was moved out of the migration directory; `supabase/seeds/development_seed.sql` is manual development data only.

## Deployment status

Vercel deployment is intentionally **not ready** until business CRUD, stock workflows, and authorization are migrated to and tested against Supabase. No code has been pushed or deployed.
