# Typing Speed Controls

## New Features

Added typing speed controls and pause/resume functionality for `Ctrl+Shift+V` (clipboard typing).

## Shortcuts

### Typing Control
| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+V** | Start typing clipboard content |
| **Ctrl+Shift+X** | Stop typing |
| **Escape or F1-F12** | Stop typing (alternative) |
| **Alt+Backspace** | Pause/Resume typing |
| **Alt+=** | Increase speed (faster typing) |
| **Alt+-** | Decrease speed (slower typing) |

## How It Works

### Speed Control

**Alt+= (Faster)**
- Decreases delay between keystrokes
- Makes typing faster
- Range: 10ms (very fast) to 500ms (very slow)
- Default: 75ms (normal)

**Alt+- (Slower)**
- Increases delay between keystrokes
- Makes typing slower
- Useful for applications that can't handle fast input

**Speed Levels:**
- Very Fast: ≤30ms
- Fast: 31-60ms
- Normal: 61-100ms (default: 75ms)
- Slow: 101-200ms
- Very Slow: 201-500ms

### Pause/Resume

**Alt+Backspace**
- Pauses typing at current position
- Press again to resume from where it paused
- Useful when you need to:
  - Check what's been typed so far
  - Wait for application to catch up
  - Temporarily stop without losing position

## Usage Examples

### Example 1: Fast Typing
```
1. Copy code to clipboard
2. Press Ctrl+Shift+V to start typing
3. Press Alt+= a few times to speed up
4. Code types quickly
```

### Example 2: Slow Application
```
1. Copy text to clipboard
2. Press Ctrl+Shift+V to start typing
3. Application lags
4. Press Alt+- to slow down typing
5. Application can keep up
```

### Example 3: Pause and Check
```
1. Copy long text to clipboard
2. Press Ctrl+Shift+V to start typing
3. Press Alt+Backspace to pause
4. Check if everything looks correct
5. Press Alt+Backspace to resume
```

### Example 4: Stop Typing
```
1. Typing in progress
2. Realize wrong location
3. Press Escape (or F1-F12 or Ctrl+Shift+X)
4. Typing stops immediately
```

## Technical Details

### Speed Adjustment
```typescript
private typingSpeed: number = 75 // Default 75ms

adjustTypingSpeed(delta: number) {
  this.typingSpeed = Math.max(10, Math.min(500, this.typingSpeed + delta))
  keyboard.config.autoDelayMs = this.typingSpeed
}

// Alt+= : adjustTypingSpeed(-15) // Faster
// Alt+- : adjustTypingSpeed(15)  // Slower
```

### Pause Implementation
```typescript
private isPaused: boolean = false

// In typing loop
while (this.isPaused && !this.shouldStopTyping) {
  await new Promise(resolve => setTimeout(resolve, 100))
}
```

### Notifications
Shows toast notifications for:
- Speed changes: "Typing Speed: Fast (60ms)"
- Pause: "Typing Paused - Press Alt+Backspace to resume"
- Resume: "Typing Resumed - Typing continues..."

## Benefits

✅ **Adjustable speed** - Works with any application speed
✅ **Pause/Resume** - Check progress without stopping
✅ **Visual feedback** - Toast notifications show status
✅ **Persistent speed** - Speed setting maintained during session
✅ **Safe ranges** - Speed limited to 10-500ms
✅ **Easy controls** - Intuitive keyboard shortcuts

## Use Cases

### 1. Slow Applications
Some applications (IDEs, terminals) can't handle fast input:
- Start typing
- If characters are dropped, press Alt+- to slow down
- Find optimal speed for your application

### 2. Fast Entry
For simple text editors that handle fast input well:
- Press Alt+= multiple times for very fast typing
- Save time on long code snippets

### 3. Debugging
When typing doesn't work as expected:
- Use Alt+Backspace to pause
- Check what's been typed
- Adjust speed if needed
- Resume with Alt+Backspace

### 4. Long Content
When typing very long content:
- Start typing
- Pause to check progress
- Adjust speed if needed
- Resume typing

## Keyboard Layout

```
Alt + Backspace = Pause/Resume
Alt + =         = Faster (+ is above =)
Alt + -         = Slower (- is next to =)
```

Easy to remember: +/= for faster, - for slower

## Files Modified

### `electron/shortcuts.ts`
1. **Added state variables:**
   - `isPaused: boolean` - Tracks pause state
   - `typingSpeed: number` - Current typing speed (default 75ms)

2. **Added methods:**
   - `adjustTypingSpeed(delta)` - Adjusts speed by delta
   - `togglePause()` - Toggles pause state

3. **Updated typing loop:**
   - Uses `this.typingSpeed` instead of hardcoded 75ms
   - Checks `isPaused` and waits while paused
   - Resets `isPaused` in finally block

4. **Added shortcuts:**
   - `Alt+Backspace` - Toggle pause
   - `Alt+=` - Increase speed (faster)
   - `Alt+-` - Decrease speed (slower)

## Testing

### Test Speed Control
1. Copy text to clipboard
2. Press Ctrl+Shift+V
3. Press Alt+= several times
4. Verify typing speeds up
5. Press Alt+- several times
6. Verify typing slows down

### Test Pause/Resume
1. Copy long text to clipboard
2. Press Ctrl+Shift+V
3. Press Alt+Backspace (pause)
4. Verify typing pauses
5. Press Alt+Backspace (resume)
6. Verify typing continues from same position

### Test Stop
1. Start typing
2. Press Escape (or F1-F12)
3. Verify typing stops immediately

---

**Version**: November 2025
**Status**: ✅ Complete and Tested
**Compatibility**: Works with all typing operations
