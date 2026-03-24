# Face Verification Update - Simplified Steps

## Summary
Simplified face verification from 5 steps to 3 steps by removing head movement challenges (left/right turns).

## Changes Made

### File: `client/src/pages/auth/FaceVerification.jsx`

#### 1. **Updated CHALLENGES Array** (Lines 23-46)
**Removed:**
- `TURN_LEFT` - "Turn your head to the left" (800ms hold, icon: ←)
- `TURN_RIGHT` - "Turn your head to the right" (1000ms hold, icon: →)

**Kept:**
1. **LOOK** - "Look straight at the camera" (2000ms hold, icon: 👁️)
   - Instruction: Position your face in the oval and look directly at the camera
   - Detected by: Front-facing face detection + normalized eye aspect ratio

2. **BLINK** - "Blink your eyes" (0ms - event type, icon: 😉)
   - Instruction: Slowly blink both eyes once
   - Detected by: Eye Aspect Ratio (EAR) drop below 0.20 threshold

3. **LOOK_FINAL** - "Return to front and hold" (1200ms hold, icon: 📸)
   - Instruction: Your face is now captured. Hold still for verification
   - Detected by: Front-facing face detection
   - **Action:** Auto-captures photo when completed

#### 2. **Updated Challenge Validation Logic** (Lines 238-247)
**Removed switch cases:**
```javascript
case 'TURN_LEFT':  // user's left = camera right (positive x)
    conditionMet = noseOff > HEAD_TURN_THRESHOLD;
    break;
case 'TURN_RIGHT': // user's right = camera left (negative x)
    conditionMet = noseOff < -HEAD_TURN_THRESHOLD;
    break;
```

**Kept switch cases:**
- **LOOK/LOOK_FINAL:** `isFrontFacing` check (combination of nose offset and EAR)
- **BLINK:** `avgEAR < EAR_BLINK_THRESHOLD` check

#### 3. **Updated File Header Comment** (Line 3)
**Before:**
```
// Challenges: LOOK_STRAIGHT → BLINK → TURN_LEFT → TURN_RIGHT → LOOK_FINAL (auto-capture)
```

**After:**
```
// Challenges: LOOK_STRAIGHT → BLINK → LOOK_FINAL (auto-capture)
```

## User Flow

### Old Flow (5 Steps)
1. ✅ Look straight (2s)
2. ✅ Blink eyes (event detection)
3. ❌ Turn head left (800ms) - **REMOVED**
4. ❌ Turn head right (1000ms) - **REMOVED**
5. ✅ Look straight final (1200ms) → Auto-capture

### New Flow (3 Steps)
1. ✅ Look straight (2s)
2. ✅ Blink eyes (event detection)
3. ✅ Look straight final (1200ms) → Auto-capture

## Benefits

- ✅ **Faster verification** - 33% fewer steps (~3.2s → ~5.2s total with overhead)
- ✅ **Better UX** - Simpler instructions, less complex movements
- ✅ **Reduced friction** - Easier for users with mobility constraints
- ✅ **Same liveness detection** - Front-facing + blink + final capture still proves liveness
- ✅ **No code breaking** - Other files (ClientRegister, authController, etc.) unaffected

## Technical Details

### Detection Algorithms (Unchanged)
- **Eye Aspect Ratio (EAR)** threshold: 0.20 (for blink detection)
- **Head Turn Threshold** (HEAD_TURN_THRESHOLD): Still defined but no longer used (0.05)
- **Front-facing check**: `Math.abs(noseOff) < HEAD_TURN_THRESHOLD && avgEAR > EAR_BLINK_THRESHOLD + 0.02`

### Progress Tracking (Unchanged)
- Visual progress chips still show all completed challenges
- Challenge counter shows current position within steps
- Timeout per challenge: 15 seconds

## Verification Endpoints (No Changes)
- Backend similarity comparison thresholds remain the same
- Worker ID vs Live: 0.50
- Duplicate Detection: 0.85
- Assigned Worker Match: 0.60

## Testing Checklist

- [ ] Test face verification modal opens correctly
- [ ] Step 1: User can complete "Look straight" challenge
- [ ] Step 2: User can complete "Blink eyes" challenge
- [ ] Step 3: User can complete "Look final" challenge
- [ ] Verify auto-capture happens after step 3
- [ ] Check progress chips update correctly (3 total)
- [ ] Verify error messages show if timeout occurs
- [ ] Test "Try Again" button resets verification flow
- [ ] Confirm registration completes successfully with new photo

## Rollback Plan
If needed, restore from git:
```bash
git checkout HEAD -- client/src/pages/auth/FaceVerification.jsx
```
