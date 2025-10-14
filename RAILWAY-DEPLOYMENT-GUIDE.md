# 🚂 Railway Deployment - Step by Step Guide

## Prerequisites
- GitHub account
- Railway account (free trial) - https://railway.app
- Backend code in GitHub

---

## Step 1: Prepare Backend for Deployment

### 1.1 Create Separate Backend Repository (Recommended)

Railway works best with a dedicated backend repository.

**Option A: Create new repo for backend only**

1. Go to https://github.com/new
2. Create repository: "dispatch-backend"
3. Don't initialize with README

```bash
# Navigate to backend directory
cd backend

# Initialize git
git init

# Add all backend files
git add .

# Commit
git commit -m "Initial backend commit for Railway"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/dispatch-backend.git

# Push
git branch -M main
git push -u origin main
```

**Option B: Use same repo with root directory config**

Keep everything in one repo and tell Railway to use the `backend` folder.

---

## Step 2: Sign Up for Railway

1. Go to https://railway.app
2. Click "Start a New Project" or "Login"
3. Choose "Login with GitHub"
4. Authorize Railway to access your GitHub

**Free Trial**: You get $5 credit per month (about 500 compute hours)

---

## Step 3: Create New Project on Railway

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository:
   - If separate backend repo: Select "dispatch-backend"
   - If same repo: Select "dispatch-app"
4. Railway will detect it's a Node.js project

---

## Step 4: Configure Root Directory (If using same repo)

If your backend is in a subdirectory:

1. Go to project Settings
2. Find "Root Directory" setting
3. Set to: `backend`
4. Click "Update"

---

## Step 5: Configure Environment Variables

1. Click on your service
2. Go to "Variables" tab
3. Add these variables:

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-app.vercel.app
```

**Note**: Update `FRONTEND_URL` after you deploy to Vercel

### How to Add Variables:

1. Click "+ New Variable"
2. Name: `NODE_ENV`, Value: `production`
3. Click "Add"
4. Repeat for other variables

---

## Step 6: Deploy!

Railway will automatically:
1. Install dependencies (`npm install`)
2. Build TypeScript (`npm run build`)
3. Start server (`npm start`)

**First deployment takes 2-3 minutes**

Watch the logs:
- Click "View Logs"
- You'll see build and runtime logs
- Look for: `🚀 Server running on port 3001`

---

## Step 7: Get Your Backend URL

1. Go to "Settings" tab
2. Scroll to "Domains" section
3. Click "Generate Domain"
4. Copy your Railway URL (e.g., `your-backend.up.railway.app`)

**Your API is now live!**

Test it:
```
https://your-backend.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T...",
  "environment": "production"
}
```

---

## Step 8: Update Vercel Environment Variable

Now that backend is deployed:

1. Go to Vercel dashboard
2. Select your dispatch-app project
3. Go to Settings → Environment Variables
4. Update `VITE_API_URL`:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```
5. Click "Save"
6. Go to Deployments → Redeploy latest

---

## Step 9: Update Railway FRONTEND_URL

1. Go back to Railway
2. Select your project
3. Go to "Variables" tab
4. Update `FRONTEND_URL` to your actual Vercel URL:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
5. Railway will automatically redeploy

---

## Automatic Deployments

Railway automatically redeploys on every push:

```bash
cd backend

# Make changes
git add .
git commit -m "Updated API endpoint"
git push origin main

# Railway automatically detects and deploys!
```

---

## Monitoring

### View Logs

1. Click on your service
2. Click "View Logs"
3. See real-time logs
4. Filter by:
   - Build logs
   - Deploy logs
   - Application logs

### Metrics

1. Go to "Metrics" tab
2. View:
   - CPU usage
   - Memory usage
   - Network traffic
   - Request count

### Deployments

1. Go to "Deployments" tab
2. See all deployment history
3. Click any deployment to see details
4. Rollback if needed

---

## Adding PostgreSQL Database (Optional)

### Step 1: Add Database

1. In your Railway project
2. Click "+ New"
3. Select "Database"
4. Choose "PostgreSQL"

### Step 2: Get Connection String

1. Click on PostgreSQL service
2. Go to "Connect" tab
3. Copy `DATABASE_URL`

### Step 3: Add to Your Backend

1. Go to your backend service
2. Variables tab
3. Add new variable:
   ```
   DATABASE_URL=postgresql://...
   ```

### Step 4: Install pg in Backend

```bash
cd backend
npm install pg
```

Update your code to use PostgreSQL instead of in-memory storage.

---

## Custom Domain

### Add Your Domain

1. Go to Settings → Domains
2. Click "Custom Domain"
3. Enter your domain: `api.yourdomain.com`
4. Add DNS records shown by Railway:
   ```
   Type: CNAME
   Name: api
   Value: your-backend.up.railway.app
   ```
5. Wait for DNS propagation (5-30 minutes)

---

## Troubleshooting

### Build Fails

**Error**: `npm run build failed`

**Solution**:
```bash
# Test build locally
cd backend
npm install
npm run build

# Fix any TypeScript errors
# Push fix to GitHub
```

### Server Crashes

**Error**: `Application failed to respond`

**Check**:
1. View logs for error messages
2. Verify `PORT` environment variable is set
3. Check your `server.ts` uses `process.env.PORT`

### CORS Errors

**Error**: `Access-Control-Allow-Origin`

**Check**:
1. `FRONTEND_URL` is set correctly
2. Your backend CORS config includes the frontend URL
3. Both are using HTTPS (not mixed HTTP/HTTPS)

### Connection Refused

**Error**: Frontend can't connect to backend

**Check**:
1. Backend service is running (green status)
2. Domain is generated in Railway
3. Vercel `VITE_API_URL` matches Railway URL
4. Test health endpoint directly

---

## Railway CLI (Alternative Method)

### Install

```bash
npm install -g @railway/cli
```

### Login

```bash
railway login
```

### Deploy

```bash
cd backend
railway init
railway up
```

---

## Project Settings

### Service Settings

Location: Settings tab

```
Name: dispatch-backend
Root Directory: backend (if applicable)
Build Command: npm run build
Start Command: npm start
Watch Paths: /backend/** (if applicable)
```

### Environment Variables

```
Production:
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-app.vercel.app

Optional (with database):
DATABASE_URL=postgresql://...
```

---

## Scaling (Optional)

Railway automatically scales, but you can configure:

1. Go to Settings → Service
2. Adjust:
   - **Memory**: 512MB - 8GB
   - **CPU**: Shared - Dedicated
   - **Replicas**: 1-10 instances

**Free tier**: 512MB RAM, shared CPU, 1 replica

---

## Costs

### Starter Plan (Free Trial)
- ✅ $5 credit per month
- ✅ ~500 compute hours
- ✅ Perfect for development/testing

### Hobby Plan ($5/month)
- ✅ 500 compute hours
- ✅ $5 included usage
- ✅ Pay-as-you-go after

### Pro Plan ($20/month)
- ✅ Unlimited compute hours
- ✅ Priority support
- ✅ Team collaboration

**Estimate for this project**: $5-10/month

---

## Health Checks

Railway automatically monitors your service:

- HTTP health checks every 30 seconds
- Restart if unhealthy
- Alert on repeated failures

Configure custom health check:

1. Settings → Health Check
2. Set path: `/health`
3. Timeout: 10 seconds

---

## Rollback a Deployment

If something breaks:

1. Go to "Deployments" tab
2. Find last working deployment
3. Click "..." menu
4. Select "Redeploy"
5. Confirm

---

## Viewing Build/Runtime Logs

### Build Logs

```
npm install
npm run build
Compiling TypeScript...
Build complete!
```

### Runtime Logs

```
🚀 Server running on port 3001
📊 Environment: production
🌐 Frontend URL: https://your-app.vercel.app
```

### Filter Logs

- Click "Filter" button
- Choose:
  - Build logs only
  - Deploy logs only
  - Application logs only
  - Error logs only

---

## Best Practices

1. **Use Environment Variables** for all config
2. **Enable Health Checks** at `/health` endpoint
3. **Monitor Logs** regularly
4. **Set Up Alerts** for errors
5. **Use Separate Database** service
6. **Keep Secrets Secure** (never commit `.env`)
7. **Test Locally** before pushing

---

## Quick Reference

### Your Railway URLs:
- Service: `https://your-backend.railway.app`
- Dashboard: `https://railway.app/dashboard`
- Docs: `https://docs.railway.app`

### API Endpoints:
```
GET  /health
GET  /api/jobs
POST /api/jobs
PUT  /api/jobs/:id
DELETE /api/jobs/:id
GET  /api/drivers
POST /api/drivers
PUT  /api/drivers/:id
DELETE /api/drivers/:id
```

### Important Commands:
```bash
# Push changes
cd backend
git add .
git commit -m "message"
git push origin main

# View logs
railway logs

# Open dashboard
railway open
```

---

## Integration with Vercel

Your architecture:

```
┌─────────────────┐
│  Vercel         │
│  (Frontend)     │ ──────────┐
│  React + Vite   │           │
└─────────────────┘           │
                              │ HTTPS
                              │
                              ▼
                    ┌─────────────────┐
                    │  Railway        │
                    │  (Backend)      │
                    │  Express.js     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  PostgreSQL     │
                    │  (Optional)     │
                    └─────────────────┘
```

---

## Support

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Status Page: https://status.railway.app

---

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Get Railway URL
3. ✅ Update Vercel environment variable
4. ✅ Update Railway FRONTEND_URL
5. ✅ Test the connection
6. 🔄 Add PostgreSQL database (optional)
7. 🔄 Set up monitoring
8. 🔄 Configure custom domain

---

**Your backend is now live! 🎉**

Test your deployed API:
- Health: `https://your-backend.railway.app/health`
- Jobs: `https://your-backend.railway.app/api/jobs`
- Drivers: `https://your-backend.railway.app/api/drivers`
