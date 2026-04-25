# KarigarConnect Client

This package contains the React + Vite frontend for KarigarConnect. It serves the client, worker, shop, and admin user interfaces.

## Frontend Features

### Public and auth screens
- Landing page and marketing pages
- Login, registration, forgot password, and reset password
- Worker registration, client registration, and shop registration
- Worker application status check
- Public worker profile browsing

### Client screens
- Dashboard and job posting
- Job management and history
- Favorites and nearby shops
- AI assistant and profile tools
- Direct hire management and live tracking
- Complaints, groups, and notifications

### Worker screens
- Dashboard and available job requests
- Bookings, direct invites, and direct hires
- Public profile and ID card preview
- Availability, leaderboard, feedback, and history
- Community, groups, shops, and live tracking

### Admin screens
- Dashboard and user moderation
- Worker profile review
- Complaints, community moderation, fraud monitor, and shops
- Marketplace rates and direct hire payment views

### Shared UI
- Error boundary for route-level rendering failures
- Toast notifications
- Role-based route protection
- API interceptors for auth tokens

## Setup

### 1. Install dependencies

```bash
cd client
npm install
```

### 2. Configure environment variables

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
VITE_FLASK_URL=http://localhost:5001
VITE_FRAUD_SOCKET_URL=http://localhost:5001
```

### 3. Start the frontend

```bash
npm run dev
```

The app runs on port `5173` by default.

## Useful Notes

- The frontend expects the backend to be running before login, job browsing, AI assistant, IVR, or tracking screens are used.
- Public routes are only the UI surface; backend authorization still protects the sensitive data.
- Do not commit `.env` or `node_modules`.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```
