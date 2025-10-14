# ✅ Deployment Checklist

Use this checklist to deploy your Dispatch Management System step by step.

---

## 📋 Pre-Deployment Checklist

- [ ] Code is working locally (test at http://localhost:3000)
- [ ] GitHub account created
- [ ] Vercel account created (https://vercel.com/signup)
- [ ] Railway account created (https://railway.app)
- [ ] Git installed on your computer

---

## 🔧 Step 1: Prepare Your Code

### Frontend (Root Directory)

- [ ] Open terminal in project root
- [ ] Test build:
  ```bash
  npm install
  npm run build
  ```
- [ ] Build successful (no errors)

### Backend

- [ ] Navigate to backend directory:
  ```bash
  cd backend
  ```
- [ ] Test build:
  ```bash
  npm install
  npm run build
  ```
- [ ] Build successful (no errors)

---

## 📦 Step 2: Push to GitHub

### Create GitHub Repository

- [ ] Go to https://github.com/new
- [ ] Repository name: `dispatch-app`
- [ ] Keep it Public or Private (your choice)
- [ ] **DO NOT** check "Add a README file"
- [ ] Click "Create repository"
- [ ] Copy the repository URL

### Push Frontend Code

```bash
# In project root directory
git init
git add .
git commit -m "Initial commit - Ready for deployment"
git branch -M main
git remote add origin YOUR_REPO_URL_HERE
git push -u origin main
```

- [ ] Code pushed to GitHub successfully
- [ ] Verify on GitHub.com that all files are there

### Create Separate Backend Repository (Recommended)

- [ ] Create another repo: `dispatch-backend`
- [ ] Push backend code:
  ```bash
  cd backend
  git init
  git add .
  git commit -m "Backend ready for Railway"
  git branch -M main
  git remote add origin YOUR_BACKEND_REPO_URL
  git push -u origin main
  ```
- [ ] Backend code on GitHub

**Alternative**: Use same repo with backend in `/backend` folder

---

## 🚂 Step 3: Deploy Backend to Railway

### Setup Railway

- [ ] Go to https://railway.app
- [ ] Click "Start a New Project" or "Login"
- [ ] Login with GitHub
- [ ] Authorize Railway

### Create Project

- [ ] Click "New Project"
- [ ] Select "Deploy from GitHub repo"
- [ ] Choose `dispatch-backend` repository
- [ ] Wait for Railway to detect Node.js

### Configure Settings

- [ ] If using same repo: Set Root Directory to `backend`
- [ ] Go to "Variables" tab
- [ ] Add environment variables:
  ```
  NODE_ENV=production
  PORT=3001
  FRONTEND_URL=http://localhost:3000
  ```
- [ ] Click "Deploy"

### Get Backend URL

- [ ] Wait for deployment (2-3 minutes)
- [ ] Go to "Settings" → "Domains"
- [ ] Click "Generate Domain"
- [ ] Copy your Railway URL: `______.railway.app`
- [ ] Test health endpoint: `https://YOUR-URL.railway.app/health`
- [ ] Should return: `{"status":"healthy",...}`

**Your Railway URL**: `_______________________________`

---

## ☁️ Step 4: Deploy Frontend to Vercel

### Setup Vercel

- [ ] Go to https://vercel.com
- [ ] Click "Sign Up" or "Log In"
- [ ] Login with GitHub
- [ ] Authorize Vercel

### Import Project

- [ ] Click "Add New..." → "Project"
- [ ] Find your `dispatch-app` repository
- [ ] Click "Import"

### Configure Build Settings

Verify (should be auto-detected):
- [ ] Framework: Vite
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm install`

### Add Environment Variable

- [ ] Scroll to "Environment Variables"
- [ ] Add variable:
  ```
  Name: VITE_API_URL
  Value: https://YOUR-RAILWAY-URL.railway.app
  ```
  (Use your Railway URL from Step 3)
- [ ] Click "Deploy"

### Get Frontend URL

- [ ] Wait for deployment (1-2 minutes)
- [ ] Copy your Vercel URL: `______.vercel.app`
- [ ] Open URL in browser
- [ ] App should load!

**Your Vercel URL**: `_______________________________`

---

## 🔗 Step 5: Connect Frontend and Backend

### Update Railway FRONTEND_URL

- [ ] Go back to Railway
- [ ] Select your project
- [ ] Go to "Variables"
- [ ] Update `FRONTEND_URL`:
  ```
  FRONTEND_URL=https://YOUR-VERCEL-URL.vercel.app
  ```
- [ ] Save (Railway auto-redeploys)

### Verify Connection

- [ ] Open your Vercel app
- [ ] Try importing data
- [ ] Check if data loads
- [ ] Test creating a job
- [ ] Test drag-and-drop

---

## ✅ Step 6: Final Verification

### Test All Features

- [ ] Home - Order Import works
- [ ] Jobs - Dispatch view loads
- [ ] Calendar - Shows jobs
- [ ] Reports - Generates reports
- [ ] Analytics - Shows charts
- [ ] History - Shows completed jobs

### Test API Connection

- [ ] Open browser console (F12)
- [ ] Check for errors
- [ ] API calls should go to Railway URL
- [ ] No CORS errors

### Performance Check

- [ ] App loads quickly
- [ ] No console errors
- [ ] Images load
- [ ] Drag and drop works
- [ ] Filters work
- [ ] Export works

---

## 📝 Post-Deployment

### Save Your URLs

```
Frontend (Vercel): https://_______________.vercel.app
Backend (Railway):  https://_______________.railway.app

GitHub Frontend:    https://github.com/________/dispatch-app
GitHub Backend:     https://github.com/________/dispatch-backend
```

### Set Up Monitoring

- [ ] Check Vercel Analytics
- [ ] Check Railway Metrics
- [ ] Set up error alerts (optional)

### Update Documentation

- [ ] Update README.md with live URLs
- [ ] Share URLs with team
- [ ] Document any custom configurations

---

## 🎯 Quick Test Commands

Test your deployed app:

```bash
# Test backend health
curl https://YOUR-BACKEND.railway.app/health

# Test backend jobs endpoint
curl https://YOUR-BACKEND.railway.app/api/jobs

# Test backend drivers endpoint
curl https://YOUR-BACKEND.railway.app/api/drivers
```

---

## 🐛 Troubleshooting

### Vercel Build Fails

- [ ] Run `npm run build` locally
- [ ] Fix TypeScript errors
- [ ] Push fix to GitHub
- [ ] Vercel auto-redeploys

### Railway Build Fails

- [ ] Check Railway logs
- [ ] Verify package.json scripts
- [ ] Test `npm run build` in backend
- [ ] Push fix to GitHub

### Frontend Can't Connect to Backend

- [ ] Check `VITE_API_URL` in Vercel
- [ ] Verify Railway URL is correct
- [ ] Check CORS in backend
- [ ] Check Railway logs for errors

### CORS Errors

- [ ] Verify `FRONTEND_URL` in Railway
- [ ] Make sure it matches Vercel URL exactly
- [ ] Include `https://` in URLs
- [ ] Redeploy Railway

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ Vercel URL loads the app
✅ Railway health endpoint responds
✅ Can import Excel data
✅ Can create/edit jobs
✅ Drag and drop works
✅ Charts display
✅ Reports generate
✅ No console errors
✅ CORS working
✅ All features functional

---

## 📞 Need Help?

### Documentation
- [ ] Read VERCEL-DEPLOYMENT-GUIDE.md
- [ ] Read RAILWAY-DEPLOYMENT-GUIDE.md
- [ ] Read DEPLOYMENT.md

### Support
- Vercel: https://vercel.com/docs
- Railway: https://docs.railway.app
- GitHub Issues: Create an issue in your repo

---

## 🚀 You're Live!

Once all checkboxes are complete, your app is:

✅ **Deployed to Production**
✅ **Accessible Worldwide**
✅ **Auto-deploying on Push**
✅ **HTTPS Secured**
✅ **Backed by CDN**

**Congratulations! 🎉**

---

## 📅 Maintenance Checklist (Monthly)

- [ ] Check Railway usage/costs
- [ ] Review Vercel bandwidth
- [ ] Check for dependency updates
- [ ] Review error logs
- [ ] Test all features still work
- [ ] Backup important data
- [ ] Review security settings

---

**Print this checklist and check off items as you go!**
