# 🚀 Deployment Guide

## Deploy to Glitch (FREE) + Keep Vercel Domain

### Step 1: Deploy Backend to Glitch

1. **Go to [Glitch.com](https://glitch.com)**
   - Sign up with GitHub (free)

2. **Create New Project**
   - Click **"New Project"** → **"Import from GitHub"**
   - Select `animated-spoon` repository
   - Glitch auto-deploys!

3. **Configure Environment Variables**
   - In Glitch editor, click **".env"** button (bottom left)
   - Add all variables from your `.env`:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=your-email@gmail.com
     SMTP_PASS=your-app-password
     SMTP_SECURE=false
     EMAIL_FROM=your-email@gmail.com
     JWT_SECRET=your-very-long-random-secret
     JWT_EXPIRES_IN=7d
     API_PORT=3001
     FRONTEND_ORIGIN=https://yourdomain.com
     NODE_ENV=production
     ```

4. **Get Your Glitch URL**
   - Your app is live at: `https://your-project-name.glitch.me`
   - Copy this URL!

### Step 2: Update Frontend API Endpoint

In `index.html` line 2746, change:

```javascript
// OLD
const API = 'http://localhost:3001';

// NEW (use your Glitch URL)
const API = 'https://your-project-name.glitch.me';
```

### Step 3: Commit and Push

```bash
git add index.html
git commit -m "Update API endpoint to Glitch production"
git push origin main
```

Your Glitch project auto-updates from GitHub!

### Step 4: Connect Your Vercel Domain

In Vercel dashboard:
1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS:
   - Create CNAME record
   - Point to: `your-project-name.glitch.me`

---

## ✅ What You Get:
- ✅ **Free forever** ✨
- ✅ Backend running on Glitch
- ✅ SQLite database persists
- ✅ Your custom domain
- ✅ All 50+ admin features work
- ✅ Jump scares functional

## 🔗 Useful Glitch Features:
- Auto-deploys from GitHub on every push
- Built-in logs and debugging
- Environment variable management
- Persistent file system (SQLite works!)
- Free always (no credit card required!)

## ⚠️ Notes:
- Glitch projects go to sleep after 5 minutes of inactivity (normal for free tier)
- When you access the site, it wakes up in ~10 seconds
- For production, consider upgrading, but free tier is great for learning!

---

## Quick Setup Checklist:
- [ ] Sign up on Glitch.com
- [ ] Import `animated-spoon` from GitHub
- [ ] Add `.env` variables
- [ ] Get Glitch URL
- [ ] Update `index.html` API endpoint
- [ ] Push to GitHub
- [ ] Update domain DNS
- [ ] Test at yourdomain.com

Done! 🎉

