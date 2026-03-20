# KarigarConnect

KarigarConnect is a full-stack marketplace platform connecting clients and skilled workers, with AI assistance, fraud detection, face verification, notifications, and role-based dashboards.

## What This Project Contains

This repository has 4 major parts:

- `client/` - React + Vite frontend
- `server/` - Node.js + Express + MongoDB main backend API
- `server/fraud_service/` - Python Flask fraud detection microservice
- `face_service/` - Python face verification service (optional but recommended)

## Core Features

### Authentication and Security
- OTP login and password login
- Role-based authentication (Admin, Worker, Client)
- JWT session management
- Face verification support during auth flow

### Worker Features
- Worker profile with skills, experience, and portfolio
- Job discovery and job applications
- Booking management
- Availability toggle
- Leaderboard and performance tracking
- Complaint filing and feedback views

### Client Features
- Post and manage jobs
- View and hire workers
- Applicant response workflow
- Subtask and group job support
- Rate workers and complete job flow
- AI-assisted job guidance

### Admin Features
- Worker approval and user management
- Admin dashboard with platform stats
- Fraud monitor with risk queue
- Fraud actions (block/delete) with audit trail

### AI and Intelligence
- AI estimate generation
- AI question generation and advisor reports
- Fraud scoring pipeline with model explanations (SHAP)

### Fraud Detection and Monitoring
- Worker and client risk scoring
- Real-time fraud alert queue
- Full scan trigger from admin monitor
- Action history and model metrics
- Automatic warning notifications for medium/high risk threshold crossings

### Notifications
- In-app notifications
- SMS notifications (Twilio)
- Fraud and account-status notifications

## Tech Stack

### Frontend
- React 19
- Vite 7
- Redux Toolkit
- React Router
- Tailwind CSS
- Axios

### Backend
- Node.js + Express 5
- MongoDB + Mongoose
- JWT
- Cloudinary
- Twilio
- Nodemailer

### Python Services
- Flask
- Flask-SocketIO
- PyMongo
- XGBoost
- SHAP
- APScheduler

## Required Versions

Use these minimum versions for stable setup:

- Node.js: 18.x or higher (recommended 20.x LTS)
- npm: 9.x or higher
- Python: 3.11.x (recommended for fraud and face services)
- MongoDB: 6.x or higher (local instance)
- Git: latest stable

## Project Structure

- `client/src/` - pages, components, Redux store, API wrapper
- `server/controllers/` - business logic
- `server/routes/` - API routes
- `server/models/` - Mongoose models
- `server/utils/` - helpers and integrations
- `server/fraud_service/routes/` - fraud prediction and actions API
- `server/fraud_service/preprocessing/` - feature engineering
- `server/fraud_service/models/` - trained fraud model artifacts (local)
- `face_service/main.py` - face verification API entrypoint

## Ports Used

- Frontend (Vite): `5173`
- Main Backend (Node/Express): `5000`
- Fraud Service (Flask): `5001`
- Face Service (Python): `8001`

## Installation and Setup

## 1) Clone

```bash
git clone <your-repo-url>
cd KarigarConnect
```

## 2) Install Frontend Dependencies

```bash
cd client
npm install
cd ..
```

## 3) Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

## 4) Install Fraud Service Dependencies

Windows PowerShell:

```powershell
cd server\fraud_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r Requirements.txt
cd ..\..
```

## 5) Install Face Service Dependencies (Optional)

Windows PowerShell:

```powershell
cd face_service
python -m venv .venv311
.\.venv311\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

## Environment Configuration

Create and configure these env files before running.

## A) Backend env (`server/.env`)

Use local MongoDB and local services:

```env
MONGO_URI=mongodb://127.0.0.1:27017/karigarConnect
PORT=5000
JWT_SECRET=your_jwt_secret

FRONTEND_URL=http://localhost:5173
FACE_SERVICE_URL=http://localhost:8001
FRAUD_SERVICE_URL=http://localhost:5001
NODE_BASE_URL=http://localhost:5000
INTERNAL_SECRET=your_internal_secret

TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

EMAIL_USER=your_email
EMAIL_PASS=your_app_password

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

ADMIN_MOBILE=admin_mobile
ADMIN_PASSWORD=admin_password

GROQ_API_KEY=your_groq_api_key
```

## B) Frontend env (`client/.env`)

```env
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
VITE_FLASK_URL=http://localhost:5001
VITE_FRAUD_SOCKET_URL=http://localhost:5001
```

## C) Fraud Service env

The fraud service reads env from `server/.env`, so no separate env file is required.

## Run the Project

Start services in this order.

## 1) Start Main Backend

```bash
cd server
node server.js
```

(If you use nodemon locally, `nodemon server.js` is also fine.)

## 2) Start Fraud Service

Windows PowerShell:

```powershell
cd server\fraud_service
.\.venv\Scripts\Activate.ps1
python app.py
```

## 3) Start Frontend

```bash
cd client
npm run dev
```

## 4) Start Face Service (Optional but recommended)

Windows PowerShell:

```powershell
cd face_service
.\.venv311\Scripts\Activate.ps1
python main.py
```

## Health Checks

- Backend root: `http://localhost:5000/`
- Backend health: `http://localhost:5000/api/health`
- Fraud health via backend: `http://localhost:5000/api/fraud/health`
- Fraud direct health: `http://localhost:5001/health`

## Build Frontend for Production

```bash
cd client
npm run build
```

## Common Troubleshooting

### MongoDB connection failed
- Ensure MongoDB local server is running.
- Verify `MONGO_URI` is exactly `mongodb://127.0.0.1:27017/karigarConnect` if using local data.

### Fraud monitor queue empty
- Confirm fraud service is running on port 5001.
- Trigger a full scan from Admin Fraud Monitor.

### No SMS notifications
- Verify Twilio credentials in `server/.env`.
- Ensure user mobile numbers are present and valid.

### CORS issues
- Ensure frontend runs on `http://localhost:5173`.
- Ensure `FRONTEND_URL` in backend env is set correctly.

## Notes for GitHub Push

This repo uses `.gitignore` to exclude local env files, node_modules, virtual environments, generated model/data files, and runtime uploads.

Before pushing, verify:

```bash
git status
```

Only commit source code and required configuration templates (not secrets).

## License

Use your preferred license for your final-year submission/repository.
