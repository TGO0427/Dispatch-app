# Clear Browser Cache Instructions

The transporter filter is showing old driver data because it's cached in your browser's localStorage.

## Option 1: Clear via Browser Console (Recommended)

1. Open your browser at http://localhost:3000/
2. Press F12 to open Developer Tools
3. Go to the Console tab
4. Type this command and press Enter:
   ```javascript
   localStorage.clear(); location.reload();
   ```

This will clear all localStorage data and reload the page with the new transporter names.

## Option 2: Clear via Browser Settings

**Chrome/Edge:**
1. Press F12 to open Developer Tools
2. Go to "Application" tab
3. In the left sidebar, expand "Local Storage"
4. Click on "http://localhost:3000"
5. Right-click and select "Clear"
6. Refresh the page (F5)

**Firefox:**
1. Press F12 to open Developer Tools
2. Go to "Storage" tab
3. In the left sidebar, expand "Local Storage"
4. Click on "http://localhost:3000"
5. Right-click and select "Delete All"
6. Refresh the page (F5)

## What You Should See After Clearing

The Transporter filter dropdown should now show:
- Transporter (default option)
- Unassigned
- ATS
- Noble
- Citadel
- Synecore

Instead of old driver names like "James Wilson", "Sarah Mitchell", etc.
