# KarigarConnect

KarigarConnect is a full-stack marketplace for skilled workers, clients, shops, and administrators. It combines job posting and hiring, direct hire tickets, live tracking, AI-assisted pricing, IVR voice flows, fraud monitoring, coupons, notifications, and profile verification.

## What The System Does

### Core user roles
- Client portal for posting jobs, managing hires, paying workers, tracking work, and reviewing history.
- Worker portal for browsing jobs, applying, accepting invites, managing availability, tracking work, and viewing earnings and ratings.
- Shop portal for shop onboarding, product management, coupon workflows, and transaction history.
- Admin portal for approving users, moderating complaints, reviewing fraud, managing rates, and handling direct-hire payments.

### Business features
- OTP login and password login for all supported roles.
- Worker and client registration flows with document upload and verification.
- Public worker profile browsing and worker profile summary generation.
- Job posting, job editing, application review, hiring, rejection, and ratings.
- Direct hire ticket creation, acceptance, completion, and payment tracking.
- Live worker location tracking for active jobs.
- IVR voice menu for workers, including registration guidance, job summaries, and application actions.
- AI-assisted question generation, estimate building, and job guidance.
- Semantic job-worker matching and ranking.
- Fraud service scanning, queue management, and action handling.
- SMS, email, and in-app notifications.
- Community posts, comments, and moderation.
- Nearby shop browsing and shop product browsing.
- Coupons, purchase history, and leaderboard views.

## Project Structure

```text
Karigar-Connect/
  client/
  server/
    controllers/
    middleware/
    models/
    routes/
    services/
    utils/
    fraud_service/
    semantic_match_service/
  face_service/
```

## Tech Stack

### Frontend
- React 19
- Vite 7
- Redux Toolkit
- React Router
- Tailwind CSS 4

### Backend
- Node.js
- Express 5
- MongoDB + Mongoose
- Twilio
- Cloudinary
- Nodemailer
- Razorpay
- Groq SDK

### Python Services
- Flask fraud service
- Semantic matching service with Python ML dependencies
- Face verification service

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Python 3.11 or newer
- MongoDB 6 or newer

## Installation

### 1. Install backend dependencies

```bash
cd server
npm install
```

### 2. Install frontend dependencies

```bash
cd ../client
npm install
```

### 3. Install fraud service dependencies

```powershell
cd server\fraud_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r Requirements.txt
```

### 4. Install semantic matching service dependencies

```powershell
cd ..\semantic_match_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 5. Install face verification service dependencies

```powershell
cd ..\..\face_service
python -m venv .venv311
.\.venv311\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Environment Variables

Create `server/.env` with values for:

```env
MONGO_URI=mongodb://127.0.0.1:27017/karigarConnect
PORT=5000
JWT_SECRET=your_jwt_secret

FRONTEND_URL=http://localhost:5173
NODE_BASE_URL=http://localhost:5000
INTERNAL_SECRET=your_internal_secret

FACE_SERVICE_URL=http://localhost:8001
FRAUD_SERVICE_URL=http://127.0.0.1:5001

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
TWILIO_WEBHOOK_URL=https://your-tunnel-domain/api/ivr/twilio/voice

GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_key

EMAIL_USER=your_email
EMAIL_PASS=your_email_app_password

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

REGISTRATION_URL=http://localhost:5173/register
IVR_JOB_MATCH_RADIUS_KM=20
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
VITE_FLASK_URL=http://localhost:5001
VITE_FRAUD_SOCKET_URL=http://localhost:5001
```

## Deployment Ready Notes

- Use the provided `.env.example` files in `server/`, `client/`, `face_service/`, `server/fraud_service/`, and `server/semantic_match_service/`.
- Never commit actual `.env` files or secret values. Create local `.env` files from the examples.
- For production, override the following URLs with your live domains:
  - `NODE_BASE_URL`
  - `FRONTEND_URL`
  - `FACE_SERVICE_URL`
  - `FRAUD_SERVICE_URL`
  - `SEMANTIC_SERVICE_URL`
- Set `TWILIO_WEBHOOK_URL` to `https://<your-backend-domain>/api/ivr/twilio/voice`.
- Keep `DISABLE_DIRECT_HIRE_SWEEP=true` and `SKIP_SEMANTIC_REBUILD_ON_STARTUP=true` in production if you plan to scale the backend horizontally.

## Recommended Production Deployment Order

1. Provision shared resources:
   - MongoDB Atlas
   - Cloudinary
   - Twilio phone number and webhook
   - Razorpay account
   - Email SMTP credentials
   - Google Maps API key
   - Groq/OpenAI API key

2. Deploy Python microservices first:
   - `server/fraud_service/`
   - `server/semantic_match_service/`
   - `face_service/`

3. Deploy `server/` backend next.
   - Set the backend’s `FACE_SERVICE_URL`, `FRAUD_SERVICE_URL`, and `SEMANTIC_SERVICE_URL` to the deployed Python service URLs.
   - Set `NODE_BASE_URL` and `FRONTEND_URL` to the production domains.

4. Deploy `client/` frontend last.
   - Set `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_FLASK_URL`, and `VITE_FRAUD_SOCKET_URL` to the production service URLs.

5. Verify end-to-end:
   - `GET /api/health`
   - `GET /api/fraud/health`
   - `GET /api/matching/health`
   - `GET /health` on the face service
   - browser-based app load and login flows
   - Twilio IVR webhook connectivity

## Recommended Hosting Setup

- Use Vercel for `client/`.
- Use Render for `server/` and the three Python microservices.
- If you prefer a single platform, you can use Render for all services and deploy the static frontend using a Render static site.

## What to deploy first

1. Python microservices so the backend can resolve them.
2. Backend API so the client has a working API endpoint.
3. Frontend last, after all API URLs are live.

## Run Order

Start the services in this order:

### 1. Main backend

```bash
cd server
npm start
```

or during development:

```bash
cd server
npm run dev
```

### 2. Fraud service

```powershell
cd server\fraud_service
.\.venv\Scripts\Activate.ps1
python app.py
```

### 3. Semantic matching service

```powershell
cd server\semantic_match_service
.\.venv\Scripts\Activate.ps1
python main.py
```

### 4. Frontend

```bash
cd client
npm run dev
```

### 5. Face verification service

```powershell
cd face_service
.\.venv311\Scripts\Activate.ps1
python main.py
```

## Key Endpoints

- `GET /api/health`
- `POST /api/auth/send-otp`
- `POST /api/auth/register/worker`
- `POST /api/auth/register/client`
- `GET /api/worker/public/:id`
- `GET /api/client/workers/:workerId/profile`
- `GET /api/worker/jobs`
- `POST /api/client/jobs/post`
- `POST /api/client/direct-hires`
- `GET /api/ivr/twilio/voice`
- `POST /api/ivr/twilio/state`
- `GET /api/admin/fraud/queue`
- `GET /api/admin/workers`
- `GET /api/shop/public/all`
- `GET /api/matching/health`

## Feature List

### Authentication
- OTP send and verify
- Password login
- Forgot password and reset password
- Worker application status lookup
- Face similarity preview for registration

### Worker Features
- Worker registration with photo, ID proof, skill certificates, portfolio, and e-Shram card
- Worker profile, settings, and password change OTP flow
- Availability toggle
- Available jobs and job details
- Job applications and sub-task applications
- Direct invite acceptance and rejection
- Direct hire invitations
- Direct hire ticket management
- Bookings, analytics, feedback, history, and leaderboard
- Public profile and public profile summary
- Nearby client discovery and live tracking
- Community posts and comments
- Complaints
- Coupons and purchase history
- Public shop browsing

### Client Features
- Client registration and profile management
- Job posting, editing, and deletion
- Worker search, invites, hiring, rejection, and rating
- Job manage dashboard
- History and favorites
- Nearby shops and marketplace discount
- Client live tracking
- Face verification for assigned worker
- AI assistant and pricing help
- Direct hire ticket creation and payment handling
- Groups and notifications
- Complaints

### Shop Features
- Shop registration and login
- Shop profile and media uploads
- Product management
- Coupon verification and application
- Transaction history and analytics
- Public shop listing and public product browsing

### Admin Features
- Worker approval, rejection, blocking, and deletion
- Client moderation
- Shop moderation
- Worker and client complaints review
- Community moderation
- Fraud queue, scan, stats, actions, and health
- Direct hire payment review, warnings, blocking, and unblocking
- Marketplace rates and worker leaderboard
- User profile lookup
- Notification management
- Document proxy for previews

### AI, IVR, and Automation
- AI question generation
- AI estimate generation
- AI assistant conversations
- Semantic matching rebuild and sync
- Fraud scoring and alerts
- IVR worker registration guidance
- IVR job detail SMS and call flow
- Scheduled direct-hire payment sweep
- Rate and demand update cron jobs

## Health Checks

- Backend root: `http://localhost:5000/`
- Backend health: `http://localhost:5000/api/health`
- Fraud health via backend: `http://localhost:5000/api/fraud/health`
- Semantic matching health: `http://localhost:5000/api/matching/health`

## Twilio And IVR Setup

If you are testing locally with ngrok:

```powershell
ngrok http 5000
```

Then configure Twilio with the public webhook URL:

- `https://your-ngrok-domain/api/ivr/twilio/voice`

The state callback is handled by `/api/ivr/twilio/state`.

## Security Notes

- Do not commit `.env` files.
- Do not commit `node_modules` or generated Python virtual environments.
- Public endpoints intentionally expose only limited data; sensitive fields are filtered in the backend.

## Troubleshooting

- If IVR webhooks fail, confirm `TWILIO_WEBHOOK_URL` and `NODE_BASE_URL` point to the active public tunnel.
- If fraud or semantic services fail, confirm their Python virtual environments and ports are running.
- If uploads fail, confirm Cloudinary and Multer settings are valid.
- If a route returns 401/403, verify the correct role token is in use.

### CORS issues
- Keep frontend at `http://localhost:5173` in local setup.
- Verify `FRONTEND_URL` in `server/.env`.

### SMS not sent
- Verify Twilio credentials and sender number.
- Ensure phone numbers are stored in valid format.

## Build Frontend

```bash
cd client
npm run build
```

## Security Notes

- Do not commit real credentials to Git.
- Keep `.env` local/private.
- Rotate keys immediately if accidentally exposed.

## License

Use the license required by your academic/project submission policy.
