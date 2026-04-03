# 🚀 Deployment Guide

## Deploy to Replit (FREE) + Keep Vercel Domain

### Step 1: Deploy Backend to Replit

1. **Go to [Replit.com](https://replit.com)**
   - Sign up with GitHub (or email)

2. **Create New Repl**
   - Click **"Create Repl"** (top left)
   - Select **"Import from GitHub"**
   - Paste: `https://github.com/nepaliterminal/animated-spoon`
   - Click **"Import"**
   - Wait for it to load (~1 minute)

3. **Install Dependencies**
   - Replit auto-detects `package.json`
   - It auto-runs `npm install`
   - Wait for green checkmark ✅

4. **Add Environment Variables**
   - Click **"Secrets"** (padlock icon on left sidebar)
   - Click **"Add new secret"** for each variable:
     ```
     SMTP_HOST = smtp.gmail.com
     SMTP_PORT = 587
     SMTP_USER = your-email@gmail.com
     SMTP_PASS = your-app-password
     SMTP_SECURE = false
     EMAIL_FROM = your-email@gmail.com
     JWT_SECRET = your-very-long-random-secret-key
     JWT_EXPIRES_IN = 7d
     API_PORT = 3001
     FRONTEND_ORIGIN = https://yourdomain.com
     NODE_ENV = production
     ```

5. **Run Your App**
   - Click green **"Run"** button (top)
   - Look for output like: `Server running on port 3001`
   - Your Replit URL will appear (look for the webview URL)
   - Copy it! (looks like `https://your-username.replit.dev`)

### Step 2: Update Frontend API Endpoint

In `index.html` line 2746, change:

```javascript
// OLD
const API = 'http://localhost:3001';

// NEW (use your Replit URL)
const API = 'https://your-username.replit.dev';
```

### Step 3: Commit and Push

```bash
git add index.html
git commit -m "Update API endpoint to Replit production"
git push origin main
```

### Step 4: Enable Always-On (Optional but Recommended)

In Replit:
- Click **"Repl"** tab (top left)
- Scroll to **"Always On"**
- Click **"Upgrade to Always On"** (small paid feature, ~$7/month, or free with limited hours)

*Note: Without Always On, your Replit goes to sleep after 5 minutes of inactivity, but wakes up when accessed (~10 second startup)*

### Step 5: Connect Your Vercel Domain

In Vercel dashboard:
1. Go to **Settings** → **Domains**
2. Select your domain
3. Go to **DNS Records**
4. Create/Update **CNAME record**:
   - **Name**: `api` (or leave as is for root)
   - **Value**: `your-username.replit.dev`
   - Click **"Save"**

Then update your frontend code to use:
```javascript
const API = 'https://api.yourdomain.com'; // if you used CNAME subdomain
// OR
const API = 'https://your-username.replit.dev'; // direct Replit URL
```

---

## ✅ What You Get (FREE):
- ✅ Backend running on Replit
- ✅ SQLite database persists
- ✅ Your custom domain works
- ✅ All 50+ admin features
- ✅ Jump scares functional
- ✅ Completely free!

## 🔄 Auto-Updates from GitHub

Your Replit is connected to GitHub. To update:
1. Make changes locally or on GitHub
2. Push to main branch
3. In Replit, click **"Version control"** → **"Pull from GitHub"**
4. Your app updates!

---

## ⚠️ Important Notes:

### Without Always On (Free):
- App sleeps after 5 min of no activity
- First request takes ~10 seconds to wake up
- Perfect for development/testing
- Good for hobby projects

### With Always On ($7/month):
- App runs 24/7
- Instant response times
- Recommended for production

---

## Quick Setup Checklist:

- [ ] Sign up on Replit.com with GitHub
- [ ] Click "Create Repl" → "Import from GitHub"
- [ ] Paste repo URL: `https://github.com/nepaliterminal/animated-spoon`
- [ ] Wait for npm install to finish
- [ ] Click "Secrets" and add all `.env` variables
- [ ] Click green "Run" button
- [ ] Copy your Replit URL (shows in webview)
- [ ] Update `index.html` line 2746 with Replit URL
- [ ] Commit and push to GitHub
- [ ] Set up domain DNS in Vercel
- [ ] Test at yourdomain.com

---

## 🧪 Test Your Deployment:

```bash
# Test backend is running
curl https://your-username.replit.dev/admin/users
# Should return 401 (needs auth token) ✅

# Test frontend
# Go to https://yourdomain.com
# Should load your KrynoLux app ✅
```

Done! 🎉 Your app is live!


