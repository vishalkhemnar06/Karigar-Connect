import React from "react";
import Header from "./Header";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const location = useLocation();
  const isEmbedded = new URLSearchParams(location.search).get('embed') === '1';

  return (
    <>
      {!isEmbedded && <Header />}
      <div className={`min-h-screen bg-gradient-to-b from-white to-orange-50 px-4 sm:px-6 lg:px-8 ${isEmbedded ? 'py-6' : 'py-12'}`}>
        <div className="max-w-5xl mx-auto">
          {/* Back Button */}
          {!isEmbedded && (
            <Link to="/" className="inline-flex items-center text-orange-600 hover:text-orange-700 mb-6 font-semibold">
              <ChevronLeft size={20} className="mr-1" /> Back to Home
            </Link>
          )}

          <h1 className="text-4xl font-black text-orange-600 mb-2">Privacy Policy</h1>
          <p className="text-gray-600 mb-8 text-lg">Last updated: March 2024</p>

          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 space-y-8">
            
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                KarigarConnect ("Company," "we," "us," or "our") operates the KarigarConnect platform. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard information when you 
                visit our website, mobile application, and related services (collectively, "Platform").
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2.1 Information You Provide</h3>
                  <ul className="list-disc ml-6 text-gray-700 space-y-2">
                    <li><strong>Registration Information:</strong> Name, email address, phone number, address, date of birth, identification documents</li>
                    <li><strong>Profile Information:</strong> Skills, experience, qualifications, certifications, photos, ratings, and reviews</li>
                    <li><strong>Payment Information:</strong> Bank details, payment method (processed securely through payment gateways)</li>
                    <li><strong>Communication:</strong> Messages, feedback, complaints, and support tickets</li>
                    <li><strong>Location Data:</strong> GPS coordinates for shop and service locations</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2.2 Information Collected Automatically</h3>
                  <ul className="list-disc ml-6 text-gray-700 space-y-2">
                    <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
                    <li><strong>Usage Data:</strong> Pages visited, time spent, clicks, search queries, and interactions</li>
                    <li><strong>Cookies & Tracking:</strong> We use cookies and similar technologies to enhance your experience</li>
                    <li><strong>Biometric Data:</strong> Face verification data collected during liveness detection for identity verification</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li><strong>Account Management:</strong> Create and manage your account, verify identity, and provide customer support</li>
                <li><strong>Service Delivery:</strong> Connect workers with clients, process bookings, and facilitate payments</li>
                <li><strong>Communication:</strong> Send notifications, updates, marketing emails (with your consent)</li>
                <li><strong>Fraud Prevention:</strong> Monitor and prevent fraudulent activities, abuse, and security threats</li>
                <li><strong>Compliance:</strong> Meet legal and regulatory obligations</li>
                <li><strong>Analytics & Improvement:</strong> Understand user behavior and improve our services</li>
                <li><strong>Verification:</strong> Conduct background checks and verify professional credentials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Sharing & Disclosure</h2>
              <div className="space-y-4">
                <p className="text-gray-700">We may share your information with:</p>
                <ul className="list-disc ml-6 text-gray-700 space-y-2">
                  <li><strong>Other Users:</strong> Public profile information is visible to other users (name, skills, ratings, reviews)</li>
                  <li><strong>Service Providers:</strong> Payment processors, hosting providers, customer support platforms</li>
                  <li><strong>Legal Requirements:</strong> Government authorities, law enforcement when required by law</li>
                  <li><strong>Business Partners:</strong> Analytics and marketing partners (with anonymized data)</li>
                  <li><strong>Insurance & Verification:</strong> Insurance partners and verification agencies for compliance</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Security</h2>
              <div className="space-y-3">
                <p className="text-gray-700">
                  We implement industry-standard security measures including:
                </p>
                <ul className="list-disc ml-6 text-gray-700 space-y-2">
                  <li>SSL/TLS encryption for data in transit</li>
                  <li>Encrypted storage for sensitive information</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Secure payment processing through PCI-DSS compliant gateways</li>
                </ul>
                <p className="text-gray-700 mt-4">
                  However, no method of transmission over the internet is 100% secure. We encourage you to use strong passwords 
                  and enable two-factor authentication.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Your Rights & Choices</h2>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data (subject to legal requirements)</li>
                <li><strong>Marketing Preferences:</strong> Opt-out of promotional emails anytime</li>
                <li><strong>Data Portability:</strong> Request your data in a portable format</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Biometric & Face Verification Data</h2>
              <div className="space-y-3">
                <p className="text-gray-700">
                  KarigarConnect uses face verification technology (MediaPipe Face Mesh) to verify user identity and prevent fraudulent accounts.
                </p>
                <ul className="list-disc ml-6 text-gray-700 space-y-2">
                  <li>Facial data is compared with uploaded ID documents for identity verification only</li>
                  <li>Live face data is not stored permanently unless explicitly required for compliance</li>
                  <li>Biometric data is processed securely and never shared with third parties without consent</li>
                  <li>You can withdraw consent for face verification anytime by contacting support</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Data Retention</h2>
              <div className="space-y-3">
                <p className="text-gray-700">We retain your information for as long as necessary to:</p>
                <ul className="list-disc ml-6 text-gray-700 space-y-2">
                  <li>Provide our services</li>
                  <li>Comply with legal and regulatory obligations</li>
                  <li>Resolve disputes and enforce agreements</li>
                  <li>Generally, active account data is retained while your account is active</li>
                  <li>After account deletion, data may be retained for legal compliance (typically 7 years)</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Cookies & Tracking Technologies</h2>
              <div className="space-y-3">
                <p className="text-gray-700">
                  We use cookies to:
                </p>
                <ul className="list-disc ml-6 text-gray-700 space-y-2">
                  <li>Remember your preferences and login information</li>
                  <li>Analyze platform usage and improve services</li>
                  <li>Display personalized content and advertisements</li>
                </ul>
                <p className="text-gray-700 mt-4">
                  You can control cookies through your browser settings or our preference center. Disabling cookies may affect 
                  platform functionality.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Third-Party Links</h2>
              <p className="text-gray-700">
                Our Platform may contain links to third-party websites. We are not responsible for their privacy practices. 
                We encourage you to review their privacy policies before providing personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Children's Privacy</h2>
              <p className="text-gray-700">
                KarigarConnect is not intended for children under 18 years old. We do not knowingly collect information from 
                minors. If we discover we have collected such information, we will delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Changes to This Privacy Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. 
                We will notify you of significant changes via email or prominent notice on our Platform. Your continued use 
                constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions about this Privacy Policy or our privacy practices, please contact us:
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-gray-700 space-y-2">
                <p><strong>KarigarConnect Privacy Team</strong></p>
                <p>📧 Email: <a href="mailto:privacy@kc.india@gmail.com" className="text-orange-600 hover:underline">kc.india@gmail.com</a></p>
                <p>📞 Phone: <a href="tel:+918605171209" className="text-orange-600 hover:underline">+91 8605171209</a></p>
                <p>📍 Address: Manjari Budruk, Hadapsar Road, Manjri, Wagholi, Maharashtra 412307, India</p>
              </div>
            </section>

            <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-blue-900 mb-3">Your Consent</h3>
              <p className="text-blue-800">
                By using KarigarConnect, you consent to our Privacy Policy and consent to our collection, use, and disclosure 
                of your personal information as described herein. If you do not agree with our privacy practices, please do not 
                use our Platform.
              </p>
            </section>
          </div>

          {/* Footer CTA */}
          {!isEmbedded && (
            <div className="mt-12 text-center">
              <Link to="/register" className="inline-block px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg transition-all">
                Ready to Join? Register Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
