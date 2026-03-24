# Face Verification Code Analysis

## Overview
KarigarConnect implements a comprehensive face verification system with **liveness detection** using MediaPipe Face Mesh (frontend) and **face recognition** using InsightFace (backend Python service). The system is designed to:
- Detect and prevent fraud during registration
- Verify worker identity during job assignments
- Support multi-stage verification challenges

---

## 1. Frontend Implementation

### Primary Component: `FaceVerification.jsx`
**File:** [client/src/pages/auth/FaceVerification.jsx](client/src/pages/auth/FaceVerification.jsx)

#### Verification Steps (CHALLENGES array)
The face verification process consists of **5 sequential challenges**:

```javascript
const CHALLENGES = [
    {
        id:          'LOOK',
        label:       'Look straight at the camera',
        instruction: 'Position your face in the oval and look directly at the camera',
        icon:        '👁️',
        durationMs:  2000,   // must hold for 2s
        type:        'hold',
    },
    {
        id:          'BLINK',
        label:       'Blink your eyes',
        instruction: 'Slowly blink both eyes once',
        icon:        '😉',
        durationMs:  0,
        type:        'event',
    },
    {
        id:          'TURN_LEFT',
        label:       'Turn your head to the left',
        instruction: 'Slowly turn your head to YOUR left side',
        icon:        '←',
        durationMs:  800,
        type:        'hold',
    },
    {
        id:          'TURN_RIGHT',
        label:       'Turn your head to the right',
        instruction: 'Slowly turn your head to YOUR right side',
        icon:        '→',
        durationMs:  1000,
        type:        'hold',
    },
    {
        id:          'LOOK_FINAL',
        label:       'Return to front and hold',
        instruction: 'Bring your face back to the center and hold still for a moment',
        icon:        '📸',
        durationMs:  1200,
        type:        'hold',
    },
];
```

#### Step Configuration Details

| Challenge | Type | Duration | Threshold | Method |
|-----------|------|----------|-----------|--------|
| LOOK | hold | 2000ms | Front-facing | Nose offset < 0.05 + avg EAR > 0.22 |
| BLINK | event | N/A | Blink detected | avg EAR < 0.20 |
| TURN_LEFT | hold | 800ms | Head left | Nose offset > 0.05 |
| TURN_RIGHT | hold | 1000ms | Head right | Nose offset < -0.05 |
| LOOK_FINAL | hold | 1200ms | Front-facing | Nose offset < 0.05 + avg EAR > 0.22 |

**Key Constants:**
- `CHALLENGE_TIMEOUT_MS = 15_000` — 15 seconds per challenge
- `EAR_BLINK_THRESHOLD = 0.20` — Eye Aspect Ratio threshold for blink detection
- `HEAD_TURN_THRESHOLD = 0.05` — Normalized nose offset for head turns

#### How Steps are Organized

**1. Challenge Definition Structure (lines 23-68)**
- Each challenge is an object with: `id`, `label`, `instruction`, `icon`, `durationMs`, `type`
- `type: 'hold'` — must maintain condition for specified duration
- `type: 'event'` — event-based (like blink), no duration needed

**2. Geometry Calculations (lines 70-89)**
```javascript
// Key functions for detecting step completion:
const calcEAR = (lm, indices) => {...}     // Eye Aspect Ratio
const calcNoseOffset = (lm) => {...}       // Head turn detection
```

**3. Progress Tracking (lines 145-150)**
```javascript
const [challengeIdx, setChallengeIdx] = useState(0);  // Current step
const [progress, setProgress] = useState([]);          // Completed step IDs
const [holdPct, setHoldPct] = useState(0);             // Progress bar %
```

#### Challenge Progression Flow

1. **Initialization** (lines 182-225)
   - Load MediaPipe Face Mesh from CDN: `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/`
   - Start camera with 640x480 resolution
   - Initialize challenge index to 0

2. **Detection Loop** (lines 227-243)
   - Continuous `requestAnimationFrame` loop
   - Sends video frames to MediaPipe
   - Receives facial landmarks (468 points)

3. **Step Completion Detection** (lines 245-305)
   ```javascript
   const handleResults = useCallback((results) => {
       const lm = results.multiFaceLandmarks?.[0];  // Get landmarks
       
       // Calculate metrics
       const leftEAR = calcEAR(lm, LEFT_EYE);
       const rightEAR = calcEAR(lm, RIGHT_EYE);
       const avgEAR = (leftEAR + rightEAR) / 2;
       const noseOff = calcNoseOffset(lm);
       
       // Check completion based on challenge type
       switch (challenge.id) {
           case 'LOOK':
               conditionMet = isFrontFacing;
               break;
           case 'BLINK':
               conditionMet = avgEAR < EAR_BLINK_THRESHOLD;
               break;
           case 'TURN_LEFT':
               conditionMet = noseOff > HEAD_TURN_THRESHOLD;
               break;
           case 'TURN_RIGHT':
               conditionMet = noseOff < -HEAD_TURN_THRESHOLD;
               break;
       }
   })
   ```

4. **Step Advance** (lines 307-330)
   - When condition is met, start holding timer
   - Track `holdPct` (0-100) for progress bar
   - When hold duration reached, call `advanceChallenge()`
   - Auto-capture when all steps complete

#### Rendering Components

**Progress Chips** (lines 393-408)
- Visual indicator of completed, in-progress, and pending steps
- Shows step icon and label
- Color-coded: green (completed), orange (active), gray (pending)

**Camera Canvas** (lines 410-450)
- Displays video with drawn face oval guide
- Facet detection highlight (green oval = detected, orange = not detected)
- Overlays loading, success, error, and warning messages

**Challenge Instructions** (lines 458-475)
- Shows current step icon, label, and instructions
- Displays progress bar for 'hold' type challenges
- Shows step counter (e.g., "1/5")

### Related Components Using FaceVerification

1. **[ClientRegister.jsx](client/src/pages/auth/ClientRegister.jsx) (lines 2-330)**
   - Imports `FaceVerification` component
   - Triggers modal when user clicks "Create Account"
   - Stores verification result in `livePhotoData` state

2. **[WorkerRegister.jsx](client/src/pages/auth/WorkerRegister.jsx)**
   - Similar integration to ClientRegister
   - User provides ID proof + live face capture

3. **[ClientWorkerFaceVerify.jsx](client/src/pages/client/ClientWorkerFaceVerify.jsx)**
   - Simple camera capture (no liveness challenges)
   - Used for scanning worker faces during active jobs
   - Calls `verifyAssignedWorkerFace()` API

---

## 2. Backend Implementation

### Node.js Controllers

#### **authController.js**
**File:** [server/controllers/authController.js](server/controllers/authController.js)

**Key Functions:**

1. **`previewFaceSimilarity()`** (lines 123-183)
   - Accepts: `idProof` and `livePhoto` multipart uploads
   - Calls face_service to extract embeddings from both images
   - Compares embeddings using cosine similarity
   - Returns similarity score and pass/fail status
   - **Threshold:** `WORKER_THRESHOLD` (0.50)

2. **`registerWorker()`** (lines 186+)
   - Face verification happens post-registration
   - Stores `faceEmbedding` from live photo in user document
   - Also stores `faceVerificationStatus` (e.g., 'completed', 'skipped')
   - Gracefully handles face_service unavailability

3. **`registerClient()`**
   - Similar flow to worker registration
   - Includes duplicate face detection (stricter threshold: 0.85)

#### **clientController.js**
**File:** [server/controllers/clientController.js](server/controllers/clientController.js)

**Key Function:**

**`verifyAssignedWorkerFace()`** (lines 359-460)
- Called when client scans assigned worker's face
- Extracts embedding from live photo
- Compares against all worker embeddings in assigned jobs
- Finds best match worker
- **Threshold:** Default 0.60 (can be configured)

```javascript
// Loops through assigned workers
const bestMatch = await Promise.all(
    job.assignedWorkers.map(async (worker) => {
        const cmp = await faceClient.compareEmbeddings(
            liveResult.embedding, 
            worker.faceEmbedding
        );
        const similarity = Number(cmp?.similarity || 0);
        if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { worker, similarity };
        }
    })
);

if (!bestMatch || bestMatch.similarity < threshold) {
    return 'verification_failed';  // No match found
}
```

### Face Service Client

**File:** [server/utils/faceServiceClient.js](server/utils/faceServiceClient.js)

Wrapper for Python face_service HTTP API:

```javascript
module.exports = {
    isAvailable(),              // Check service health
    downloadImage(url),         // Download from Cloudinary
    extractEmbedding(buffer),   // Get 512-dim ArcFace embedding
    compareEmbeddings(emb1, emb2), // Cosine similarity
    checkDuplicate(emb, stored), // Duplicate detection
    WORKER_THRESHOLD: 0.50,
    DUPLICATE_THRESHOLD: 0.85
};
```

**Timeouts:**
- Extract: 30 seconds (model inference)
- Compare: 10 seconds (pure math)
- Health: 3 seconds

---

## 3. Python Face Service

**File:** [face_service/main.py](face_service/main.py)

FastAPI microservice using InsightFace (ArcFace + RetinaFace):

### API Endpoints

#### **POST /extract-embedding**
- Input: Image file (JPEG/PNG/WebP)
- Output: 512-dimensional ArcFace embedding
- Response:
  ```json
  {
    "face_detected": true/false,
    "embedding": [0.12, 0.34, ...],
    "detection_score": 0.95,
    "message": "..."
  }
  ```

#### **POST /compare**
- Input: Two embeddings (`embedding1`, `embedding2`)
- Output: Similarity score + match decision
- **Threshold:** 0.60 for ID vs. live comparison
- Response:
  ```json
  {
    "similarity": 0.8234,
    "match": true,
    "confidence": "high"
  }
  ```

#### **POST /check-duplicate**
- Input: New embedding + array of stored embeddings
- Output: Max similarity + duplicate flag
- **Threshold:** 0.85 (stricter for duplicate detection)
- Response:
  ```json
  {
    "max_similarity": 0.72,
    "is_duplicate": false
  }
  ```

#### **GET /health**
- Service health check
- Returns: `{ status, models_loaded, model, startup_error }`

### Model Configuration

**InsightFace Setup:**
- Model pack: `buffalo_l` (default)
- Detection modules: `detection`, `recognition`
- Embedding dimension: 512 (ArcFace)
- Face detection: RetinaFace
- Execution provider: CPU

---

## 4. Frontend API Integration

**File:** [client/src/api/index.js](client/src/api/index.js)

```javascript
export const previewFaceSimilarity = (fd) => 
    API.post('/api/auth/face-similarity-preview', fd, mp);

export const verifyAssignedWorkerFace = (fd) => 
    API.post('/api/client/face/verify-assigned-worker', fd, mp);
```

---

## 5. Key Files at a Glance

| Category | File | Purpose |
|----------|------|---------|
| **Frontend** | [client/src/pages/auth/FaceVerification.jsx](client/src/pages/auth/FaceVerification.jsx) | Main liveness detection component (5 challenges) |
| | [client/src/pages/auth/ClientRegister.jsx](client/src/pages/auth/ClientRegister.jsx) | Registration flow with face verification |
| | [client/src/pages/auth/WorkerRegister.jsx](client/src/pages/auth/WorkerRegister.jsx) | Worker registration with face verification |
| | [client/src/pages/client/ClientWorkerFaceVerify.jsx](client/src/pages/client/ClientWorkerFaceVerify.jsx) | Assigned worker face scanning |
| **Backend** | [server/controllers/authController.js](server/controllers/authController.js) | Registration + preview similarity |
| | [server/controllers/clientController.js](server/controllers/clientController.js) | Assigned worker face verification |
| | [server/utils/faceServiceClient.js](server/utils/faceServiceClient.js) | Python service HTTP client |
| **Python** | [face_service/main.py](face_service/main.py) | FastAPI + InsightFace service |

---

## 6. Verification Thresholds

| Context | Threshold | Purpose |
|---------|-----------|---------|
| Worker ID vs. Live | 0.50 | Register worker with ID proof |
| Client Duplicate Detection | 0.85 | Prevent multiple accounts |
| Assigned Worker Matching | 0.60 | Match scanned face to worker pool |

---

## 7. Data Flow Diagram

```
CLIENT REGISTRATION FLOW:
├─ UI: FaceVerification modal
│  ├─ Challenge 1: LOOK (2s)
│  ├─ Challenge 2: BLINK
│  ├─ Challenge 3: TURN_LEFT (0.8s)
│  ├─ Challenge 4: TURN_RIGHT (1s)
│  └─ Challenge 5: LOOK_FINAL (1.2s)
│     └─ Auto-capture → photoDataUrl
│
├─ API: previewFaceSimilarity()
│  ├─ Send: idProof (upload) + livePhoto (canvas capture)
│  ├─ Backend: authController.previewFaceSimilarity()
│  ├─ Call: faceServiceClient.extractEmbedding() (both images)
│  └─ Call: faceServiceClient.compareEmbeddings()
│     └─ Response: similarity score + pass/fail
│
└─ Final Submit: registerWorker() or registerClient()
   ├─ Create user record
   ├─ Store faceEmbedding + faceVerificationStatus
   └─ Check duplicate (clients only)

ASSIGNED WORKER VERIFICATION FLOW:
├─ UI: ClientWorkerFaceVerify
│  ├─ Start camera → Capture frame
│  └─ Canvas toBlob()
│
├─ API: verifyAssignedWorkerFace()
│  ├─ Backend: clientController.verifyAssignedWorkerFace()
│  ├─ Call: faceServiceClient.extractEmbedding(livePhoto)
│  ├─ Loop: Compare against all assigned workers' embeddings
│  └─ Return: Best match + similarity score

PYTHON SERVICE:
├─ /extract-embedding: Image → 512-dim embedding
├─ /compare: emb1 + emb2 → similarity score
└─ /check-duplicate: emb + stored[] → max similarity
```

---

## 8. Summary

**Step Definition:** Hardcoded in `CHALLENGES` array in FaceVerification.jsx
- 5 sequential steps with specific icons, labels, instructions, and durations
- Thresholds based on facial landmarks (Eye Aspect Ratio, nose offset)

**Rendering:** FaceVerification component with:
- Video canvas (MediaPipe Face Mesh overlay)
- Progress chips (status indicators)
- Challenge instructions panel
- Real-time progress bar

**Backend Processing:**
- Node.js controllers handle API requests
- Face Service Client calls Python microservice
- Python service performs embedding extraction and comparison
- Results stored in MongoDB user documents
