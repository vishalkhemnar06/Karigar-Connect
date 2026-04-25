import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronDown, ChevronUp,
  Database, Eye, Share2, Lock, UserCheck,
  Fingerprint, MapPin, Bell, Trash2, Phone, Shield, Scale
} from "lucide-react";
import Header from "./Header";

const DATA_TABLE = [
  { category: "Identity Data", examples: "Name, date of birth, gender, Aadhaar/PAN/Voter ID number, photo", purpose: "Account creation, identity verification, fraud prevention", retention: "Duration of account + 7 years post-deletion (legal obligation)" },
  { category: "Contact Data", examples: "Mobile number, email address, postal address", purpose: "Account management, job notifications, support, OTP delivery", retention: "Duration of account + 2 years" },
  { category: "Biometric Data", examples: "Facial landmarks captured during liveness check (MediaPipe Face Mesh)", purpose: "Worker identity verification against government ID", retention: "Raw facial scan: deleted within 24 hours of verification. Result (pass/fail) retained for account lifecycle." },
  { category: "Location Data", examples: "GPS coordinates during active job, city/locality at account setup", purpose: "Job matching, live worker tracking during active jobs, service area display", retention: "Real-time tracking: not stored. Approximate location for matching: duration of account." },
  { category: "Job & Transaction Data", examples: "Job descriptions, posted photos, hire/completion records, payment history", purpose: "Service delivery, dispute resolution, pricing analytics, platform improvement", retention: "7 years from transaction date (GST compliance)" },
  { category: "Device & Usage Data", examples: "IP address, browser/OS type, pages visited, session duration, click patterns", purpose: "Platform security, fraud detection, performance optimization, analytics", retention: "Rolling 90 days" },
  { category: "AI Advisor Data", examples: "Work descriptions, Q&A responses, uploaded work-site photos submitted to the AI advisor", purpose: "Generating cost estimates; improving AI model accuracy (with consent only)", retention: "90 days unless you save the analysis to history, in which case until you delete it." },
  { category: "Communications", examples: "In-app messages between Client and Worker, support tickets", purpose: "Service delivery, complaint resolution, safety investigation", retention: "2 years from last message" },
  { category: "Ratings & Reviews", examples: "Star ratings, text reviews submitted after a completed job", purpose: "Worker quality display, platform trust", retention: "Duration of the reviewed party's account" },
];

const RIGHTS_TABLE = [
  { right: "Right to Access", description: "Request a copy of all personal data we hold about you.", how: "Email kc.india@gmail.com with subject 'Data Access Request'. We will respond within 30 days." },
  { right: "Right to Correction", description: "Request correction of inaccurate or incomplete personal data.", how: "Most data can be updated directly in your profile. For ID-linked data, email us." },
  { right: "Right to Erasure", description: "Request deletion of your account and associated personal data.", how: "Use Settings → Delete Account, or email us. Some data may be retained for legal compliance." },
  { right: "Right to Data Portability", description: "Receive your personal data in a structured, machine-readable format.", how: "Email us. We will provide a JSON/CSV export within 30 days." },
  { right: "Right to Withdraw Consent", description: "Withdraw consent for face verification, marketing, or AI model training.", how: "Toggle consent settings in the app or contact the Grievance Officer." },
  { right: "Right to Nominate", description: "Nominate a trusted person to exercise your data rights in the event of your death or incapacity (DPDPA 2023).", how: "Contact the Grievance Officer in writing with supporting documents." },
  { right: "Right to Grievance", description: "File a complaint with KarigarConnect's Grievance Officer or the Data Protection Board of India.", how: "See Section 9 below for Grievance Officer contact details." },
];

const SECTIONS = [
  {
    id: "who-we-are",
    icon: <Shield size={20} className="text-orange-500" />,
    title: "1. Who We Are & Scope of This Policy",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>Data Fiduciary:</strong> KarigarConnect ("Company", "we", "us") operates a technology marketplace connecting clients with skilled workers across India. Our registered address is Manjari Budruk, Hadapsar Road, Wagholi, Pune, Maharashtra 412307, India.</p>
        <p>This Privacy Policy applies to all individuals who register, browse, or transact on the KarigarConnect website, mobile application (iOS and Android), and all related services (collectively, the "Platform").</p>
        <p>This Policy explains what personal data we collect, why we collect it, how we use and protect it, with whom we share it, how long we keep it, and what rights you have under Indian law — specifically the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong> ("SPDI Rules"), the <strong>Information Technology Act, 2000</strong>, and the <strong>Digital Personal Data Protection Act, 2023</strong> ("DPDPA") to the extent applicable.</p>
        <p>If you are a Worker, additional data processing disclosures made during your onboarding also form part of this Policy.</p>
      </div>
    ),
  },
  {
    id: "data-collected",
    icon: <Database size={20} className="text-orange-500" />,
    title: "2. What Data We Collect & Why",
    content: (
      <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
        <p>The table below sets out each category of personal data we collect, why we collect it, and how long we retain it.</p>
        <div className="overflow-x-auto rounded-xl border border-orange-100">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-orange-50">
                <th className="p-3 text-left font-semibold text-gray-800 border-b border-orange-100 w-1/5">Data Category</th>
                <th className="p-3 text-left font-semibold text-gray-800 border-b border-orange-100 w-2/5">Examples</th>
                <th className="p-3 text-left font-semibold text-gray-800 border-b border-orange-100 w-1/5">Purpose</th>
                <th className="p-3 text-left font-semibold text-gray-800 border-b border-orange-100 w-1/5">Retention</th>
              </tr>
            </thead>
            <tbody>
              {DATA_TABLE.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-orange-50/30"}>
                  <td className="p-3 font-semibold text-gray-900 border-b border-orange-100 align-top">{row.category}</td>
                  <td className="p-3 text-gray-600 border-b border-orange-100 align-top">{row.examples}</td>
                  <td className="p-3 text-gray-600 border-b border-orange-100 align-top">{row.purpose}</td>
                  <td className="p-3 text-gray-600 border-b border-orange-100 align-top">{row.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>We collect personal data directly from you (registration, job postings, messages), automatically through your use of the platform (device logs, location), and from third parties (payment processors, verification agencies).</p>
        <p>We only collect what is necessary. Where a field is optional, this is clearly indicated in the app.</p>
      </div>
    ),
  },
  {
    id: "biometric",
    icon: <Fingerprint size={20} className="text-orange-500" />,
    title: "3. Biometric & Face Verification Data",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>We use face verification technology powered by <strong>MediaPipe Face Mesh</strong> to verify Worker identity against their uploaded government-issued photo ID. Biometric data is classified as <strong>Sensitive Personal Data or Information</strong> under India's SPDI Rules, 2011, and is handled with the highest level of care.</p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-gray-900 text-sm">What we do:</p>
          <ul className="list-disc ml-4 space-y-1 text-sm">
            <li>Capture facial landmarks via a live camera session on the worker's device.</li>
            <li>Compare those landmarks against the ID document photo for a match.</li>
            <li>Store only the verification <em>result</em> (pass/fail + confidence score).</li>
            <li>Delete the raw facial scan data within <strong>24 hours</strong> of verification completion.</li>
          </ul>
          <p className="font-semibold text-gray-900 text-sm mt-3">What we do NOT do:</p>
          <ul className="list-disc ml-4 space-y-1 text-sm">
            <li>Store permanent facial templates in our database.</li>
            <li>Share biometric data with any third party except verification technology providers bound by confidentiality obligations.</li>
            <li>Use facial data for advertising, profiling, or surveillance.</li>
            <li>Re-use your biometric data for any purpose other than the identity check you consented to.</li>
          </ul>
        </div>
        <p>Your explicit consent is obtained before any biometric data is collected, via an in-app consent screen. You may withdraw this consent at any time by contacting our Grievance Officer, though withdrawal may affect your ability to maintain a verified Worker profile.</p>
      </div>
    ),
  },
  {
    id: "location",
    icon: <MapPin size={20} className="text-orange-500" />,
    title: "4. Location Data & Live Tracking",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>Location data is used for two distinct purposes on the platform:</p>
        <p><strong>4.1 Job Matching (Approximate Location).</strong> Your city and locality are used to match you with nearby jobs or workers. This information is entered by you during registration and can be updated at any time.</p>
        <p><strong>4.2 Live Job Tracking (Precise GPS).</strong> When a Worker is on their way to or at an active job, the Client has the option to enable live GPS tracking of the Worker's device, and the Worker may enable location sharing from their side. This is a voluntary, opt-in feature.</p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1.5 text-sm">
          <p>✔ Live GPS coordinates are <strong>never stored</strong> to our servers. They are transmitted peer-to-peer via an ephemeral real-time session.</p>
          <p>✔ Location sharing is <strong>automatically turned off</strong> when the job is marked as completed or if the Worker disables it.</p>
          <p>✔ Workers can turn off location sharing at any time from the app without penalty.</p>
          <p>✔ Location data is <strong>never shared with advertisers</strong> or third-party marketing platforms.</p>
        </div>
        <p>If you deny location permissions on your device, approximate location features will not function. You can manage location permissions through your device settings at any time.</p>
      </div>
    ),
  },
  {
    id: "how-we-use",
    icon: <Eye size={20} className="text-orange-500" />,
    title: "5. How We Use Your Personal Data",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>We process your personal data for the following purposes, each grounded in a legal basis under Indian law:</p>
        <div className="space-y-3">
          {[
            { purpose: "Account creation & management", basis: "Contract performance", detail: "Creating and maintaining your account, verifying your identity, and enabling platform access." },
            { purpose: "Service delivery & matching", basis: "Contract performance", detail: "Connecting clients with workers, facilitating job posting, hiring, scheduling, messaging, and completion." },
            { purpose: "Payment processing", basis: "Contract performance / Legal obligation", detail: "Processing payments, disbursing worker payouts, generating tax invoices, and maintaining financial records." },
            { purpose: "Safety & verification", basis: "Legitimate interest / Legal obligation", detail: "Conducting identity checks, detecting fraud, investigating complaints, and cooperating with law enforcement." },
            { purpose: "AI cost estimation", basis: "Consent (for AI advisor use)", detail: "Processing job descriptions and uploaded photographs to generate indicative cost estimates. You can use the platform without using the AI advisor." },
            { purpose: "Platform analytics & improvement", basis: "Legitimate interest", detail: "Understanding user behaviour, diagnosing technical issues, and improving features. We use anonymised or pseudonymised data wherever possible." },
            { purpose: "Marketing communications", basis: "Consent", detail: "Sending promotional offers, feature announcements, and newsletters. You can unsubscribe at any time via the email footer or app settings." },
            { purpose: "Legal compliance & dispute resolution", basis: "Legal obligation", detail: "Retaining transaction and communication records for tax compliance, regulatory audits, and dispute resolution." },
          ].map((item, idx) => (
            <div key={idx} className="border border-orange-100 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 text-sm">{item.purpose}</span>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{item.basis}</span>
              </div>
              <p className="text-gray-600 text-xs">{item.detail}</p>
            </div>
          ))}
        </div>
        <p>We do not use your personal data for automated decision-making that produces legal or similarly significant effects without human review, except for fraud detection flags which are always reviewed by our team before action is taken.</p>
      </div>
    ),
  },
  {
    id: "sharing",
    icon: <Share2 size={20} className="text-orange-500" />,
    title: "6. Who We Share Your Data With",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>We do not sell your personal data. We share it only as described below:</p>
        <div className="space-y-3">
          {[
            { party: "Other Platform Users", detail: "Workers' public profile data (name, photo, skills, ratings, locality) is visible to Clients. Clients' name and job location (not full address) are shared with the hired Worker. Full home addresses are never publicly displayed." },
            { party: "Payment Processors", detail: "We share transaction data with our payment gateway partners (Razorpay/PhonePe or equivalent) solely to process payments. These partners are PCI-DSS compliant and bound by confidentiality agreements." },
            { party: "Cloud Infrastructure Providers", detail: "We use AWS/Google Cloud for hosting and data storage. These providers process data on our behalf and are contractually bound to appropriate security standards." },
            { party: "Identity Verification Partners", detail: "Government ID details are shared with our verification service provider solely for authentication purposes, under strict data processing agreements." },
            { party: "Analytics Partners", detail: "Aggregated, anonymised usage data (no names, contact details, or job content) may be shared with analytics platforms to improve the product." },
            { party: "Law Enforcement / Government", detail: "We disclose data to government authorities, courts, or law enforcement only when required by a valid legal order, court order, or statutory obligation under Indian law. We will notify you where legally permissible." },
            { party: "Business Transfers", detail: "If KarigarConnect is acquired, merged with, or substantially transfers its assets to another entity, your data may be transferred as part of that transaction. You will be notified before your data is subject to a new privacy policy." },
          ].map((item, idx) => (
            <div key={idx} className="border border-orange-100 rounded-lg p-3">
              <p className="font-semibold text-gray-900 text-sm mb-1">{item.party}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
          <strong>We do not share</strong> your name, phone number, email, ID documents, biometric data, or job history with advertisers, data brokers, or any third party for marketing or profiling purposes.
        </p>
      </div>
    ),
  },
  {
    id: "security",
    icon: <Lock size={20} className="text-orange-500" />,
    title: "7. Data Security",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>We implement technical and organizational security measures proportionate to the sensitivity of your data. These include:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Encryption in Transit", detail: "TLS 1.2+ for all data transmitted between your device and our servers." },
            { label: "Encryption at Rest", detail: "Sensitive data fields (ID numbers, payment details, biometrics) are encrypted at rest using AES-256." },
            { label: "Access Controls", detail: "Role-based access control ensures employees can only access data necessary for their function." },
            { label: "Authentication", detail: "OTP-based login, JWT session tokens, and two-factor authentication (optional) for all accounts." },
            { label: "Security Audits", detail: "Periodic vulnerability assessments and penetration testing by third-party security firms." },
            { label: "Incident Response", detail: "A documented data breach response plan. You will be notified within 72 hours of a breach affecting your data, as required by law." },
          ].map((item, idx) => (
            <div key={idx} className="border border-orange-100 rounded-xl p-3 bg-white">
              <p className="font-semibold text-gray-900 text-xs mb-1">{item.label}</p>
              <p className="text-gray-600 text-xs">{item.detail}</p>
            </div>
          ))}
        </div>
        <p>Despite these measures, no internet transmission is 100% secure. You are responsible for keeping your login credentials confidential. If you suspect unauthorized access to your account, contact us immediately at <a href="mailto:kc.india@gmail.com" className="text-orange-600 underline">kc.india@gmail.com</a>.</p>
      </div>
    ),
  },
  {
    id: "rights",
    icon: <UserCheck size={20} className="text-orange-500" />,
    title: "8. Your Rights Under Indian Law",
    content: (
      <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
        <p>Under the DPDPA 2023 and SPDI Rules 2011, you have the following rights with respect to your personal data:</p>
        <div className="overflow-x-auto rounded-xl border border-orange-100">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-orange-50">
                <th className="p-3 text-left font-semibold text-gray-800 border-b border-orange-100 w-1/4">Right</th>
                <th className="p-3 text-left font-semibold text-gray-800 border-b border-orange-100 w-2/5">What it means</th>
                <th className="p-3 text-left font-semibold text-gray-800 border-b border-orange-100">How to exercise it</th>
              </tr>
            </thead>
            <tbody>
              {RIGHTS_TABLE.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-orange-50/30"}>
                  <td className="p-3 font-semibold text-gray-900 border-b border-orange-100 align-top">{row.right}</td>
                  <td className="p-3 text-gray-600 border-b border-orange-100 align-top">{row.description}</td>
                  <td className="p-3 text-gray-600 border-b border-orange-100 align-top">{row.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>We will respond to all rights requests within <strong>30 days</strong>. In complex cases, we may extend this by a further 30 days with notice. There is no fee to exercise these rights unless requests are manifestly unfounded or repetitive.</p>
        <p>If you are unsatisfied with our response, you have the right to lodge a complaint with the <strong>Data Protection Board of India</strong> once it is constituted under the DPDPA 2023.</p>
      </div>
    ),
  },
  {
    id: "grievance",
    icon: <Phone size={20} className="text-orange-500" />,
    title: "9. Grievance Officer",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>In accordance with Rule 5(9) of the SPDI Rules, 2011 and Section 13 of the DPDPA 2023, KarigarConnect has designated a Grievance Officer to address your data-related concerns:</p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-2">
          <p className="font-bold text-gray-900">KarigarConnect Grievance Officer</p>
          <p className="text-sm">📧 <a href="mailto:kc.india@gmail.com" className="text-orange-600 underline font-medium">kc.india@gmail.com</a></p>
          <p className="text-sm">📞 <a href="tel:+918605171209" className="text-orange-600 underline font-medium">+91 86051 71209</a> (Mon–Sat, 9 AM – 6 PM IST)</p>
          <p className="text-sm">📍 Manjari Budruk, Hadapsar Road, Wagholi, Pune, Maharashtra 412307, India</p>
          <p className="text-xs text-gray-500 mt-2">Please use subject line: <em>"Privacy Grievance — [Your registered email]"</em> for faster resolution.</p>
        </div>
        <p>Grievances are acknowledged within <strong>48 hours</strong> and resolved within <strong>30 days</strong> wherever possible. Complex matters may take up to 60 days; you will be kept informed.</p>
      </div>
    ),
  },
  {
    id: "cookies",
    icon: <Database size={20} className="text-orange-500" />,
    title: "10. Cookies & Tracking Technologies",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>We use cookies and similar technologies (local storage, session tokens) for the following purposes:</p>
        <div className="space-y-2">
          {[
            { type: "Strictly Necessary", description: "Session management and security tokens. Cannot be disabled as they are essential for the platform to function.", canOpt: false },
            { type: "Functional", description: "Remembering your city preference, notification settings, and language choice.", canOpt: true },
            { type: "Analytics", description: "Understanding how users navigate the platform to improve features. Data is aggregated and anonymised.", canOpt: true },
            { type: "Marketing (if enabled)", description: "Delivering relevant promotional content. Only used if you opt-in during registration or settings.", canOpt: true },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start justify-between border border-orange-100 rounded-lg p-3 gap-3">
              <div>
                <p className="font-semibold text-gray-900 text-xs mb-0.5">{item.type}</p>
                <p className="text-gray-600 text-xs">{item.description}</p>
              </div>
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${item.canOpt ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {item.canOpt ? "Opt-out" : "Required"}
              </span>
            </div>
          ))}
        </div>
        <p>You can manage cookie preferences through your browser settings. Disabling functional or analytics cookies may affect your experience but will not prevent platform access.</p>
      </div>
    ),
  },
  {
    id: "children",
    icon: <Shield size={20} className="text-orange-500" />,
    title: "11. Children's Privacy",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>KarigarConnect is not intended for individuals under the age of <strong>18 years</strong>. We do not knowingly collect personal data from minors. Registration requires confirmation of age 18+.</p>
        <p>If we become aware that a user is under 18, we will suspend the account and promptly delete all associated personal data. If you believe a minor has registered on the platform, please notify us at <a href="mailto:kc.india@gmail.com" className="text-orange-600 underline">kc.india@gmail.com</a>.</p>
        <p>Under the DPDPA 2023, processing of children's data requires parental consent. KarigarConnect does not have a mechanism to obtain verifiable parental consent and therefore the platform is restricted to adults only.</p>
      </div>
    ),
  },
  {
    id: "changes",
    icon: <Bell size={20} className="text-orange-500" />,
    title: "12. Changes to This Policy",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>We may update this Privacy Policy to reflect changes in our practices, technology, legal requirements, or for other operational reasons. The updated date at the top of this page will always reflect the latest revision.</p>
        <p>For <strong>material changes</strong> (changes that meaningfully affect how your data is used or your rights), we will:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Send an email notification to your registered email address at least <strong>7 days</strong> before the change takes effect.</li>
          <li>Display a prominent in-app banner.</li>
          <li>For changes requiring fresh consent (new uses of biometric data, new third-party sharing), we will request your explicit consent before proceeding.</li>
        </ul>
        <p>Your continued use of the platform after the effective date of a revised Policy constitutes your acceptance of those changes.</p>
      </div>
    ),
  },
];

const AccordionItem = ({ section, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <div className="border border-orange-100 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-orange-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {section.icon}
          <span className="font-semibold text-gray-900 text-sm md:text-base">{section.title}</span>
        </div>
        {open
          ? <ChevronUp size={18} className="text-orange-400 flex-shrink-0" />
          : <ChevronDown size={18} className="text-orange-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-3 bg-orange-50/40 border-t border-orange-100">
          {section.content}
        </div>
      )}
    </div>
  );
};

const PrivacyPolicy = () => {
  const location = useLocation();
  const isEmbedded = new URLSearchParams(location.search).get("embed") === "1";

  return (
    <>
      {!isEmbedded && <Header />}
      <div className={`min-h-screen bg-gradient-to-b from-white to-orange-50 px-4 sm:px-6 lg:px-8 ${isEmbedded ? "py-6" : "py-12"}`}>
        <div className="max-w-4xl mx-auto">
          {!isEmbedded && (
            <Link to="/" className="inline-flex items-center text-orange-600 hover:text-orange-700 mb-6 font-semibold text-sm">
              <ChevronLeft size={18} className="mr-1" /> Back to Home
            </Link>
          )}

          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-3">
              <Lock size={13} /> Legal Document
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 text-sm">
              Effective date: <strong>1 January 2025</strong> &nbsp;·&nbsp; Last updated: <strong>April 2025</strong>
              &nbsp;·&nbsp; Aligned with <strong>DPDPA 2023 &amp; IT (SPDI) Rules 2011</strong>
            </p>
          </div>

          {/* Quick Commitment Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { icon: "🚫", label: "We never sell your data" },
              { icon: "🧬", label: "Biometric data deleted in 24h" },
              { icon: "📍", label: "No permanent GPS storage" },
              { icon: "✉️", label: "Grievance response in 48h" },
            ].map((item) => (
              <div key={item.label} className="bg-white border border-orange-100 rounded-xl p-3 text-center">
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className="text-xs text-gray-600 font-medium leading-tight">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Accordion Sections */}
          <div>
            {SECTIONS.map((section, idx) => (
              <AccordionItem key={section.id} section={section} defaultOpen={idx === 0} />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
            <p className="font-bold text-lg mb-1">Questions about your privacy?</p>
            <p className="text-orange-100 text-sm mb-4">Contact our Grievance Officer — we aim to respond within 48 hours on all business days.</p>
            <div className="flex flex-wrap gap-3">
              <a href="mailto:kc.india@gmail.com" className="inline-flex items-center gap-2 bg-white text-orange-600 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-orange-50">
                ✉️ kc.india@gmail.com
              </a>
              <a href="tel:+918605171209" className="inline-flex items-center gap-2 bg-white/20 text-white font-semibold text-sm px-4 py-2 rounded-lg hover:bg-white/30">
                📞 +91 86051 71209
              </a>
            </div>
          </div>

          {!isEmbedded && (
            <div className="mt-8 text-center">
              <Link to="/terms" className="text-orange-600 hover:text-orange-700 text-sm font-medium underline">
                Read our Terms &amp; Conditions →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
