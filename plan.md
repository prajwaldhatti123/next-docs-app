# 📋 Execution Plan — Secure Internal Docs System (RBAC Edition)

> **Project:** Production-ready internal documentation system with team-based RBAC
> **Stack:** Next.js 16.1.6 · App Router · TypeScript · TailwindCSS 4 · MDX
> **Constraint:** No database · No next-auth · Vercel-optimized
> **Created:** 2026-02-28
> **Updated:** 2026-02-28 — RBAC stream model added

---

## 🔐 RBAC — Stream Model Overview

Users belong to one or more **streams** (teams). A stream maps 1-to-1 with a top-level content folder.

| Stream       | Content Folder        | Who Sees It              |
| ------------ | --------------------- | ------------------------ |
| `marketing`  | `/content/marketing/` | Marketing team members   |
| `sales`      | `/content/sales/`     | Sales team members       |
| `tech`       | `/content/tech/`      | Engineering/Tech members |
| `hr`         | `/content/hr/`        | HR team members          |
| _(any name)_ | `/content/<name>/`    | Members of that stream   |

**Post-login flow:**

1. User logs in → JWT includes their `teams[]` array
2. Redirect to `/dashboard` — shows **only their accessible streams** as cards
3. User clicks a stream card → enters `/docs/[stream]/` for that stream's docs
4. Middleware enforces: user's JWT teams must include the requested stream

**Env format (updated):**

```env
# Format: username:bcrypt_hash:team1,team2,team3
# Separate users with pipe |
DOCS_USERS=alice:$2b$10$hash:marketing,sales|bob:$2b$10$hash:tech|charlie:$2b$10$hash:marketing,sales,tech
```

---

## 🗂️ Current Codebase State

```
docs/
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx        ← bare root layout
│   └── page.tsx          ← default Next.js landing page
├── next.config.mjs       ← MDX config (✅ done in Phase 1)
├── package.json          ← all deps installed (✅ done in Phase 1)
├── tsconfig.json         ← strict mode, @/* alias configured
├── lib/auth/             ← users.ts, session.ts, rateLimit.ts (✅ Phase 2)
└── lib/security/         ← csrf.ts, headers.ts (✅ Phase 2)
```

**What exists:** Phase 1 + 2 complete. Auth core and security utilities built.  
**What's remaining:** Middleware, API routes, docs engine, UI, RBAC dashboard, deployment.

---

## 📐 Target Folder Structure (Post-Build)

```
docs/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                      ← login form
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts                ← login POST (bcrypt + JWT + RBAC)
│   │   │   └── logout/route.ts               ← logout handler
│   │   └── csrf/route.ts                     ← CSRF token endpoint
│   ├── dashboard/
│   │   └── page.tsx                          ← stream picker (post-login home)
│   ├── docs/
│   │   └── [stream]/
│   │       ├── page.tsx                      ← stream landing (index of that stream)
│   │       └── [...slug]/
│   │           └── page.tsx                  ← MDX doc renderer
│   ├── globals.css
│   ├── layout.tsx                            ← root layout with fonts
│   └── not-found.tsx                         ← 404 page
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx                        ← app name + username + logout
│   │   ├── Sidebar.tsx                       ← stream-scoped file tree
│   │   └── TableOfContents.tsx               ← sticky right TOC
│   ├── dashboard/
│   │   └── StreamCard.tsx                    ← card for each stream on dashboard
│   ├── docs/
│   │   ├── MDXContent.tsx                    ← renders compiled MDX
│   │   └── SearchBar.tsx                     ← client-side search within stream
│   └── ui/
│       ├── LoadingSpinner.tsx
│       └── ErrorBoundary.tsx
├── content/                                  ← stream folders
│   ├── tech/
│   │   ├── architecture.mdx
│   │   └── api-reference.mdx
│   ├── marketing/
│   │   ├── brand-guide.mdx
│   │   └── campaigns.mdx
│   ├── sales/
│   │   ├── playbook.mdx
│   │   └── pricing.mdx
│   └── hr/
│       └── onboarding.mdx
├── lib/
│   ├── auth/
│   │   ├── session.ts       ✅ JWT + teams[] in payload
│   │   ├── users.ts         ✅ parses username:hash:teams env format
│   │   └── rateLimit.ts     ✅ 5 attempts / 15 min
│   ├── security/
│   │   ├── csrf.ts          ✅ double-submit cookie
│   │   └── headers.ts       ✅ security headers
│   └── docs/
│       ├── streams.ts       ← list available streams from /content dirs
│       ├── mdx.ts           ← compile MDX for a stream/slug
│       ├── sidebar.ts       ← sidebar tree scoped to a stream
│       └── toc.ts           ← heading extractor
├── middleware.ts             ← Edge: auth guard + stream RBAC check
├── next.config.mjs          ✅
├── .env.example             ✅
└── README.md
```

---

## 🚀 Phases

---

### Phase 1 — Dependency Setup & Project Config ✅ COMPLETE

**Status:** Done. All packages installed. `next.config.mjs` configured. `.env.example` and `.env.local` created.

**Installed packages:** `bcryptjs`, `jose`, `zod`, `gray-matter`, `next-mdx-remote`, `remark-gfm`, `rehype-pretty-code`, `shiki`, `server-only`, `@types/bcryptjs`

> ⚠️ **Note:** `@next/mdx` was removed due to Turbopack serialization incompatibility. MDX is compiled by `next-mdx-remote/rsc` at runtime inside `lib/docs/mdx.ts` — this gives us full plugin support without bundler restrictions.

**Env format (updated for RBAC):**

```env
# Format: username:bcrypt_hash:team1,team2 — separate users with |
DOCS_USERS=alice:$2b$10$hash:marketing,sales|bob:$2b$10$hash:tech
SESSION_SECRET=min-32-char-random-secret
CSRF_SECRET=another-min-32-char-secret
```

**Checkpoint:** ✅ `npm run build` succeeds with zero errors.

---

### Phase 2 — Authentication Core (`lib/auth/`) ✅ COMPLETE

**Status:** Done. All files built with RBAC teams support.

| File                      | Status | Notes                                                           |
| ------------------------- | ------ | --------------------------------------------------------------- |
| `lib/auth/users.ts`       | ✅     | Parses `username:hash:team1,team2` format, pipe-separated users |
| `lib/auth/session.ts`     | ✅     | JWT includes `teams: string[]` in payload                       |
| `lib/auth/rateLimit.ts`   | ✅     | 5 attempts / 15 min / IP with auto-cleanup                      |
| `lib/security/csrf.ts`    | ✅     | Double-submit cookie, constant-time compare                     |
| `lib/security/headers.ts` | ✅     | X-Frame-Options, CSP, HSTS, Referrer-Policy                     |

**Checkpoint:** ✅ All lib files created with full TypeScript types.

---

### Phase 3 — Middleware & API Routes

**Goal:** Protect `/dashboard` and `/docs/[stream]/**` at the Edge; enforce stream-level RBAC.

#### Steps

1. **`middleware.ts`** (Edge runtime)
   - Protected paths: `/dashboard(.*)`, `/docs/(.*)`
   - For any request to `/docs/[stream]/...`:
     - Verify JWT session → if invalid, redirect to `/login`
     - Extract `teams[]` from JWT payload
     - Extract `stream` from the URL (first path segment after `/docs/`)
     - If `teams` does NOT include `stream` → return 403 (forbidden)
   - Apply security headers on all responses
   - Public paths (no auth): `/login`, `/api/auth/login`, `/api/csrf`, `/_next/*`, `/favicon.ico`

2. **`app/api/auth/login/route.ts`** (POST)
   - Extract IP from `x-forwarded-for`
   - Check rate limit → 429 if exceeded
   - Zod validate body: `{ username: string, password: string }`
   - Validate CSRF token (`X-CSRF-Token` header vs cookie)
   - `getHashForUser(username)` — returns hash + teams
   - `bcrypt.compare(password, hash)` — constant-time
   - On failure: `{ error: 'Invalid credentials' }` — same message always
   - On success: `signSession({ username, teams })` → set cookie → `{ redirect: '/dashboard' }`

3. **`app/api/auth/logout/route.ts`** (POST)
   - Clear session cookie
   - Return redirect to `/login`

4. **`app/api/csrf/route.ts`** (GET)
   - `generateCsrfToken()` → set CSRF cookie → return `{ token }` JSON

**Checkpoint:** `curl` login returns cookie. `/dashboard` without cookie → `/login`. `/docs/tech/...` with a marketing-only user → 403.

---

### Phase 4 — Documentation Engine (`lib/docs/`)

**Goal:** Stream-aware, file-system based MDX engine. Content is organized by stream.

#### Steps

1. **Create `/content/` stream folders** with sample MDX docs:

   ```
   content/
   ├── tech/
   │   ├── architecture.mdx
   │   └── api-reference.mdx
   ├── marketing/
   │   ├── brand-guide.mdx
   │   └── campaigns.mdx
   ├── sales/
   │   ├── playbook.mdx
   │   └── pricing.mdx
   └── hr/
       └── onboarding.mdx
   ```

   Frontmatter shape:

   ```yaml
   ---
   title: "Architecture Overview"
   description: "System design overview"
   order: 1
   ---
   ```

2. **`lib/docs/streams.ts`** — Discover available streams
   - `getAvailableStreams()` — `fs.readdirSync('/content')`, return only directories
   - `getStreamMetadata(stream)` — reads optional `_index.json` inside stream folder for display name/icon
   - Returns `{ name, slug, label, icon? }[]`
   - Used by the dashboard to show available stream cards

3. **`lib/docs/sidebar.ts`** — Build stream-scoped sidebar tree
   - `getSidebar(stream: string)` — recursively walk `/content/[stream]/`
   - Parse frontmatter of each `.mdx` file with `gray-matter`
   - Return `{ title, slug, order, children? }[]` sorted by `order`
   - Slug: `[stream]/path/to/file` (prefixed with stream)

4. **`lib/docs/mdx.ts`** — Compile MDX for a stream + slug
   - `compileMdx(stream: string, slug: string[])` — reads file at `/content/[stream]/[...slug].mdx`
   - Compiles with `next-mdx-remote/rsc` + `remark-gfm` + `rehype-pretty-code`
   - Returns `{ source, frontmatter }` or throws 404

5. **`lib/docs/toc.ts`** — Extract headings
   - Regex parse `## heading` and `### heading` from raw MDX source
   - Return `{ id: string, text: string, level: 2|3 }[]`
   - IDs are URL-safe slugified heading text

**Checkpoint:** `compileMdx('tech', ['architecture'])` returns compiled MDX source.

---

### Phase 5 — UI Components & Pages

**Goal:** Build the full responsive UI — login → dashboard → stream docs.

#### Steps

1. **`app/layout.tsx`** — Root layout
   - Google Font (Inter via `next/font/google`)
   - `<html lang="en" suppressHydrationWarning>` for dark mode
   - Dark mode: class-based strategy on `<html>`

2. **`app/not-found.tsx`** — Custom 404 page with back-to-dashboard link

3. **`app/(auth)/login/page.tsx`** — Login page
   - Fetch CSRF token from `/api/csrf` on mount
   - Form: username + password
   - POST to `/api/auth/login` with `X-CSRF-Token` header
   - Generic error message on failure
   - Loading state + disabled button on submit

4. **`app/dashboard/page.tsx`** — Stream picker (post-login home) ⭐ NEW
   - Server Component: reads session → extracts `teams[]`
   - Fetches stream metadata for each team the user belongs to
   - Renders a grid of `<StreamCard>` components (one per accessible stream)
   - If user has only 1 team, auto-redirect to that stream

5. **`components/dashboard/StreamCard.tsx`** — Stream card ⭐ NEW
   - Shows: stream icon + label + description
   - Links to `/docs/[stream]`
   - Hover animation (scale + glow)
   - Color-coded per stream (marketing=purple, sales=green, tech=blue, hr=orange)

6. **`app/docs/[stream]/page.tsx`** — Stream landing ⭐ NEW
   - Redirects to first doc in the stream's sidebar

7. **`app/docs/[stream]/[...slug]/page.tsx`** — Dynamic MDX page ⭐ NEW
   - Server Component: session → verify `teams` includes `stream` (double-check beyond middleware)
   - `compileMdx(stream, slug)` → render MDX
   - Extract TOC, build sidebar scoped to `stream`
   - Layout: `<Navbar>` + `<Sidebar>` + `<MDXContent>` + `<TableOfContents>`

8. **`components/layout/Navbar.tsx`**
   - App name + breadcrumb: `Dashboard / [Stream Name]`
   - Logged-in username + logout button
   - Link back to `/dashboard`

9. **`components/layout/Sidebar.tsx`**
   - Stream-scoped file tree (from `getSidebar(stream)`)
   - Collapsible nested folders
   - Active link highlighted
   - Mobile: hamburger drawer

10. **`components/layout/TableOfContents.tsx`**
    - Sticky right TOC
    - Active heading highlight via Intersection Observer

11. **`components/docs/MDXContent.tsx`** + **`components/docs/SearchBar.tsx`**
    - MDXContent: renders compiled MDX with styled component map
    - SearchBar: client-side search scoped to current stream's sidebar

12. **`components/ui/LoadingSpinner.tsx`** + **`components/ui/ErrorBoundary.tsx`**

**Checkpoint:** Login → `/dashboard` shows stream cards → click a card → enter `/docs/[stream]` → MDX renders with sidebar + TOC.

---

### Phase 6 — Polish & Hardening

**Goal:** Final security pass, responsiveness check, dark mode, and code quality.

#### Steps

1. **Dark mode** — `dark:` Tailwind variants throughout; test both modes

2. **Responsive** — mobile (320px), tablet (768px), desktop (1280px):
   - Dashboard: 1-col on mobile, 3-col grid on desktop
   - Sidebar → hamburger drawer on mobile
   - TOC hidden on mobile

3. **RBAC security audit:**
   - [ ] User with `teams: ['tech']` cannot access `/docs/marketing/...` (middleware returns 403)
   - [ ] JWT `teams` array is not exposed to client components (server-only)
   - [ ] Dashboard only renders streams the user belongs to
   - [ ] Direct URL access to unauthorized stream redirects to dashboard

4. **General security audit:**
   - [ ] `DOCS_USERS` / `SESSION_SECRET` never logged
   - [ ] Login always returns same generic error
   - [ ] CSRF validated on all mutating requests
   - [ ] Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`
   - [ ] Rate limiter: 6th attempt within 15min → 429
   - [ ] Security headers on all responses
   - [ ] No sensitive data in client bundle

5. **Error handling** — 404 for missing slugs, 403 for unauthorized streams, error boundaries for MDX failures

6. **ESLint + build** — `npm run lint` then `npm run build` must pass with zero errors

**Checkpoint:** `npm run build` passes. RBAC audit passes. Security checklist complete.

---

### Phase 7 — README & Sample Content

**Goal:** Self-documenting README with RBAC user setup guide + polished sample MDX docs.

#### Steps

1. **`README.md`** content:

   ```
   ## Setup
   1. Clone repo & npm install
   2. Copy .env.example → .env.local
   3. Generate bcrypt hashes for each user
   4. npm run dev

   ## User & Team Setup
   Format: username:bcrypt_hash:team1,team2 — separated by |
   DOCS_USERS=alice:$2b$10$...:marketing,sales|bob:$2b$10$...:tech

   ## Generate bcrypt hash:
   node -e "require('bcryptjs').hash('yourpassword', 10).then(console.log)"

   ## Stream/Content Setup
   Each top-level folder under /content = one stream.
   Add a user to a team to grant access to that stream.

   ## Deploying to Vercel → see Phase 8
   ```

2. **Sample MDX docs** — polished, real content for each stream folder to test the full system

---

### Phase 8 — Vercel Deployment

**Goal:** Deploy to production on Vercel with correct environment variable setup.

#### Steps

1. **Create a GitHub repository** and push the project:

   ```bash
   git init   # (already done — .git exists)
   git add .
   git commit -m "feat: initial secure docs system"
   git remote add origin https://github.com/<your-username>/docs.git
   git push -u origin main
   ```

2. **Create Vercel project**
   - Go to [vercel.com](https://vercel.com) → New Project
   - Import GitHub repository
   - Framework preset: **Next.js** (auto-detected)
   - Root directory: `./` (no change needed)

3. **Configure Environment Variables in Vercel Dashboard**
   Navigate to: Project → Settings → Environment Variables

   | Variable         | Value                                                     | Environments        |
   | ---------------- | --------------------------------------------------------- | ------------------- |
   | `DOCS_USERS`     | `alice:$2b$10$hash:marketing,sales\|bob:$2b$10$hash:tech` | Production, Preview |
   | `SESSION_SECRET` | `<min 32 char random string>`                             | Production, Preview |
   | `CSRF_SECRET`    | `<min 32 char random string>`                             | Production, Preview |
   | `NODE_ENV`       | `production`                                              | Production          |

   > ⚠️ **Never commit `.env.local` or put real secrets in `.env.example`**

4. **No extra Vercel config needed** — App Router + Edge middleware work natively on Vercel

5. **Deploy** — Push to `main` or click Deploy in dashboard

6. **Post-deploy RBAC verification:**
   - [ ] `/login` accessible
   - [ ] Login → `/dashboard` shows only user's streams
   - [ ] Click stream card → `/docs/[stream]` renders correctly
   - [ ] User with `tech` only cannot access `/docs/marketing` (403 or redirect)
   - [ ] Wrong credentials → generic error
   - [ ] Unauthenticated → `/login`
   - [ ] Security headers present ([securityheaders.com](https://securityheaders.com))
   - [ ] HTTPS enforced automatically by Vercel

   > ⚠️ **Vercel ephemeral memory:** In-memory rate limiter resets on cold starts. Acceptable for MVP — upgrade to Vercel KV for persistent rate limiting if needed.

7. **Custom domain (optional)**
   - Vercel Dashboard → Project → Settings → Domains
   - Add your custom domain and follow DNS configuration steps

**Checkpoint:** App is live on `https://<your-project>.vercel.app` and all post-deploy checks pass.

---

## 📊 Phase Summary

| Phase | Focus              | Status  | Key Output                                         |
| ----- | ------------------ | ------- | -------------------------------------------------- |
| **1** | Deps & Config      | ✅ Done | Packages installed, `next.config.mjs`              |
| **2** | Auth Core          | ✅ Done | `lib/auth/` + `lib/security/` with RBAC teams      |
| **3** | Middleware & API   | ⏳ Next | Edge auth + stream RBAC guard, login/logout routes |
| **4** | Docs Engine        | ⏳      | Stream-scoped MDX engine + sidebar + TOC           |
| **5** | UI & Pages         | ⏳      | Login → Dashboard → Stream Docs                    |
| **6** | Polish & Hardening | ⏳      | Dark mode, responsive, RBAC audit, build pass      |
| **7** | README & Content   | ⏳      | Self-documenting README + sample MDX per stream    |
| **8** | Vercel Deployment  | ⏳      | Live production app with env vars                  |

---

## ⚡ Quick Reference — Key Libraries

| Library              | Purpose             | Runtime              |
| -------------------- | ------------------- | -------------------- |
| `jose`               | JWT sign/verify     | Edge ✅              |
| `bcryptjs`           | Password hashing    | Node.js (API routes) |
| `zod`                | Input validation    | Both                 |
| `gray-matter`        | MDX frontmatter     | Node.js (server)     |
| `next-mdx-remote`    | MDX compilation     | Server Components    |
| `rehype-pretty-code` | Syntax highlighting | Build time           |
| `remark-gfm`         | GFM markdown        | Build time           |

---

> 📌 **Execute phases in order.** Each phase has a checkpoint — do not proceed until the checkpoint passes. Phase 6 (hardening) must complete before Phase 8 (deployment).
