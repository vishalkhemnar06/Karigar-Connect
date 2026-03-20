import React from "react";

const TermsAndConditions = () => {
  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 text-gray-800">
      <h1 className="text-3xl font-bold text-orange-600 mb-6">
        Terms & Conditions
      </h1>

      <div className="space-y-6 text-[16px] leading-7">
        
        <section>
          <h2 className="font-semibold text-lg">1. Eligibility</h2>
          <ul className="list-disc ml-6">
            <li>Users must be at least 18 years old to use the platform.</li>
            <li>All information provided must be accurate and verifiable.</li>
            <li>Karigar Connect reserves the right to verify and suspend accounts with false information.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">2. User Roles</h2>
          <ul className="list-disc ml-6">
            <li>Workers: Individuals offering services.</li>
            <li>Clients: Individuals or businesses hiring services.</li>
            <li>Both parties are responsible for lawful and ethical use of the platform.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">3. Account Security</h2>
          <ul className="list-disc ml-6">
            <li>Users must keep login details confidential.</li>
            <li>Karigar Connect is not responsible for unauthorized account access due to user negligence.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">4. Service Listings & Availability</h2>
          <ul className="list-disc ml-6">
            <li>Workers must keep rates, skills, and availability accurate.</li>
            <li>False claims may result in permanent suspension.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">5. Payments & Fees</h2>
          <ul className="list-disc ml-6">
            <li>All bookings must be made within the platform (if supported).</li>
            <li>Service fees, commissions, and processing charges may apply.</li>
            <li>Refunds and disputes follow platform policies.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">6. Conduct Rules</h2>
          <ul className="list-disc ml-6">
            <li>Harassment, discrimination, threats, or abuse is strictly prohibited.</li>
            <li>Workers must deliver work professionally and on time.</li>
            <li>Clients must provide a safe working environment.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">7. Ratings & Reviews</h2>
          <ul className="list-disc ml-6">
            <li>Reviews must be truthful and respectful.</li>
            <li>Manipulating ratings is prohibited.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">8. Verification</h2>
          <ul className="list-disc ml-6">
            <li>Users may be required to provide identity or certification documents.</li>
            <li>Failure to submit required documents may lead to account restrictions.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">9. Intellectual Property</h2>
          <ul className="list-disc ml-6">
            <li>Platform content, branding, and digital assets belong to Karigar Connect.</li>
            <li>Copying, reselling, or modifying platform content is prohibited.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">10. Safety & Liability</h2>
          <ul className="list-disc ml-6">
            <li>Karigar Connect is not responsible for injuries, damages, or loss during service execution.</li>
            <li>Users assume all risks associated with service interactions.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">11. Termination</h2>
          <ul className="list-disc ml-6">
            <li>Accounts may be suspended for fraud, misuse, or repeated complaints.</li>
            <li>Karigar Connect may remove content or restrict access at its discretion.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">12. Privacy & Data</h2>
          <p>User data is handled according to the platform's Privacy Policy.</p>
        </section>

        <section>
          <h2 className="font-semibold text-lg">13. Disputes</h2>
          <ul className="list-disc ml-6">
            <li>Users must first attempt to resolve disputes professionally.</li>
            <li>Karigar Connect may assist but is not obligated to mediate conflicts.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-lg">14. Modifications</h2>
          <p>These Terms may be updated at any time. Continued use means acceptance of updated terms.</p>
        </section>
      </div>

      <p className="mt-10 text-center text-gray-700 font-medium">
        ✔ By using Karigar Connect, you acknowledge and agree to these Terms & Conditions.
      </p>
    </div>
  );
};

export default TermsAndConditions;




// TermsAndConditions.jsx
// import React from 'react';
// import { Link } from 'react-router-dom';

// const TermsAndConditions = () => {
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 py-8">
//       <div className="container mx-auto px-4 max-w-4xl">
        
//         {/* Header */}
//         <div className="text-center mb-8">
//           <Link 
//             to="/" 
//             className="inline-flex items-center gap-2 mb-6 text-orange-500 hover:text-orange-600 transition-colors"
//           >
//             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
//             </svg>
//             Back to Home
//           </Link>
//           <h1 className="text-4xl font-bold text-gray-800 mb-4">Terms & Conditions</h1>
//           <p className="text-lg text-gray-600">Legal Agreement for KarigarConnect Platform Usage</p>
//         </div>

//         {/* Content Card */}
//         <div className="bg-white rounded-2xl shadow-lg border border-orange-200 p-8">
          
//           {/* Platform Rules */}
//           <section className="mb-8">
//             <h2 className="text-2xl font-bold text-orange-600 mb-6 border-b pb-2">Platform Rules & Regulations</h2>
            
//             <div className="space-y-6">
//               <div className="bg-red-50 border border-red-200 rounded-lg p-4">
//                 <h3 className="text-lg font-bold text-red-700 mb-3">🚫 Strictly Prohibited Activities</h3>
//                 <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
//                   <li>Sharing direct contact information before service confirmation</li>
//                   <li>Accepting or making payments outside the platform</li>
//                   <li>Creating multiple accounts for the same individual</li>
//                   <li>Posting fake reviews or ratings</li>
//                   <li>Misrepresenting skills, experience, or qualifications</li>
//                   <li>Discriminatory behavior based on gender, religion, caste, or ethnicity</li>
//                   <li>Harassment or inappropriate communication with other users</li>
//                   <li>Sharing copyrighted or illegal content</li>
//                 </ul>
//               </div>

//               <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
//                 <h3 className="text-lg font-bold text-yellow-700 mb-3">⚠️ Service & Booking Regulations</h3>
//                 <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
//                   <li>Artisans must honor confirmed booking dates and times</li>
//                   <li>Cancellations require 24-hour notice unless emergency</li>
//                   <li>Service prices must include all applicable taxes</li>
//                   <li>No hidden charges beyond agreed service scope</li>
//                   <li>Work quality must match profile descriptions</li>
//                   <li>Clients must provide accurate service requirements</li>
//                   <li>Site access and necessary tools must be provided by client</li>
//                 </ul>
//               </div>

//               <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
//                 <h3 className="text-lg font-bold text-blue-700 mb-3">💰 Payment & Financial Rules</h3>
//                 <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
//                   <li>All payments must be processed through platform payment gateway</li>
//                   <li>Platform commission of 15% applies to all completed services</li>
//                   <li>Payments are released to artisans after client approval</li>
//                   <li>Refund requests must be submitted within 7 days of service completion</li>
//                   <li>Chargebacks without platform dispute resolution are prohibited</li>
//                   <li>Artisans must provide valid GST information if applicable</li>
//                 </ul>
//               </div>

//               <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//                 <h3 className="text-lg font-bold text-green-700 mb-3">✅ Quality & Professional Standards</h3>
//                 <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
//                   <li>Artisans must maintain professional conduct at all times</li>
//                   <li>Use of safety equipment and following safety protocols is mandatory</li>
//                   <li>Work sites must be cleaned after service completion</li>
//                   <li>Materials used must meet quality standards as promised</li>
//                   <li>Timely communication with clients is required</li>
//                   <li>Warranty periods must be clearly communicated</li>
//                 </ul>
//               </div>
//             </div>
//           </section>

//           {/* Account Management Rules */}
//           <section className="mb-8">
//             <h2 className="text-2xl font-bold text-orange-600 mb-4">Account Management</h2>
//             <div className="grid md:grid-cols-2 gap-6 text-gray-700">
//               <div className="space-y-3">
//                 <h4 className="font-semibold text-gray-800">Artisan Accounts</h4>
//                 <ul className="list-disc list-inside space-y-1 ml-4">
//                   <li>Skill verification is mandatory for service listing</li>
//                   <li>Profile must include recent portfolio images</li>
//                   <li>Availability status must be regularly updated</li>
//                   <li>Response to client inquiries within 24 hours required</li>
//                   <li>ID proof verification for account activation</li>
//                 </ul>
//               </div>
//               <div className="space-y-3">
//                 <h4 className="font-semibold text-gray-800">Client Accounts</h4>
//                 <ul className="list-disc list-inside space-y-1 ml-4">
//                   <li>Accurate service requirements must be provided</li>
//                   <li>Payment method verification required for bookings</li>
//                   <li>Reviews must be based on actual service experience</li>
//                   <li>Site accessibility information must be shared</li>
//                   <li>Timely service approval/rejection required</li>
//                 </ul>
//               </div>
//             </div>
//           </section>

//           {/* Dispute Resolution */}
//           <section className="mb-8">
//             <h2 className="text-2xl font-bold text-orange-600 mb-4">Dispute Resolution Protocol</h2>
//             <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
//               <div className="space-y-4 text-gray-700">
//                 <div className="flex items-start gap-3">
//                   <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
//                   <p>Parties must attempt direct resolution within 48 hours</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
//                   <p>Formal dispute can be raised through platform support</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
//                   <p>Platform mediation team will review evidence from both parties</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
//                   <p>Resolution decision is binding and final</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
//                   <p>Repeated disputes may lead to account suspension</p>
//                 </div>
//               </div>
//             </div>
//           </section>

//           {/* Penalty System */}
//           <section className="mb-8">
//             <h2 className="text-2xl font-bold text-orange-600 mb-4">Penalty & Suspension System</h2>
//             <div className="overflow-x-auto">
//               <table className="w-full border-collapse border border-gray-300">
//                 <thead>
//                   <tr className="bg-orange-100">
//                     <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Violation</th>
//                     <th className="border border-gray-300 px-4 py-3 text-left font-semibold">First Offense</th>
//                     <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Repeat Offense</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   <tr>
//                     <td className="border border-gray-300 px-4 py-3">Late cancellation</td>
//                     <td className="border border-gray-300 px-4 py-3">Warning</td>
//                     <td className="border border-gray-300 px-4 py-3">Temporary suspension</td>
//                   </tr>
//                   <tr className="bg-gray-50">
//                     <td className="border border-gray-300 px-4 py-3">Payment outside platform</td>
//                     <td className="border border-gray-300 px-4 py-3">Account suspension</td>
//                     <td className="border border-gray-300 px-4 py-3">Permanent ban</td>
//                   </tr>
//                   <tr>
//                     <td className="border border-gray-300 px-4 py-3">Fake reviews</td>
//                     <td className="border border-gray-300 px-4 py-3">Review removal + warning</td>
//                     <td className="border border-gray-300 px-4 py-3">Rating reset + suspension</td>
//                   </tr>
//                   <tr className="bg-gray-50">
//                     <td className="border border-gray-300 px-4 py-3">Professional misconduct</td>
//                     <td className="border border-gray-300 px-4 py-3">Investigation + warning</td>
//                     <td className="border border-gray-300 px-4 py-3">Immediate suspension</td>
//                   </tr>
//                 </tbody>
//               </table>
//             </div>
//           </section>

//           {/* Legal Compliance */}
//           <section className="mb-8">
//             <h2 className="text-2xl font-bold text-orange-600 mb-4">Legal Compliance</h2>
//             <div className="space-y-4 text-gray-700">
//               <p><strong>Governing Law:</strong> These terms are governed by Indian laws</p>
//               <p><strong>Jurisdiction:</strong> Courts in Pune, Maharashtra have exclusive jurisdiction</p>
//               <p><strong>Updates:</strong> Platform reserves right to modify terms with 30-day notice</p>
//               <p><strong>Liability:</strong> Maximum liability limited to service value in dispute</p>
//             </div>
//           </section>

//           {/* Acceptance Section */}
//           <section className="bg-orange-50 rounded-xl p-6 border border-orange-200 mt-8">
//             <h2 className="text-xl font-bold text-orange-600 mb-4">Acceptance & Agreement</h2>
//             <p className="text-gray-700 mb-4">
//               By using KarigarConnect platform, you explicitly agree to abide by all rules and regulations stated above. 
//               Violation of any rule may result in immediate account suspension or permanent ban without refund.
//             </p>
//             <div className="flex items-center gap-2 text-sm text-gray-600">
//               <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
//               </svg>
//               <span>For queries: legal@karigarconnect.com | Support: +91-XXXXX-XXXXX</span>
//             </div>
//           </section>

//           {/* Footer */}
//           <div className="mt-8 pt-6 border-t border-gray-200 text-center">
//             <p className="text-gray-600 text-sm">
//               © {new Date().getFullYear()} KarigarConnect Pvt. Ltd. All rights reserved.
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default TermsAndConditions;