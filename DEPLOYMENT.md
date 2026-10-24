# Guild Club Services - Production Deployment Guide

## 1. Architectural Guidance: Should You Deploy Frontend & Backend Separately?

### **Verdict: Deploy Together as a Single Unified Application (Do NOT Separate).**

Here is why:

1. **Next.js 16 App Router Architecture**:
   Next.js is a **full-stack framework**. Your user interface consists of **React Server Components (RSC)**, **Server Actions (`"use server"`)**, and internal server-side data fetchers. Separating frontend and backend into two different codebases or servers would break Server Actions and SSR streaming, forcing you to rewrite everything into client-side REST APIs.

2. **Secure Direct Database Access**:
   Server Components and Server Actions connect directly to **Neon PostgreSQL** via Drizzle ORM using connection pooling (`@neondatabase/serverless`). Database credentials never reach the browser client.

3. **Frictionless Cookie-Based Authentication**:
   The app uses secure, `httpOnly`, encrypted JWT session cookies. Because the UI and API/Server Actions share the exact same domain origin, there are **no CORS issues**, no cross-domain cookie rejection, and no vulnerability to token theft via JavaScript.

4. **Zero API Version Skew & Atomic Deployments**:
   When you deploy via Git, the frontend UI and backend business logic deploy simultaneously in one atomic step. You never have to worry about the frontend calling an outdated or mismatched backend API endpoint.

---

## 2. Recommended Deployment Platform: Vercel (Recommended)

Since this app is built with **Next.js 16 + Neon Serverless Postgres + Vercel Blob**, deploying on **Vercel** is the most seamless, high-performance path.

### Step-by-Step Vercel Deployment:

1. **Push to GitHub**:
   Ensure your code is pushed to your GitHub repository:
   `https://github.com/vasu-8424/guild_club-services`

2. **Import Project into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your `guild_club-services` repository.
   - Framework Preset will automatically detect **Next.js**.
   - Root Directory: `./` (leave default).

3. **Configure Environment Variables**:
   In the Vercel project settings, add the following environment variables:

   | Variable | Description | Example / Note |
   |---|---|---|
   | `DATABASE_URL` | Neon pooled connection string | `postgresql://user:pass@ep-pooler.region.neon.tech/neondb?sslmode=require` |
   | `DATABASE_URL_UNPOOLED` | Neon direct connection string (for migrations) | `postgresql://user:pass@ep-direct.region.neon.tech/neondb?sslmode=require` |
   | `AUTH_SECRET` | Secret key for JWT session tokens (32+ chars) | Generate with: `openssl rand -base64 32` |
   | `APP_TIMEZONE` | Business timezone | `Asia/Kolkata` |
   | `EMAIL_FROM` | Sender address for notifications | `Guild Club Services <noreply@yourdomain.com>` |
   | `RESEND_API_KEY` | Resend API key for transaction emails | `re_xxxxxxxxxxxxxxxxxxxx` |
   | `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (for session photos & signatures) | Connect via Vercel Storage tab |

4. **Deploy**:
   - Click **Deploy**. Vercel will build and launch your application globally on its Edge network.

5. **Run Initial Database Migration & Seeding**:
   From your local terminal (connected to your production Neon database via `.env` or CLI):
   ```bash
   # 1. Apply Drizzle database migrations
   npm run db:migrate

   # 2. Seed initial Super Admin credentials & lookup tables
   npm run db:seed
   ```

---

## 3. Alternative Deployment: Docker / Railway / Render / VPS

If you prefer deploying a containerized Node.js instance on **Railway**, **Render**, **AWS ECS**, **DigitalOcean App Platform**, or an **Ubuntu VPS**:

A production-ready multi-stage `Dockerfile` is included in the project root.

### Building & Running with Docker:

```bash
# Build production Docker container
docker build -t guild-club-services .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@ep-pooler.region.neon.tech/neondb?sslmode=require" \
  -e DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-direct.region.neon.tech/neondb?sslmode=require" \
  -e AUTH_SECRET="your-32-char-random-secret" \
  -e APP_TIMEZONE="Asia/Kolkata" \
  -e RESEND_API_KEY="re_xxx" \
  -e EMAIL_FROM="Guild Club <noreply@yourdomain.com>" \
  -e BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxx" \
  guild-club-services
```

### Running on Railway or Render:
- Connect your GitHub repo.
- Select **Node.js** or **Docker**.
- Set the Build Command: `npm run build`
- Set the Start Command: `npm start` (or let Dockerfile handle it).
- Add the environment variables listed above.

---

## 4. Health Check & Monitoring

The application includes an uptime health-check endpoint:
- **Basic Health Ping**: `GET /api/health`
  - Returns `200 OK` with application uptime and timestamp.
  - Used by load balancers, Render/Railway health monitors, or UptimeRobot.
- **Deep Database Health Check**: `GET /api/health?db=true`
  - Pings Neon PostgreSQL (`SELECT 1`) to confirm live database connectivity.

---

## 5. Production Checklist

- [x] Sharp-corner token styling applied app-wide (0px radius).
- [x] All 30 routes compile cleanly (`npm run build`).
- [x] Production security headers active in `next.config.ts`.
- [x] Multi-stage `Dockerfile` and `.dockerignore` configured.
- [x] Production health check route at `/api/health`.
- [x] Environment variable schema documented in `.env.example`.
- [x] Migration (`src/db/migrate.ts`) and seed (`src/db/seed.ts`) scripts verified.
- [x] All automated Playwright E2E test suites passing.
