# Upload Performance Testing Guide

## Quick Start Testing

### 1. Test Single File Upload (Should still work normally)
1. Select a month/year
2. Upload 1 file
3. Verify it uploads and shows success message
4. ✅ Should take similar time as before

### 2. Test Multiple File Uploads (Should be 2-3x faster)
1. Select a month/year
2. Upload 3+ files together
3. Open browser DevTools (F12 or Right-click → Inspect)
4. Go to **Console** tab
5. Watch for log: `📤 Starting parallel upload: X files with concurrency=3`
6. ✅ Files should upload in groups of 3 simultaneously

### 3. Test Network Throttling (Optional - Advanced)

**To simulate slow network:**
1. Press F12 (DevTools)
2. Go to **Network** tab
3. Find the dropdown that says "No throttling"
4. Select "Slow 3G" or "Fast 3G"
5. Upload files and observe parallel processing
6. ✅ Should still upload in parallel, just slower

### 4. Monitor Upload Progress

**In Browser Console:**
```
📤 Starting parallel upload: 5 files with concurrency=3
```

- Files 1-3 upload simultaneously (first batch)
- Files 4-5 upload after (second batch)
- ✅ Each batch takes same time as single file

### 5. Test Error Handling

#### Test Duplicate Upload:
1. Upload a file successfully
2. Try to upload the same file again for same SHG
3. ✅ Should show "Duplicate upload blocked" message
4. ✅ File marked as "Already Uploaded"

#### Test Network Error:
1. Disconnect internet while uploading
2. ✅ Should retry automatically
3. ✅ Error logged to console

#### Test Authentication:
1. Stay logged in and upload normally
2. ✅ All uploads should succeed
3. ✅ Check Authorization header in Network tab

## Performance Metrics

### What to measure:

```
Total time before: 50 seconds (10 files, sequential)
Total time after: ~17-20 seconds (10 files, parallel)
Speed improvement: 60-65%
```

### Console Timing:
- Look for timestamps in console logs
- Calculate: Upload start → last file complete
- Compare with previous uploads

## Browser DevTools Network Tab

### View Parallel Uploads:
1. F12 → Network tab
2. Upload multiple files
3. ✅ Should see 3 upload requests at same time
4. ✅ When 1 completes, next one starts automatically

### Check Request Headers:
1. Click on any upload request
2. Go to **Headers** tab
3. Look for `Authorization: Bearer [token]`
4. ✅ Should be present for all requests

## Performance Baseline

Run this test to establish baseline:

### Test Setup:
- Files: 6 images (2-5MB each)
- Month/Year: January 2026
- Network: Normal (no throttling)
- Browser: Latest version

### Procedure:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Log in fresh
3. Select files and start upload
4. Time it from first request to last success
5. Record in console output

### Expected Results:
```
Sequential (old): ~30-40 seconds for 6 files
Parallel (new): ~10-13 seconds for 6 files (3x faster)
```

## Troubleshooting

### Issue: Still takes long time
- Check network tab for upload request duration
- Verify files aren't too large (>10MB per file)
- Check if server is slow (backend logs)
- Try reducing image quality before upload

### Issue: Some files fail while uploading
- Check console for error messages
- Verify internet connection is stable
- Check if token expired (login again)
- Check if server disk space is full

### Issue: Not seeing parallel uploads in Network tab
- DevTools might filter requests
- Go to Network tab → Filter → clear any filters
- Check "All" requests are shown
- Refresh and try again

## Optimization Tuning

### To make uploads faster (more concurrent):
Edit `SHGUploadSection.jsx` line with:
```javascript
await uploadFilesInParallel(filesToUpload, token, 5); // Changed from 3 to 5
```

**Warning**: Concurrency > 5 may cause:
- Browser instability
- Network timeouts on slow connections
- Excessive memory usage

### To make uploads safer (less concurrent):
```javascript
await uploadFilesInParallel(filesToUpload, token, 2); // More conservative
```

**Benefits**: Better for:
- Mobile devices
- Slow/unstable networks
- Servers with strict rate limits

## Success Checklist

- [ ] Single file uploads work
- [ ] Multiple files upload in parallel
- [ ] Console shows "Starting parallel upload" message
- [ ] Files complete faster than before
- [ ] Network tab shows 3 concurrent requests
- [ ] Error messages are clear
- [ ] Retry logic works (disconnect test)
- [ ] Authentication errors redirect to login
- [ ] Duplicate detection works
- [ ] File validation still works before upload

## Reporting Issues

If uploads are still slow, provide:
1. **File size**: How large are the files? (MB)
2. **File count**: How many files at once?
3. **Network speed**: What's your internet speed? (use speedtest.net)
4. **Device type**: Desktop, laptop, phone, tablet?
5. **Browser**: Chrome, Firefox, Safari, Edge? (with version)
6. **Console output**: Screenshot of console logs during upload
7. **Network tab**: Screenshot showing upload requests timeline
