# Shop Display Components Analysis

## 📋 Overview
This document analyzes the current shop information display implementation across admin and worker interfaces, identifying all components, their structure, and current fields displayed.

---

## 1. ADMIN SHOP DISPLAY - AdminShops.jsx

**File:** [client/src/pages/admin/AdminShops.jsx](client/src/pages/admin/AdminShops.jsx)

### Component Structure

#### A. Main Page Component: `AdminShops`
- **Tabs:** Shops | Coupons | History
- **Views:** Grid view and List view
- **Filtering:** By status (pending, approved, blocked, all)
- **Sorting:** By createdAt, shopName, ownerName, city
- **Search:** Across shopName, ownerName, mobile, city, category
- **Bulk Actions:** Approve multiple shops, delete multiple shops

#### B. Shop Card Component (Grid/List Display)
Basic shop information displayed on list/grid cards:
- Shop Logo
- Shop Name
- Owner Name
- City
- Category
- Registration Status Badge

#### C. Shop Detail Modal: `ShopDetailModal`
**Triggered by:** Clicking on a shop card
**Layout:** Tabbed modal with 3 tabs

##### **Tab 1: Information**
Shows in two sections:

**Owner & Contact Section:**
- Owner Name (field: `ownerName`)
- Mobile (field: `mobile`)
- Email (field: `email`)
- GST No. (field: `gstNumber`)

**Shop Details Section:**
- Shop Name (field: `shopName`)
- Category (field: `category`)
- Address (field: `address`)
- City (field: `city`)
- Pincode (field: `pincode`)
- Locality (field: `locality`)
- Registered Date (field: `createdAt`)

##### **Tab 2: Documents**
Displays upload documents:
- Shop Logo (field: `shopLogo`) - Image with viewer
- Owner Photo (field: `ownerPhoto`) - Image with viewer
- ID Proof (field: `idProof.filePath` or `idProof`) - PDF or image with viewer
  - Shows ID Type (field: `idProof.idType`)

##### **Tab 3: Statistics**
Performance metrics:
- Rating (field: `rating`)
- Total Coupons (field: `couponsCount`)
- Used Coupons (field: `usedCouponsCount`)
- Total Sales (field: `totalSales`)

### Current Fields Displayed (Admin View)

```
Display Fields:
✓ ownerName
✓ mobile
✓ email
✓ gstNumber (optional, displays "Not Provided" if null)
✓ shopName
✓ category
✓ address
✓ city
✓ pincode
✓ locality
✓ createdAt (formatted date)
✓ shopLogo (image)
✓ ownerPhoto (image)
✓ idProof (ID document)
✓ idProof.idType (ID type label)
✓ verificationStatus (status badge)
✓ rating
✓ couponsCount
✓ usedCouponsCount
✓ totalSales

NOT Currently Displayed:
✗ shopPhoto (captured during registration - not shown in admin view)
✗ gstnCertificate (GSTN certificate document - not shown in admin view)
✗ shopLocation (GPS coordinates - not shown in admin view)
```

### Actions Available (Admin View)
- **For Pending Shops:** Approve | Reject
- **For Approved Shops:** Block
- **For Blocked Shops:** Unblock
- **All Shops:** Delete

---

## 2. WORKER SHOP DISPLAY - WorkerShops.jsx

**File:** [client/src/pages/worker/WorkerShops.jsx](client/src/pages/worker/WorkerShops.jsx)

### Component Structure

#### A. Main Page Component: `WorkerShops`
- **Tabs:** Shops | My Coupons
- **Search:** By shopName, category, city
- **Filtering:** By category
- **Coupon Generation:** Generate coupon for applicable worker

#### B. Shop Card Component (Grid Display)
List of approved shops with basic info:
- Shop Logo
- Shop Name
- Owner Name
- City
- Category

#### C. Shop Detail Modal: `ShopDetailModal`
**Triggered by:** Clicking on a shop card
**Layout:** Tabbed modal with 2 tabs (mobile-optimized)

##### **Tab 1: Products**
- Product images with zoom capability
- Product name
- Product description
- Product price
- Discount calculation (based on worker's coupon discount %)
- Stock information
- Applies discount badge for products ≥ ₹1000

##### **Tab 2: Shop Info**
Shows in three sections:

**Contact Information Section:**
- Mobile (field: `mobile`)
- Email (field: `email`)

**Business Details Section:**
- Category (field: `category`)
- GST Number (field: `gstNumber`) - if available
- Member Since (field: `createdAt`)
- Verification Status (field: `verificationStatus`)

**Address Section:**
- Full address (field: `address`)
- City (field: `city`)
- State (field: `state`, defaults to "Maharashtra")
- Pincode (field: `pincode`)

**About Shop Section (if exists):**
- About text (field: `about`)

### Current Fields Displayed (Worker View)

```
Display Fields:
✓ mobile
✓ email
✓ category
✓ gstNumber (if available)
✓ createdAt (formatted as "Member since Month Year")
✓ verificationStatus (as badge "Verified Shop")
✓ address
✓ city
✓ state (default: "Maharashtra")
✓ pincode
✓ about (if exists)
✓ shopLogo (thumbnail in grid and modal header)

NOT Currently Displayed:
✗ shopPhoto (captured during registration - not shown to workers)
✗ gstnCertificate (GSTN document - not shown to workers)
✗ shopLocation (GPS coordinates - not shown to workers)
✗ locality (sub-area details)
✗ ownerPhoto
✗ ownerName
✗ idProof
✗ Shop rating
✗ Shop statistics
```

---

## 3. DATABASE MODEL - shopModel.js

**File:** [server/models/shopModel.js](server/models/shopModel.js)

### All Available Fields in Database

```javascript
// Owner Information
ownerName         String (required)
ownerPhoto        String
mobile            String (required, unique)
email             String (required, unique)
password          String (required)

// Shop Information
shopName          String (required)
shopLogo          String
shopPhoto         String                    // ← NEW: Live shop photo from registration
gstNumber         String (optional)
gstnCertificate   String                    // ← NEW: GSTN certificate document
category          String (required)

// Location Information (GPS)
shopLocation: {
  latitude        Number                    // ← NEW: GPS latitude
  longitude       Number                    // ← NEW: GPS longitude
  address         String
}

// Address Information
address           String (required)
city              String (required)
pincode           String
locality          String                    // ← Sub-area or village

// Verification Documents
idProof: {
  idType          String
  filePath        String
}

// Status & Verification
verificationStatus Enum: ['pending', 'approved', 'rejected', 'blocked']
rejectionReason   String
approvedAt        Date
rejectedAt        Date
mobileVerified    Boolean
emailVerified     Boolean

// Analytics
totalSales        Number (default: 0)
totalDiscounts    Number (default: 0)
totalWorkers      Number (default: 0)
```

---

## 4. COMPARISON TABLE

| Field | Admin View | Worker View | Database | Notes |
|-------|-----------|------------|----------|-------|
| ownerName | ✓ | ✗ | ✓ | Shown in admin section only |
| ownerPhoto | ✓ | ✗ | ✓ | Shown in documents tab (admin only) |
| mobile | ✓ | ✓ | ✓ | Both views show contact |
| email | ✓ | ✓ | ✓ | Both views show contact |
| shopName | ✓ | ✓ | ✓ | Grid cards + modal header |
| shopLogo | ✓ | ✓ | ✓ | Displayed in both views |
| shopPhoto | ✗ | ✗ | ✓ | **NOT DISPLAYED** (from registration) |
| gstNumber | ✓ | ✓ | ✓ | Shown with label "GST No." |
| gstnCertificate | ✗ | ✗ | ✓ | **NOT DISPLAYED** (from registration) |
| category | ✓ | ✓ | ✓ | Shown in both views |
| address | ✓ | ✓ | ✓ | Full address displayed |
| city | ✓ | ✓ | ✓ | Shown in both views |
| pincode | ✓ | ✓ | ✓ | Part of address |
| locality | ✓ | ✗ | ✓ | Admin only - "Locality" field |
| shopLocation.latitude | ✗ | ✗ | ✓ | **NOT DISPLAYED** (GPS coordinates) |
| shopLocation.longitude | ✗ | ✗ | ✓ | **NOT DISPLAYED** (GPS coordinates) |
| createdAt | ✓ (date) | ✓ (formatted) | ✓ | Registration date |
| verificationStatus | ✓ (badge) | ✓ (badge) | ✓ | Status indicator |
| idProof | ✓ | ✗ | ✓ | Admin documents tab only |
| rating | ✓ | ✗ | ✓ | Admin statistics tab only |
| totalSales | ✓ | ✗ | ✓ | Admin statistics tab only |

---

## 5. MISSING UI ELEMENTS

### New Fields from Registration Enhancement (NOT YET DISPLAYED)

1. **shopPhoto** (captured during registration)
   - Available in database
   - Not shown in admin view
   - Not shown in worker view
   - **Recommendation:** Add to admin Documents tab

2. **gstnCertificate** (GSTN document uploaded during registration)
   - Available in database
   - Not shown in admin view
   - Not shown in worker view
   - **Recommendation:** Add to admin Documents tab

3. **shopLocation (GPS coordinates)**
   - Available in database
   - latitude & longitude captured
   - Not shown in any view
   - **Recommendation:** 
     - Show in admin Info tab with map viewer
     - Optional: Show in worker view if shop locator feature added

---

## 6. IMPLEMENTATION CHECKLIST

### To Display shopPhoto in Admin View

**Location:** Admin Detail Modal → Documents Tab

**Changes Needed:**
- [ ] Import `shopPhoto` field from shop object
- [ ] Add photo display section in Documents tab (similar to ownerPhoto display)
- [ ] Include in image viewer gallery
- [ ] Show label "Shop Photo" with timestamp if available

### To Display gstnCertificate in Admin View

**Location:** Admin Detail Modal → Documents Tab

**Changes Needed:**
- [ ] Import `gstnCertificate` field from shop object
- [ ] Add certificate display section in Documents tab
- [ ] Use DocViewer component (same as ID Proof)
- [ ] Handle both PDF and image formats
- [ ] Show label "GSTN Certificate"

### To Display shopLocation (GPS) in Admin View

**Location:** Admin Detail Modal → Information Tab (new map section)

**Changes Needed:**
- [ ] Extract latitude and longitude from `shopLocation`
- [ ] Add map visualization component (Leaflet or similar)
- [ ] Display coordinates in information grid
- [ ] Optional: Show accuracy/timestamp
- [ ] Consider reverse geocoding for address verification

---

## 7. FILE PATH SUMMARY

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Admin Shop List & Details | `client/src/pages/admin/AdminShops.jsx` | Shop verification, approval, statistics |
| Worker Shop Browse | `client/src/pages/worker/WorkerShops.jsx` | Browse approved shops, view products, use coupons |
| Shop Database Model | `server/models/shopModel.js` | Schema definition with all fields |
| Shop Auth Routes | `server/routes/shopRoutes.js` | API routes including shop registration with file uploads |
| Shop Auth Controller | `server/controllers/shopAuthController.js` | Registration logic, file handling |

---

## 8. KEY OBSERVATIONS

1. **Admin and Worker views serve different purposes:**
   - Admin: Verification, approval, fraud detection, statistics
   - Worker: Browse shops, products, coupon usage

2. **New registration fields (shopPhoto, gstnCertificate, shopLocation) are stored but not utilized in UI**
   - Database layer ready
   - Backend accepting files
   - Frontend needs new display components

3. **Mobile optimization present in Worker view but not Admin view**
   - Worker components have responsive design
   - Admin components are more desktop-focused

4. **GPS Location data is captured but unused**
   - Could enable shop location features
   - Could implement distance-based shop discovery

5. **File path normalization is implemented**
   - Windows paths converted to web-safe paths
   - Files served from `/uploads/` endpoint
