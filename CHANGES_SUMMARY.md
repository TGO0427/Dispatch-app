# Changes Summary - Dispatch App

## Date: October 13, 2025

### 1. Analytics Dashboard → Advanced Reports (AnalyticsView.tsx)

**Location:** `src/components/views/AnalyticsView.tsx`

**Changes:**
- Changed header from "Analytics Dashboard" to "Advanced Reports" with blue gradient background
- Added 6 report types:
  - Job Summary
  - Driver Performance
  - Customer Analysis
  - Exception Report
  - Delivery Performance
  - Warehouse Utilization

- **New Filters Added:**
  - Report Type selector
  - Date Range (Today, Last 7 Days, Last 30 Days, Last 90 Days, Last Year, Custom Range)
  - Status Filter
  - Priority Filter
  - Warehouse Filter
  - **ETA Week Filter** (NEW - filters jobs by the week their ETA falls in)

- **Enhanced Reports:**
  - All reports now show BOTH "Created Date" and "ETA Date" columns
  - ETA dates display with week information (e.g., "Week 42, 2025")
  - Export to Excel includes: Created Date, ETA Date, and ETA Week columns
  - Export to CSV includes: Created Date, ETA Date, and ETA Week columns

### 2. Transport Companies (mockData.ts)

**Location:** `src/data/mockData.ts`

**Changes:**
Replaced 8 individual drivers with 5 transport companies:

| Company | Callsign | Location | Capacity | Status |
|---------|----------|----------|----------|--------|
| Transporte | TRANS-01 | National | 50 | Busy |
| ATS | ATS-01 | Regional | 40 | Busy |
| Noble | NOBLE-01 | Western Cape | 35 | Busy |
| Citadel | CITADEL-01 | Gauteng | 45 | Available |
| Synecore | SYNECORE-01 | National | 60 | Available |

**Removed:**
- All personal phone numbers (now empty strings)
- All email addresses (now empty strings)
- Individual driver names (James Wilson, Sarah Mitchell, etc.)

### 3. Vite Configuration (vite.config.ts)

**Location:** `vite.config.ts`

**Changes:**
- Added `watch: { usePolling: true }` to fix file watching issues on WSL (Windows Subsystem for Linux)
- This enables automatic hot module replacement when files change

## How to Verify Changes:

1. **Server:** http://localhost:5173/

2. **Check Transport Companies:**
   - Navigate to "Jobs" view (clipboard icon)
   - Look at the Drivers/Carriers section on the right
   - Should see: Transporte, ATS, Noble, Citadel, Synecore

3. **Check Advanced Reports:**
   - Click the grid icon (4th icon from top)
   - Page should show "Advanced Reports" header with blue gradient
   - Should see 6 filter dropdowns including "ETA Week Filter"
   - Job Summary table should have 8 columns including both "Created" and "ETA"

4. **Test ETA Week Filter:**
   - Select "Job Summary" report
   - Use "ETA Week Filter" dropdown to filter by specific weeks
   - Jobs should filter to show only those with ETAs in the selected week

5. **Test Export:**
   - Generate any report
   - Click "Export Excel" or "Export CSV"
   - Downloaded file should include: Created Date, ETA Date, and ETA Week columns

## Troubleshooting:

If changes don't appear:
1. Close ALL browser windows
2. Clear browser cache (Ctrl+Shift+Delete → Clear All)
3. Reopen browser and go to http://localhost:5173/
4. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
5. Check browser console (F12) for any JavaScript errors

## Files Modified:

1. `/src/components/views/AnalyticsView.tsx` - Complete rewrite for Advanced Reports
2. `/src/data/mockData.ts` - Updated driver data to transport companies
3. `/vite.config.ts` - Added file polling for WSL compatibility
4. `/src/App.tsx` - Minor import optimization
