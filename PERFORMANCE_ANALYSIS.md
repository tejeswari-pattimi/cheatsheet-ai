# Performance Analysis - Ctrl+D (Quick Answer) Flow

## Current Flow When Pressing Ctrl+D

```
User presses Ctrl+D
  ↓
1. Reset Phase (~100ms)
   - Cancel ongoing requests
   - Clear queues
   - Set view to "queue"
   - Send reset events to renderer
   - Wait 100ms (hardcoded delay)
  ↓
2. Screenshot Capture Phase (~200-1000ms) ⚠️ BOTTLENECK
   - Call takeScreenshot()
   - Windows: Try multiple methods (file-based, PowerShell, buffer)
   - Generate preview image
   - Send screenshot-taken event
   - Wait 200ms (hardcoded delay)
  ↓
3. Processing Phase (~2000-5000ms) ⚠️ MAJOR BOTTLENECK
   - Load screenshots from disk
   - Convert to base64
   - Call AI API (Groq/Gemini)
   - Parse response
   - Send solution-success event
```

## Identified Bottlenecks

### 🔴 Critical (High Impact)

1. **AI API Call (2-5 seconds)**
   - Location: `electron/ProcessingHelper.ts:399-427`
   - Impact: 80-90% of total latency
   - Current: Synchronous API call with retry logic
   - Measured: `performanceMonitor.startTimer('API Call')`

2. **Screenshot Capture on Windows (200-1000ms)**
   - Location: `electron/ScreenshotHelper.ts:195-260`
   - Impact: 10-15% of total latency
   - Current: Multiple fallback methods (file → PowerShell → buffer)
   - Issue: File I/O operations are slow

### 🟡 Medium (Moderate Impact)

3. **Hardcoded Delays (300ms total)**
   - Location: `electron/shortcuts.ts:119, 131`
   - 100ms after reset
   - 200ms after screenshot
   - Impact: 5-10% of total latency
   - Reason: Unclear - possibly for UI updates?

4. **Image Loading & Base64 Conversion (~50-100ms)**
   - Location: `electron/ProcessingHelper.ts:131-138`
   - Reading files from disk
   - Converting to base64
   - Impact: 2-5% of total latency

5. **Preview Generation (~50-150ms)**
   - Location: `electron/main.ts` (getImagePreview)
   - Uses Sharp library to resize images
   - Impact: 2-5% of total latency

### 🟢 Low (Minor Impact)

6. **IPC Communication (~10-20ms)**
   - Multiple send() calls to renderer
   - Negligible but adds up

## Performance Monitoring Coverage

### ✅ Currently Monitored:
- `processScreenshots (Total)` - Full processing time
- `Load Screenshots` - File loading time
- `API Call (mode) - Attempt N` - API request time
- `Shortcut to Processing` - Ctrl+Enter handler time

### ❌ Not Monitored:
- Screenshot capture time
- Preview generation time
- Base64 conversion time
- IPC communication time
- Individual retry attempts

## Optimization Recommendations

### High Priority (Quick Wins)

1. **Remove Hardcoded Delays**
   ```typescript
   // BEFORE
   await new Promise(resolve => setTimeout(resolve, 100))
   
   // AFTER
   // Remove or reduce to 10-20ms if needed for UI
   ```
   **Expected Gain**: 250-300ms

2. **Add Performance Monitoring to Screenshot Capture**
   ```typescript
   performanceMonitor.startTimer('Screenshot Capture');
   const screenshotPath = await this.deps.takeScreenshot()
   performanceMonitor.endTimer('Screenshot Capture');
   ```
   **Benefit**: Visibility into actual bottleneck

3. **Optimize Windows Screenshot Method**
   - Try buffer method first (fastest)
   - Only fallback to file/PowerShell if needed
   - Cache the working method
   **Expected Gain**: 100-500ms on Windows

4. **Parallel Preview Generation**
   ```typescript
   // BEFORE: Sequential
   const screenshotPath = await takeScreenshot()
   const preview = await getImagePreview(screenshotPath)
   
   // AFTER: Parallel
   const [screenshotPath, preview] = await Promise.all([
     takeScreenshot(),
     takeScreenshot().then(getImagePreview)
   ])
   ```
   **Expected Gain**: 50-100ms

### Medium Priority

5. **Stream Base64 Conversion**
   - Instead of loading entire file into memory
   - Stream and convert in chunks
   **Expected Gain**: 20-50ms for large images

6. **Cache AI Provider Instances**
   - Reuse connections instead of recreating
   - Keep-alive for HTTP connections
   **Expected Gain**: 50-100ms per request

7. **Optimize Image Preview Size**
   - Current: Unknown size
   - Recommended: 200x200px max
   - Smaller = faster generation & transfer
   **Expected Gain**: 20-50ms

### Low Priority (Long-term)

8. **Implement Request Queuing**
   - Queue multiple screenshots
   - Batch process when possible
   - Reduce API calls

9. **Add Response Caching**
   - Cache similar questions
   - Use content hash for lookup
   - Instant responses for duplicates

10. **Optimize IPC Communication**
    - Batch multiple sends
    - Use structured cloning
    - Reduce payload size

## Expected Total Improvement

| Optimization | Time Saved | Difficulty |
|-------------|------------|------------|
| Remove delays | 250-300ms | Easy |
| Optimize screenshot | 100-500ms | Medium |
| Parallel preview | 50-100ms | Easy |
| Add monitoring | 0ms (visibility) | Easy |
| **Total Quick Wins** | **400-900ms** | **1-2 hours** |

## Current Performance Baseline

Based on code analysis:
- **Best Case**: ~2.5 seconds (fast API, buffer screenshot)
- **Average Case**: ~3.5 seconds (normal API, file screenshot)
- **Worst Case**: ~6+ seconds (slow API, PowerShell fallback, retries)

## Target Performance

After optimizations:
- **Best Case**: ~2 seconds (-20%)
- **Average Case**: ~2.5 seconds (-30%)
- **Worst Case**: ~5 seconds (-15%)

## Next Steps

1. Add comprehensive performance monitoring
2. Run actual benchmarks with real usage
3. Implement quick wins (remove delays, optimize screenshot)
4. Measure improvements
5. Iterate on medium priority items
