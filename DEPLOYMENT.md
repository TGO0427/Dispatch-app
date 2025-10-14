# Deployment Guide

This guide explains how to deploy the Dispatch Management System with frontend on Vercel and backend on Railway.

## Architecture

- **Frontend**: React + TypeScript + Vite → Vercel
- **Backend**: Express.js + TypeScript → Railway
- **Storage**: Currently in-memory (ready for database integration)

---

## Prerequisites

1. [GitHub](https://github.com) account
2. [Vercel](https://vercel.com) account
3. [Railway](https://railway.app) account
4. Git installed locally

---

## Part 1: Deploy Backend to Railway

### Step 1: Push Backend to GitHub

```bash
cd backend
git init
git add .
git commit -m "Initial backend commit"
git branch -M main
git remote add origin <your-backend-repo-url>
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your backend repository
5. Railway will automatically detect the Node.js project

### Step 3: Configure Environment Variables

In Railway dashboard:

1. Go to your project → Variables tab
2. Add the following variables:
   ```
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   ```

### Step 4: Get Your Backend URL

1. Go to Settings tab
2. Under "Domains", generate a domain
3. Copy your Railway domain (e.g., `your-app.railway.app`)
4. Your API will be available at: `https://your-app.railway.app`

**API Endpoints:**
- Health check: `https://your-app.railway.app/health`
- Jobs: `https://your-app.railway.app/api/jobs`
- Drivers: `https://your-app.railway.app/api/drivers`

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Push Frontend to GitHub

```bash
# From the root dispatch-app directory
git add .
git commit -m "Initial frontend commit"
git branch -M main
git remote add origin <your-frontend-repo-url>
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [Vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Vercel will auto-detect Vite

### Step 3: Configure Build Settings

Vercel should auto-detect these, but verify:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 4: Set Environment Variables

In Vercel project settings → Environment Variables:

```
VITE_API_URL=https://your-app.railway.app
```

### Step 5: Deploy

1. Click "Deploy"
2. Wait for deployment to complete
3. Your app will be live at: `https://your-app.vercel.app`

---

## Part 3: Update CORS Settings

After both deployments:

1. Go back to Railway
2. Update the `FRONTEND_URL` environment variable with your actual Vercel URL
3. Railway will automatically redeploy

---

## Local Development Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

Server will run on http://localhost:3001

### Frontend

```bash
# From root directory
npm install
npm run dev
```

Frontend will run on http://localhost:3000

---

## Environment Variables Reference

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001     # Local development
# VITE_API_URL=https://your-app.railway.app  # Production
```

### Backend (.env)

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
# DATABASE_URL=your_database_url    # When adding database
```

---

## Adding a Database (Optional)

### Railway PostgreSQL

1. In Railway, click "New" → "Database" → "PostgreSQL"
2. Railway will provide a `DATABASE_URL`
3. Install database library in backend:
   ```bash
   cd backend
   npm install pg
   ```
4. Update your backend code to use PostgreSQL instead of in-memory storage

### Alternative: MongoDB

1. Create a MongoDB Atlas account
2. Get your connection string
3. Install MongoDB driver:
   ```bash
   cd backend
   npm install mongodb
   ```
4. Add `MONGODB_URI` to Railway environment variables

---

## Monitoring & Logs

### Vercel

- Dashboard → Your Project → Deployments → View logs
- Real-time logs available during builds and runtime
- Analytics available in Analytics tab

### Railway

- Dashboard → Your Project → Deployments → View logs
- Real-time logs in the Logs tab
- Metrics available in Metrics tab

---

## Custom Domains

### Vercel

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Railway

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

---

## Troubleshooting

### Frontend can't connect to backend

1. Check `VITE_API_URL` in Vercel environment variables
2. Verify CORS is enabled in backend
3. Check Railway backend logs for errors

### Railway deployment fails

1. Check `package.json` has correct scripts
2. Verify TypeScript compiles: `npm run build`
3. Check Railway logs for specific error

### Vercel build fails

1. Verify all dependencies are in `package.json`
2. Check for TypeScript errors: `npm run build` locally
3. Review Vercel build logs

---

## Costs

### Vercel
- **Free tier**: Perfect for this project
- Includes: 100 GB bandwidth, unlimited deploys

### Railway
- **Free trial**: $5 credit monthly
- **Hobby Plan**: $5/month for 500 hours
- **Pro Plan**: $20/month for unlimited hours

---

## Security Checklist

- [ ] Environment variables set in both platforms
- [ ] CORS configured correctly
- [ ] No sensitive data in frontend code
- [ ] `.env` files in `.gitignore`
- [ ] API endpoints secured (add authentication as needed)
- [ ] HTTPS enabled (automatic on both platforms)

---

## Continuous Deployment

Both Vercel and Railway support automatic deployments:

- **Push to `main` branch** → Automatic deployment
- **Pull requests** → Preview deployments (Vercel)
- **Rollback** → Available in both dashboards

---

## Support & Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Vite Documentation](https://vitejs.dev)
- [Express Documentation](https://expressjs.com)

---

## Quick Commands Reference

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Backend
npm run dev          # Start development server with auto-reload
npm run build        # Compile TypeScript
npm start            # Start production server
```

---

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Deploy frontend to Vercel
3. ✅ Test the deployed application
4. 🔄 Add database (PostgreSQL/MongoDB)
5. 🔄 Add authentication
6. 🔄 Set up monitoring and alerts
7. 🔄 Configure custom domains

---

**Your application is now live! 🎉**

- Frontend: `https://your-app.vercel.app`
- Backend API: `https://your-app.railway.app`
