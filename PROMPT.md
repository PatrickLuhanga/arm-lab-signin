# Arm Lab Sign-In System (v1) — Master Build Specification & Phased Execution Prompt

You are an expert full-stack desktop engineer building the **Arm Lab Sign-In System (v1)**: an offline-first, local Windows 10 kiosk application built with **Tauri v2, React, TypeScript, Tailwind CSS, Lucide React icons, and SQLite**.

## 0. Critical Execution Rules (Read First)
1. **Build Strictly Piece by Piece:** Follow the 6 Phases in Section 7 in exact order. **Complete ONLY Phase 1 first, then STOP.** Report what you built, show verification output (`npx tsc --noEmit`, `npm run build`, and `cargo check`), and wait for my approval before starting Phase 2. Repeat this stop-and-verify gate after every single phase.
2. **Do Not Invent v2 Scope:** v1 is a local Windows prototype. The **Admin-only password gate is the sole permitted credential gate**. Explicitly **DO NOT** build general passwords/login gates, in-app announcements, email notifications, project visibility toggles, self-registration on the sign-in screen, or QR/RFID scanning.
3. **Zero `localStorage`:** Do NOT use `localStorage` or `sessionStorage` anywhere. All data—including theme preference (`light` / `dark`)—must persist in SQLite (`armlab.db`).
4. **Zero Emojis:** Do NOT use Unicode emojis anywhere in UI copy, buttons, status banners, leaderboards, or headings. Use crisp monochrome vector icons from `lucide-react` and the custom inline SVG logo only.
5. **Production-Safe Desktop Packaging:**
   - Use `HashRouter` from `react-router-dom` so parameterized routes like `/events/:id/checkin` work cleanly in bundled Tauri `.exe` builds.
   - Store the SQLite database inside Tauri's standard app data/config directory (`sqlite:armlab.db` via `@tauri-apps/plugin-sql`)—never inside the app install directory—so `.exe` updates via USB never overwrite lab records.
   - Configure Tauri v2 capabilities cleanly in `src-tauri/capabilities/default.json` for every plugin used (`sql`, `dialog`, `fs`).

---

## 1. Tech Stack
- **Desktop Shell:** Tauri v2 (Rust backend + Windows WebView2 bundler configured for offline installation, e.g., `webviewInstallMode` or offline-ready bundle).
- **Frontend:** React 18+, TypeScript (strict mode), Vite, Tailwind CSS (class-based `darkMode: 'class'`), `react-router-dom` (`HashRouter`), `lucide-react`.
- **Database:** SQLite via `@tauri-apps/plugin-sql` (`tauri-plugin-sql` with `sqlite` feature) with startup Rust `Migration` definitions.
- **Native Exports:** `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` for saving CSV files and exporting raw `armlab.db` database backups to local folders or USB drives.

---

## 2. Aesthetic, Colors, Theme Toggle & Logo

### Aesthetic Benchmark
Accudemia-inspired institutional software: crisp `1px` neutral gray borders, flat surfaces, classic enterprise data tables, generous whitespace, and clean geometric sans-serif typography (`Inter` / system sans). Use `6px-8px` corner radii with `shadow-none` or very subtle elevation. Keep the interface neutral and reserve the matte institutional accent for solid primary CTAs, active tab indicators, and keyboard focus rings. Maintain **48x48 px minimum** touch targets on all buttons, cards, and numpad keys.

### Color Tokens (Accudemia-Inspired Neutral Institutional Palette)
Configure Tailwind CSS / CSS variables with these exact tokens:

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| App Canvas | `#F3F5F8` | `#121418` | Main viewport canvas |
| Card / Header / Modal / Input Surface | `#FFFFFF` | `#1A1D23` | Cards, forms, modals, inputs |
| Subtle Table Header / Secondary Surface | `#F8FAFC` | `#22262E` | Table header strips and metadata blocks |
| Border / Divider | `#D5DCE4` | `#2E3440` | Strictly neutral `1px` borders and dividers |
| Primary Text | `#1E293B` | `#F1F5F9` | Headings, names, student numbers |
| Muted / Secondary Text | `#5A6577` | `#94A3B8` | Subtitles, labels, timestamps |
| Matte Institutional Accent | `#0076A8` (hover `#00618A`) | `#0088C2` (hover `#0076A8`) | Solid primary CTAs, active tab indicators, keyboard focus rings |
| Success | `#15803D` text / `#DCFCE7` fill | `#22C55E` text / `#14532D` fill | Sign-in and guest check-in confirmation |
| Warning / Duplicate | `#B45309` text / `#FEF3C7` fill | `#FBBF24` text / `#451A03` fill | Same-day duplicate sign-in notice |
| Error / Destructive | `#C81E1E` | `#F87171` | Not found and destructive confirms |
| Role Badges | `slate-100` / `slate-700` / `slate-200` border | `slate-800` / `slate-300` / `slate-700` border | Understated `Arm Member` / `Intern` pills |

### Top-Left Arm Lab Bubble Logo (Inline SVG Component)
Create `<ArmLabLogo/>` as a clickable button with `aria-label="Arm Lab"` that always navigates back to Home (`/`):
- Bubble mark: a clean `#0091BD` solid circular SVG, sized around `44x44px` to `48x48px`, with bold, crisp white `Arm` on the top line and `Lab` directly underneath on the second line, both centered inside the bubble. No text outside the circle.
- App icon: the same `#0091BD` circular bubble with white `Arm` / `Lab` centered inside on a transparent background, regenerated for every Tauri icon size and used by `index.html` / `public/favicon.png`.

### Theme Toggle Behavior (Exact Requirement)
- When **Light Mode** is active, the theme button displays a **crescent moon** icon (`Moon` from `lucide-react`) to indicate switching to Dark Mode.
- When **Dark Mode** is active, the theme button displays a **light bulb** icon (`Lightbulb` from `lucide-react`) to indicate switching to Light Mode.
- Persist the active theme (`'light'` | `'dark'`) in SQLite's `app_settings` table.

---

## 3. SQLite Database Schema (`armlab.db`)

Define these 6 tables inside Tauri SQLite startup migrations (`PRAGMA foreign_keys = ON;` enabled):

```sql
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('arm_member', 'intern')),
    course TEXT NOT NULL,
    organization TEXT, -- Required in UI when role = 'intern'; NULL for 'arm_member'
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sign_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    sign_in_date TEXT NOT NULL, -- Local date 'YYYY-MM-DD'
    signed_in_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE (profile_id, sign_in_date) -- Enforces zero same-day duplicate counts
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,  -- Optional
    coordinators TEXT, -- Optional
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'ended')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS event_guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    organization TEXT, -- Optional
    contact TEXT,      -- Optional (email or phone)
    checked_in_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Business Rules Enforced in Service Layer
- **All Members & Interns use DUT Student Numbers:** `student_number` is trimmed and unique across `profiles`.
- **Mandatory Project Rule:** Every `arm_member` MUST be created with at least 1 project (atomic transaction), and the app MUST block deleting an Arm Member's last remaining project.
- **Mandatory Organization Rule:** Every `intern` MUST have a non-empty `organization`.
- **Same-Day Duplicate Sign-In Guard:** Check or catch `UNIQUE(profile_id, sign_in_date)` using local `'YYYY-MM-DD'`. If already signed in today, do NOT increment count—return the existing `signed_in_at` time.
- **No Self-Registration:** Unregistered student numbers never trigger a signup form on Home.
- **Destructive Action Guardrails:** Because v1 has no passwords, every delete/remove/end action (deleting a profile, deleting a project, ending/deleting an event, removing a guest) MUST open a clean **"Are you sure?" confirmation modal** first.

---

## 4. Global Navigation Header
Rendered persistently across the top of the app as a flat institutional bar with a `1px` neutral bottom border. Active routes use matte accent text with a clean bottom indicator, never colored borders:
- **Left:** `<ArmLabLogo/>` only (clicking returns to `/`). No duplicate back buttons in the header.
- **Inline breadcrumbs:** Sub-pages render a breadcrumb above the page heading instead of a navbar back button (e.g., `More / Arm Members`, `More / Interns`, `More / Events`, `More / Events / <Event Title>`, `More / Admin`). Clickable `More` and `Events` links return up the hierarchy.
- **Right (3 Global Controls):**
  1. **Theme Toggle Button** (`Moon` when Light, `Lightbulb` when Dark)
  2. **Leaderboard Button** (`Trophy` icon + `Leaderboard`) -> `/leaderboard`
  3. **More Button** (`LayoutGrid` icon + `More`) -> `/sections`

---

## 5. Complete Screen Specifications (7 Views)

### Screen 1: Home — Daily Sign-In Register (`/`)
- Displays live local date and time (e.g., `Tuesday, 10 Nov 2026 | 09:15`).
- Centered **Daily Sign-In Register** card:
  - Auto-focused Student Number input (`aria-label="Student Number"`, `placeholder="Enter student number"`, no visible field label) that supports both physical keyboards (submits on `Enter`, compatible with USB scanners) and touch tapping.
  - Large touch-friendly on-screen numeric keypad (`1–9`, `CLR`, `0`, `DEL` backspace) + full-width **`SIGN IN NOW`** primary button below the keypad.
  - The card contains only the input, numpad, `SIGN IN NOW` button, and the auto-clearing status banner. Do not render a redundant inner card header, a visible Student Number label, or a footer help caption.
- **Feedback Banner & Auto-Clear (~4 seconds):**
  - **Success (Green):** `Welcome, [Full Name] -- Signed in at [HH:MM] ([Arm Member / Intern])`
  - **Duplicate Today (Amber):** `Already signed in today at [HH:MM]. Have a productive session, [Full Name].`
  - **Not Registered (Red):** `Profile not found for "[Student #]". Please contact an Admin to create your profile.`
  - Auto-clear input and dismiss banner after 4 seconds (canceling timer if the user starts typing again).

### Screen 2: Leaderboard (`/leaderboard`)
- Plain page heading **`Leaderboard`** (no trophy icon and no explanatory subtitle).
- **Single unified table** ranking Arm Members and Interns together by sign-in count (`COUNT(sign_ins.id) DESC, full_name ASC`).
- Connected segmented period control at top-right (rounded `4px`, `1px` neutral hairline borders, flush dividers, solid `#0076A8` active tab): **`Today`**, **`This Week`**, **`This Month`**, **`All Time`**. Boundaries are local kiosk dates; hide zero-count profiles and show a period-specific empty state.
- Five aligned table columns:
  - **`#`:** Rank (`#1`, `#2`, `#3`...).
  - **`Name`:** Bold full name.
  - **`Qualification`:** Course.
  - **`Role`:** Restrained `Arm Member` / `Intern` badge.
  - **`Days`:** Right-aligned `tabular-nums` sign-in total (`1 day`, `14 days`).

### Screen 3: The More Hub (`/sections`)
- Clean **2×2 card grid** showing:
  1. **Arm Members** (`Cpu` icon) — description + live registered count -> `/members`
  2. **Interns** (`GraduationCap` icon) — description + live registered count -> `/interns`
  3. **Events** (`Calendar` icon) — description + live active event count -> `/events`
  4. **Admin** (`SlidersHorizontal` icon) — `Profiles, Logs & Backups` -> `/admin`

### Screen 4: Arm Members Directory & Project Drawer (`/members`)
- Inline breadcrumb: `More / Arm Members`.
- **Admin verification:** Editing member details, editing projects, and deleting projects require a per-action Admin password verification modal. Verifying one action does not unlock this directory or `/admin`; the 1-project delete guard is enforced before prompting.
- **Unified Split-Pane Panel:** one bordered `rounded-md` container with a `1px` vertical divider between a fixed `300px–340px` left directory column and a fluid right detail workspace. The live search input sits at the top of the left column above a `1px` bottom border and filters by `full_name` or `student_number`.
- **Left Directory Column:** Selectable rows showing Full Name, Student Number, project count, and total sign-ins.
- **Right Detail Workspace:**
  - Header with Full Name, `[Arm Member]` pill, and an **`Edit Details`** button (opens modal to edit `full_name`, `student_number`, and `course` with duplicate student number validation).
  - Flat specification grid: Student #, Course, and Total Sign-Ins as hairline-divided label/value rows (no nested cards).
  - **Projects Section** (`Minimum 1 required`): clean hairline-divided list rows directly on the detail surface, not stacked nested boxes.
    - Lists all projects (`title` + optional `description`).
    - Each project row has an **`Edit`** button (modal/inline form to update title/description) and a **`Delete`** button (confirmation modal; disabled with tooltip/hint `"At least 1 project required"` when `projects.length === 1`).
    - **`+ Add New Project`** button/form at the bottom of the projects list.

### Screen 5: Interns Directory (`/interns`)
- Inline breadcrumb: `More / Interns`.
- **Admin verification:** Editing intern details requires a per-action Admin password verification modal. Verifying one edit does not unlock this directory or `/admin`.
- **Unified Split-Pane Panel:** one bordered `rounded-md` container with a `1px` vertical divider between a fixed `300px–340px` left directory column and a fluid right detail workspace. The live search input sits at the top of the left column above a `1px` bottom border and filters by `full_name`, `organization`, or `student_number`.
- **Left Directory Column:** Selectable rows showing Full Name, Student Number, Organization, and total sign-ins.
- **Right Detail Workspace:**
  - Header with Full Name, `[Intern]` pill, and an **`Edit`** button (opens modal to edit `full_name`, `student_number`, `course`, and `organization`).
  - Flat specification grid: Student #, Course, Organization, and Total Sign-Ins as hairline-divided label/value rows (no nested cards).
  - **Recent Sign-Ins:** Chronological hairline-divided list of recent sign-in dates and times (`signed_in_at`) directly on the detail surface, with plain muted empty text when none exist.

### Screen 6A: Events Hub (`/events`)
Ordered strictly **top-to-bottom** as follows:
1. **Top Action Bar:**
   - **`+ Create / Schedule Event`** button -> opens modal with:
     - Event Name * (required)
     - Coordinators (optional)
     - Description (optional)
     - Initial Status toggle: **`Active Now`** (`'active'`) or **`Schedule for Later`** (`'scheduled'`)
   - **`Export All Guests CSV`** button.
2. **Middle — Active & Scheduled Events:**
   - **Active Events** (`[LIVE]` green/cyan badge): shows Title, optional Coordinators, optional Description, live checked-in guest count, **`End Event`** button (confirmation modal), and **`Open Check-In Screen`** click action (navigates to `/events/:id/checkin`).
   - **Scheduled Events** (`[SCHEDULED]` badge): shows Title, optional Coordinators/Description, **`Activate Now`** button, and **`Edit`** / **`Delete`** controls.
3. **Bottom — Previous Events (`[ENDED]`):**
   - Lists ended events with guest count and a **`View Roster`** button (opens read-only modal listing who signed in + single-event CSV export).
   - **Sign-in is strictly blocked** for ended events.

### Screen 6B: Dedicated Active Event Check-In Page (`/events/:id/checkin`)
- Inline breadcrumb: `More / Events / <Event Title>`.
Designed for continuous unattended walk-up guest check-in using a **vertical Top-and-Bottom stack** (NOT left/right columns):
- **Route Guard:** If the event is `'ended'` (or missing), display a clear `"This event has ended — guest sign-in is closed"` state with a button back to `/events`.
- **Top Section — Event Info & Walk-Up Check-In Card:**
  - Displays Event Title, `[LIVE]` badge, optional Coordinators, and optional Description.
  - Compact 3-input form row: **Full Name*** (required), **Organization / Affiliation** (optional), **Contact (Email or Phone)** (optional), plus **`CHECK IN AS GUEST`** button.
  - On submit: saves to `event_guests`, displays a 3-second green confirmation banner, clears all 3 fields immediately for the next visitor, and prepends the new guest to row #1 below.
- **Bottom Section — Checked-In Guests Table (Envoy-Inspired Minimalist List):**
  - **Toolbar:** Bold total count on the left (e.g., `14 Guests`), pill-shaped search box (`Search guests...`), and **`Export`** button on the right (exports CSV for this event).
  - **Table Design:** Clean horizontal dividers only (no vertical grid borders), generous row padding, muted sortable column headers (`Name`, `Organization`, `Contact`, `Signed in`), sorted **newest-first (`checked_in_at DESC`)** by default.
  - **Columns:**
    1. **Name:** Circular colored initials badge (e.g., `TM`, deterministically rotating across `#0091BD`, `#7AB4B6`, `#5370A3`, `#812575`, `#1C8441`, `#D11F2D`) beside bold `full_name` and subtle `"Checked in"` sub-line.
    2. **Organization:** Value or `—`.
    3. **Contact:** Value or `—`.
    4. **Signed in:** Formatted local time (e.g., `2:14 pm`).
    5. **Row Actions (`...`):** Dropdown menu to **Edit Guest** (fix typos) or **Remove Entry** (with confirmation modal).

### Screen 7: Admin Hub (`/admin`)
- Inline breadcrumb: `More / Admin`.
Organized into 3 clean tabs:
1. **Create & Manage Profiles:**
   - **Create Profile Form:** Role selector (`Arm Member` | `Intern`), Full Name*, Student Number*, Course (currently studying or completed)*.
     - When `Arm Member`: shows **Mandatory Initial Project** section (`Project Title*`, `Description` optional).
     - When `Intern`: shows **Organization*** required input.
   - Below (or sub-view): Searchable profile management table allowing quick **Delete Profile** (with confirmation modal warning that projects and sign-in history will be removed).
2. **Daily Attendance Logs & Exports:**
   - Date picker (defaults to Today) showing everyone who signed in on that day (`Time`, `Name`, `Student #`, `Role`, `Course`).
   - Buttons: **`Export Selected Day CSV`** and **`Export Full Attendance Summary CSV`** (all profiles + total sign-ins).
3. **Database Backup:**
   - Explains where the local SQLite database lives and provides a **`Download Database Backup (.db)`** button using native save dialog + file copy (plus a clean error/success banner) so an admin can back up `armlab.db` onto a USB drive.

**Admin-Only Password Gate:** `/admin` is the ONLY password-protected route. On first launch, once SQLite is ready, if `admin_password_hash` is missing from `app_settings`, block the app with a **Set Admin Password** screen (new password plus confirmation, minimum 4 characters, `Eye`/`EyeOff` visibility toggles). Store a random salt in `admin_password_salt` and a salted SHA-256 hash in `admin_password_hash`; never hardcode a default password. Keep the unlock state strictly in React memory. Entering `/admin` while locked shows an Admin Password Prompt (password input, `Eye`/`EyeOff`, inline wrong-password error, Unlock, and Cancel back to `/sections`). Leaving `/admin` automatically re-locks it. Provide `Lock Admin` and `Change Admin Password` (current password, new password, confirmation) controls inside `AdminPage`. All other routes remain open without a password.

---

## 6. Recommended Folder Structure
```text
arm-lab-signin/
├── src-tauri/
│   ├── capabilities/default.json
│   ├── icons/
│   ├── src/
│   │   ├── lib.rs          # Tauri plugins + SQLite migrations
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/
│   │   ├── ArmLabLogo.tsx
│   │   ├── ConfirmModal.tsx
│   │   ├── Navbar.tsx
│   │   ├── Numpad.tsx
│   │   └── RoleBadge.tsx
│   ├── context/
│   │   └── ThemeContext.tsx
│   ├── db/
│   │   ├── client.ts       # Singleton Database.load('sqlite:armlab.db')
│   │   ├── types.ts        # Strict TypeScript interfaces
│   │   ├── profiles.ts     # Profiles + Projects CRUD + 1-project guard
│   │   ├── signIns.ts      # Daily register + Leaderboard queries
│   │   ├── events.ts       # Events + Event Guests CRUD
│   │   ├── settings.ts     # Theme persistence in SQLite
│   │   └── exports.ts      # CSV builders + native Tauri save / .db backup
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── LeaderboardPage.tsx
│   │   ├── SectionsPage.tsx
│   │   ├── MembersPage.tsx
│   │   ├── InternsPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── EventCheckInPage.tsx
│   │   └── AdminPage.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
└── tailwind.config.js# Arm Lab Sign-In System (v1) — Master Build Specification & Phased Execution Prompt

You are an expert full-stack desktop engineer building the **Arm Lab Sign-In System (v1)**: an offline-first, local Windows 10 kiosk application built with **Tauri v2, React, TypeScript, Tailwind CSS, Lucide React icons, and SQLite**.

## 0. Critical Execution Rules (Read First)
1. **Build Strictly Piece by Piece:** Follow the 6 Phases in Section 7 in exact order. **Complete ONLY Phase 1 first, then STOP.** Report what you built, show verification output (`npx tsc --noEmit`, `npm run build`, `npm test`, and `cargo check`), and wait for my approval before starting Phase 2. Repeat this stop-and-verify gate after every single phase.
2. **Do Not Invent v2 Scope:** v1 is a local Windows prototype. The **Admin-only password gate is the sole permitted credential gate**. Explicitly **DO NOT** build general passwords/login gates, in-app announcements, email notifications, project visibility toggles, self-registration on the sign-in screen, or QR/RFID scanning.
3. **Zero `localStorage`:** Do NOT use `localStorage` or `sessionStorage` anywhere. All data—including theme preference (`light` / `dark`)—must persist in SQLite (`armlab.db`).
4. **Zero Emojis:** Do NOT use Unicode emojis anywhere in UI copy, buttons, status banners, leaderboards, or headings. Use crisp monochrome vector icons from `lucide-react` and the custom inline SVG logo only.
5. **Production-Safe Desktop Packaging:**
   - Use `HashRouter` from `react-router-dom` so parameterized routes like `/events/:id/checkin` work cleanly in bundled Tauri `.exe` builds.
   - Store the SQLite database inside Tauri's standard app data/config directory (`sqlite:armlab.db` via `@tauri-apps/plugin-sql`)—never inside the app install directory—so `.exe` updates via USB never overwrite lab records.
   - Configure Tauri v2 capabilities cleanly in `src-tauri/capabilities/default.json` for every plugin used (`sql`, `dialog`, `fs`).

---

## 1. Tech Stack
- **Desktop Shell:** Tauri v2 (Rust backend + Windows WebView2 bundler configured for offline installation, e.g., `webviewInstallMode` or offline-ready bundle).
- **Frontend:** React 18+, TypeScript (strict mode), Vite, Tailwind CSS (class-based `darkMode: 'class'`), `react-router-dom` (`HashRouter`), `lucide-react`.
- **Database:** SQLite via `@tauri-apps/plugin-sql` (`tauri-plugin-sql` with `sqlite` feature) with startup Rust `Migration` definitions.
- **Native Exports:** `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` for saving CSV files and exporting raw `armlab.db` database backups to local folders or USB drives.
- **Testing:** Vitest + React Testing Library (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`).

---

## 2. Aesthetic, Colors, Theme Toggle & Logo

### Aesthetic Benchmark
Accudemia-inspired institutional software: crisp `1px` neutral gray borders, flat surfaces, classic enterprise data tables, generous whitespace, and clean geometric sans-serif typography (`Inter` / system sans). Use `6px-8px` corner radii with `shadow-none` or very subtle elevation. Keep the interface neutral and reserve the matte institutional accent for solid primary CTAs, active tab indicators, and keyboard focus rings. Maintain **48x48 px minimum** touch targets on all buttons, cards, and numpad keys.

### Color Tokens (Accudemia-Inspired Neutral Institutional Palette)
Configure Tailwind CSS / CSS variables with these exact tokens:

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| App Canvas | `#F3F5F8` | `#121418` | Main viewport canvas |
| Card / Header / Modal / Input Surface | `#FFFFFF` | `#1A1D23` | Cards, forms, modals, inputs |
| Subtle Table Header / Secondary Surface | `#F8FAFC` | `#22262E` | Table header strips and metadata blocks |
| Border / Divider | `#D5DCE4` | `#2E3440` | Strictly neutral `1px` borders and dividers |
| Primary Text | `#1E293B` | `#F1F5F9` | Headings, names, student numbers |
| Muted / Secondary Text | `#5A6577` | `#94A3B8` | Subtitles, labels, timestamps |
| Matte Institutional Accent | `#0076A8` (hover `#00618A`) | `#0088C2` (hover `#0076A8`) | Solid primary CTAs, active tab indicators, keyboard focus rings |
| Success | `#15803D` text / `#DCFCE7` fill | `#22C55E` text / `#14532D` fill | Sign-in and guest check-in confirmation |
| Warning / Duplicate | `#B45309` text / `#FEF3C7` fill | `#FBBF24` text / `#451A03` fill | Same-day duplicate sign-in notice |
| Error / Destructive | `#C81E1E` | `#F87171` | Not found and destructive confirms |
| Role Badges | `slate-100` / `slate-700` / `slate-200` border | `slate-800` / `slate-300` / `slate-700` border | Understated `Arm Member` / `Intern` pills |

### Top-Left Arm Lab Bubble Logo (Inline SVG Component)
Create `<ArmLabLogo/>` as a clickable button with `aria-label="Arm Lab"` that always navigates back to Home (`/`):
- Bubble mark: a clean `#0091BD` solid circular SVG, sized around `44x44px` to `48x48px`, with bold, crisp white `Arm` on the top line and `Lab` directly underneath on the second line, both centered inside the bubble. No text outside the circle.
- App icon: the same `#0091BD` circular bubble with white `Arm` / `Lab` centered inside on a transparent background, regenerated for every Tauri icon size and used by `index.html` / `public/favicon.png`.

### Theme Toggle Behavior (Exact Requirement)
- When **Light Mode** is active, the theme button displays a **crescent moon** icon (`Moon` from `lucide-react`) to indicate switching to Dark Mode.
- When **Dark Mode** is active, the theme button displays a **light bulb** icon (`Lightbulb` from `lucide-react`) to indicate switching to Light Mode.
- Persist the active theme (`'light'` | `'dark'`) in SQLite's `app_settings` table.

---

## 3. SQLite Database Schema (`armlab.db`)

Define these 6 tables inside Tauri SQLite startup migrations (`PRAGMA foreign_keys = ON;` enabled):

```sql
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('arm_member', 'intern')),
    course TEXT NOT NULL,
    organization TEXT, -- Required in UI when role = 'intern'; NULL for 'arm_member'
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sign_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    sign_in_date TEXT NOT NULL, -- Local date 'YYYY-MM-DD'
    signed_in_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE (profile_id, sign_in_date) -- Enforces zero same-day duplicate counts
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,  -- Optional
    coordinators TEXT, -- Optional
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'ended')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS event_guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    organization TEXT, -- Optional
    contact TEXT,      -- Optional (email or phone)
    checked_in_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Business Rules Enforced in Service Layer
- **All Members & Interns use DUT Student Numbers:** `student_number` is trimmed and unique across `profiles`.
- **Mandatory Project Rule:** Every `arm_member` MUST be created with at least 1 project (atomic transaction), and the app MUST block deleting an Arm Member's last remaining project.
- **Mandatory Organization Rule:** Every `intern` MUST have a non-empty `organization`.
- **Same-Day Duplicate Sign-In Guard:** Check or catch `UNIQUE(profile_id, sign_in_date)` using local `'YYYY-MM-DD'`. If already signed in today, do NOT increment count—return the existing `signed_in_at` time.
- **No Self-Registration:** Unregistered student numbers never trigger a signup form on Home.
- **Destructive Action Guardrails:** Because v1 has no passwords, every delete/remove/end action (deleting a profile, deleting a project, ending/deleting an event, removing a guest) MUST open a clean **"Are you sure?" confirmation modal** first.

---

## 4. Global Navigation Header
Rendered persistently across the top of the app as a flat institutional bar with a `1px` neutral bottom border. Active routes use matte accent text with a clean bottom indicator, never colored borders:
- **Left:** `<ArmLabLogo/>` only (clicking returns to `/`). No duplicate back buttons in the header.
- **Inline breadcrumbs:** Sub-pages render a breadcrumb above the page heading instead of a navbar back button (e.g., `More / Arm Members`, `More / Interns`, `More / Events`, `More / Events / <Event Title>`, `More / Admin`). Clickable `More` and `Events` links return up the hierarchy.
- **Right (3 Global Controls):**
  1. **Theme Toggle Button** (`Moon` when Light, `Lightbulb` when Dark)
  2. **Leaderboard Button** (`Trophy` icon + `Leaderboard`) -> `/leaderboard`
  3. **More Button** (`LayoutGrid` icon + `More`) -> `/sections`

---

## 5. Complete Screen Specifications (7 Views)

### Screen 1: Home — Daily Sign-In Register (`/`)
- Displays live local date and time (e.g., `Tuesday, 10 Nov 2026 | 09:15`).
- Centered **Daily Sign-In Register** card:
  - Auto-focused Student Number input (`aria-label="Student Number"`, `placeholder="Enter student number"`, no visible field label) that supports both physical keyboards (submits on `Enter`, compatible with USB scanners) and touch tapping.
  - Large touch-friendly on-screen numeric keypad (`1–9`, `CLR`, `0`, `DEL` backspace) + full-width **`SIGN IN NOW`** primary button below the keypad.
  - The card contains only the input, numpad, `SIGN IN NOW` button, and the auto-clearing status banner. Do not render a redundant inner card header, a visible Student Number label, or a footer help caption.
- **Feedback Banner & Auto-Clear (~4 seconds):**
  - **Success (Green):** `Welcome, [Full Name] -- Signed in at [HH:MM] ([Arm Member / Intern])`
  - **Duplicate Today (Amber):** `Already signed in today at [HH:MM]. Have a productive session, [Full Name].`
  - **Not Registered (Red):** `Profile not found for "[Student #]". Please contact an Admin to create your profile.`
  - Auto-clear input and dismiss banner after 4 seconds (canceling timer if the user starts typing again).

### Screen 2: Leaderboard (`/leaderboard`)
- Plain page heading **`Leaderboard`** (no trophy icon and no explanatory subtitle).
- **Single unified table** ranking Arm Members and Interns together by sign-in count (`COUNT(sign_ins.id) DESC, full_name ASC`).
- Connected segmented period control at top-right (rounded `4px`, `1px` neutral hairline borders, flush dividers, solid `#0076A8` active tab): **`Today`**, **`This Week`**, **`This Month`**, **`All Time`**. Boundaries are local kiosk dates; hide zero-count profiles and show a period-specific empty state.
- Five aligned table columns:
  - **`#`:** Rank (`#1`, `#2`, `#3`...).
  - **`Name`:** Bold full name.
  - **`Qualification`:** Course.
  - **`Role`:** Restrained `Arm Member` / `Intern` badge.
  - **`Days`:** Right-aligned `tabular-nums` sign-in total (`1 day`, `14 days`).

### Screen 3: The More Hub (`/sections`)
- Clean **2×2 card grid** showing:
  1. **Arm Members** (`Cpu` icon) — description + live registered count -> `/members`
  2. **Interns** (`GraduationCap` icon) — description + live registered count -> `/interns`
  3. **Events** (`Calendar` icon) — description + live active event count -> `/events`
  4. **Admin** (`SlidersHorizontal` icon) — `Profiles, Logs & Backups` -> `/admin`

### Screen 4: Arm Members Directory & Project Drawer (`/members`)
- Inline breadcrumb: `More / Arm Members`.
- **Admin verification:** Editing member details, editing projects, and deleting projects require a per-action Admin password verification modal. Verifying one action does not unlock this directory or `/admin`; the 1-project delete guard is enforced before prompting.
- **Unified Split-Pane Panel:** one bordered `rounded-md` container with a `1px` vertical divider between a fixed `300px–340px` left directory column and a fluid right detail workspace. The live search input sits at the top of the left column above a `1px` bottom border and filters by `full_name` or `student_number`.
- **Left Directory Column:** Selectable rows showing Full Name, Student Number, project count, and total sign-ins.
- **Right Detail Workspace:**
  - Header with Full Name, `[Arm Member]` pill, and an **`Edit Details`** button (opens modal to edit `full_name`, `student_number`, and `course` with duplicate student number validation).
  - Flat specification grid: Student #, Course, and Total Sign-Ins as hairline-divided label/value rows (no nested cards).
  - **Projects Section** (`Minimum 1 required`): clean hairline-divided list rows directly on the detail surface, not stacked nested boxes.
    - Lists all projects (`title` + optional `description`).
    - Each project row has an **`Edit`** button (modal/inline form to update title/description) and a **`Delete`** button (confirmation modal; disabled with tooltip/hint `"At least 1 project required"` when `projects.length === 1`).
    - **`+ Add New Project`** button/form at the bottom of the projects list.

### Screen 5: Interns Directory (`/interns`)
- Inline breadcrumb: `More / Interns`.
- **Admin verification:** Editing intern details requires a per-action Admin password verification modal. Verifying one edit does not unlock this directory or `/admin`.
- **Unified Split-Pane Panel:** one bordered `rounded-md` container with a `1px` vertical divider between a fixed `300px–340px` left directory column and a fluid right detail workspace. The live search input sits at the top of the left column above a `1px` bottom border and filters by `full_name`, `organization`, or `student_number`.
- **Left Directory Column:** Selectable rows showing Full Name, Student Number, Organization, and total sign-ins.
- **Right Detail Workspace:**
  - Header with Full Name, `[Intern]` pill, and an **`Edit`** button (opens modal to edit `full_name`, `student_number`, `course`, and `organization`).
  - Flat specification grid: Student #, Course, Organization, and Total Sign-Ins as hairline-divided label/value rows (no nested cards).
  - **Recent Sign-Ins:** Chronological hairline-divided list of recent sign-in dates and times (`signed_in_at`) directly on the detail surface, with plain muted empty text when none exist.

### Screen 6A: Events Hub (`/events`)
Ordered strictly **top-to-bottom** as follows:
1. **Top Action Bar:**
   - **`+ Create / Schedule Event`** button -> opens modal with:
     - Event Name * (required)
     - Coordinators (optional)
     - Description (optional)
     - Initial Status toggle: **`Active Now`** (`'active'`) or **`Schedule for Later`** (`'scheduled'`)
   - **`Export All Guests CSV`** button.
2. **Middle — Active & Scheduled Events:**
   - **Active Events** (`[LIVE]` green/cyan badge): shows Title, optional Coordinators, optional Description, live checked-in guest count, **`End Event`** button (confirmation modal), and **`Open Check-In Screen`** click action (navigates to `/events/:id/checkin`).
   - **Scheduled Events** (`[SCHEDULED]` badge): shows Title, optional Coordinators/Description, **`Activate Now`** button, and **`Edit`** / **`Delete`** controls.
3. **Bottom — Previous Events (`[ENDED]`):**
   - Lists ended events with guest count and a **`View Roster`** button (opens read-only modal listing who signed in + single-event CSV export).
   - **Sign-in is strictly blocked** for ended events.

### Screen 6B: Dedicated Active Event Check-In Page (`/events/:id/checkin`)
- Inline breadcrumb: `More / Events / <Event Title>`.
Designed for continuous unattended walk-up guest check-in using a **vertical Top-and-Bottom stack** (NOT left/right columns):
- **Route Guard:** If the event is `'ended'` (or missing), display a clear `"This event has ended — guest sign-in is closed"` state with a button back to `/events`.
- **Top Section — Event Info & Walk-Up Check-In Card:**
  - Displays Event Title, `[LIVE]` badge, optional Coordinators, and optional Description.
  - Compact 3-input form row: **Full Name*** (required), **Organization / Affiliation** (optional), **Contact (Email or Phone)** (optional), plus **`CHECK IN AS GUEST`** button.
  - On submit: saves to `event_guests`, displays a 3-second green confirmation banner, clears all 3 fields immediately for the next visitor, and prepends the new guest to row #1 below.
- **Bottom Section — Checked-In Guests Table (Envoy-Inspired Minimalist List):**
  - **Toolbar:** Bold total count on the left (e.g., `14 Guests`), pill-shaped search box (`Search guests...`), and **`Export`** button on the right (exports CSV for this event).
  - **Table Design:** Clean horizontal dividers only (no vertical grid borders), generous row padding, muted sortable column headers (`Name`, `Organization`, `Contact`, `Signed in`), sorted **newest-first (`checked_in_at DESC`)** by default.
  - **Columns:**
    1. **Name:** Circular colored initials badge (e.g., `TM`, deterministically rotating across `#0091BD`, `#7AB4B6`, `#5370A3`, `#812575`, `#1C8441`, `#D11F2D`) beside bold `full_name` and subtle `"Checked in"` sub-line.
    2. **Organization:** Value or `—`.
    3. **Contact:** Value or `—`.
    4. **Signed in:** Formatted local time (e.g., `2:14 pm`).
    5. **Row Actions (`...`):** Dropdown menu to **Edit Guest** (fix typos) or **Remove Entry** (with confirmation modal).

### Screen 7: Admin Hub (`/admin`)
- Inline breadcrumb: `More / Admin`.
Organized into 3 clean tabs:
1. **Create & Manage Profiles:**
   - **Create Profile Form:** Role selector (`Arm Member` | `Intern`), Full Name*, Student Number*, Course (currently studying or completed)*.
     - When `Arm Member`: shows **Mandatory Initial Project** section (`Project Title*`, `Description` optional).
     - When `Intern`: shows **Organization*** required input.
   - Below (or sub-view): Searchable profile management table allowing quick **Delete Profile** (with confirmation modal warning that projects and sign-in history will be removed).
2. **Daily Attendance Logs & Exports:**
   - Date picker (defaults to Today) showing everyone who signed in on that day (`Time`, `Name`, `Student #`, `Role`, `Course`).
   - Buttons: **`Export Selected Day CSV`** and **`Export Full Attendance Summary CSV`** (all profiles + total sign-ins).
3. **Database Backup:**
   - Explains where the local SQLite database lives and provides a **`Download Database Backup (.db)`** button using native save dialog + file copy (plus a clean error/success banner) so an admin can back up `armlab.db` onto a USB drive.

**Admin-Only Password Gate:** `/admin` is the ONLY password-protected route. On first launch, once SQLite is ready, if `admin_password_hash` is missing from `app_settings`, block the app with a **Set Admin Password** screen (new password plus confirmation, minimum 4 characters, `Eye`/`EyeOff` visibility toggles). Store a random salt in `admin_password_salt` and a salted SHA-256 hash in `admin_password_hash`; never hardcode a default password. Keep the unlock state strictly in React memory. Entering `/admin` while locked shows an Admin Password Prompt (password input, `Eye`/`EyeOff`, inline wrong-password error, Unlock, and Cancel back to `/sections`). Leaving `/admin` automatically re-locks it. Provide `Lock Admin` and `Change Admin Password` (current password, new password, confirmation) controls inside `AdminPage`. All other routes remain open without a password.

---

## 6. Recommended Folder Structure
```text
arm-lab-signin/
├── src-tauri/
│   ├── capabilities/default.json
│   ├── icons/
│   ├── src/
│   │   ├── lib.rs          # Tauri plugins + SQLite migrations
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── components/
│   │   ├── ArmLabLogo.tsx
│   │   ├── ConfirmModal.tsx
│   │   ├── Navbar.tsx
│   │   ├── Numpad.tsx
│   │   └── RoleBadge.tsx
│   ├── context/
│   │   └── ThemeContext.tsx
│   ├── db/
│   │   ├── client.ts       # Singleton Database.load('sqlite:armlab.db')
│   │   ├── types.ts        # Strict TypeScript interfaces
│   │   ├── profiles.ts     # Profiles + Projects CRUD + 1-project guard
│   │   ├── signIns.ts      # Daily register + Leaderboard queries
│   │   ├── events.ts       # Events + Event Guests CRUD
│   │   ├── settings.ts     # Theme persistence in SQLite
│   │   └── exports.ts      # CSV builders + native Tauri save / .db backup
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── LeaderboardPage.tsx
│   │   ├── SectionsPage.tsx
│   │   ├── MembersPage.tsx
│   │   ├── InternsPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── EventCheckInPage.tsx
│   │   └── AdminPage.tsx
│   ├── test/
│   │   ├── setup.ts
│   │   ├── phase1-theme-shell.test.tsx
│   │   ├── phase2-db-rules.test.ts
│   │   ├── phase3-register-leaderboard.test.tsx
│   │   ├── phase4-directories.test.tsx
│   │   ├── phase5-events-checkin.test.tsx
│   │   └── phase6-admin-hygiene.test.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
└── tailwind.config.js
```

---

## 7. Piece-by-Piece Build Plan (6 Phases — Execute One Phase Per Turn)

Work strictly in this order. At the end of each phase, run checks (`npx tsc --noEmit`, `npm run build`, `npm test`, and `cargo check` inside `src-tauri/` when Rust files change), list created/modified files, and **STOP for my review**:

- **Phase 1 — Project Scaffold, Tauri SQLite Setup, Theme System & Shell:**
  Initialize the Tauri v2 + Vite + React + TypeScript + Tailwind + Vitest project (or verify existing files if already initialized), install `lucide-react`, `react-router-dom`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-dialog`, and `@tauri-apps/plugin-fs`, register Rust plugins and the 6-table SQLite migration in `src-tauri/src/lib.rs`, configure `capabilities/default.json` and `tauri.conf.json` (including Windows offline WebView2 bundler settings), implement the Arm + DUT palette, `ThemeContext` (backed by SQLite `app_settings`), `<ArmLabLogo/>`, `<Navbar/>` (with exact Moon/Lightbulb toggle logic), `<ConfirmModal/>`, and placeholder routes in `HashRouter`. Write and pass Phase 1's test.
  **-> STOP and wait for confirmation.**

- **Phase 2 — Complete TypeScript Database & Export Layer (`src/db/`):**
  Implement `types.ts`, `client.ts`, `settings.ts`, `profiles.ts` (including transactional Arm Member + Project #1 creation, Intern validation, and last-project delete guard), `signIns.ts` (including local `YYYY-MM-DD` same-day duplicate detection and combined Leaderboard queries for `today`, Monday-start `week`, `month`, and `all`), `events.ts` (active/scheduled/ended transitions, guest check-in, guest edit/delete), and `exports.ts` (safe RFC-4180 CSV escaping + native save dialog + `.db` backup copy). Include clean validation errors. Write and pass Phase 2's test.
  **-> STOP and wait for confirmation.**

- **Phase 3 — Home Daily Register (`/`), Combined Leaderboard (`/leaderboard`), and More Hub (`/sections`):**
  Build `HomePage.tsx` (live clock, auto-focused input with `Enter` submit, touch-friendly `Numpad`, 4-second auto-clear status feedback for registered/duplicate/not-found), `LeaderboardPage.tsx` (single combined table with Today/This Week/This Month/All Time filters and role pills beside courses), and `SectionsPage.tsx` (2×2 grid with live database counts). Write and pass Phase 3's test.
  **-> STOP and wait for confirmation.**

- **Phase 4 — Arm Members (`/members`) and Interns (`/interns`) Directories:**
  Build `MembersPage.tsx` (master-detail split, search, `Edit Details` modal, project list with `Edit`, `Delete` + 1-project guard + `ConfirmModal`, and `Add New Project`) and `InternsPage.tsx` (master-detail split, search by name/org/student #, `Edit` modal, and recent sign-in timestamps). Write and pass Phase 4's test.
  **-> STOP and wait for confirmation.**

- **Phase 5 — Events Hub (`/events`) and Vertical Top/Bottom Guest Check-In (`/events/:id/checkin`):**
  Build `EventsPage.tsx` (ordered top action bar -> active & scheduled events -> ended events at bottom with read-only roster modal and blocked check-ins) and `EventCheckInPage.tsx` (vertical top/bottom layout: compact walk-up form at top that stays open and auto-resets, Envoy-style sortable/searchable table below with colored initial badges, newest-first sorting, single-event CSV export, and `...` row edit/remove actions). Write and pass Phase 5's test.
  **-> STOP and wait for confirmation.**

- **Phase 6 — Admin Hub (`/admin`), Backups & Final Polish:**
  Build `AdminPage.tsx` (3 tabs: Create & Manage Profiles with mandatory Project #1 / Organization rules, Daily Attendance Logs + CSV exports, and Database `.db` Backup export) plus the Admin-only password gate (first-run setup, salted SHA-256 in SQLite, `/admin` unlock prompt with automatic re-lock on exit, Lock Admin, and Change Admin Password). Run Phase 6's automated audit test plus a full verification confirming zero emojis, zero `localStorage`/`sessionStorage`, no non-Admin password gates, zero announcements, full Light/Dark parity across all 7 screens, and clean `npm run build` + `npm test` + `cargo check` (and `npm run tauri build` readiness).
  **-> Present final verification checklist.**

---

## 8. Automated Testing Requirements (1 Test Suite Per Phase — Mandatory)

Alongside `npx tsc --noEmit`, `npm run build`, and `cargo check`, you MUST create and pass **one automated test file per phase** using **Vitest** (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`) before stopping at that phase's gate.

### Testing Rules
- **Windows-Safe SQLite Testing:** Do NOT install native C++ packages like `better-sqlite3` (which require Visual Studio build tools on Windows). Either use pure-WASM `sql.js` for SQL constraint tests or mock `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-dialog`, and `@tauri-apps/plugin-fs` cleanly in `src/test/setup.ts`.
- **Add `"test": "vitest run"`** to `package.json` in Phase 1 and report the full `npm test` output at the end of every phase.

### Required Automated Test for Each Phase
1. **Phase 1 Test (`src/test/phase1-theme-shell.test.tsx`) — Theme Toggle Icon & Shell Navigation:**
   Render `<ThemeProvider>` and `<Navbar/>` inside `HashRouter` with mocked SQLite settings. Assert that in Light Mode the theme button renders the `Moon` icon (and NOT `Lightbulb`) without the `.dark` class; clicking it adds `.dark`, switches the icon to `Lightbulb`, persists `'dark'` via the SQLite settings handler, and never touches `localStorage` or `sessionStorage`. Assert clicking `<ArmLabLogo/>` navigates back to `/`.
2. **Phase 2 Test (`src/test/phase2-db-rules.test.ts`) — Schema Rules, Duplicate Guard & CSV Escaping:**
   Verify the `src/db/` layer rejects creating an `arm_member` with zero projects, blocks deleting an Arm Member's last remaining project, rejects creating an `intern` without an `organization`, allows only one `sign_ins` record per `(profile_id, YYYY-MM-DD)` (returning the existing timestamp on a second same-day attempt), and properly RFC-4180 escapes commas, double quotes, and newlines in `exports.ts`.
3. **Phase 3 Test (`src/test/phase3-register-leaderboard.test.tsx`) — Home Numpad, 4-Second Auto-Clear & Combined Leaderboard:**
   Using `vi.useFakeTimers()`, render `HomePage`, enter a student number via the on-screen `Numpad` (`DEL`, `CLR`, digits), submit via `SIGN IN NOW` (and via keyboard `Enter`), verify all 3 status banner states (Green welcome, Amber duplicate, Red not found), and assert the input and banner automatically reset after 4 seconds. Also verify `LeaderboardPage` renders both `Arm Member` and `Intern` entries in a single sorted table with role pills next to qualifications and switches across all four periods (Today, This Week, This Month, All Time).
4. **Phase 4 Test (`src/test/phase4-directories.test.tsx`) — Project Guardrails & Directory Edits:**
   Render `MembersPage` with a member who has 1 project and assert the project `Delete` button is disabled (`At least 1 project required`). Add a 2nd project, assert `Delete` becomes enabled, click it, and verify `<ConfirmModal/>` appears before `deleteProject` runs. Verify search filtering and `Edit Details` / `Edit` modal submissions on both `MembersPage` and `InternsPage`.
5. **Phase 5 Test (`src/test/phase5-events-checkin.test.tsx`) — Event Lifecycle & Vertical Top/Bottom Guest Check-In:**
   Verify `EventsPage` renders the top action bar above Active/Scheduled events and Previous (`ended`) events at the bottom, and blocks guest sign-in on ended events. Render `EventCheckInPage` for an active event, submit a guest via the top form, and assert the form clears immediately while staying on the page, the new guest prepends to row #1 of the bottom table with an initials badge, search filters rows, and removing a guest requires `<ConfirmModal/>`.
6. **Phase 6 Test (`src/test/phase6-admin-hygiene.test.tsx`) — Admin Validation & Repo Hygiene Audit:**
   Render `AdminPage` and verify form validation blocks an Arm Member missing Project #1 and an Intern missing Organization, while valid submissions succeed and trigger backup/CSV export handlers. Also cover first-run Admin password setup when `app_settings` has no hash, salted SHA-256 storage and verification, the `/admin` lock gate with wrong-password handling, automatic re-lock upon leaving `/admin`, the change-password flow, and non-Admin routes staying unlocked. In the same test file, scan `src/` source files (excluding `src/test/`) using Node `fs` to assert zero occurrences of `localStorage`, `sessionStorage`, announcements, and Unicode emoji characters (the Admin-only password gate is permitted).

Begin **Phase 1 only** right now. Inspect the current working directory first so you don't overwrite anything unexpectedly, then scaffold and verify Phase 1.