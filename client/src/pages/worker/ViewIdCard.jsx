// src/pages/worker/ViewIdCard.jsx
// FULLY RESPONSIVE ID CARD - Fixed missing imports

import React, { useRef, useState, useEffect } from "react";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { BASE_URL } from "../../constants/config";
import * as api from "../../api";
import {
  Download, Share2, QrCode, CheckCircle, Award,
  MapPin, Phone, User, Briefcase, Star, TrendingUp,
  Shield, Calendar, Copy, ExternalLink, Loader2,
  Sparkles, Crown, Heart, Eye, ChevronDown, ChevronUp,
  Smartphone,  // ✅ Added missing Smartphone import
  AlertCircle  // ✅ Added missing AlertCircle import
} from 'lucide-react';

const ViewIdCard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [cardOrientation, setCardOrientation] = useState('horizontal');
  const idCardRef = useRef(null);

  const verifiedBadgeUrl = "https://cdn-icons-png.flaticon.com/512/8458/8458433.png";

  useEffect(() => {
    fetchUserData();
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const checkScreenSize = () => {
    setCardOrientation(window.innerWidth < 640 ? 'vertical' : 'horizontal');
  };

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const localUser = JSON.parse(localStorage.getItem("user"));
      if (!localUser?.karigarId) {
        toast.error("User not found");
        setLoading(false);
        return;
      }

      const { data } = await api.getPublicWorkerProfile(localUser.karigarId);
      setUser(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch user data");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!idCardRef.current) return;

    setDownloading(true);
    const toastId = toast.loading("Generating PDF...");

    try {
      const canvas = await html2canvas(idCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: false,
        width: cardOrientation === 'horizontal' ? 700 : 350,
        height: cardOrientation === 'horizontal' ? 400 : 500,
        windowWidth: cardOrientation === 'horizontal' ? 700 : 350,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF(cardOrientation === 'horizontal' ? "l" : "p", "mm", cardOrientation === 'horizontal' ? "a6" : "a7");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height) * 0.95;

      const finalWidth = canvas.width * ratio;
      const finalHeight = canvas.height * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);
      pdf.save(`Karigar_ID_${user.karigarId}.pdf`);

      toast.dismiss(toastId);
      toast.success("PDF Downloaded Successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.dismiss(toastId);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const copyPublicLink = () => {
    const publicURL = `${window.location.origin}/profile/public/${user?.karigarId}`;
    navigator.clipboard.writeText(publicURL);
    toast.success("Profile link copied!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"
          />
          <p className="text-gray-600 mt-4 text-sm">Loading your ID card...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl p-8 shadow-lg max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">User Not Found</h3>
          <p className="text-gray-500 text-sm">Could not load user data. Please try again.</p>
        </div>
      </div>
    );
  }

  const photoUrl =
    !user.photo
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ea580c&color=fff&bold=true&size=150`
      : user.photo.startsWith("http")
      ? user.photo
      : `${BASE_URL}/${user.photo.replace(/\\/g, "/")}`;

  const skills = user.skills?.map((s) => s.name || s) || [];
  const issueDate = new Date().toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' });
  const publicURL = `${window.location.origin}/profile/public/${user.karigarId}`;

  const city = user.address?.city || user.city || "";
  const pincode = user.address?.pincode || user.pincode || "";
  const locality = user.address?.locality || user.locality || "";
  const fullAddress = [locality, city, pincode].filter(Boolean).join(", ");

  const stats = [
    { label: "Jobs", value: user.completedJobs || 0, icon: Briefcase, color: "text-blue-600" },
    { label: "Rating", value: user.avgStars?.toFixed(1) || "4.5", icon: Star, color: "text-yellow-600" },
    { label: "Points", value: user.points || 0, icon: TrendingUp, color: "text-green-600" },
  ];

  // Mobile-friendly ID Card (Vertical)
  const MobileIdCard = () => (
    <div className="bg-white rounded-2xl shadow-2xl border-2 border-orange-500 overflow-hidden max-w-sm w-full mx-auto">
      {/* Orange Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-center relative">
        <div className="absolute top-2 right-2 w-10 h-10">
          <img src={verifiedBadgeUrl} alt="Verified" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-black text-white">KARIGAR</h1>
        <h2 className="text-sm font-semibold text-orange-100">CONNECT</h2>
        <div className="inline-block bg-white text-orange-600 px-3 py-1 rounded-full text-xs font-bold mt-2">
          IDENTITY CARD
        </div>
      </div>

      {/* Profile Section */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full border-3 border-orange-500 overflow-hidden bg-orange-50 shadow-md flex-shrink-0">
            <img
              src={photoUrl}
              alt="Profile"
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-gray-900">{user.name}</h3>
            <div className="inline-block bg-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">
              ID: {user.karigarId}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center bg-gray-50 rounded-xl p-2">
              <stat.icon size={14} className={`${stat.color} mx-auto mb-1`} />
              <p className="text-xs font-black text-gray-800">{stat.value}</p>
              <p className="text-[9px] text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Details Grid */}
        <div className="space-y-2 mb-4">
          {user.mobile && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-orange-500" />
              <span className="text-gray-700">{user.mobile}</span>
            </div>
          )}
          {user.gender && (
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-orange-500" />
              <span className="text-gray-700 capitalize">{user.gender}</span>
            </div>
          )}
          {user.overallExperience && (
            <div className="flex items-center gap-2 text-sm">
              <Award size={14} className="text-orange-500" />
              <span className="text-gray-700">{user.overallExperience}</span>
            </div>
          )}
          {city && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-orange-500" />
              <span className="text-gray-700">{city}</span>
            </div>
          )}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.slice(0, 4).map((skill, idx) => (
                <span key={idx} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">
                  {skill}
                </span>
              ))}
              {skills.length > 4 && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">
                  +{skills.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3 flex items-center justify-between gap-3 mb-3">
          <div className="flex-1">
            <p className="text-[10px] text-gray-500 mb-1">Scan to verify identity</p>
            <p className="text-[9px] text-orange-600 font-mono truncate">{publicURL}</p>
          </div>
          <div className="bg-white p-1.5 rounded-lg">
            <QRCode value={publicURL} size={45} />
          </div>
        </div>

        {/* Address */}
        {fullAddress && (
          <p className="text-[10px] text-gray-500 border-t border-gray-100 pt-3 mt-2">
            <span className="font-bold">Address:</span> {fullAddress}
          </p>
        )}

        {/* Issue Date */}
        <p className="text-[8px] text-gray-400 text-center mt-3">
          Issued: {issueDate}
        </p>
      </div>
    </div>
  );

  // Desktop ID Card (Horizontal)
  const DesktopIdCard = () => (
    <div
      ref={idCardRef}
      className="bg-white rounded-xl shadow-2xl border-2 border-orange-500 overflow-hidden"
      style={{
        width: "700px",
        height: "400px",
        position: "relative",
      }}
    >
      {/* Left orange section */}
      <div className="absolute left-0 top-0 bottom-0 w-[38%] bg-gradient-to-br from-orange-500 to-amber-500 text-white p-6 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl font-black text-center tracking-tight">KARIGAR</h1>
          <h2 className="text-sm font-semibold text-center opacity-90 mb-3">CONNECT</h2>
          <div className="bg-white text-orange-600 px-3 py-1 rounded-full text-[10px] font-bold text-center mb-4 inline-block w-full">
            IDENTITY CARD
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl flex flex-col items-center gap-2">
          <QRCode value={publicURL} size={90} style={{ width: "90px", height: "90px" }} />
          <p className="text-[10px] text-orange-600 font-bold text-center">SCAN TO VERIFY</p>
        </div>

        <p className="text-[10px] text-orange-200 text-center mt-2">
          Issued: {issueDate}
        </p>
      </div>

      {/* Right white section */}
      <div className="absolute left-[38%] right-0 top-0 bottom-0 bg-white p-6 flex flex-col">
        <div className="absolute top-3 right-3 w-10 h-10 z-10">
          <img src={verifiedBadgeUrl} alt="Verified" className="w-full h-full object-contain" />
        </div>

        <div className="flex gap-4 mb-4">
          <div className="w-20 h-20 rounded-full border-3 border-orange-500 overflow-hidden bg-orange-50 flex-shrink-0 shadow-md">
            <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-gray-900">{user.name}</h3>
            <div className="inline-block bg-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">
              ID: {user.karigarId}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          {user.mobile && (
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Mobile</p>
              <p className="text-xs font-semibold text-gray-800">{user.mobile}</p>
            </div>
          )}
          {user.gender && (
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Gender</p>
              <p className="text-xs font-semibold text-gray-800 capitalize">{user.gender}</p>
            </div>
          )}
          {user.overallExperience && (
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Experience</p>
              <p className="text-xs font-bold text-orange-600">{user.overallExperience}</p>
            </div>
          )}
          {city && (
            <div>
              <p className="text-[9px] text-gray-400 font-bold uppercase">Location</p>
              <p className="text-xs font-semibold text-gray-800">{city}</p>
            </div>
          )}
        </div>

        <div className="mb-2">
          <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Skills</p>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {skills.slice(0, 3).map((skill, idx) => (
                <span key={idx} className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                  {skill}
                </span>
              ))}
              {skills.length > 3 && (
                <span className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                  +{skills.length - 3}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[9px] text-gray-400 italic">No skills added</p>
          )}
        </div>

        {fullAddress && (
          <div className="mt-auto pt-2 border-t border-gray-100">
            <p className="text-[8px] text-gray-400 truncate">
              <span className="font-bold">Address:</span> {fullAddress}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Digital ID Card
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Your official KarigarConnect identification
          </p>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={downloadPDF}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {downloading ? "Generating..." : "Download PDF"}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={copyPublicLink}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-all"
          >
            <Share2 size={18} />
            Share Profile
          </motion.button>
        </div>

        {/* ID Card Display */}
        <div className="flex justify-center mb-6 overflow-x-auto py-4">
          {cardOrientation === 'horizontal' ? <DesktopIdCard /> : <MobileIdCard />}
        </div>

        {/* Mobile Orientation Note */}
        {cardOrientation === 'vertical' && (
          <div className="text-center mb-4">
            <p className="text-[10px] text-gray-400 bg-white rounded-full px-3 py-1 inline-flex items-center gap-1">
              <Smartphone size={10} />
              Mobile optimized card
            </p>
          </div>
        )}

        {/* Stats Preview - Mobile */}
        <div className="sm:hidden grid grid-cols-3 gap-3 mb-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <stat.icon size={16} className={`${stat.color} mx-auto mb-1`} />
              <p className="text-sm font-black text-gray-800">{stat.value}</p>
              <p className="text-[9px] text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Additional Info - Mobile Expandable */}
        <div className="sm:hidden mt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200"
          >
            <span className="text-sm font-semibold text-gray-700">More Information</span>
            {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-3 overflow-hidden"
              >
                {user.education && (
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Education</p>
                    <p className="text-sm text-gray-800">{user.education}</p>
                  </div>
                )}
                {user.experience && (
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Experience</p>
                    <p className="text-sm text-gray-800">{user.experience} years</p>
                  </div>
                )}
                {fullAddress && (
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Full Address</p>
                    <p className="text-sm text-gray-800">{fullAddress}</p>
                  </div>
                )}
                {skills.length > 4 && (
                  <div className="bg-white rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">All Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill, idx) => (
                        <span key={idx} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-gray-400">
            <Sparkles size={10} className="inline mr-1" />
            Official KarigarConnect Identity Card — Valid for verification
          </p>
          <div className="flex items-center justify-center gap-3 mt-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1">
              <Shield size={8} /> Verified
            </span>
            <span className="flex items-center gap-1">
              <QrCode size={8} /> Scan to Verify
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle size={8} /> Official
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewIdCard;