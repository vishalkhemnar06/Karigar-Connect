# Shop Registration Implementation Analysis

## 1. FILE LOCATIONS

### Client-Side
- **Registration Form**: `client/src/pages/shop/ShopRegister.jsx`
- **Shop Authentication API**: `client/src/api/index.js`
- **Admin Shop Management**: `client/src/pages/admin/AdminShops.jsx`
- **Worker Shop Browsing**: `client/src/pages/worker/WorkerShops.jsx`
- **Shop Dashboard**: `client/src/pages/shop/ShopDashboard.jsx`
- **Shop Login**: `client/src/pages/shop/ShopLogin.jsx`

### Server-Side
- **Shop Model/Schema**: `server/models/shopModel.js`
- **Shop Auth Controller**: `server/controllers/shopAuthController.js`
- **Shop Controller**: `server/controllers/shopController.js`
- **Admin Shop Controller**: `server/controllers/adminShopController.js`
- **Shop Routes**: `server/routes/shopRoutes.js`
- **Admin Shop Routes**: `server/routes/adminShopRoutes.js`
- **Upload Directory**: `server/uploads/` (auto-created, files served statically)

---

## 2. SHOP SCHEMA FIELDS

### File: `server/models/shopModel.js`

```javascript
{
  // Owner Info
  ownerName:   String (required, trimmed)
  ownerPhoto:  String (file path to uploads/)
  mobile:      String (required, unique)
  email:       String (required, unique, lowercase)
  password:    String (required, bcrypt hashed, select: false)

  // Shop Info
  shopName:    String (required, trimmed)
  shopLogo:    String (file path to uploads/)
  gstNumber:   String (optional, defaults to null)
  category:    String (required) - predefined categories or custom

  // Address
  address:     String (required)
  city:        String (required)
  pincode:     String (optional)
  locality:    String (optional)

  // Verification Documents
  idProof: {
    idType:    String (e.g., 'Aadhar Card', 'PAN Card', 'Voter ID', 'Driving Licence', 'Passport')
    filePath:  String (path to uploads/)
  }

  // Status & Verification
  verificationStatus: String (enum: 'pending', 'approved', 'rejected', 'blocked', default: 'pending')
  rejectionReason:   String (null by default)
  approvedAt:        Date
  rejectedAt:        Date

  // Email/Mobile OTP Verification
  mobileVerified:    Boolean (default: false)
  emailVerified:     Boolean (default: false)
  mobileOtp:         String (select: false) - hashed OTP
  mobileOtpExpiry:   Date (select: false) - 10 minutes
  emailOtp:          String (select: false) - hashed OTP
  emailOtpExpiry:    Date (select: false) - 10 minutes

  // Analytics
  totalSales:        Number (default: 0)
  totalDiscounts:    Number (default: 0)
  totalWorkers:      Number (default: 0)

  // Timestamps
  createdAt:         Date (auto)
  updatedAt:         Date (auto)
}
```

### Shop Categories (Predefined)
```javascript
[
  'Electronics & Tools',
  'Plumbing Supplies',
  'Electrical Supplies',
  'Carpentry & Woodwork',
  'Painting Supplies',
  'Welding & Fabrication',
  'Masonry & Construction',
  'Automobile Parts',
  'Gardening & Landscaping',
  'Safety Equipment',
  'Other' // allows custom category input
]
```

---

## 3. SHOP REGISTRATION FORM STRUCTURE

### File: `client/src/pages/shop/ShopRegister.jsx`

#### 3-Step Registration Process

**STEP 1: Contact Verification**
- Mobile number (10 digits required)
  - Send OTP button → SMS via Twilio
  - Enter & verify OTP
- Email address
  - Send OTP button → Email via Nodemailer
  - Enter & verify OTP
- Password (6+ characters minimum)
- Confirm Password
- Both mobile & email must be verified to proceed

**STEP 2: Shop & Owner Details**
- Owner Name
- Shop Name
- GST Number (optional)
- Shop Category (dropdown + custom input if "Other" selected)
- Address (full address required)
- City
- Pincode
- Locality (optional)

**STEP 3: Documents Upload**
- Owner Photo (image preview shown)
- ID Proof Document
  - ID Type dropdown: Aadhar Card, PAN Card, Voter ID, Driving Licence, Passport
  - Document upload
- Shop Logo (image preview shown)

#### Form Components
- **Field**: Label, hint, error display wrapper
- **Input**: Text input with customizable prefix, error states
- **Select**: Dropdown for categories, ID types
- **FileField**: Drag-drop style file upload with preview
- **OtpRow**: Mobile/Email with OTP send/verify buttons
- **StepDot**: Step indicator (1, 2, 3 with checkmarks)

#### State Management
```javascript
// Contact Verification
mobile, mobileOtp, mobileOtpSent, mobileVerified
email, emailOtp, emailOtpSent, emailVerified
password, confirmPwd, showPwd

// Shop Details
ownerName, shopName, gstNumber, category, customCategory
address, city, pincode, locality

// Documents
idType, ownerPhoto, idProof, shopLogo
ownerPhotoPreview, shopLogoPreview
```

---

## 4. FILE UPLOAD & STORAGE HANDLING

### Server-Side Configuration
**File: `server/routes/shopRoutes.js`**

```javascript
// Multer Configuration
- Storage: server/uploads/ directory (auto-created)
- Field naming:
  • ownerPhoto (max 1)
  • idProof (max 1)
  • shopLogo (max 1)
  
- Allowed formats: jpeg, jpg, png, webp, pdf
- Max file size: 5 MB

- Filename pattern: {timestamp}-{sanitized_original_name}
  Example: 1711270400000-aadhar_card.pdf

// File Path Normalization (normPath function)
// Problem: Windows paths use backslashes → cross-platform compatibility
// Solution: 
//   Input:  "C:\project\server\uploads\1234-photo.jpg"
//   Output: "uploads/1234-photo.jpg"
//   Served at: GET /uploads/1234-photo.jpg
```

### Express Static Middleware
Files are served publicly via:
```
GET /uploads/{filename}
```

### Path Normalization Function
```javascript
const normPath = (filePath) => {
    if (!filePath) return null;
    const normalised = filePath.replace(/\\/g, '/');
    const idx = normalised.indexOf('uploads/');
    if (idx !== -1) return normalised.slice(idx);
    return `uploads/${path.basename(normalised)}`;
};
```

### Storage in Database
All file paths stored as:
- Format: `uploads/filename` (relative, forward slashes)
- Fields: `ownerPhoto`, `shopLogo`, `idProof.filePath`
- Example: `uploads/1711270400000-aadhar_card.pdf`

---

## 5. REGISTRATION FLOW (Backend)

### API Endpoints

#### Step 1: Send Mobile OTP
```
POST /api/shops/auth/send-mobile-otp
Body: { mobile }
Response: { message: 'OTP sent to mobile.' }
```

#### Step 2: Verify Mobile OTP
```
POST /api/shops/auth/verify-mobile-otp
Body: { mobile, otp }
Response: { message: 'Mobile verified.' }
```

#### Step 3: Send Email OTP
```
POST /api/shops/auth/send-email-otp
Body: { email, mobile }
Response: { message: 'OTP sent to email.' }
```

#### Step 4: Verify Email OTP
```
POST /api/shops/auth/verify-email-otp
Body: { mobile, otp }
Response: { message: 'Email verified.' }
```

#### Step 5: Complete Registration
```
POST /api/shops/auth/register
Headers: Content-Type: multipart/form-data
Form Fields:
  - ownerName, mobile, email, password
  - shopName, gstNumber, category
  - address, city, pincode, locality, idType
  - ownerPhoto (file)
  - idProof (file)
  - shopLogo (file)

Response: 
{
  message: 'Registration submitted. We will contact you within 24 hours.',
  status: 'pending'
}
```

### Backend Logic (shopAuthController.js)

```javascript
// Path Normalization
- All multer file paths normalized before DB save
- Cross-platform compatibility ensured

// OTP Verification
- SHA256 hash used for OTP storage (not plain text)
- 10-minute expiry
- Allows retry on verification failure

// Password Handling
- Bcrypt salt (10 rounds)
- Auto-hashed on model.save()

// Shop Status
- Created as 'pending' by default
- Admin approval required before login possible
- Rejection → SMS notification + permanent delete
- Approved → SMS notification + access granted
```

---

## 6. ADMIN SHOP MANAGEMENT VIEW

### File: `client/src/pages/admin/AdminShops.jsx`

#### Admin Features
1. **View All Shops**
   - List of pending, approved, rejected, blocked shops
   - Status badges with color coding
   - Sorting by date, status, name

2. **Filter Options**
   - By status (pending, approved, rejected, blocked)
   - By category
   - By city
   - Search by name/email/mobile

3. **Shop Detail Modal** - Shows:
   - Owner info (name, photo, mobile, email)
   - Shop info (name, logo, GST, category)
   - Address details (address, city, pincode, locality)
   - ID Proof (type + document)
   - Verification status & timestamps
   - Registration date

4. **Image Viewer**
   - Full-screen modal for shop logo, owner photo, ID proof
   - Zoom in/out functionality
   - Keyboard navigation (arrows, escape)
   - Multiple images carousel

5. **Admin Actions**
   - **Approve**: Status → approved, SMS sent to shop owner, can now login
   - **Reject**: Delete permanently, SMS with rejection reason
   - **Block**: Status → blocked, SMS sent (temporary block)
   - **Delete**: Permanently remove from system
   - **Bulk Actions**: Approve or delete multiple shops at once

6. **Export**
   - Export shop list to CSV

7. **Analytics Dashboard**
   - Total shops count
   - Shops by status
   - Shops by category
   - Recent registrations

### Admin Routes
```
GET  /api/admin/shops              - Get all shops
GET  /api/admin/shops/:id          - Get shop by ID
PATCH /api/admin/shops/:id/approve - Approve shop
PATCH /api/admin/shops/:id/reject  - Reject shop
PATCH /api/admin/shops/:id/block   - Block shop
DELETE /api/admin/shops/:id        - Delete shop
```

### Admin Shop Controller (adminShopController.js)
```javascript
exports.getAllShops(req, res)      // Returns all shops sorted by date
exports.getShopById(req, res)      // Get single shop details
exports.approveShop(req, res)      // Approve + send SMS
exports.rejectShop(req, res)       // Reject + delete + send SMS
exports.blockShop(req, res)        // Block shop
exports.deleteShop(req, res)       // Permanently delete
```

---

## 7. WORKER SHOP BROWSING VIEW

### File: `client/src/pages/worker/WorkerShops.jsx`

#### Worker Features
1. **List Approved Shops**
   - Shows only `verificationStatus: 'approved'` shops
   - Shop logo, name, category displayed
   - Shop location (address, city)
   - Owner contact info (mobile, email)

2. **Search & Filter**
   - Search by shop name, category, city
   - Filter by category
   - Filter by city/location
   - Sort options

3. **Shop Details Card**
   - Logo (clickable for full-screen view)
   - Shop name & owner name
   - Category & GST number (if available)
   - Address info (full address, locality, pincode)
   - Contact buttons (call, message, email)
   - Ratings/reviews (if implemented)

4. **Products Browsing**
   - View shop products
   - Filter by price range
   - Add to cart/wishlist

5. **Coupon Discovery**
   - View available coupons from each shop
   - Discount percentage
   - Expiry date
   - Claim coupon action

6. **Image Viewer**
   - Full-screen shop logo/documents
   - Zoom in/out
   - Navigation arrows

#### Worker Routes
```
GET /api/shops/public/all              - Get all approved shops (public)
GET /api/shops/public/:shopId/products - Get shop products
```

---

## 8. SHOP AUTHENTICATION & LOGIN

### Shop Login Flow
**File: `server/controllers/shopAuthController.js`**

```
POST /api/shops/auth/login
Body: { mobile, password }

Validation:
1. Check shop exists
2. Check verificationStatus === 'approved'
   - If 'pending': "Your shop is under review..."
   - If 'blocked': "Your shop has been blocked..."
   - If 'rejected': "Shop not approved"
3. Verify password (bcrypt compare)
4. Return JWT token + shop data

JWT Token: { id, role: 'shop' }, expires in 7 days
```

### Shop Protected Routes
Uses middleware: `shopAuthMiddleware.js`
- Token extraction from header
- JWT verification
- Shop ID attached to request
- All shop endpoints require authentication

---

## 9. SHOP-SPECIFIC ENDPOINTS (authenticated)

### Profile Management
```
GET  /api/shops/profile                    - Get shop profile
PUT  /api/shops/profile                    - Update profile (with shopLogo, ownerPhoto)
```

### Product Management
```
GET    /api/shops/products                 - List products
POST   /api/shops/products                 - Add product (with image)
PUT    /api/shops/products/:id             - Edit product (with optional image)
DELETE /api/shops/products/:id             - Delete product
```

### Coupon Verification
```
POST /api/shops/coupons/verify             - Verify coupon code
POST /api/shops/coupons/apply              - Apply coupon for transaction
```

### Transactions
```
GET /api/shops/transactions                - View transaction history
```

### Analytics
```
GET /api/shops/analytics                   - Shop analytics dashboard
```

---

## 10. CURRENT UPLOAD DOCUMENT STRUCTURE

### Stored in Shop Document
```javascript
{
  ownerPhoto: "uploads/1711270400000-owner_photo.jpg"
  
  shopLogo: "uploads/1711270400001-shop_logo.png"
  
  idProof: {
    idType: "Aadhar Card",                    // Selected from dropdown
    filePath: "uploads/1711270400002-idcard.pdf"
  }
}
```

### Additional Uploads (Products)
```javascript
// Product model
{
  shop: ObjectId,
  name: String,
  description: String,
  price: Number,
  stock: Number,
  image: "uploads/1711270400003-product.jpg"
}
```

### File Access
Frontend utility: `client/src/utils/imageUrl.js`
```javascript
getImageUrl(path) 
// Converts: "uploads/filename" 
// To: "http://localhost:5000/uploads/filename"
```

---

## 11. VALIDATION & ERROR HANDLING

### Frontend Validation (ShopRegister.jsx)
- Mobile: 10 digits required
- Email: Valid email format
- Password: Minimum 6 characters
- Passwords must match
- All required fields must be filled
- Category selection required
- OTP: 6 digits
- Files: Size < 5MB, format: jpeg/jpg/png/webp/pdf

### Backend Validation (shopAuthController.js)
- Mobile/Email uniqueness check
- OTP expiry validation
- Password hashing
- File path normalization
- Database constraints (unique indices on mobile/email)

### Error Responses
```javascript
{
  message: "Error description",
  status: 400/401/403/404/500
}
```

---

## 12. STATUS FLOW DIAGRAM

```
Registration Form
        ↓
    Step 1: Mobile OTP Verification ← SMS via Twilio
    Step 2: Email OTP Verification ← Email via Nodemailer
    Step 3: Shop & Owner Details + Documents Upload
        ↓
POST /api/shops/auth/register
        ↓
Created with Status: 'pending'
        ↓
    [ADMIN REVIEWS]
    ├─ APPROVE → Status: 'approved' → SMS ✅ Can Login
    ├─ REJECT → Deleted from DB → SMS ❌ Retry registration
    └─ BLOCK → Status: 'blocked' → SMS ⛔ Can't Login
```

---

## 13. KEY TECHNICAL NOTES

### File Path Normalization
- **Problem**: Windows backslashes break in URLs
- **Solution**: Convert all paths to `uploads/filename` format
- **Applied to**: ownerPhoto, shopLogo, idProof.filePath, product images

### OTP Security
- Hashed with SHA256 before storage
- 10-minute expiry
- Not returned to frontend (only verification response)

### Password Security
- Bcrypt hashing (salt rounds: 10)
- Not selected by default in queries (select: false)
- Only fetched when needed (login)
- Never sent to frontend after registration

### File Upload Security
- File type whitelist: jpeg, jpg, png, webp, pdf
- Max 5MB per file
- Sanitized filenames (spaces → underscores)
- UUID-like naming with timestamp

### API Authentication
- JWT tokens for shop-specific routes
- Token expires in 7 days
- Role-based access control (admin/shop/worker)

---

## 14. FUTURE ENHANCEMENT OPPORTUNITIES

1. **Additional Document Storage**
   - Business license
   - Tax certificate
   - Business registration

2. **Rejection Workflow**
   - Currently permanent delete
   - Could store as 'rejected' with retry option

3. **Location-Based Features**
   - Reverse geocoding (coordinates → address)
   - Distance-based shop discovery for workers

4. **Advanced Verification**
   - Liveness detection for owner photo
   - ID document OCR verification
   - Background checks

5. **Shop Analytics**
   - Product views
   - Click-through rates
   - Worker conversions

6. **Batch Operations**
   - Import shops from CSV
   - Bulk verification

