# 🚀 Vercel Deployment - Step by Step Guide

## Prerequisites
- GitHub account
- Vercel account (free) - https://vercel.com/signup
- Your code pushed to GitHub

---

## Step 1: Push Your Code to GitHub

### Option A: Create New Repository on GitHub

1. Go to https://github.com/new
2. Create a new repository (e.g., "dispatch-app")
3. **DO NOT** initialize with README (we already have code)
4. Click "Create repository"

### Option B: Use Existing Repository

If you already have a repo, skip to Step 2.

---

## Step 2: Initialize Git and Push to GitHub

Open your terminal in the project root directory:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - Ready for Vercel deployment"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace**:
- `YOUR_USERNAME` with your GitHub username
- `YOUR_REPO_NAME` with your repository name

---

## Step 3: Deploy to Vercel

### 3.1 Sign Up / Log In to Vercel

1. Go to https://vercel.com
2. Click "Sign Up" or "Log In"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub account

### 3.2 Import Your Project

1. Click "Add New..." button (top right)
2. Select "Project"
3. You'll see a list of your GitHub repositories
4. Find your "dispatch-app" repository
5. Click "Import"

### 3.3 Configure Project Settings

Vercel will auto-detect Vite. Verify these settings:

```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

**These should be auto-detected. Don't change unless needed.**

### 3.4 Add Environment Variables

Before deploying, add your environment variable:

1. Scroll down to "Environment Variables" section
2. Add the following:

```
Name: VITE_API_URL
Value: http://localhost:3001
```

**Note**: We'll update this after deploying the backend to Railway.

For now, use localhost or leave it empty if you want to test with just the frontend.

### 3.5 Deploy!

1. Click "Deploy"
2. Wait 1-2 minutes for the build to complete
3. You'll see a success screen with your URL!

Your app will be live at: `https://your-app-name.vercel.app`

---

## Step 4: Update Environment Variable (After Backend Deployment)

Once you deploy your backend to Railway:

1. Go to your Vercel dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Edit `VITE_API_URL`
5. Change value to: `https://your-backend.railway.app`
6. Click "Save"
7. Go to "Deployments" tab
8. Click "..." menu on the latest deployment
9. Select "Redeploy"

---

## Step 5: Custom Domain (Optional)

### Using Your Own Domain:

1. Go to Project Settings → "Domains"
2. Add your custom domain (e.g., `dispatch.yourdomain.com`)
3. Add the DNS records shown by Vercel to your domain provider
4. Wait for DNS propagation (5-30 minutes)

### Using Vercel's Free Domain:

Your app is automatically available at:
- `https://your-app-name.vercel.app`
- `https://your-app-name-USERNAME.vercel.app`

---

## Automatic Deployments

Vercel automatically deploys on every push to your main branch:

```bash
# Make changes to your code
git add .
git commit -m "Updated feature"
git push origin main
# Vercel automatically deploys the changes!
```

---

## Preview Deployments

For testing changes before merging:

```bash
# Create a new branch
git checkout -b feature/new-feature

# Make changes
git add .
git commit -m "New feature"
git push origin feature/new-feature

# Create Pull Request on GitHub
# Vercel automatically creates a preview deployment!
```

---

## Troubleshooting

### Build Fails

**Error**: `Command "npm run build" exited with 1`

**Solution**:
1. Test build locally: `npm run build`
2. Fix any TypeScript errors
3. Push the fix to GitHub
4. Vercel will automatically retry

### Environment Variables Not Working

**Error**: API calls failing

**Solution**:
1. Make sure variable starts with `VITE_`
2. Check spelling: `VITE_API_URL` (case-sensitive)
3. Redeploy after adding variables

### Port 3000 Already in Use Locally

**Solution**:
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use a different port
npm run dev -- --port 3001
```

---

## Vercel CLI (Alternative Method)

You can also deploy using Vercel CLI:

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts
```

---

## Project Settings You Might Need

### Build & Development Settings

Location: Project Settings → General

```
Node.js Version: 18.x (default)
Install Command: npm install
Build Command: npm run build
Output Directory: dist
Development Command: npm run dev
```

### Environment Variables

Location: Project Settings → Environment Variables

```
Production:
VITE_API_URL=https://your-backend.railway.app

Preview & Development:
VITE_API_URL=http://localhost:3001
```

---

## Monitoring Your Deployment

### Deployment Logs

1. Go to your project dashboard
2. Click "Deployments"
3. Click on any deployment
4. View build and runtime logs

### Analytics

1. Go to "Analytics" tab
2. View:
   - Page views
   - Top pages
   - Visitors
   - Performance metrics

---

## Rollback a Deployment

If something goes wrong:

1. Go to "Deployments" tab
2. Find a previous working deployment
3. Click "..." menu
4. Select "Promote to Production"
5. Confirm

---

## Cost

**Vercel Hobby Plan (Free)**:
- ✅ Unlimited personal projects
- ✅ 100 GB bandwidth per month
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic deployments
- ✅ Preview deployments
- ✅ Analytics

Perfect for this project!

---

## Quick Reference

### Your Vercel URLs:
- Production: `https://your-app.vercel.app`
- Dashboard: `https://vercel.com/dashboard`
- Docs: `https://vercel.com/docs`

### Important Commands:
```bash
# Push changes
git add .
git commit -m "message"
git push origin main

# Force redeploy
# Go to Vercel dashboard → Deployments → Redeploy

# Check build locally
npm run build
npm run preview
```

---

## Next Steps After Deployment

1. ✅ Deploy backend to Railway (see RAILWAY-DEPLOYMENT-GUIDE.md)
2. ✅ Update `VITE_API_URL` in Vercel settings
3. ✅ Test the deployed application
4. ✅ Set up custom domain (optional)
5. ✅ Configure monitoring/alerts (optional)

---

## Support

- Vercel Documentation: https://vercel.com/docs
- Vercel Community: https://github.com/vercel/vercel/discussions
- Status Page: https://www.vercel-status.com

---

**You're ready to deploy! 🚀**

Follow the steps above and your application will be live in minutes!
