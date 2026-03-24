# KarigarConnect

KarigarConnect is a full-stack marketplace platform that connects clients with skilled workers. It includes AI-assisted job help, fraud monitoring, face verification, notifications, and IVR-based worker interaction.

## Modules

- `client/`: React + Vite frontend
- `server/`: Node.js + Express + MongoDB backend
- `server/fraud_service/`: Python Flask fraud service
- `face_service/`: Python face verification service (optional but recommended)

## Features

### Authentication and Access
- OTP and password-based login
- Role-based access: admin, worker, client
- JWT session security

### Worker Flow
- Profile, skills, portfolio, availability
- Job discovery and applications
- IVR-based job interaction (language menu, apply/cancel flow)
- Leaderboard and performance points

### Client Flow
- Job posting and management
- Worker hiring and tracking
- Rating and completion workflow

### Admin Flow
- User and worker approval management
- Fraud dashboard and action queue
- Community and complaint moderation

### AI, Fraud, and Notifications
- AI estimate and guidance endpoints
- Fraud scoring and alerts
- In-app + SMS notifications

## Tech Stack

### Frontend
- React 19
- Vite 7
- Redux Toolkit
- React Router

### Backend
- Node.js + Express 5
- MongoDB + Mongoose
- Twilio, Cloudinary, Nodemailer
- Groq SDK (IVR speech intent extraction)

### Python Services
- Flask
- XGBoost + SHAP
- APScheduler

## Prerequisites

- Node.js 18+ (recommended 20 LTS)
- npm 9+
- Python 3.11+
- MongoDB 6+

## Project Structure

```text
Karigar-Connect/
	client/
	server/
		controllers/
		models/
		routes/
		services/
		fraud_service/
	face_service/
```

## Local Ports

- Frontend: `5173`
- Main backend: `5000`
- Fraud service: `5001`
- Face service: `8001`

## Setup

### 1) Install frontend

```bash
cd client
npm install
```

### 2) Install backend

```bash
cd ../server
npm install
```

### 3) Install fraud service

```powershell
cd fraud_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r Requirements.txt
cd ..
```

### 4) Install face service (optional)

```powershell
cd ..\face_service
python -m venv .venv311
.\.venv311\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..\server
```

## Environment Configuration

Create `server/.env` with at least the following keys:

```env
MONGO_URI=mongodb://127.0.0.1:27017/karigarConnect
PORT=5000
JWT_SECRET=your_jwt_secret

FRONTEND_URL=http://localhost:5173
FACE_SERVICE_URL=http://localhost:8001
FRAUD_SERVICE_URL=http://127.0.0.1:5001
NODE_BASE_URL=http://localhost:5000
INTERNAL_SECRET=your_internal_secret

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone

TWILIO_IVR_VOICE_PATH=/api/ivr/twilio/voice
TWILIO_IVR_STATE_PATH=/api/ivr/twilio/state
REGISTRATION_URL=http://localhost:5173/register

TWILIO_TTS_VOICE_HI=hi-IN-Standard-A
TWILIO_TTS_VOICE_MR=mr-IN-Standard-A
TWILIO_TTS_VOICE_EN=en-IN-Chirp3-HD-Kore
IVR_JOB_MATCH_RADIUS_KM=20

GROQ_API_KEY=your_groq_api_key

EMAIL_USER=your_email
EMAIL_PASS=your_email_app_password

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

ADMIN_MOBILE=admin_mobile
ADMIN_PASSWORD=admin_password
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
VITE_FLASK_URL=http://localhost:5001
VITE_FRAUD_SOCKET_URL=http://localhost:5001
```

## Run Order

Start services in this sequence.

### 1) Backend

```bash
cd server
node server.js
```

or

```bash
cd server
nodemon server.js
```

### 2) Fraud service

```powershell
cd server\fraud_service
.\.venv\Scripts\Activate.ps1
python app.py
```

### 3) Frontend

```bash
cd client
npm run dev
```

### 4) Face service (optional)

```powershell
cd face_service
.\.venv311\Scripts\Activate.ps1
python main.py
```

## Health and Smoke Checks

- Backend root: `http://localhost:5000/`
- Backend health: `http://localhost:5000/api/health`
- Fraud health (through backend): `http://localhost:5000/api/fraud/health`
- Fraud direct health: `http://localhost:5001/health`
- IVR voice webhook (POST): `http://localhost:5000/api/ivr/twilio/voice`
- IVR state webhook (POST): `http://localhost:5000/api/ivr/twilio/state`

Quick IVR local test (PowerShell):

```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/ivr/twilio/voice" `
	-Method POST `
	-Body "From=%2B919876543210&CallSid=TEST123" `
	-ContentType "application/x-www-form-urlencoded" `
	-UseBasicParsing
```

Expected response: HTTP `200` with TwiML XML.

## Twilio Webhook Configuration

If using ngrok for local development:

```powershell
ngrok http 5000
```

Then set Twilio Voice webhook to:

- `https://<your-ngrok-domain>/api/ivr/twilio/voice`

The backend automatically drives call flow through `/api/ivr/twilio/state`.

## Troubleshooting

### 502/Bad Gateway for IVR webhooks
- Confirm backend is running and reachable.
- Confirm Twilio webhook path is exactly `/api/ivr/twilio/voice`.
- Confirm `NODE_BASE_URL` points to your active tunnel/domain.
- Check backend logs for IVR handler exceptions.

### MongoDB errors on IVR unregistered lead updates
- Ensure `server/models/ivrUnregisteredLeadModel.js` exists and is in sync.
- Restart backend after pulling IVR changes.

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
