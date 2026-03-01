You are a senior security-focused Next.js 16 App Router engineer.

Build a production-ready internal documentation system using Next.js 16+ App Router with strong security practices.

STACK:

- Next.js 16+
- App Router
- TypeScript
- TailwindCSS
- MDX for documentation
- No database
- No next-auth
- No external auth providers

GOAL:
Secure internal docs system with bcrypt-hashed users stored in environment variables.

---

## AUTHENTICATION REQUIREMENTS

Users stored in .env as:

DOCS_USERS=user1:$2b$10$hashedPassword1,user2:$2b$10$hashedPassword2
SESSION_SECRET=super-long-random-secret-min-32-chars

Rules:

- Parse users server-side only
- Never expose user list to client
- Login page at /login
- Validate input using Zod
- Compare passwords using bcrypt.compare()
- Use constant-time comparisons where applicable
- Implement rate limiting (5 attempts per 15 minutes per IP)
- On success:
  - Create signed JWT or encrypted session
  - Store in HTTP-only, Secure, SameSite=Strict cookie
  - Cookie must expire in 8 hours
- Protect all /docs routes using middleware
- Redirect unauthenticated users to /login
- Implement logout route that clears cookie
- Handle expired sessions properly
- Use Edge-compatible middleware

---

## CSRF + SECURITY HARDENING

- Implement CSRF protection using double-submit cookie pattern
- Set proper security headers:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: no-referrer
  - Content-Security-Policy (strict)
- Prevent timing attacks
- Sanitize all user input
- Do not leak auth errors (generic error message)

---

## DOCUMENTATION SYSTEM

- Store all docs inside /content as .mdx files
- Support nested folders
- Auto-generate sidebar from folder tree
- Dynamic route: /docs/[...slug]
- Use gray-matter for frontmatter parsing
- Frontmatter fields:
  - title
  - description
  - order
- Generate table of contents automatically
- Auto-link headings
- Syntax highlight code blocks
- Proper MDX config with next.config.mjs

---

## UI REQUIREMENTS

- Clean modern layout
- Sidebar (left)
- Navbar (top) with:
  - App name
  - Logged-in username
  - Logout button
- Right-side table of contents
- Fully responsive
- Dark mode support
- 404 page
- Loading UI
- Error boundaries

---

## SEARCH

- Simple client-side search
- Index titles + frontmatter
- No external services

---

## ARCHITECTURE

- Clean folder structure
- Separate:
  - lib/auth
  - lib/security
  - lib/docs
  - components
  - middleware
- Reusable utilities
- Strong typing everywhere

---

## DELIVERABLES

Return:

1. Full folder structure
2. All critical files fully implemented
3. Middleware implementation
4. Auth utilities
5. Rate limiting implementation (in-memory Map)
6. CSRF implementation
7. MDX configuration
8. Example .env file
9. Example MDX doc
10. README with:
    - setup instructions
    - how to generate bcrypt passwords
    - how to deploy to Vercel

---

## CONSTRAINTS

- No database
- No next-auth
- No unnecessary libraries
- Optimized for Vercel deployment
- Production-grade code quality
- Secure by default
- Clean and minimal
