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


