import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronDown, ChevronUp, AlertTriangle, Shield, IndianRupee, Users, Briefcase, Star, Phone, Scale } from "lucide-react";
import Header from "./Header";

const SECTIONS = [
  {
    id: "platform-nature",
    icon: <Briefcase size={20} className="text-orange-500" />,
    title: "1. Nature of the Platform",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>KarigarConnect is a <strong>technology-based marketplace platform</strong> that connects clients seeking home and commercial services ("Clients") with independent, self-employed skilled workers ("Karigars" or "Workers"). KarigarConnect is not a staffing agency, contractor, or employer.</p>
        <p>KarigarConnect does <strong>not itself provide</strong> any home services. All services are provided directly by independent Workers who are not employees, agents, or partners of KarigarConnect. Workers set their own schedules and methods of work.</p>
        <p>KarigarConnect facilitates the following: job discovery and matching, verified worker profiles, AI-assisted cost estimation, scheduling, communication, ratings, and payment facilitation. KarigarConnect is not responsible for the quality, safety, legality, or timeliness of any service provided through the platform.</p>
        <p>By registering on the platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions in their entirety.</p>
      </div>
    ),
  },
  {
    id: "eligibility",
    icon: <Shield size={20} className="text-orange-500" />,
    title: "2. Eligibility & Registration",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>To register and use KarigarConnect, you must:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Be at least <strong>18 years of age</strong>.</li>
          <li>Be a resident of India and operate within the service areas supported by the platform.</li>
          <li>Provide accurate, current, and complete information during registration. Providing false information is grounds for immediate, permanent suspension.</li>
          <li>Maintain the security and confidentiality of your login credentials. You are solely responsible for all activity under your account.</li>
          <li>Notify KarigarConnect immediately at <a href="mailto:kc.india@gmail.com" className="text-orange-600 underline">kc.india@gmail.com</a> if you become aware of any unauthorized use of your account.</li>
        </ul>
        <p>Workers must additionally complete face verification, submit a valid government-issued photo ID (Aadhaar, PAN, Driving Licence, or Voter ID), and pass skill and background verification before being listed on the platform. KarigarConnect reserves the right to reject any application without providing a reason.</p>
        <p>One person may not hold more than one active account of the same role. Creating multiple accounts to circumvent a suspension is a material breach of these Terms.</p>
      </div>
    ),
  },
  {
    id: "worker-obligations",
    icon: <Users size={20} className="text-orange-500" />,
    title: "3. Worker Obligations & Conduct",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>3.1 Professional Standards.</strong> Workers must arrive at the job site on time, bring all required tools as agreed, present valid identification if requested, and complete the work described in the job posting to a professional standard.</p>
        <p><strong>3.2 Off-Platform Transactions Prohibited.</strong> Workers are strictly prohibited from soliciting or accepting payment directly from Clients to bypass the platform. Any transaction for a job originated through KarigarConnect must be completed through the platform. Violation will result in permanent account suspension and recovery of platform commission.</p>
        <p><strong>3.3 Safety & Site Conduct.</strong> Workers must follow all applicable safety standards at all times. Workers must not consume alcohol, tobacco, or any controlled substances at or before a job site. Workers must treat clients, their family members, and property with respect at all times.</p>
        <p><strong>3.4 Accurate Profile Information.</strong> Workers must keep their skills, experience, availability, and service areas up to date. Listing skills or certifications you do not possess is fraud and will result in immediate suspension.</p>
        <p><strong>3.5 Rate Accuracy.</strong> Workers must not quote rates to clients that substantially differ from their listed rates without a legitimate scope-change reason documented in the platform.</p>
        <p><strong>3.6 Poaching Prohibition.</strong> Workers are prohibited from contacting Clients directly (via phone, WhatsApp, or any channel) for purposes of obtaining work outside the platform for a period of <strong>12 months</strong> from any job completed through the platform.</p>
        <p><strong>3.7 Image & Identity.</strong> Workers may not use photographs of other persons, AI-generated faces, or copyrighted images in their profiles. Profile photos must be a clear, recent photograph of the Worker themselves.</p>
      </div>
    ),
  },
  {
    id: "client-obligations",
    icon: <Users size={20} className="text-orange-500" />,
    title: "4. Client Obligations & Conduct",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>4.1 Safe Working Environment.</strong> Clients must provide Workers with a safe, accessible work environment. This includes ensuring any hazards (live electrical circuits, structural damage, aggressive pets, etc.) are disclosed before work begins.</p>
        <p><strong>4.2 Accurate Job Description.</strong> Clients are responsible for providing accurate, complete job descriptions when posting. If the actual scope is materially larger than described, the Worker is entitled to revise the quote. Repeated misleading job postings will result in account suspension.</p>
        <p><strong>4.3 Respect.</strong> Clients must treat Workers with dignity and respect. Harassment, physical or verbal abuse, discrimination, or threatening behavior toward Workers will result in immediate, permanent suspension of the Client's account and may be reported to law enforcement.</p>
        <p><strong>4.4 Payment.</strong> Clients must pay the agreed amount through the platform upon job completion or as otherwise agreed at the time of booking. Withholding payment without a legitimate dispute filed through the platform's dispute resolution process is a breach of these Terms.</p>
        <p><strong>4.5 Presence or Authorized Representative.</strong> An adult (18+) must be present at the service location for the duration of the job, or a designated adult representative must be authorized in writing before the Worker arrives.</p>
      </div>
    ),
  },
  {
    id: "job-booking",
    icon: <Briefcase size={20} className="text-orange-500" />,
    title: "5. Job Posting, Booking & Scheduling",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>5.1 Posting.</strong> Clients may post jobs describing the required work, preferred date, time, and location. KarigarConnect's AI advisor may assist in generating cost estimates. All AI-generated estimates are <strong>indicative only</strong> and do not constitute a binding quote from any Worker.</p>
        <p><strong>5.2 Hiring.</strong> A booking is confirmed only when a Client explicitly hires a Worker and the Worker accepts the job. Both parties will receive a confirmation notification.</p>
        <p><strong>5.3 Scheduling.</strong> Jobs must be scheduled at least <strong>50 minutes</strong> in advance. Work hours are between <strong>6:00 AM and 9:00 PM</strong> unless both parties have agreed otherwise in writing via the platform.</p>
        <p><strong>5.4 Cancellation — Client.</strong> Clients may cancel a confirmed booking:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>More than <strong>4 hours before</strong> scheduled start — no charge.</li>
          <li>Between <strong>1–4 hours before</strong> — a cancellation fee of <strong>₹100</strong> applies.</li>
          <li>Less than <strong>1 hour before</strong>, or Worker has already arrived — a cancellation fee of up to <strong>50% of the estimated job value</strong> applies.</li>
        </ul>
        <p><strong>5.5 Cancellation — Worker.</strong> Workers who cancel a confirmed booking without reasonable cause more than twice in any 30-day period may have their account suspended or delisted. Last-minute cancellations (less than 2 hours before start) are treated as a serious conduct violation.</p>
        <p><strong>5.6 No-Shows.</strong> If a Worker fails to arrive within 30 minutes of the agreed start time without notification, the Client may mark the booking as a no-show through the platform and will not be charged any fees.</p>
      </div>
    ),
  },
  {
    id: "payments",
    icon: <IndianRupee size={20} className="text-orange-500" />,
    title: "6. Payments, Fees & Refunds",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>6.1 Payment Methods.</strong> KarigarConnect supports payment via UPI, debit/credit card, net banking, and wallet as listed on the platform. Cash payments are permissible but must be recorded on the platform.</p>
        <p><strong>6.2 Platform Commission.</strong> KarigarConnect charges Workers a platform commission on each completed job. The applicable commission rate is communicated during onboarding and may be updated with 30 days' advance notice. Workers may not pass on platform commission costs to Clients as a surcharge.</p>
        <p><strong>6.3 GST.</strong> Applicable Goods and Services Tax (GST) will be charged in addition to the service fee, in accordance with Indian tax law. Tax invoices will be generated for transactions above the threshold.</p>
        <p><strong>6.4 Disputed Payments.</strong> If a Client believes the final payment amount is incorrect, they must raise a dispute through the platform within <strong>48 hours</strong> of job completion. After 48 hours, the payment is deemed accepted and finalized.</p>
        <p><strong>6.5 Refund Policy.</strong> Refunds may be processed in the following circumstances:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Worker no-show confirmed by the platform.</li>
          <li>Work quality complaint upheld by KarigarConnect after investigation.</li>
          <li>Duplicate or erroneous payment.</li>
        </ul>
        <p>Refunds are processed within <strong>5–7 business days</strong> to the original payment method. KarigarConnect's decision in all refund disputes is final.</p>
        <p><strong>6.6 Worker Payouts.</strong> Workers receive payouts as per the payout schedule communicated during onboarding. KarigarConnect is not responsible for delays caused by banking processes outside its control.</p>
      </div>
    ),
  },
  {
    id: "ai-estimates",
    icon: <AlertTriangle size={20} className="text-orange-500" />,
    title: "7. AI-Generated Estimates Disclaimer",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>KarigarConnect provides an AI-powered advisor tool that generates estimates for labour cost, material cost, equipment cost, and project duration. These estimates are generated using statistical models trained on market data and are provided <strong>for informational purposes only</strong>.</p>
        <p><strong>AI estimates are not binding quotes.</strong> The actual cost of any job may differ from the AI estimate based on factors including but not limited to: actual site conditions, scope changes, material price fluctuations, location-specific factors, and Worker availability.</p>
        <p>KarigarConnect does not guarantee the accuracy, completeness, or suitability of any AI-generated estimate. KarigarConnect shall not be liable for any loss, damage, or expense incurred by any party in reliance on an AI-generated estimate.</p>
        <p>Material and equipment prices shown in estimates are indicative only and based on market averages. Actual purchase prices may vary. Clients are advised to obtain independent quotes before purchasing any materials.</p>
        <p>The AI advisor processes your job description, uploaded photographs, and questionnaire answers. By using this feature, you consent to this processing. No personally identifiable information from your job description is used to train or update the underlying AI model without your explicit consent.</p>
      </div>
    ),
  },
  {
    id: "ratings",
    icon: <Star size={20} className="text-orange-500" />,
    title: "8. Ratings, Reviews & Content",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>8.1 Authentic Reviews.</strong> Ratings and reviews must reflect genuine experiences from verified completed jobs. Submitting fabricated, incentivized, or fraudulent reviews is prohibited and will result in immediate account suspension.</p>
        <p><strong>8.2 Content Standards.</strong> Reviews must not contain defamatory, abusive, sexually explicit, or discriminatory content. KarigarConnect reserves the right to remove any review that violates these standards without prior notice.</p>
        <p><strong>8.3 Review Disputes.</strong> Workers who believe a review is false or defamatory may flag it for investigation within <strong>7 days</strong> of publication. KarigarConnect will investigate and take action it deems appropriate, including removal.</p>
        <p><strong>8.4 User-Generated Content.</strong> By uploading any content (photos, descriptions, messages) to the platform, you grant KarigarConnect a non-exclusive, royalty-free, perpetual, worldwide license to use, reproduce, and display that content for operational and marketing purposes, subject to the Privacy Policy.</p>
        <p><strong>8.5 Rating Manipulation.</strong> Coordinated attempts to inflate or suppress ratings — including organizing third parties to post reviews — are a material breach of these Terms and may be reported to relevant authorities.</p>
      </div>
    ),
  },
  {
    id: "verification-safety",
    icon: <Shield size={20} className="text-orange-500" />,
    title: "9. Verification & Background Checks",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>9.1 Verification Process.</strong> KarigarConnect verifies Workers through government ID validation, face matching using liveness detection technology (MediaPipe Face Mesh), and skill assessment. A "Verified" badge on a Worker's profile indicates these checks have been completed.</p>
        <p><strong>9.2 Limitations of Verification.</strong> Verification reduces but does not eliminate risk. KarigarConnect does not conduct criminal background checks as a standard process, though this may be introduced for certain service categories. The presence of a Verified badge does not constitute a guarantee of the Worker's conduct, quality, or suitability for any specific job.</p>
        <p><strong>9.3 Client Responsibilities for Safety.</strong> Clients are advised to: check Worker profile, ratings, and reviews before hiring; be present during work; secure valuables; and not share sensitive personal financial information with Workers. If you feel unsafe at any point, end the interaction and contact local authorities.</p>
        <p><strong>9.4 Incident Reporting.</strong> Any incident — theft, damage, harassment, assault — occurring during a platform-originated job must be reported to KarigarConnect within 24 hours via the complaint mechanism and to local police where appropriate. KarigarConnect will cooperate fully with law enforcement investigations.</p>
      </div>
    ),
  },
  {
    id: "prohibited",
    icon: <AlertTriangle size={20} className="text-orange-500" />,
    title: "10. Prohibited Activities",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>The following are expressly prohibited on the KarigarConnect platform:</p>
        <ul className="list-disc ml-5 space-y-1.5">
          <li>Impersonating another person or entity.</li>
          <li>Creating fake accounts or using bots to interact with the platform.</li>
          <li>Attempting to scrape, crawl, or extract data from the platform through automated means.</li>
          <li>Posting jobs for illegal activities, dangerous work not disclosed to the Worker, or anything violating applicable Indian law.</li>
          <li>Attempting to reverse-engineer, decompile, or tamper with the platform's software.</li>
          <li>Using the platform's messaging system to send spam, phishing links, or unsolicited commercial messages.</li>
          <li>Attempting to manipulate or game the AI cost estimation or matching system.</li>
          <li>Engaging in discrimination based on religion, caste, gender, disability, sexual orientation, or any other protected characteristic under Indian law.</li>
          <li>Sharing login credentials with any third party.</li>
          <li>Circumventing platform fees through off-platform arrangements for platform-originated work.</li>
        </ul>
        <p>Violation of any prohibition above may result in immediate suspension, legal action, and/or reporting to appropriate authorities.</p>
      </div>
    ),
  },
  {
    id: "liability",
    icon: <Scale size={20} className="text-orange-500" />,
    title: "11. Limitation of Liability",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>11.1 Service Quality.</strong> KarigarConnect is a marketplace platform and is not responsible for the quality, fitness, safety, or legality of any service performed by a Worker. Disputes regarding service quality are between the Client and the Worker directly, though KarigarConnect may assist with mediation.</p>
        <p><strong>11.2 Property Damage.</strong> Workers are individually liable for any damage caused to client property during service execution. KarigarConnect's liability for any property damage claim is limited to platform commission earned on the relevant job.</p>
        <p><strong>11.3 Platform Availability.</strong> KarigarConnect does not warrant that the platform will be available at all times or free from errors. KarigarConnect shall not be liable for any loss caused by platform downtime, technical errors, or data loss.</p>
        <p><strong>11.4 Maximum Liability.</strong> To the maximum extent permitted by Indian law, KarigarConnect's total aggregate liability to any user for any claim arising out of or in connection with the platform shall not exceed <strong>₹10,000</strong> or the platform commission earned on the relevant transaction, whichever is lower.</p>
        <p><strong>11.5 Indemnity.</strong> You agree to indemnify, defend, and hold harmless KarigarConnect, its directors, employees, and agents from and against any claims, losses, damages, expenses (including legal fees) arising from: (a) your violation of these Terms; (b) your use of the platform; (c) any service provided or received through the platform; or (d) any content you post on the platform.</p>
      </div>
    ),
  },
  {
    id: "ip",
    icon: <Shield size={20} className="text-orange-500" />,
    title: "12. Intellectual Property",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p>All platform content including but not limited to: the KarigarConnect name, logo, AI models, algorithms, software code, database structure, UI/UX design, and written content are the exclusive intellectual property of KarigarConnect and are protected under the Copyright Act, 1957, Trade Marks Act, 1999, and applicable Indian and international intellectual property laws.</p>
        <p>You may not copy, reproduce, distribute, create derivative works from, publicly display, or commercially exploit any platform content without prior written permission from KarigarConnect.</p>
        <p>If you believe any content on the platform infringes your intellectual property rights, please send a notice to <a href="mailto:kc.india@gmail.com" className="text-orange-600 underline">kc.india@gmail.com</a> with full details of the alleged infringement.</p>
      </div>
    ),
  },
  {
    id: "dispute",
    icon: <Scale size={20} className="text-orange-500" />,
    title: "13. Dispute Resolution & Governing Law",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>13.1 Platform Grievances.</strong> If you have a complaint about KarigarConnect's services, please first raise it through the in-app complaint system or write to our Grievance Officer at <a href="mailto:kc.india@gmail.com" className="text-orange-600 underline">kc.india@gmail.com</a>. We will endeavor to resolve all grievances within <strong>30 days</strong> of receipt.</p>
        <p><strong>13.2 Between Users.</strong> KarigarConnect may at its discretion facilitate mediation between Clients and Workers. However, KarigarConnect is not an arbitrator and its mediation suggestions are non-binding.</p>
        <p><strong>13.3 Arbitration.</strong> Any dispute, controversy, or claim arising out of or relating to these Terms, or the breach, termination, or invalidity thereof, that cannot be resolved through internal grievance mechanisms shall be finally settled by binding arbitration under the <strong>Arbitration and Conciliation Act, 1996</strong>. The seat of arbitration shall be <strong>Pune, Maharashtra</strong>. The arbitration shall be conducted in English.</p>
        <p><strong>13.4 Governing Law & Jurisdiction.</strong> These Terms are governed by the laws of India. Subject to the arbitration clause above, the courts of Pune, Maharashtra shall have exclusive jurisdiction over any matters that proceed to litigation.</p>
        <p><strong>13.5 No Class Actions.</strong> You agree to bring any claim against KarigarConnect only in your individual capacity and not as a plaintiff or class member in any purported class or representative proceeding.</p>
      </div>
    ),
  },
  {
    id: "general",
    icon: <Briefcase size={20} className="text-orange-500" />,
    title: "14. General Provisions",
    content: (
      <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
        <p><strong>14.1 Modifications.</strong> KarigarConnect reserves the right to modify these Terms at any time. Material changes will be notified via email or in-app notification at least <strong>7 days</strong> before taking effect. Your continued use of the platform after the effective date constitutes acceptance.</p>
        <p><strong>14.2 Severability.</strong> If any provision of these Terms is found by a court of competent jurisdiction to be invalid or unenforceable, that provision shall be modified to the minimum extent necessary to make it valid, and the remaining provisions shall continue in full force and effect.</p>
        <p><strong>14.3 Entire Agreement.</strong> These Terms, together with the Privacy Policy and any additional terms applicable to specific services, constitute the entire agreement between you and KarigarConnect and supersede all prior agreements relating to the platform.</p>
        <p><strong>14.4 No Waiver.</strong> KarigarConnect's failure to enforce any right or provision in these Terms shall not constitute a waiver of that right or provision.</p>
        <p><strong>14.5 Contact.</strong> KarigarConnect Pvt. Ltd., Manjari Budruk, Hadapsar Road, Wagholi, Pune, Maharashtra 412307. Email: <a href="mailto:kc.india@gmail.com" className="text-orange-600 underline">kc.india@gmail.com</a>. Phone: +91 86051 71209.</p>
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

const TermsAndConditions = () => {
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
              <Scale size={13} /> Legal Document
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">Terms &amp; Conditions</h1>
            <p className="text-gray-500 text-sm">
              Effective date: <strong>1 January 2025</strong> &nbsp;·&nbsp; Last updated: <strong>April 2025</strong>
            </p>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
            <div className="flex gap-3">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm mb-1">Please read carefully before using the platform.</p>
                <p className="text-amber-800 text-sm leading-relaxed">
                  These Terms form a legally binding agreement between you and KarigarConnect. By registering, posting a job, or applying for work on the platform, you confirm that you have read and agreed to these Terms in full. If you do not agree, please do not use the platform.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Cancellation fee", value: "From ₹100" },
              { label: "Refund window", value: "48 hours" },
              { label: "Governing law", value: "India / Pune" },
              { label: "Dispute method", value: "Arbitration" },
            ].map((item) => (
              <div key={item.label} className="bg-white border border-orange-100 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className="font-bold text-gray-900 text-sm">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Accordion Sections */}
          <div>
            {SECTIONS.map((section, idx) => (
              <AccordionItem key={section.id} section={section} defaultOpen={idx === 0} />
            ))}
          </div>

          {/* Acceptance Footer */}
          <div className="mt-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white text-center">
            <p className="font-bold text-lg mb-1">✔ By using KarigarConnect, you agree to these Terms.</p>
            <p className="text-orange-100 text-sm">
              Questions? Contact us at{" "}
              <a href="mailto:kc.india@gmail.com" className="underline font-semibold">kc.india@gmail.com</a>
              {" "}or call{" "}
              <a href="tel:+918605171209" className="underline font-semibold">+91 86051 71209</a>.
            </p>
          </div>

          {!isEmbedded && (
            <div className="mt-8 text-center">
              <Link to="/privacy" className="text-orange-600 hover:text-orange-700 text-sm font-medium underline">
                Read our Privacy Policy →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TermsAndConditions;
