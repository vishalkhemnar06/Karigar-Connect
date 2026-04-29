# KarigarConnect — Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Stack](#architecture--stack)
3. [Feature Set & Technical Implementation](#feature-set--technical-implementation)
4. [Database Models](#database-models)
5. [API Routes & Controllers](#api-routes--controllers)
6. [External Services & Integrations](#external-services--integrations)
7. [Deployment Architecture](#deployment-architecture)
8. [Development & Build Commands](#development--build-commands)
9. [Key Technologies by Feature](#key-technologies-by-feature)
10. [Environment Variables](#environment-variables)

---

## Project Overview

**KarigarConnect** is a comprehensive full-stack marketplace platform for skilled workers (Karigars), clients, shops, and administrators. The system enables job posting, hiring, live tracking, AI-assisted pricing, fraud detection, community engagement, and verified digital identity management.

### Core Business Objectives
- Connect skilled workers with verified clients
- Provide transparent, verifiable digital identities for workers
- Enable secure payments and transaction tracking
- Implement two-way verification for trust
- Provide AI-assisted job matching and pricing
- Detect and prevent fraud
- Support mobile-first user experience
### Socio-Technical Relevance

KarigarConnect directly addresses economic inequality and digital exclusion by providing verifiable digital identities and market access to informal skilled workers. The platform's QR-based ID cards and audit-backed credentialing lower barriers to institutional services — including microcredit, insurance, and government welfare — that often require formal documentation. By making workers discoverable and verifiable, KarigarConnect helps integrate large informal labor segments into formal service and financial ecosystems, increasing income opportunities and economic resilience for vulnerable populations.

From a technical standpoint, KarigarConnect implements a Two-Way Verification Model that authenticates both workers and clients to reduce trust asymmetries common in gig marketplaces. The system couples scalable, non-blocking Node.js/Express APIs with geospatial filtering, WebSocket-based real-time communication, and FCM push notifications to support high concurrency and low-latency interactions. AI components — including TF-IDF and cosine-similarity-based semantic matching and ML-driven fraud detection using ensemble/tree methods — improve matching accuracy and automated risk mitigation while preserving explainability through model-interpretability tooling.

Academically, the project synthesizes methods from software engineering, distributed systems, machine learning, and human–computer interaction into a cohesive, production-ready system. It demonstrates practical trade-offs in architecture (microservice separation for compute-heavy ML workloads), fairness and trust design (two-way verification and audit logs), and usability (mobile-first UX, voice IVR). As a result, KarigarConnect serves both as an applied research case study and a deployable platform that translates theoretical approaches into measurable socio-economic impact.

---

## Research Gaps and Solutions

### 5.1 The Worker's Lifecycle and Agency Gap

**Gap Identified**: Existing platforms like ServiceArc (Jadhav et al., 2023) and the Daily-Wage Worker Hiring System (Bhasker Rao K et al., 2022) treat workers as one-time job seekers, ignoring their long-term career growth, skill progression, and transition to independent contracting.

**KarigarConnect's Solution**: Introduces a "digital work diary" (via `workerDailyProfileModel.js`) to track jobs, payments, ratings, and feedback over time. Includes team-building and group hiring features (`groupController.js`, `Group.js`) to support career progression from individual worker to contractor/project lead, enabling workers to aggregate teams and establish track records for scaling.

---

### 5.2 Trust and Dispute Resolution Gap

**Gap Identified**: Basic ID verification (Thomas et al., 2024; Nirmal et al., 2025) and simple rating systems fail to establish trust or manage disputes effectively in informal labour marketplaces, particularly in cross-geographic transactions.

**KarigarConnect's Solution**: Implements a multi-layer trust system — face-verified digital identity (InsightFace-based `face_service`), two-way ratings and peer/client skill endorsements (`ratingModel.js`), and a structured dispute resolution process with evidence attachment, admin adjudication, and voice-guided UI (IVR module via `ivrController.js`). Audit logging (`auditLogModel.js`) ensures transparency and accountability.

---

### 5.3 Socio-Technical Design Gap

**Gap Identified**: Most platforms replace the social role of physical labour mandis (traditional marketplaces) with impersonal digital listings, ignoring community practices like bartering, reputation-building, and face-to-face trust mechanisms essential to informal economies.

**KarigarConnect's Solution**: Adds community-driven features including a moderated community feed (`communityController.js`, `communityPostModel.js`), job barter mechanics for skill exchange, and QR-based digital identity cards for offline verification. These bridge digital and physical trust mechanisms, preserving social fabric while enabling scale.

---

### 5.4 Economic Model and Middleman Gap

**Gap Identified**: Systems like ServiceArc (Jadhav et al., 2023) criticize contractor intermediaries but don't offer scalable alternatives; approaches like Labour Agency (Thomas et al., 2024) remain underdeveloped, leaving workers dependent on manual networks or exploitative middlemen.

**KarigarConnect's Solution**: Introduces a transparent Contractor/Karigar-Lead Mode for experienced workers (`groupController.js`, role-based access in `userModel.js`). Verified workers can transition to project leads managing teams with platform-enforced transparency, escrow payments (Razorpay integration), and dispute resolution. This creates a legitimate alternative to informal middlemen while maintaining platform oversight and worker protections.

---

### 5.5 Bias and Cold Start Problem

**Gap Identified**: Systems using collaborative filtering or recommendation algorithms (Kamble et al., 2023) disadvantage new users with no prior ratings or history, perpetuating bias against newcomers and limiting market access for first-time workers.

**KarigarConnect's Solution**: Deploys AI-boosting mechanisms in the semantic matching service (`semanticMatchingService.js`) to promote newly verified users in job recommendations. Combines this with sentiment-weighted feedback analysis to ensure fairer job allocation independent of historical data. New workers benefit from the two-way verification model and skill endorsements, reducing cold-start disadvantage.

---

## Architecture & Stack

### Frontend Technology Stack
```
Web Application (Client)
├── React 19.2.4 (UI framework)
├── Vite 7.x (Build tool)
├── Redux Toolkit 2.9.0 (State management)
├── React Router 7.9.1 (Routing)
├── Tailwind CSS 4.x (Styling)
├── Framer Motion 12.38.0 (Animations)
├── Socket.io Client 4.8.1 (Real-time communication)
├── Axios 1.12.2 (HTTP client)
├── i18next 25.10.3 (Internationalization)
├── Leaflet 1.9.4 (Map display)
├── Lucide React 0.544.0 (Icons)
├── QR Code React 4.2.0 (QR generation)
├── React Hot Toast 2.6.0 (Notifications)
├── jsPDF 3.0.3 (PDF export)
├── html2canvas 1.4.1 (Canvas rendering)
├── Recharts 3.8.1 (Charting)
├── XLSX 0.18.5 (Excel export)
└── dom-to-image-more 3.7.1 (Image export)
```

### Mobile Application Stack
```
React Native / Expo
├── React Native 0.81.5
├── Expo SDK 54.0
├── React Navigation 7.2.0 (Navigation)
├── React Hook Form 7.72.0 (Form handling)
├── React Query 5.95.2 (Data fetching)
├── Zustand 5.0.12 (State management)
├── Zod 4.3.6 (Validation)
├── Axios 1.13.6 (HTTP)
├── Expo Camera (Camera access)
├── Expo Location (GPS tracking)
├── Expo Notifications (Push notifications)
├── Expo Secure Store (Secure storage)
├── React Native Toast Message (Notifications)
└── React Native Date/Time Picker
```

### Backend Technology Stack
```
Node.js Server (Express 5.1.0)
├── Express 5.1.0 (Web framework)
├── MongoDB 6+ with Mongoose 8.18.1 (Database)
├── JWT 9.0.2 (Authentication)
├── bcryptjs 3.0.2 (Password hashing)
├── Socket.io (Real-time communication)
├── Multer 2.0.2 (File uploads)
├── Cloudinary SDK 1.41.3 (Image storage)
├── Twilio 4.20.0 (SMS/IVR)
├── Nodemailer 7.0.6 (Email)
├── Razorpay 2.8.0 (Payments)
├── QR Code 1.5.4 (QR generation)
├── Groq SDK 0.37.0 (AI inference)
├── Node Cron 4.2.1 (Job scheduling)
├── Axios 1.13.6 (HTTP requests)
├── CORS 2.8.5 (Cross-origin)
├── Dotenv 17.2.2 (Environment config)
└── Google Translate API 9.2.1 (Translation)
```

### Python Services Stack
```
Face Verification Service (FastAPI)
├── FastAPI 0.104.1
├── Uvicorn 0.24.0
├── InsightFace 0.7.3 (Face recognition)
├── ONNX Runtime 1.24.3 (Model inference)
├── OpenCV 4.10.0.84
├── NumPy 2.2.0
└── Pillow 11.1.0

Fraud Detection Service (Flask)
├── Flask 3.0.3
├── Flask-SocketIO 5.3.6
├── Flask-CORS 4.0.1
├── XGBoost 2.0.3 (ML model)
├── Scikit-learn 1.5.0 (ML utilities)
├── SHAP 0.45.1 (Feature importance)
├── Pandas 2.2.2 (Data processing)
├── NumPy 1.26.4
├── APScheduler 3.10.4 (Task scheduling)
└── Requests 2.32.3

Semantic Matching Service (Python)
├── Custom ML models
├── Pandas & NumPy
└── Integration with Node.js API
```

---

## Feature Set & Technical Implementation

### 1. USER AUTHENTICATION & AUTHORIZATION

#### Features
- OTP-based login (SMS/Email)
- Password-based login
- JWT token-based session management
- Role-based access control (Worker, Client, Shop, Admin)
- Two-factor authentication support
- Password strength validation
- OTP cooldown & rate limiting
- Audit logging for security events

#### Technical Implementation
- **File**: `authController.js`, `authRoutes.js`
- **Database Models**: `userModel.js`
- **Middleware**: `authMiddleware.js`
- **External Services**: Twilio (SMS), Nodemailer (Email)
- **Crypto**: bcryptjs for password hashing, JWT for tokens
- **Features**:
  - In-memory OTP store (production: use Redis)
  - OTP TTL: 5 minutes
  - Max verify attempts: 5
  - Strong password policy enforcement
  - Audit event logging
  - Admin account auto-creation on first deployment

---

### 2. WORKER PROFILE & VERIFICATION

#### Features
- Worker registration with document upload
- Skill selection and categorization
- Photo upload and face verification
- ID card verification (Aadhaar, PAN, etc.)
- Experience tracking
- Rating & review system
- Verification status management (pending/approved/rejected)
- Public worker profile with QR code
- Digital ID card generation & download
- Worker availability management
- Earnings tracking

#### Technical Implementation
- **Files**: `workerController.js`, `workerRoutes.js`, `ViewIdCard.jsx`
- **Database Models**: `userModel.js`, `ratingModel.js`, `workerDailyProfileModel.js`
- **Face Verification**: FastAPI service (port 8001) via InsightFace
- **ID Card Generation**:
  - React component with html2canvas & jsPDF
  - Front & back card design
  - QR code embedding
  - A6 landscape format (148mm × 105mm) at 300 DPI
  - Barcode generation
- **External Services**:
  - Cloudinary for photo storage
  - Custom face verification service
  - QR code generation
- **Key Endpoints**:
  - `POST /api/auth/register/worker` - Register worker
  - `GET /api/workers/profile` - Get worker profile
  - `PUT /api/workers/profile/update` - Update profile
  - `GET /api/workers/id-card` - Generate ID card
  - `POST /api/workers/verify-face` - Trigger face verification
  - `GET /api/workers/public/:id` - Public profile view

---

### 3. CLIENT PROFILE & JOB MANAGEMENT

#### Features
- Client registration & profile setup
- Job posting with detailed descriptions
- Job editing and status management
- Application review & worker selection
- Direct hire ticket creation
- Job history tracking
- Client ratings & review system
- Job preferences & filters
- Client verification

#### Technical Implementation
- **Files**: `clientController.js`, `clientRoutes.js`
- **Database Models**: `userModel.js`, `jobModel.js`, `ratingModel.js`
- **Key Endpoints**:
  - `POST /api/auth/register/client` - Register client
  - `GET /api/clients/profile` - Get profile
  - `PUT /api/clients/profile/update` - Update profile
  - `POST /api/jobs/create` - Create job
  - `GET /api/jobs/list` - List jobs
  - `PUT /api/jobs/:id/edit` - Edit job
  - `GET /api/jobs/:id/applications` - View applications
  - `POST /api/jobs/:id/hire` - Hire worker

---

### 4. JOB POSTING & MATCHING

#### Features
- Advanced job posting with categories & skills
- Geospatial filtering (radius-based search)
- Semantic job-worker matching (ML-based)
- Job recommendation engine
- Smart matching feedback
- Job application tracking
- Worker availability matching
- Rate-based job suggestions

#### Technical Implementation
- **Files**: 
  - `jobController.js`, `jobRoutes.js`
  - `semanticMatchingController.js`, `semanticMatchingRoutes.js`
  - `semanticMatchingService.js` (Python ML backend)
- **Database Models**: 
  - `jobModel.js`
  - `jobMatchFeedbackModel.js`
  - `locationModel.js`
- **ML Matching**:
  - Custom semantic matching service
  - Skill embedding model
  - Location-aware matching
  - Availability verification
- **Key Endpoints**:
  - `POST /api/jobs/create` - Post job
  - `GET /api/jobs/nearby` - Nearby jobs
  - `GET /api/jobs/match/suggestions` - Semantic matching
  - `POST /api/jobs/:id/apply` - Apply to job
  - `POST /api/match/feedback` - Training feedback

---

### 5. DIRECT HIRE SYSTEM

#### Features
- Direct hire ticket creation (client → worker)
- Ticket acceptance/rejection
- Payment tracking for tickets
- Task completion marking
- Rate management
- Weekly automated payments
- Direct hire history

#### Technical Implementation
- **Files**: `directHireController.js`, `jobRoutes.js`
- **Database Models**: `jobModel.js`, `transactionModel.js`, `paymentTransactionModel.js`
- **Payment Processing**: Razorpay integration
- **Automation**: Node Cron (weekly payment sweep)
- **Key Endpoints**:
  - `POST /api/jobs/direct-hire` - Create direct hire
  - `PUT /api/jobs/:id/direct-hire/accept` - Accept ticket
  - `PUT /api/jobs/:id/direct-hire/complete` - Mark complete
  - `GET /api/transactions/direct-hire` - Payment history

---

### 6. LIVE LOCATION TRACKING

#### Features
- Real-time worker location tracking for active jobs
- Geofencing support
- Location history logging
- Map visualization
- Privacy controls (only during active jobs)
- Location sharing toggles

#### Technical Implementation
- **Files**: `locationController.js`, `locationRoutes.js`
- **Database Models**: `locationModel.js`
- **Frontend**: Leaflet.js for map display
- **Mobile**: Expo Location API
- **Real-time**: Socket.io for live updates
- **Key Endpoints**:
  - `POST /api/locations/update` - Update worker location
  - `GET /api/locations/job/:id` - Get job location trail
  - `GET /api/locations/current` - Get current location

---

### 7. PAYMENT & RAZORPAY INTEGRATION

#### Features
- Multiple payment methods support
- Secure payment processing
- Transaction tracking
- Payment verification
- Invoice generation
- Refund handling
- Payment history & statements

#### Technical Implementation
- **Files**: `razorpayController.js`, `paymentRoutes.js`, `paymentTransactionModel.js`
- **Integration**: Razorpay API (v2)
- **Flow**:
  1. Client initiates payment
  2. Razorpay order creation
  3. Payment processing
  4. Webhook verification
  5. Transaction logging
- **Security**:
  - Signature verification
  - Encrypted transaction data
  - PCI compliance
- **Key Endpoints**:
  - `POST /api/payments/create-order` - Create payment order
  - `POST /api/payments/verify` - Verify payment
  - `GET /api/payments/history` - Payment history

---

### 8. COMPLAINT MANAGEMENT

#### Features
- Worker support tickets (Complaint Model)
- Client-vs-Worker disputes (ClientComplaint Model)
- Admin complaint review & resolution
- Status tracking (Open, In-Review, Resolved, Closed)
- Evidence attachment
- Resolution tracking
- Escalation support

#### Technical Implementation
- **Files**:
  - `complaintModel.js`, `clientComplaintModel.js`
  - `workerComplaintController.js`, `clientComplaintController.js`
  - `adminComplaintController.js`, `adminWorkerComplaintController.js`
  - `workerComplaintRoutes.js`, `clientComplaintRoutes.js`
  - `adminComplaintRoutes.js`, `adminWorkerComplaintRoutes.js`
- **Database Models**:
  - `Complaint` - Worker support tickets
  - `ClientComplaint` - Disputes between clients & workers
- **Workflow**:
  1. User files complaint
  2. Admin review & investigation
  3. Evidence gathering
  4. Resolution decision
  5. User notification
- **Key Endpoints**:
  - `POST /api/complaints/create` - File complaint
  - `GET /api/complaints/list` - List user complaints
  - `PUT /api/complaints/:id/update` - Update complaint
  - `POST /api/admin/complaints/:id/resolve` - Admin resolution

---

### 9. COMMUNITY & MODERATION

#### Features
- Community posts & feed
- Comments on posts
- Like/react system
- Content moderation
- User reputation
- Community guidelines enforcement
- Blocked users list
- Report abuse mechanism

#### Technical Implementation
- **Files**: 
  - `communityController.js`, `communityRoutes.js`
  - `adminCommunityRoutes.js`
- **Database Models**: `communityPostModel.js`
- **Features**:
  - Post creation with media
  - Comment threading
  - Reaction system
  - Admin moderation dashboard
  - Automated content filtering
- **Key Endpoints**:
  - `POST /api/community/posts` - Create post
  - `GET /api/community/feed` - Get community feed
  - `POST /api/community/posts/:id/comment` - Add comment
  - `PUT /api/community/posts/:id/moderate` - Admin moderation

---

### 10. SHOP & E-COMMERCE MODULE

#### Features
- Shop registration & profile
- Product catalog management
- Shop discovery & browsing
- Product listings with images
- Shop ratings & reviews
- Shop authentication
- Coupon/promotional code management
- Transaction history tracking

#### Technical Implementation
- **Files**: 
  - `shopController.js`, `shopRoutes.js`
  - `shopAuthController.js`, `shopAuthMiddleware.js`
  - `adminShopController.js`, `adminShopRoutes.js`
  - `workerShoppingController.js`
- **Database Models**: 
  - `shopModel.js`
  - `productModel.js`
  - `couponModel.js`
  - `transactionModel.js`
- **Features**:
  - Shop onboarding workflow
  - Multi-product listing
  - Inventory management
  - Coupon application
  - Transaction tracking
- **Key Endpoints**:
  - `POST /api/shop/register` - Register shop
  - `GET /api/shop/profile` - Get shop profile
  - `POST /api/shop/products` - Add product
  - `GET /api/shop/products` - List products
  - `GET /api/shop/nearby` - Find nearby shops

---

### 11. COUPON & PROMOTIONAL SYSTEM

#### Features
- Coupon code creation & management
- Discount percentage configuration
- Expiry date management
- Usage limits & tracking
- Coupon validation
- Worker discount application
- Purchase history with coupons

#### Technical Implementation
- **Files**: `couponController.js`, `couponRoutes.js`
- **Database Models**: `couponModel.js`
- **Validation Logic**:
  - Expiry checking
  - Usage limit verification
  - Worker eligibility
  - Discount calculation
- **Key Endpoints**:
  - `POST /api/coupons/create` - Create coupon (admin)
  - `GET /api/coupons/available` - List available coupons
  - `POST /api/coupons/validate` - Validate coupon code

---

### 12. FRAUD DETECTION & PREVENTION

#### Features
- Real-time fraud scoring
- Behavioral analysis
- Pattern detection (XGBoost ML model)
- Suspicious activity alerting
- Fraud dashboard for admins
- Action handling (freeze account, flag transaction, etc.)
- Feature importance analysis (SHAP)
- CSV dataset management

#### Technical Implementation
- **Files**:
  - `adminFraudController.js`, `adminFraudRoutes.js`
  - `fraud_service/` (Flask backend)
- **Database Models**: `fraudModel.js` (implicit in fraud service)
- **ML Pipeline**:
  - Data: 50K client + 50K worker fraud datasets
  - Model: XGBoost classifier
  - Features:
    - Transaction patterns
    - Behavioral anomalies
    - Geolocation inconsistencies
    - Temporal patterns
  - SHAP for interpretability
- **Architecture**:
  - Flask SocketIO for real-time updates
  - APScheduler for background scanning
  - MongoDB integration for data persistence
- **Actions**:
  - Account freeze
  - Transaction flagging
  - Manual review queue
  - Automated alerts
- **Key Endpoints**:
  - `GET /api/admin/fraud/dashboard` - Fraud stats
  - `GET /api/admin/fraud/queue` - Flagged cases
  - `POST /api/admin/fraud/:id/action` - Take action

---

### 13. IVR (INTERACTIVE VOICE RESPONSE)

#### Features
- Voice-based job browsing for workers
- Worker registration via phone
- Job summaries via IVR
- Application actions via DTMF (keypad)
- Unregistered lead tracking
- Call recording & logging

#### Technical Implementation
- **Files**: `ivrController.js`, `ivrRoutes.js`
- **Database Models**: 
  - `ivrSessionModel.js`
  - `ivrUnregisteredLeadModel.js`
- **Integration**: Twilio Voice API
- **Flow**:
  1. Incoming call received
  2. IVR menu presented
  3. DTMF input collection
  4. Job data fetched
  5. Response provided
  6. Session logged
- **Menu Options**:
  - Browse nearby jobs
  - Job details
  - Apply to job
  - Account info
  - Speak to operator
- **Key Endpoints**:
  - `POST /api/ivr/call-handler` - Incoming call handler
  - `POST /api/ivr/dtmf-handler` - DTMF input handler
  - `GET /api/ivr/sessions` - Session history

---

### 14. AI ASSISTANT & JOB GUIDANCE

#### Features
- AI-powered job guidance & assistance
- Smart question generation
- Estimate building assistance
- Job description optimization
- Pricing recommendations
- Contextual suggestions
- Multi-language support

#### Technical Implementation
- **Files**: 
  - `aiAssistantController.js`, `aiRoutes.js`
  - `clientChatbotController.js`, `guestChatbotController.js`
  - `chatbotSupportController.js`, `chatbotSupportRoutes.js`
- **Database Models**: 
  - `aiHistoryModel.js`
  - `chatbotSupportRequestModel.js`
- **AI Integration**: Groq SDK (LLM inference)
  - Model: Mixtral or Llama 2 (configurable)
  - Temperature & token limits configured
  - Streaming response support
- **Features**:
  - Context-aware suggestions
  - Multi-turn conversations
  - Audit trail for support requests
  - Admin support queue management
  - Escalation to human support
- **Key Endpoints**:
  - `POST /api/ai/job-assistant` - Job guidance
  - `POST /api/ai/pricing-estimate` - Price recommendation
  - `POST /api/chatbot/query` - General chatbot
  - `GET /api/chatbot/support/queue` - Support tickets

---

### 15. NOTIFICATIONS SYSTEM

#### Features
- SMS notifications (Twilio)
- Email notifications (Nodemailer)
- In-app push notifications
- Notification preferences
- Notification history
- Real-time notification delivery (Socket.io)
- Notification templates

#### Technical Implementation
- **Files**: `notificationController.js`, `notificationModel.js`
- **Database Models**: `notificationModel.js`
- **Integrations**:
  - Twilio SMS API
  - Nodemailer for SMTP email
  - Firebase Cloud Messaging (mobile)
  - Socket.io for in-app real-time
- **Triggers**:
  - Job application received
  - Worker hired
  - Payment received
  - Complaint update
  - Rating received
  - Community interaction
  - System alerts
- **Features**:
  - Batch processing
  - Retry logic
  - Failed notification logging
  - User preference respect
- **Key Endpoints**:
  - `GET /api/notifications/list` - Get notifications
  - `PUT /api/notifications/:id/read` - Mark read
  - `PUT /api/notifications/preferences` - Update preferences

---

### 16. ADMIN DASHBOARD & MANAGEMENT

#### Features
- User verification & approval
- Complaint review & resolution
- Fraud monitoring & action
- Rate management & updates
- Platform analytics & reporting
- Community moderation
- Shop management & approval
- Worker eligibility tracking
- Admin roles & permissions

#### Technical Implementation
- **Files**:
  - `adminController.js`, `adminRoutes.js`
  - `adminComplaintController.js`, `adminCommunityRoutes.js`
  - `adminFraudController.js`, `adminShopController.js`
  - `adminWorkerComplaintController.js`
- **Database Models**:
  - `userModel.js` (with role/status fields)
  - `complaintModel.js`, `clientComplaintModel.js`
  - `auditLogModel.js`
  - `rateUpdateLogModel.js`
- **Features**:
  - Dashboard statistics
  - User approval workflow
  - Complaint adjudication
  - Rate management
  - Audit logging
  - Reporting & export
- **Key Endpoints**:
  - `GET /api/admin/dashboard` - Dashboard stats
  - `GET /api/admin/users/pending` - Pending approvals
  - `POST /api/admin/users/:id/approve` - Approve user
  - `GET /api/admin/audit-logs` - Audit trail

---

### 17. GROUP HIRING & PROJECTS

#### Features
- Group project creation
- Multiple worker assignment
- Project tracking & status
- Group member management
- Task assignment within groups
- Group completion & payment
- Group ratings

#### Technical Implementation
- **Files**: `groupController.js`, `groupRoutes.js`
- **Database Models**: `Group.js`
- **Features**:
  - Project creation workflow
  - Worker invitation system
  - Progress tracking
  - Bulk payment processing
- **Key Endpoints**:
  - `POST /api/groups/create` - Create group project
  - `POST /api/groups/:id/invite-workers` - Add workers
  - `PUT /api/groups/:id/status` - Update status

---

### 18. RATING & REVIEW SYSTEM

#### Features
- Worker ratings by clients
- Client ratings by workers
- Star-based rating (1-5)
- Review comments
- Rating history & aggregates
- Performance metrics calculation
- Verified review badges

#### Technical Implementation
- **Files**: `ratingModel.js`
- **Database Models**: `ratingModel.js`
- **Features**:
  - Two-way rating (worker → client, client → worker)
  - Rating aggregation (average, count)
  - Performance scoring
  - Historical tracking
- **Key Endpoints**:
  - `POST /api/ratings/create` - Post rating
  - `GET /api/workers/:id/ratings` - Get worker ratings
  - `GET /api/clients/:id/ratings` - Get client ratings

---

### 19. RATE MANAGEMENT & UPDATES

#### Features
- Base rate configuration
- Locality factor adjustments
- Market rate tracking
- Demand-based pricing
- Automated weekly rate updates
- Rate history logging

#### Technical Implementation
- **Files**: `cron/updateRates.js`
- **Database Models**:
  - `baseRateModel.js`
  - `localityFactorModel.js`
  - `marketRateModel.js`
  - `demandSnapshotModel.js`
  - `rateUpdateLogModel.js`
- **Automation**:
  - Weekly cron job (node-cron)
  - Rate algorithm: base × locality factor × demand multiplier
  - CSV rate import support
  - Historical tracking
- **Key Endpoints**:
  - `GET /api/admin/rates/config` - Get rate config
  - `POST /api/admin/rates/import` - Import rates (CSV)

---

### 20. INTERNATIONALIZATION (I18N)

#### Features
- Multi-language support
- Language detection
- UI translation
- SMS translation support
- Content localization

#### Technical Implementation
- **Frontend**: i18next + react-i18next
- **Backend**: Google Translate API
- **Features**:
  - Automatic language detection
  - Fallback language support
  - Dynamic translation loading
  - Message formatting
- **Languages Supported**: (Configurable)
  - English (en)
  - Hindi (hi)
  - Regional languages

---

## Database Models

### Core Models

#### User Model
```javascript
{
  _id: ObjectId,
  userId: String (unique), // "KC-XXXXX"
  role: Enum ['worker', 'client', 'shop', 'admin'],
  name: String,
  email: String (unique),
  mobile: String (unique),
  password: String (hashed),
  
  // Profile
  gender: String,
  photo: String (Cloudinary URL),
  address: {
    locality: String,
    city: String,
    state: String,
    pincode: String
  },
  
  // Worker-specific
  experience: Number,
  skills: [{ name: String, verified: Boolean }],
  verificationStatus: Enum ['pending', 'approved', 'rejected'],
  faceVerificationStatus: Enum ['pending', 'passed', 'failed', 'skipped'],
  idType: String ('Aadhar Card', 'PAN Card', etc.),
  idNumber: String (hashed),
  idProofUrl: String,
  overallExperience: String,
  expiryYear: Number,
  idCardIssuedAt: Date,
  
  // Rating & Performance
  averageRating: Number (0-5),
  totalRatings: Number,
  
  // Status
  isActive: Boolean,
  isBlocked: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Job Model
```javascript
{
  _id: ObjectId,
  jobId: String (unique),
  client: ObjectId (ref: User),
  title: String,
  description: String,
  category: String,
  skills: [String],
  
  // Location & Availability
  location: {
    type: 'Point',
    coordinates: [longitude, latitude],
    city: String,
    locality: String
  },
  availableDate: Date,
  availableTime: String,
  
  // Pricing & Budget
  estimatedRate: Number,
  budget: Number,
  paymentType: Enum ['hourly', 'fixed', 'negotiable'],
  
  // Status & Tracking
  status: Enum ['open', 'in-progress', 'completed', 'cancelled'],
  applications: [ObjectId], // Worker IDs
  hiredWorker: ObjectId,
  startDate: Date,
  completionDate: Date,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

#### Rating Model
```javascript
{
  _id: ObjectId,
  ratedBy: ObjectId (ref: User),
  ratedTo: ObjectId (ref: User),
  job: ObjectId (ref: Job),
  
  rating: Number (1-5),
  review: String,
  verified: Boolean,
  
  createdAt: Date
}
```

#### Complaint Model (Worker Support Tickets)
```javascript
{
  _id: ObjectId,
  worker: ObjectId (ref: User),
  title: String,
  description: String,
  category: String,
  
  status: Enum ['open', 'in-review', 'resolved', 'closed'],
  priority: Enum ['low', 'medium', 'high'],
  
  evidence: [String], // File URLs
  adminNotes: String,
  resolvedAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### ClientComplaint Model (Disputes)
```javascript
{
  _id: ObjectId,
  client: ObjectId (ref: User),
  worker: ObjectId (ref: User),
  job: ObjectId (ref: Job),
  
  title: String,
  description: String,
  category: Enum ['poor-service', 'no-show', 'payment-issue', 'other'],
  
  status: Enum ['open', 'in-review', 'resolved', 'closed'],
  resolution: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Community Post Model
```javascript
{
  _id: ObjectId,
  author: ObjectId (ref: User),
  content: String,
  media: [String], // Image URLs
  
  comments: [{
    user: ObjectId,
    text: String,
    createdAt: Date
  }],
  
  likes: [ObjectId], // User IDs
  
  status: Enum ['published', 'flagged', 'removed'],
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Payment/Transaction Model
```javascript
{
  _id: ObjectId,
  transactionId: String (unique),
  from: ObjectId (ref: User),
  to: ObjectId (ref: User),
  job: ObjectId (ref: Job),
  
  amount: Number,
  paymentMethod: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  
  status: Enum ['initiated', 'completed', 'failed', 'refunded'],
  
  createdAt: Date,
  completedAt: Date
}
```

#### Shop Model
```javascript
{
  _id: ObjectId,
  shopId: String (unique),
  owner: ObjectId (ref: User),
  name: String,
  description: String,
  
  location: {
    type: 'Point',
    coordinates: [longitude, latitude],
    city: String,
    locality: String,
    address: String
  },
  
  phone: String,
  email: String,
  
  products: [ObjectId], // Product IDs
  
  rating: Number,
  verificationStatus: Enum ['pending', 'approved', 'rejected'],
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Coupon Model
```javascript
{
  _id: ObjectId,
  code: String (unique),
  discountPercentage: Number,
  maxUses: Number,
  usedCount: Number,
  
  validFrom: Date,
  validUntil: Date,
  
  eligibleRoles: [String], // ['worker', 'client']
  
  createdAt: Date
}
```

#### IVR Session Model
```javascript
{
  _id: ObjectId,
  callSid: String,
  caller: String,
  
  sessionData: {
    menu: String,
    input: String,
    status: String
  },
  
  duration: Number,
  outcome: String,
  
  createdAt: Date
}
```

#### Notification Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  type: Enum ['sms', 'email', 'push', 'in-app'],
  title: String,
  message: String,
  
  status: Enum ['sent', 'failed', 'pending'],
  
  readAt: Date,
  
  createdAt: Date
}
```

#### AI History Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  query: String,
  response: String,
  context: String,
  
  tokens: {
    prompt: Number,
    completion: Number
  },
  
  createdAt: Date
}
```

#### Audit Log Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  action: String,
  resource: String,
  changes: Object,
  
  ipAddress: String,
  userAgent: String,
  
  createdAt: Date
}
```

#### Group Model
```javascript
{
  _id: ObjectId,
  groupId: String,
  client: ObjectId (ref: User),
  title: String,
  description: String,
  
  workers: [ObjectId], // Worker IDs
  
  tasks: [String],
  status: Enum ['active', 'completed', 'cancelled'],
  
  budget: Number,
  paymentStatus: Enum ['pending', 'paid'],
  
  createdAt: Date,
  completedAt: Date
}
```

### Additional Models
- `baseRateModel.js` - Skill-based rate configuration
- `localityFactorModel.js` - Geographic price modifiers
- `marketRateModel.js` - Market rate tracking
- `demandSnapshotModel.js` - Demand metrics
- `rateUpdateLogModel.js` - Rate history
- `locationModel.js` - Live location tracking
- `jobMatchFeedbackModel.js` - ML training data
- `workerDailyProfileModel.js` - Daily worker status
- `taskTemplateModel.js` - Reusable task templates
- `chatbotSupportRequestModel.js` - Support tickets

---

## API Routes & Controllers

### Authentication Routes (`/api/auth`)
```
POST   /register/worker           - Register worker
POST   /register/client           - Register client
POST   /register/shop             - Register shop
POST   /login                     - Login with password/OTP
POST   /request-otp              - Request OTP
POST   /verify-otp               - Verify OTP
POST   /logout                   - Logout
POST   /refresh-token            - Refresh JWT
POST   /password-reset           - Reset password
```

### Worker Routes (`/api/workers`)
```
GET    /profile                  - Get worker profile
PUT    /profile/update           - Update profile
POST   /skills/add               - Add/update skills
POST   /availability             - Set availability
GET    /jobs/nearby              - Find nearby jobs
GET    /jobs/applications        - View applications
GET    /earnings                 - View earnings
GET    /ratings                  - Get ratings
GET    /id-card                  - Generate ID card
POST   /verify-face              - Trigger face verification
GET    /public/:karigarId        - Public profile
```

### Client Routes (`/api/clients`)
```
GET    /profile                  - Get client profile
PUT    /profile/update           - Update profile
POST   /jobs/create              - Create job posting
GET    /jobs/list                - List my jobs
PUT    /jobs/:id/edit            - Edit job
GET    /jobs/:id/applications    - View applications
POST   /jobs/:id/hire            - Hire worker
GET    /workers/nearby           - Find nearby workers
GET    /ratings                  - Get ratings
```

### Job Routes (`/api/jobs`)
```
GET    /list                     - List all jobs
GET    /nearby                   - Nearby jobs (geospatial)
POST   /create                   - Create job
PUT    /:id/edit                 - Edit job
GET    /:id                      - Get job details
POST   /:id/apply                - Apply to job
GET    /:id/applications         - View applications
POST   /:id/hire                 - Hire worker
PUT    /:id/status               - Update job status
GET    /:id/details              - Job details with tracking
```

### Direct Hire Routes
```
POST   /api/jobs/direct-hire                    - Create ticket
PUT    /api/jobs/:id/direct-hire/accept         - Accept
PUT    /api/jobs/:id/direct-hire/reject         - Reject
PUT    /api/jobs/:id/direct-hire/complete       - Complete
GET    /api/transactions/direct-hire            - Payment history
```

### Payment Routes (`/api/payments`)
```
POST   /create-order              - Create Razorpay order
POST   /verify                    - Verify payment
GET    /history                   - Payment history
GET    /:id/invoice               - Generate invoice
POST   /refund                    - Process refund
```

### Location Routes (`/api/locations`)
```
POST   /update                   - Update worker location
GET    /job/:id                  - Get location trail
GET    /current                  - Get current location
GET    /history                  - Location history
```

### Complaint Routes
```
POST   /api/complaints/create                   - File complaint
GET    /api/complaints/list                     - List complaints
PUT    /api/complaints/:id/update               - Update status
GET    /api/complaints/:id                      - Get details

POST   /api/client-complaints/create            - File dispute
GET    /api/client-complaints                   - List disputes

POST   /api/admin/complaints/:id/resolve        - Admin resolution
GET    /api/admin/complaints/queue              - Admin queue
```

### Community Routes (`/api/community`)
```
POST   /posts                    - Create post
GET    /feed                     - Get community feed
POST   /posts/:id/comment        - Add comment
POST   /posts/:id/like           - Like post
PUT    /posts/:id                - Edit post
DELETE /posts/:id                - Delete post
POST   /posts/:id/report         - Report content
```

### Admin Routes (`/api/admin`)
```
GET    /dashboard                - Dashboard stats
GET    /users/pending            - Pending approvals
POST   /users/:id/approve        - Approve user
POST   /users/:id/reject         - Reject user
GET    /complaints/queue         - Complaint queue
POST   /complaints/:id/resolve   - Resolve complaint
GET    /audit-logs               - Audit trail
GET    /rates/config             - Rate configuration
POST   /rates/import             - Import rates (CSV)
GET    /fraud/dashboard          - Fraud statistics
POST   /fraud/:id/action         - Take fraud action
```

### Shop Routes (`/api/shop`)
```
POST   /register                 - Register shop
GET    /profile                  - Get shop profile
PUT    /profile/update           - Update profile
POST   /products                 - Add product
GET    /products                 - List products
PUT    /products/:id             - Edit product
DELETE /products/:id             - Delete product
GET    /nearby                   - Find nearby shops
GET    /:id/ratings              - Get shop ratings
```

### Coupon Routes (`/api/coupons`)
```
POST   /create                   - Create coupon (admin)
GET    /available                - List available coupons
POST   /validate                 - Validate code
POST   /apply                    - Apply to transaction
```

### Semantic Matching Routes (`/api/match`)
```
GET    /suggestions              - Get job suggestions (ML)
POST   /feedback                 - Training feedback
GET    /status                   - Matching service status
```

### AI & Chatbot Routes
```
POST   /api/ai/job-assistant     - Job guidance
POST   /api/ai/pricing-estimate  - Price recommendation
POST   /api/chatbot/query        - General chatbot
POST   /api/chatbot/support      - Support request
GET    /api/chatbot/support/queue - Support queue (admin)
```

### IVR Routes (`/api/ivr`)
```
POST   /call-handler             - Incoming call handler
POST   /dtmf-handler             - DTMF input handler
GET    /sessions                 - Session history
```

### Group Routes (`/api/groups`)
```
POST   /create                   - Create group project
GET    /list                     - List groups
GET    /:id                      - Get group details
POST   /:id/invite-workers       - Invite workers
PUT    /:id/status               - Update status
POST   /:id/complete             - Mark complete
```

### Notification Routes (`/api/notifications`)
```
GET    /list                     - Get notifications
PUT    /:id/read                 - Mark as read
PUT    /preferences              - Update preferences
DELETE /:id                      - Delete notification
```

---

## External Services & Integrations

### 1. **Twilio** (SMS/IVR)
- **Purpose**: SMS notifications, OTP delivery, IVR voice flows
- **Configuration**:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`
- **Features Used**:
  - SMS API
  - Voice API (IVR)
  - DTMF handling

### 2. **Nodemailer** (Email)
- **Purpose**: Email notifications, password reset, verification
- **Configuration**:
  - SMTP server credentials
  - `EMAIL_FROM` address
  - Email templates
- **Templates Used**:
  - OTP verification
  - Password reset
  - Job notification
  - Payment receipt
  - Complaint updates

### 3. **Cloudinary** (Image Storage)
- **Purpose**: Photo uploads, ID card images, community media
- **Configuration**:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- **Features**:
  - Image optimization
  - CDN delivery
  - Secure URLs
  - Auto-deletion policies

### 4. **Razorpay** (Payment Processing)
- **Purpose**: Payment processing, order creation, verification
- **Configuration**:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
- **Flow**:
  1. Create order on Node.js backend
  2. Pass to frontend
  3. User completes payment in Razorpay modal
  4. Webhook verification
  5. Database update
- **Features**:
  - Multiple payment methods
  - Webhooks for async verification
  - Refund handling

### 5. **Face Verification Service** (FastAPI)
- **Purpose**: Face recognition, identity verification
- **Technology**: InsightFace (RetinaFace + ArcFace)
- **Endpoint**: `http://localhost:8001`
- **Features**:
  - Face detection
  - Face embedding extraction
  - Comparison & matching
- **Integration**:
  - Called during worker registration
  - Async call to service
  - Result stored in DB
  - Graceful fallback if service down

### 6. **Fraud Detection Service** (Flask)
- **Purpose**: Real-time fraud scoring, anomaly detection
- **Technology**: XGBoost ML model
- **Endpoint**: `http://localhost:5001` (Flask)
- **Features**:
  - Behavioral analysis
  - Transaction anomaly detection
  - Feature importance (SHAP)
  - Real-time scoring
- **Integration**:
  - Scoring on payment creation
  - Background scanning queue
  - Admin action handling
  - Webhook notifications

### 7. **Semantic Matching Service** (Python)
- **Purpose**: ML-based job-worker matching
- **Technology**: Custom embeddings, similarity scoring
- **Endpoint**: Internal API call
- **Features**:
  - Skill embeddings
  - Job embeddings
  - Matching algorithm
  - Ranking
- **Integration**:
  - Called when client posts job
  - Called when worker browses jobs
  - Training with feedback data

### 8. **Groq AI** (LLM Inference)
- **Purpose**: AI-assisted guidance, chatbot, recommendations
- **Models Supported**:
  - Mixtral 8x7B
  - Llama 2 70B
- **Configuration**:
  - `GROQ_API_KEY`
- **Use Cases**:
  - Job description generation
  - Pricing recommendations
  - Worker guidance
  - Chatbot responses
  - Question generation

### 9. **Google Translate API**
- **Purpose**: Multi-language support, SMS translation
- **Configuration**:
  - Google Cloud credentials
- **Features**:
  - Automatic language detection
  - Translation to user's language
  - SMS content translation

### 10. **MongoDB Atlas**
- **Purpose**: Cloud database hosting
- **Configuration**:
  - Connection string in `DATABASE_URL`
  - Automatic backups
  - Cluster configuration
- **Collections**: All models persisted here

---

## Deployment Architecture

### Frontend Deployment (Web) — **Vercel**

#### Deployment Configuration
```
Platform: Vercel
Build Command: npm run build (Vite)
Output Directory: dist/
Environment Variables:
  - VITE_API_URL: Backend API URL
  - Other API keys if needed
```

#### Vercel Benefits
- Automatic deployments on git push
- Edge caching & CDN
- Serverless functions support
- Real-time environment variables
- Automatic SSL/HTTPS
- Zero-downtime deployments

#### Deployment Steps
```bash
# 1. Connect GitHub repository
# 2. Select "client" folder as root
# 3. Set build command: npm run build
# 4. Set environment variables
# 5. Deploy
```

#### Frontend Build Process
```bash
# Development
npm run dev        # Vite dev server on localhost:5173

# Production
npm run build      # Create optimized dist/ folder
npm run preview    # Test production build locally
```

### Backend Deployment — **Render**

#### Deployment Configuration
```
Platform: Render (for Node.js server)
Build Command: npm install
Start Command: npm start (node server.js)
Environment Variables:
  - DATABASE_URL
  - FRONTEND_URL
  - JWT_SECRET
  - Twilio credentials
  - Razorpay credentials
  - Cloudinary credentials
  - Groq API key
  - Other service credentials
```

#### Render Services Architecture
```
Primary Services:
├── Node.js Express Server (Render Web Service)
│   ├── Port: 5000 (or environment specified)
│   ├── Auto-restart on failure
│   └── Persistent storage for uploads/
│
├── MongoDB Atlas Database
│   ├── Cloud-hosted MongoDB
│   └── Automatic backups
│
└── Python Services (Optional on Render)
    ├── Face Service (FastAPI)
    ├── Fraud Service (Flask)
    └── Semantic Matching Service
```

#### Render Deployment Steps
```bash
# 1. Connect GitHub repository
# 2. Select "server" folder as root
# 3. Set build command: npm install
# 4. Set start command: npm start
# 5. Set environment variables
# 6. Deploy
```

### Python Services Deployment

#### Option A: Local / Self-Hosted
```bash
# Face Service (FastAPI)
cd face_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py  # Runs on port 8001

# Fraud Service (Flask)
cd fraud_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r Requirements.txt
python app.py   # Runs on port 5001

# Semantic Matching Service
cd semantic_match_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

#### Option B: Docker Containerization
```dockerfile
# Dockerfile for Face Service
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["python", "main.py"]

# Build & run
docker build -t face-service .
docker run -p 8001:8001 face-service
```

#### Option C: Render Background Workers / Cron Jobs
```bash
# Deploy as background service
# Monitor status and logs in Render dashboard
```

### Mobile App Deployment

#### Development Build
```bash
npm install                    # Install dependencies
npm start                      # Start Expo dev server
npm run android               # Build for Android
npm run ios                   # Build for iOS
```

#### Production Build
```bash
# Using Expo CLI
eas login
eas build --platform android  # Android release APK
eas build --platform ios      # iOS production build
```

#### Distribution
- **Android**: Google Play Store
- **iOS**: Apple App Store
- **Direct Distribution**: APK/IPA files

### Environment Configuration for Deployments

#### Production Environment Variables (.env)
```env
# Database
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/karigarconnect

# Server
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://karigarconnect-client.vercel.app

# Authentication
JWT_SECRET=your-super-secret-key
JWT_EXPIRY=7d
ID_PROOF_HASH_SECRET=another-secret

# Twilio
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Razorpay
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret

# Groq AI
GROQ_API_KEY=your-groq-key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@karigarconnect.com

# Face Verification Service
FACE_SERVICE_URL=http://localhost:8001

# Fraud Service
FRAUD_SERVICE_URL=http://localhost:5001

# Optional: Admin accounts
ADMIN_EMAIL=admin@karigarconnect.com
ADMIN_PASSWORD=secure-password

# Logging
LOG_LEVEL=info
```

### Deployment Checklist

```
Frontend (Vercel):
□ Connect GitHub repo
□ Select "client" directory
□ Set build command & output
□ Add environment variables
□ Configure custom domain
□ Enable SSL/HTTPS
□ Test production build

Backend (Render):
□ Connect GitHub repo
□ Select "server" directory
□ Set build & start commands
□ Add all environment variables
□ Configure MongoDB Atlas connection
□ Set up logs & monitoring
□ Test API endpoints

Database (MongoDB Atlas):
□ Create cluster
□ Set up user authentication
□ Add IP whitelist
□ Configure backups
□ Enable monitoring

Python Services:
□ Test locally first
□ Containerize if needed
□ Deploy to infrastructure
□ Configure health checks
□ Set up error logging

Third-Party Services:
□ Twilio account & credentials
□ Razorpay merchant account
□ Cloudinary setup
□ Groq API key
□ Email service setup
□ Google Cloud credentials
```

---

## Development & Build Commands

### Client (React + Vite)
```bash
# Development
npm install                # Install dependencies
npm run dev               # Start dev server (localhost:5173)
npm run lint              # Run ESLint

# Production
npm run build             # Build for production (dist/)
npm run preview           # Preview production build

# Testing
npm run test              # Run tests (if configured)
```

### Server (Node.js + Express)
```bash
# Development
npm install               # Install dependencies
npm start                # Start server with nodemon (localhost:5000)

# Production
NODE_ENV=production npm start    # Start in production mode

# Database & Migrations
npm run jobs:cleanup:dry         # Dry-run job cleanup
npm run jobs:cleanup:apply       # Apply job cleanup
npm run workers:skills:migrate:dry   # Dry-run skill migration
npm run workers:skills:migrate:apply # Apply skill migration

# Testing
npm run test:chatbot-security    # Test chatbot security

# Semantic Matching
npm run semantic:run             # Start semantic service

# Smoke Tests
npm run smoke:commute            # Test commute flows
```

### Mobile (React Native + Expo)
```bash
# Development
npm install               # Install dependencies
npm start                # Start Expo dev server

# Platform-specific
npm run android          # Launch on Android emulator
npm run ios              # Launch on iOS simulator
npm run web              # Web preview

# Building
eas login                # Login to Expo
eas build --platform android    # Build APK
eas build --platform ios        # Build IPA
```

### Python Services
```bash
# Face Service (FastAPI)
cd face_service
python -m venv .venv
source .venv/bin/activate  # or .\.venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
python main.py             # Runs on port 8001

# Fraud Service (Flask)
cd fraud_service
python -m venv .venv
source .venv/bin/activate
pip install -r Requirements.txt
python app.py              # Runs on port 5001

# Semantic Matching
cd semantic_match_service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

---

## Key Technologies by Feature

| Feature | Frontend | Backend | Database | External | ML/AI |
|---------|----------|---------|----------|----------|-------|
| **Authentication** | React Router | JWT, bcryptjs | MongoDB | Twilio (SMS) | — |
| **Worker Profile** | React, Vite | Node.js | User Model | Cloudinary | InsightFace |
| **Job Posting** | React, Redux | Express | Job Model | — | — |
| **Job Matching** | Leaflet (maps) | Express | Job, Worker Models | — | Custom embeddings |
| **Direct Hire** | React | Express | Job, Transaction | Razorpay | — |
| **Payments** | React | Express, Razorpay SDK | Transaction | Razorpay API | — |
| **Location Tracking** | Leaflet, Socket.io | Socket.io, Express | Location Model | — | — |
| **Complaints** | React | Express | Complaint Models | — | — |
| **Community** | React | Express | Community Post | — | — |
| **Shop/Coupons** | React | Express | Shop, Coupon | — | — |
| **Fraud Detection** | Admin Dashboard | Flask API | MongoDB | — | XGBoost |
| **IVR** | — | Express, Twilio | IVR Session | Twilio Voice | — |
| **AI Assistant** | React | Express, Groq | AI History | Groq SDK | Mixtral/Llama 2 |
| **Notifications** | Toast, React | Nodemailer, Twilio | Notification | Email, SMS | — |
| **Admin Dashboard** | React | Express | Audit Logs | — | — |
| **Rating System** | React | Express | Rating Model | — | — |
| **Rate Management** | React | Express, Cron | Rate Models | — | Algorithm |
| **ID Card Generation** | html2canvas, jsPDF | QR Code lib | — | QR API | — |
| **Internationalization** | i18next | Google Translate | — | Google API | — |

---

## Project Statistics

### Code Organization
```
Total Controllers: 23
Total Routes: 24
Total Models: 27
Total Services/Utilities: Multiple
API Endpoints: 100+
```

### Technology Count
```
Frontend Libraries: 25+
Backend Packages: 20+
Python Libraries: 12+
Mobile Libraries: 15+
```

### Database Coverage
```
Collections: 27
Relationships: Complex (nested & referenced)
Indexes: Geospatial, text search, unique constraints
Scalability: MongoDB sharding ready
```

---

## Future Enhancement Opportunities

1. **Performance**
   - Redis caching for frequent queries
   - GraphQL API for flexible queries
   - Elasticsearch for advanced search

2. **ML Improvements**
   - Better fraud detection models
   - Personalized job recommendations
   - Predictive worker availability

3. **Features**
   - Video verification for workers
   - Video call support for job discussion
   - Advanced analytics dashboard
   - Worker training marketplace
   - Insurance integration

4. **Infrastructure**
   - Multi-region deployment
   - CDN for static assets
   - Database replication
   - Load balancing

5. **Security**
   - Hardware security key support
   - Biometric authentication
   - Advanced encryption
   - Penetration testing

---

## Study of AI and ML in Recruitment

The application of AI/ML to recruitment is well-established: NLP techniques (TF‑IDF vectorization and cosine similarity) and embedding-based methods convert unstructured skill and job descriptions into comparable vector representations for matching. In KarigarConnect we combine a classical TF‑IDF + cosine-similarity pipeline (implemented using `scikit-learn`) with a project-specific embeddings/matching layer implemented in the `semantic_match_service` (NumPy + Pandas based) to balance efficiency and semantic richness. The Node.js backend calls the semantic matching Python service to produce ranked suggestions; matching feedback is recorded (`jobMatchFeedbackModel.js`) to iteratively improve the model.

Anomaly detection and fraud scoring are validated research directions for marketplace security. Instead of solely relying on one-class detectors, KarigarConnect uses an ensemble/tree approach in the `fraud_service` (XGBoost with `scikit-learn` utilities) for high-signal transaction scoring, and employs SHAP (`shap`) for interpretable feature importance. Behavioural signals (application frequency, profile completion, rating volatility, geolocation anomalies, temporal transaction patterns) are extracted with Pandas/NumPy and fed to the XGBoost pipeline; the service runs in Flask with optional real-time updates via Flask-SocketIO.

For biometric identity verification, the project uses the InsightFace stack (RetinaFace for detection + ArcFace for embeddings) with ONNX Runtime and OpenCV in the `face_service` (FastAPI). This is the production-stack used for face matching and is more directly integrated into the worker verification workflow than generic research models (e.g., VGG‑Face). Model inference runs via ONNX Runtime for cross-platform performance; verification decisions and audit logs are stored in MongoDB.

Voice-interface accessibility findings motivate the IVR module; KarigarConnect implements IVR using Twilio Programmable Voice APIs and DTMF handling to extend access to low-literacy or feature-phone users. IVR sessions are logged (IVR session model) and integrated with the Node.js API to allow job browsing and application actions over voice.

Together, these choices reflect both academic best-practices and the project's concrete technology stack: `scikit-learn`, `XGBoost`, `shap`, `Pandas`, `NumPy`, `InsightFace` + `onnxruntime` + `OpenCV`, and `Twilio` — orchestrated via Python microservices (FastAPI, Flask) and the Node.js/Express core API to deliver scalable, interpretable, and accessible recruitment functionality.

## Support & Documentation

**Frontend Issues**: Check React/Vite docs, Tailwind CSS
**Backend Issues**: Check Express/MongoDB docs, Mongoose guides
**Deployment**: Vercel docs, Render docs
**APIs**: Read controller files for logic, routes for structure
**Database**: Check model definitions for schema

---

**Last Updated**: April 2026
**Version**: 1.0.0
**Status**: Production Ready
