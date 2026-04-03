# 🚀 Deployment Guide

## Option 1: Backend on Railway + Domain on Vercel

### Step 1: Deploy Backend to Railway

1. **Create Railway Account**
   - Go to [Railway.app](https://railway.app)
   - Login with GitHub

2. **Connect Repository**
   - Click "Create New Project"
   - Select "Deploy from GitHub"
   - Choose your `animated-spoon` repository
   - Select main branch

3. **Configure Environment Variables**
   - Railway automatically detects `package.json`
   - Go to "Variables" tab
   - Add all from your `.env` file:
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

4. **Deploy**
   - Railway auto-deploys when you push to main
   - Your backend URL will be: `https://yourdomain-production.up.railway.app`
   - Copy this URL!

### Step 2: Update Frontend to Use Railway Backend

Your frontend (index.html) has an API variable. Update it:

Find this line in `index.html`:
```javascript
const API = 'http://localhost:3001';
```

Change to:
```javascript
const API = 'https://your-railway-url.up.railway.app';
```

### Step 3: Point Vercel Domain to Railway

In Vercel:
1. Go to your project settings → Domains
2. Add your custom domain
3. Create a CNAME record pointing to Railway:
   - Name: `yourdomain.com`
   - Value: Your Railway app URL

Or use Railway's proxy:
1. In Railway, go to Deployments → Custom Domain
2. Point your Vercel domain there

### Step 4: Redeploy

Push updated code:
```bash
git add index.html
git commit -m "Update API endpoint to Railway production"
git push origin main
```

Railway auto-deploys!

---

## Verification

✅ Backend: `https://your-railway-url.up.railway.app/admin/users` (should require auth)
✅ Frontend: `https://yourdomain.com` (should load your app)
✅ Database: SQLite persists on Railway

Done! 🎉
