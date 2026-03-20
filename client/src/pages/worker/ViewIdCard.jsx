// src/pages/worker/ViewIdCard.jsx
// FIXES:
//  1. user.address is { city, pincode, locality } — an object, not a string.
//     Rendering {user.address} directly caused "Objects are not valid as React child" crash.
//     FIX: Use user.address?.city everywhere. Show full address as string at bottom.
//
//  2. user.city is undefined — city lives inside user.address.city, not at top level.
//     The Location card was checking {user.city} which was always falsy → never rendered.
//     FIX: Changed to user.address?.city
//
//  3. Photo URL was built as `http://localhost:5000/${user.photo}` which breaks for
//     Cloudinary URLs (https://res.cloudinary.com/...) — prepending localhost made it 404.
//     FIX: If photo already starts with http/https, use it directly.

import React, { useRef, useState, useEffect } from "react";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import { BASE_URL } from "../../constants/config";

const ViewIdCard = () => {
  const [user, setUser] = useState(null);
  const idCardRef = useRef(null);

  const verifiedBadgeUrl = "https://cdn-icons-png.flaticon.com/512/8458/8458433.png";

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const localUser = JSON.parse(localStorage.getItem("user"));
      if (!localUser?.karigarId) {
        toast.error("User not found in localStorage");
        return;
      }

      const res = await fetch(
        `${BASE_URL}/api/worker/public/${localUser.karigarId}`
      );

      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch user data");
    }
  };

  const downloadPDF = async () => {
    if (!idCardRef.current) return;

    try {
      toast.loading("Generating PDF...");

      const canvas = await html2canvas(idCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: false,
        width: 700,
        height: 400,
        windowWidth: 700,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF("l", "mm", "a6");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const ratio =
        Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height) * 0.95;

      const finalWidth = canvas.width * ratio;
      const finalHeight = canvas.height * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);
      pdf.save(`Karigar_ID_${user.karigarId}.pdf`);

      toast.dismiss();
      toast.success("PDF Downloaded Successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.dismiss();
      toast.error("Failed to generate PDF");
    }
  };

  if (!user) return <p className="text-center mt-10">Loading...</p>;

  // FIX 3: If photo is already a full URL (Cloudinary), use it directly.
  // If it's a relative path (old local storage), prepend BASE_URL.
  const photoUrl =
    !user.photo
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ea580c&color=fff&bold=true&size=150`
      : user.photo.startsWith("http")
      ? user.photo
      : `${BASE_URL}/${user.photo.replace(/\\/g, "/")}`;

  const skills = user.skills?.map((s) => s.name) || [];
  const issueDate = new Date().toLocaleDateString("en-IN");
  const publicURL = `${window.location.origin}/profile/public/${user.karigarId}`;

  // FIX 1+2: address is a nested object — extract the parts we need as strings
  const city    = user.address?.city     || user.city     || "";
  const pincode = user.address?.pincode  || user.pincode  || "";
  const locality = user.address?.locality || user.locality || "";

  // Full address string for bottom of card (safe — just string concat)
  const fullAddress = [locality, city, pincode].filter(Boolean).join(", ");

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        padding: "2rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <button
        onClick={downloadPDF}
        style={{
          width: "100%",
          maxWidth: "350px",
          backgroundColor: "#ea580c",
          color: "white",
          padding: "0.875rem 1.5rem",
          borderRadius: "8px",
          fontWeight: "600",
          marginBottom: "2rem",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          boxShadow: "0 4px 12px rgba(234, 88, 12, 0.3)",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => { e.target.style.backgroundColor = "#c2410c"; }}
        onMouseOut={(e)  => { e.target.style.backgroundColor = "#ea580c"; }}
      >
        📥 Download ID Card
      </button>

      {/* ID CARD */}
      <div
        ref={idCardRef}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          border: "2px solid #ea580c",
          overflow: "hidden",
          width: "700px",
          height: "400px",
          display: "flex",
          position: "relative",
        }}
      >
        {/* ── Left orange section ── */}
        <div
          style={{
            width: "38%",
            backgroundColor: "#ea580c",
            padding: "1.5rem",
            color: "white",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", margin: "0 0 0.25rem 0", textAlign: "center" }}>
              KARIGAR
            </h1>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "600", margin: "0 0 1rem 0", textAlign: "center", opacity: 0.9 }}>
              CONNECT
            </h2>
            <div
              style={{
                backgroundColor: "white",
                color: "#ea580c",
                padding: "0.4rem 0.75rem",
                borderRadius: "20px",
                fontSize: "0.7rem",
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "1.5rem",
              }}
            >
              IDENTITY CARD
            </div>
          </div>

          {/* QR Code */}
          <div
            style={{
              backgroundColor: "white",
              padding: "0.75rem",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <QRCode value={publicURL} size={100} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
            <p style={{ fontSize: "0.65rem", color: "#ea580c", fontWeight: "700", margin: 0, textAlign: "center" }}>
              SCAN TO VERIFY
            </p>
          </div>

          <p style={{ fontSize: "0.7rem", color: "#fed7aa", textAlign: "center", margin: "0.5rem 0", fontWeight: "500" }}>
            Issued: {issueDate}
          </p>
        </div>

        {/* ── Right white section ── */}
        <div style={{ width: "62%", padding: "1.5rem", display: "flex", flexDirection: "column" }}>

          {/* Verified badge */}
          <div style={{ position: "absolute", top: "15px", right: "15px", width: "50px", height: "50px", zIndex: 10 }}>
            <img src={verifiedBadgeUrl} alt="Verified" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>

          {/* Profile row */}
          <div style={{ display: "flex", gap: "1.25rem", marginBottom: "1.25rem", alignItems: "center" }}>
            <div
              style={{
                width: "90px", height: "90px", borderRadius: "50%",
                border: "3px solid #ea580c", overflow: "hidden",
                backgroundColor: "#fef7ed", flexShrink: 0,
              }}
            >
              <img
                src={photoUrl}
                alt="Profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                crossOrigin="anonymous"
              />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1f2937", margin: "0 0 0.5rem 0", borderBottom: "2px solid #ea580c", paddingBottom: "0.25rem" }}>
                {user.name}
              </h3>
              <div
                style={{
                  display: "inline-block", backgroundColor: "#ea580c", color: "white",
                  padding: "0.25rem 0.75rem", borderRadius: "15px",
                  fontSize: "0.75rem", fontWeight: "600",
                }}
              >
                ID: {user.karigarId}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>

            {user.mobile && (
              <div>
                <p style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: "600", margin: "0 0 0.25rem 0", textTransform: "uppercase" }}>Mobile</p>
                <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1f2937", margin: 0 }}>{user.mobile}</p>
              </div>
            )}

            {user.gender && (
              <div>
                <p style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: "600", margin: "0 0 0.25rem 0", textTransform: "uppercase" }}>Gender</p>
                <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1f2937", margin: 0 }}>{user.gender}</p>
              </div>
            )}

            {user.overallExperience && (
              <div>
                <p style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: "600", margin: "0 0 0.25rem 0", textTransform: "uppercase" }}>Experience</p>
                <p style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#ea580c", margin: 0 }}>{user.overallExperience}</p>
              </div>
            )}

            {/* FIX 2: was {user.city} — city lives inside address object */}
            {city && (
              <div>
                <p style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: "600", margin: "0 0 0.25rem 0", textTransform: "uppercase" }}>Location</p>
                <p style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1f2937", margin: 0 }}>{city}</p>
              </div>
            )}
          </div>

          {/* Skills */}
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: "600", color: "#374151", margin: "0 0 0.5rem 0", textTransform: "uppercase" }}>Skills</p>
            {skills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {skills.slice(0, 3).map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: "0.65rem", backgroundColor: "#fed7aa", color: "#c2410c",
                      padding: "0.3rem 0.6rem", borderRadius: "12px",
                      fontWeight: "500", border: "1px solid #fdba74",
                    }}
                  >
                    {skill}
                  </span>
                ))}
                {skills.length > 3 && (
                  <span style={{ fontSize: "0.65rem", backgroundColor: "#f3f4f6", color: "#6b7280", padding: "0.3rem 0.6rem", borderRadius: "12px", fontWeight: "500" }}>
                    +{skills.length - 3} more
                  </span>
                )}
              </div>
            ) : (
              <p style={{ fontSize: "0.7rem", color: "#9ca3af", fontStyle: "italic", margin: 0 }}>No skills added</p>
            )}
          </div>

          {/* FIX 1: was {user.address} which is an object → crash.
              Now renders fullAddress which is a plain string. */}
          {fullAddress && (
            <div style={{ marginTop: "auto", paddingTop: "0.5rem", borderTop: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: "0.65rem", color: "#6b7280", margin: 0, fontWeight: "500" }}>
                <strong>Address:</strong> {fullAddress}
              </p>
            </div>
          )}
        </div>
      </div>

      <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "#6b7280", textAlign: "center", maxWidth: "500px" }}>
        Professional ID Card — Optimized for printing and verification
      </p>
    </div>
  );
};

export default ViewIdCard;