# KrynoLux — Setup & Deployment Guide

## Project Structure

```
krynolux/
├── backend/          ← Node.js/Express API server
│   ├── server.js     ← Entry point
│   ├── auth.js       ← All auth endpoints
│   ├── otp.js        ← OTP generation, hashing, email delivery
│   ├── db.js         ← SQLite database + table creation
│   ├── package.json
│   ├── .env.example  ← Copy this to .env and fill in
│   └── .env          ← ⚠️ Never commit this file
└── frontend/
    └── krynolux.html ← The full app (single HTML file)
```

---

## Backend Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | What to set |
|---|---|
| `JWT_SECRET` | A long random string. Generate with: `openssl rand -hex 64` |
| `SMTP_HOST` | `smtp.gmail.com` (or your provider) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your **Gmail App Password** (not your real password) |
| `EMAIL_FROM` | `KrynoLux <noreply@krynolux.work>` |
| `FRONTEND_ORIGIN` | `http://localhost:3000` (dev) or `https://krynolux.work` (prod) |

#### Getting a Gmail App Password
1. Enable 2-Factor Authentication on your Google account
2. Go to **myaccount.google.com → Security → App passwords**
3. Create an app password for "Mail"
4. Paste the 16-character password into `SMTP_PASS`

### 3. Start the server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

The server starts at **http://localhost:3001**

---

## Frontend Setup

The frontend is a single HTML file (`krynolux.html`).

### Point it at your backend

Open `krynolux.html` and find this line near the top of the `<script>` block:

```js
const API = 'http://localhost:3001';
```

Change it to your deployed backend URL for production:

```js
const API = 'https://api.krynolux.work';
```

### Serve it locally

```bash
# Any static file server works — e.g.:
npx serve .
# Then open http://localhost:3000/krynolux.html
```

---

## API Endpoints

All endpoints return `{ success: true/false, message: "..." }`.

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/auth/register` | `name, email, password, level` | Create account + send OTP |
| POST | `/auth/login` | `email, password` | Login → returns JWT |
| POST | `/auth/verify-otp` | `email, code, purpose` | Verify OTP (purpose: `verify` or `reset`) |
| POST | `/auth/resend-otp` | `email, purpose` | Resend OTP (max 3×) |
| POST | `/auth/forgot-password` | `email` | Send password reset OTP |
| POST | `/auth/reset-password` | `resetToken, newPassword` | Set new password |
| GET | `/auth/me` | *(Bearer token)* | Get current user info |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server status check |

---

## OTP Flow — How It Works

```
Register                          Login (forgot password)
───────────────────────────────   ────────────────────────────────
1. POST /auth/register            1. POST /auth/forgot-password
   → server creates unverified       → server sends reset OTP
     user, emails 6-digit OTP
                                  2. POST /auth/verify-otp
2. POST /auth/verify-otp             { purpose: 'reset' }
   { purpose: 'verify' }             → returns short-lived resetToken
   → account activated,
     JWT returned                 3. POST /auth/reset-password
                                     { resetToken, newPassword }
3. User enters the app               → password updated
```

**Security details:**
- OTP codes are **bcrypt-hashed** before storage — the raw code is never saved
- Each code is **single-use** — verified codes are immediately marked used
- Codes **expire in 10 minutes** (configurable via `OTP_EXPIRES_MINUTES`)
- Maximum **3 resends** per email per window (configurable via `OTP_MAX_RESENDS`)
- Auth endpoints are **rate-limited** to 10 requests per 15 minutes per IP
- Login uses constant-time comparison to prevent **user enumeration**
- Forgot-password always returns the same response whether the email exists or not

---

## Production Deployment

### Backend (e.g. Railway, Render, Fly.io, VPS)

1. Push the `backend/` folder to your server
2. Set all environment variables in the platform's dashboard
3. Run `npm install && npm start`
4. Put it behind a reverse proxy (nginx/Caddy) with HTTPS

### Frontend

Host `krynolux.html` on any static host:
- **Cloudflare Pages** — drag and drop
- **Netlify** — drag and drop or git deploy
- **Your VPS** — serve with nginx

### nginx config example (backend on same server)

```nginx
server {
    listen 443 ssl;
    server_name api.krynolux.work;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Database

KrynoLux uses **SQLite** (`krynolux.db`) — no external database needed.

Tables created automatically on first run:
- `users` — accounts (id, name, email, bcrypt password, level, verified flag)
- `otps` — hashed OTP codes with expiry and use tracking

To back up the database, just copy `krynolux.db`.

---

## Education Levels (stored in `users.level`)

| Value | Display |
|---|---|
| `grade_5` – `grade_8` | Elementary / Middle School |
| `grade_9` – `grade_12` | High School |
| `college_freshman` – `college_senior` | College |
| `graduate` | Graduate / University |

---

## Common Issues

**"Missing required environment variables"**  
→ You haven't created the `.env` file. Run `cp .env.example .env` and fill it in.

**OTP emails not arriving**  
→ Check your Gmail App Password. Make sure 2FA is enabled. Check spam folder.

**CORS error in browser**  
→ Set `FRONTEND_ORIGIN` in `.env` to match the exact URL you're opening the HTML from.

**`better-sqlite3` build error on install**  
→ You need Python and a C compiler. On Ubuntu: `sudo apt install python3 build-essential`

---

## Environment Variables Reference

```env
PORT=3001
NODE_ENV=production
FRONTEND_ORIGIN=https://krynolux.work
JWT_SECRET=<64-char random hex>
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM=KrynoLux <noreply@krynolux.work>
OTP_EXPIRES_MINUTES=10
OTP_MAX_RESENDS=3
OTP_DIGITS=6
DB_PATH=./krynolux.db
```
# animated-spoon
