// src/pages/worker/ViewIdCard.jsx
// KarigarConnect — Professional ID Card (White + Orange Theme)
// Clean layout: NO overlapping elements. QR is isolated in its own column.
// Print dimensions: A6 landscape (148mm × 105mm) at 300 DPI
// Dependencies: react-qr-code, html2canvas, jspdf, react-hot-toast

import React, { useRef, useState, useEffect, useMemo } from "react";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import * as api from "../../api";

// ─── Google Font loader ────────────────────────────────────────────────────────
const loadFonts = () => {
  if (document.getElementById("kc-fonts")) return;
  const link = document.createElement("link");
  link.id = "kc-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800;900&display=swap";
  document.head.appendChild(link);
};

// ─── Fake barcode (deterministic from ID string) ──────────────────────────────
const FakeBarcode = ({ value = "", width = 180, height = 30 }) => {
  const bars = useMemo(() => {
    const seed = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rng = (n) => {
      const x = Math.sin(seed * n + n) * 10000;
      return x - Math.floor(x);
    };
    const result = [];
    let x = 0;
    let i = 0;
    while (x < width) {
      const w = Math.max(1, Math.floor(rng(i + 1) * 4));
      if (i % 3 !== 2) result.push({ x, w });
      x += w;
      i++;
    }
    return result;
  }, [value, width]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#222" />
      ))}
    </svg>
  );
};

// ─── Inline styles (plain objects, no styled-components needed) ───────────────
const S = {
  // Page wrapper
  page: {
    minHeight: "100vh",
    background: "#F3F4F6",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "40px 16px 60px",
    fontFamily: "'Barlow', sans-serif",
  },

  // Page title area
  pageTitle: {
    textAlign: "center",
    marginBottom: 32,
  },
  pageTitleH1: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 6,
    color: "#E85D04",
    margin: 0,
    textTransform: "uppercase",
  },
  pageTitleSub: {
    fontSize: 12,
    color: "#9CA3AF",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 4,
  },

  // ── FRONT CARD ──────────────────────────────────────────────────────────────
  cardOuter: {
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    width: 760,
    boxShadow:
      "0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
    position: "relative",
    marginBottom: 20,
  },

  // Orange header
  header: {
    background: "linear-gradient(105deg, #C84B00 0%, #E85D04 40%, #F48C06 75%, #FAA307 100%)",
    padding: "20px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    minHeight: 90,
  },
  headerBg: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 12px)",
    pointerEvents: "none",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    zIndex: 1,
  },
  logoCircle: {
    width: 48,
    height: 48,
    background: "rgba(255,255,255,0.2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px solid rgba(255,255,255,0.4)",
    flexShrink: 0,
  },
  orgBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  orgName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 28,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: 3,
    lineHeight: 1,
    textTransform: "uppercase",
  },
  orgTagline: {
    fontSize: 10,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    fontWeight: 500,
  },
  headerRight: {
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  idTypeBadge: {
    background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.45)",
    borderRadius: 6,
    padding: "5px 14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  idTypeBadgeLabel: {
    fontSize: 8,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  idTypeBadgeValue: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: 1,
    fontFamily: "'Barlow Condensed', sans-serif",
  },

  // Body of front card
  body: {
    padding: "24px 28px 0 28px",
    display: "flex",
    gap: 28,
  },

  // LEFT: Photo column
  photoCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    width: 120,
  },
  photoFrame: {
    width: 112,
    height: 136,
    borderRadius: 10,
    border: "3px solid #E85D04",
    overflow: "hidden",
    background: "#FFF3E0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 4px 16px rgba(232,93,4,0.18)",
  },
  photoInitials: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 44,
    fontWeight: 900,
    color: "#E85D04",
    lineHeight: 1,
  },
  verifyBadge: (passed) => ({
    background: passed ? "#DCFCE7" : "#FFF3E0",
    border: `1px solid ${passed ? "#86EFAC" : "#FECBA1"}`,
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 9,
    fontWeight: 700,
    color: passed ? "#15803D" : "#C2410C",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    whiteSpace: "nowrap",
  }),
  emblemBox: {
    marginTop: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  emblemLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // CENTER: Main info column
  infoCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 0,
    minWidth: 0,
  },
  workerName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 36,
    fontWeight: 900,
    color: "#111827",
    letterSpacing: 1,
    lineHeight: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  workerRole: {
    fontSize: 11,
    fontWeight: 700,
    color: "#E85D04",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  divider: {
    height: 1,
    background:
      "linear-gradient(90deg, #E85D04 0%, #FAA307 50%, transparent 100%)",
    opacity: 0.3,
    marginBottom: 14,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px 20px",
    marginBottom: 16,
  },
  infoCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  infoLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: 500,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "#111827",
    letterSpacing: 0.3,
  },
  infoValueOrange: {
    fontSize: 14,
    fontWeight: 700,
    color: "#E85D04",
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: 2,
  },
  skillsSection: {
    marginTop: "auto",
    paddingTop: 14,
    borderTop: "1px solid #F3F4F6",
  },
  skillsLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  skillPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },
  pill: (primary) => ({
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    padding: "4px 11px",
    borderRadius: 4,
    background: primary ? "#1F2937" : "#FFF3E0",
    color: primary ? "#FAA307" : "#C2410C",
    border: `1px solid ${primary ? "#374151" : "#FECBA1"}`,
  }),

  // RIGHT: QR column
  qrCol: {
    flexShrink: 0,
    width: 110,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  qrBox: {
    background: "#fff",
    border: "1.5px solid #E5E7EB",
    borderRadius: 10,
    padding: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  qrLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    fontWeight: 600,
  },
  expSection: {
    marginTop: 8,
    background: "#FFF3E0",
    border: "1px solid #FECBA1",
    borderRadius: 8,
    padding: "8px 12px",
    textAlign: "center",
    width: "100%",
  },
  expLabel: {
    fontSize: 8,
    color: "#92400E",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  expValue: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 15,
    fontWeight: 800,
    color: "#E85D04",
    letterSpacing: 1,
  },

  // Footer of front card
  cardFooter: {
    marginTop: 20,
    background: "#111827",
    padding: "10px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  footerAddress: {
    fontSize: 10,
    color: "#9CA3AF",
    letterSpacing: 0.3,
  },
  footerUrl: {
    fontSize: 9,
    color: "#6B7280",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  footerCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  footerRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  footerIssued: {
    fontSize: 9,
    color: "#6B7280",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  footerIdBig: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 16,
    fontWeight: 800,
    color: "#FAA307",
    letterSpacing: 3,
  },

  // Holographic strip
  holoStrip: {
    height: 4,
    background:
      "linear-gradient(90deg, #3B82F6, #8B5CF6, #E85D04, #F59E0B, #10B981, #3B82F6)",
  },

  // ── BACK CARD ───────────────────────────────────────────────────────────────
  backCard: {
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    width: 760,
    boxShadow:
      "0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
    marginBottom: 32,
  },
  backStripe: {
    height: 48,
    background: "#111827",
  },
  backBody: {
    padding: "20px 28px 0 28px",
    display: "flex",
    gap: 28,
  },
  backLeft: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  sigBox: {
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    padding: "12px 16px",
    minHeight: 64,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  sigLine: {
    height: 1,
    background: "#D1D5DB",
    marginBottom: 6,
  },
  sigLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  termsBox: {
    background: "#F9FAFB",
    borderRadius: 8,
    padding: "12px 14px",
    border: "1px solid #F3F4F6",
  },
  termsText: {
    fontSize: 10,
    color: "#6B7280",
    lineHeight: 1.7,
    letterSpacing: 0.2,
  },
  barcodeSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    paddingBottom: 8,
  },
  barcodeId: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    color: "#6B7280",
    letterSpacing: 3,
    fontWeight: 700,
  },
  backRight: {
    flexShrink: 0,
    width: 140,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  backQrBox: {
    background: "#fff",
    border: "1.5px solid #E5E7EB",
    borderRadius: 10,
    padding: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  backQrId: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 17,
    fontWeight: 800,
    color: "#E85D04",
    letterSpacing: 2,
    textAlign: "center",
  },
  backQrLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  backFooter: {
    marginTop: 20,
    background: "linear-gradient(105deg, #C84B00, #E85D04 50%, #FAA307)",
    padding: "10px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backFooterText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: 500,
  },

  // Download button
  downloadBtn: {
    padding: "14px 48px",
    background: "linear-gradient(105deg, #C84B00, #E85D04 50%, #F48C06)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 4,
    textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 8px 28px rgba(232,93,4,0.35)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  printNote: {
    marginTop: 10,
    fontSize: 11,
    color: "#9CA3AF",
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // Loading / error screens
  centered: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F3F4F6",
    fontFamily: "'Barlow', sans-serif",
  },
};

// ─── Logo SVG (handshake simplified) ─────────────────────────────────────────
const HandshakeLogo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
    <path
      d="M5 18 C8 14, 12 12, 16 14 L20 16.5 C22.5 17.5, 24 16, 23 14"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M7 20.5 L11 16.5"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M23 14 L25.5 17.5"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="7" cy="21" r="1.5" fill="rgba(255,255,255,0.6)" />
    <circle cx="25" cy="18" r="1.5" fill="rgba(255,255,255,0.6)" />
  </svg>
);

// ─── Emblem / seal ────────────────────────────────────────────────────────────
const Emblem = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
    <circle cx="22" cy="22" r="20" stroke="#E85D04" strokeWidth="1.2" strokeDasharray="3 2" />
    <circle cx="22" cy="22" r="15" stroke="#E85D04" strokeWidth="0.7" opacity="0.5" />
    <circle cx="22" cy="22" r="10" fill="rgba(232,93,4,0.08)" stroke="#E85D04" strokeWidth="0.7" />
    {Array.from({ length: 12 }).map((_, i) => {
      const angle = (i * 360) / 12;
      const rad = (angle * Math.PI) / 180;
      const x1 = 22 + 17 * Math.cos(rad);
      const y1 = 22 + 17 * Math.sin(rad);
      const x2 = 22 + 19.5 * Math.cos(rad);
      const y2 = 22 + 19.5 * Math.sin(rad);
      return (
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#E85D04"
          strokeWidth="1.5"
          opacity="0.7"
        />
      );
    })}
    <text
      x="22" y="19"
      textAnchor="middle"
      fill="#E85D04"
      fontSize="8"
      fontWeight="bold"
      fontFamily="'Barlow Condensed', sans-serif"
      letterSpacing="1"
    >
      KC
    </text>
    <text
      x="22" y="27"
      textAnchor="middle"
      fill="#E85D04"
      fontSize="4.5"
      fontFamily="'Barlow', sans-serif"
      letterSpacing="1.5"
      opacity="0.8"
    >
      VERIFIED
    </text>
  </svg>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const ViewIdCard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoError, setPhotoError] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const frontRef = useRef(null);
  const backRef = useRef(null);

  useEffect(() => {
    loadFonts();
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const local = JSON.parse(localStorage.getItem("user") || "{}");
      const id = local?.karigarId || local?._id || local?.id;
      if (!id) { toast.error("User not found"); return; }
      const { data } = await api.getPublicWorkerProfile(id);
      setUser(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const getPhotoUrl = () => {
    if (photoError || !user?.photo) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user?.name || "Worker"
      )}&background=FFF3E0&color=E85D04&bold=true&size=200&format=png`;
    }
    if (user.photo.startsWith("http")) return user.photo;
    const BASE = import.meta.env.VITE_API_URL || "http://192.168.0.101:5000";
    return `${BASE}/${user.photo.replace(/\\/g, "/")}`;
  };

  const downloadPDF = async () => {
    if (!frontRef.current || !backRef.current) return;
    const toastId = toast.loading("Generating PDF…");
    try {
      const opts = { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false };

      const canvasFront = await html2canvas(frontRef.current, opts);
      const canvasBack = await html2canvas(backRef.current, opts);

      const pdf = new jsPDF("l", "mm", [148, 105]);
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();

      const addPage = (canvas, addNew = false) => {
        if (addNew) pdf.addPage([148, 105], "l");
        const ratio = Math.min(pw / canvas.width, ph / canvas.height);
        const x = (pw - canvas.width * ratio) / 2;
        const y = (ph - canvas.height * ratio) / 2;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", x, y, canvas.width * ratio, canvas.height * ratio);
      };

      addPage(canvasFront);
      addPage(canvasBack, true);

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KarigarConnect_ID_${user.karigarId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      toast.success("PDF Downloaded!", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Download failed", { id: toastId });
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.centered}>
      <div style={{ textAlign: "center", color: "#E85D04" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{
          width: 44, height: 44,
          border: "3px solid #FDE8CC",
          borderTopColor: "#E85D04",
          borderRadius: "50%",
          animation: "spin 0.9s linear infinite",
          margin: "0 auto 12px",
        }} />
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#9CA3AF", letterSpacing: 2 }}>
          Loading Profile…
        </p>
      </div>
    </div>
  );

  if (!user) return (
    <div style={S.centered}>
      <p style={{ color: "#EF4444", fontSize: 16 }}>Failed to load profile.</p>
    </div>
  );

  // ── Derived data ───────────────────────────────────────────────────────────
  const city     = user.address?.city     || user.city     || "";
  const pincode  = user.address?.pincode  || user.pincode  || "";
  const locality = user.address?.locality || user.locality || "";
  const fullAddr = [locality, city, pincode].filter(Boolean).join(", ");
  const skills   = (user.skills || []).map((s) => s.name || s).filter(Boolean);
  const publicURL = `${window.location.origin}/profile/public/${user.karigarId}`;
  const issueDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const expYear  = new Date().getFullYear() + 3;
  const fvPassed = user.faceVerificationStatus === "passed";
  const initials = (user.name || "KC")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={S.page}>
      {/* ── Page title ── */}
      <div style={S.pageTitle}>
        <h1 style={S.pageTitleH1}>KarigarConnect</h1>
        <p style={S.pageTitleSub}>Official Identity Card</p>
      </div>

      {/* ══════════════════════════════════════════════
          FRONT CARD
      ══════════════════════════════════════════════ */}
      <div ref={frontRef} style={S.cardOuter}>

        {/* Orange header */}
        <div style={S.header}>
          <div style={S.headerBg} />
          <div style={S.headerLeft}>
            <div style={S.logoCircle}>
              <HandshakeLogo size={28} />
            </div>
            <div style={S.orgBlock}>
              <div style={S.orgName}>KarigarConnect</div>
              <div style={S.orgTagline}>Bridging Skills with Community</div>
            </div>
          </div>
          <div style={S.headerRight}>
            <div style={S.idTypeBadge}>
              <div style={S.idTypeBadgeLabel}>Document Type</div>
              <div style={S.idTypeBadgeValue}>WORKER ID</div>
            </div>
          </div>
        </div>

        {/* ── Body: 3 columns [Photo | Info | QR] ── */}
        <div style={S.body}>

          {/* Column 1 — Photo */}
          <div style={S.photoCol}>
            <div style={S.photoFrame}>
              <img
                src={getPhotoUrl()}
                alt={user.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                crossOrigin="anonymous"
                onError={() => setPhotoError(true)}
              />
            </div>
            <div style={S.verifyBadge(fvPassed)}>
              {fvPassed
                ? "✓ Face Verified"
                : user.verificationStatus === "approved"
                ? "✓ Approved"
                : "⏳ Pending"}
            </div>
            <div style={S.emblemBox}>
              <Emblem size={44} />
              <div style={S.emblemLabel}>Platform Seal</div>
            </div>
          </div>

          {/* Column 2 — Worker info */}
          <div style={S.infoCol}>
            <div style={S.workerName}>{user.name}</div>
            <div style={S.workerRole}>Karigar · Skilled Worker</div>
            <div style={S.divider} />

            {/* Info grid — 3 cols × 2 rows */}
            <div style={S.infoGrid}>
              <div style={S.infoCell}>
                <div style={S.infoLabel}>ID Number</div>
                <div style={S.infoValueOrange}>{user.karigarId}</div>
              </div>
              <div style={S.infoCell}>
                <div style={S.infoLabel}>Mobile</div>
                <div style={S.infoValue}>{user.mobile || "—"}</div>
              </div>
              <div style={S.infoCell}>
                <div style={S.infoLabel}>Gender</div>
                <div style={S.infoValue}>{user.gender || "—"}</div>
              </div>
              <div style={S.infoCell}>
                <div style={S.infoLabel}>City</div>
                <div style={S.infoValue}>{city || "—"}</div>
              </div>
              <div style={S.infoCell}>
                <div style={S.infoLabel}>Experience</div>
                <div style={S.infoValue}>
                  {user.experience ? `${user.experience} Years` : "—"}
                  {user.overallExperience ? ` · ${user.overallExperience}` : ""}
                </div>
              </div>
              <div style={S.infoCell}>
                <div style={S.infoLabel}>Valid Until</div>
                <div style={S.infoValue}>Dec {expYear}</div>
              </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div style={S.skillsSection}>
                <div style={S.skillsLabel}>Skills</div>
                <div style={S.skillPills}>
                  {skills.slice(0, 6).map((sk, i) => (
                    <span key={i} style={S.pill(i < 3)}>
                      {sk}
                    </span>
                  ))}
                  {skills.length > 6 && (
                    <span style={S.pill(false)}>+{skills.length - 6}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Column 3 — QR code (completely isolated, no overlap) */}
          <div style={S.qrCol}>
            <div style={{ fontSize: 9, color: "#9CA3AF", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, textAlign: "center" }}>
              Scan to Verify
            </div>
            <div style={S.qrBox}>
              <QRCode value={publicURL} size={86} />
            </div>
            <div style={{ fontSize: 8, color: "#9CA3AF", letterSpacing: 1, textAlign: "center", lineHeight: 1.5 }}>
              karigarconnect.in
            </div>

            {/* Validity block */}
            <div style={S.expSection}>
              <div style={S.expLabel}>Issue Date</div>
              <div style={{ ...S.expValue, fontSize: 12 }}>{issueDate}</div>
              <div style={{ ...S.expLabel, marginTop: 6 }}>Expires</div>
              <div style={S.expValue}>Dec {expYear}</div>
            </div>
          </div>
        </div>

        {/* Holographic strip */}
        <div style={{ ...S.holoStrip, marginTop: 20 }} />

        {/* Dark footer bar */}
        <div style={S.cardFooter}>
          <div style={S.footerLeft}>
            {fullAddr && (
              <div style={S.footerAddress}>{fullAddr}</div>
            )}
            <div style={S.footerUrl}>www.karigarconnect.in</div>
          </div>
          <div style={S.footerCenter}>
            <FakeBarcode value={user.karigarId} width={160} height={22} />
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: "#6B7280", letterSpacing: 3, marginTop: 2 }}>
              {user.karigarId}
            </div>
          </div>
          <div style={S.footerRight}>
            <div style={S.footerIssued}>Issued: {issueDate}</div>
            <div style={S.footerIdBig}>{user.karigarId}</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          BACK CARD
      ══════════════════════════════════════════════ */}
      <div ref={backRef} style={S.backCard}>

        {/* Black magnetic stripe */}
        <div style={S.backStripe} />

        {/* Body: left info + right QR */}
        <div style={S.backBody}>

          {/* Left section */}
          <div style={S.backLeft}>

            {/* Signature box */}
            <div style={S.sigBox}>
              <div style={S.sigLine} />
              <div style={S.sigLabel}>Authorized Signature / Worker Signature</div>
            </div>

            {/* Terms */}
            <div style={S.termsBox}>
              <div style={{ ...S.infoLabel, marginBottom: 6 }}>Terms & Conditions</div>
              <div style={S.termsText}>
                This card is the property of KarigarConnect. If found, please
                return to the nearest KarigarConnect office or contact our
                helpline. Misuse of this card is a punishable offense under
                applicable law. This card is valid only with the holographic seal
                visible. Employment is temporary and subject to assignment
                availability.
              </div>
            </div>

            {/* Barcode */}
            <div style={S.barcodeSection}>
              <div style={{ ...S.infoLabel, marginBottom: 4 }}>Scan Barcode</div>
              <FakeBarcode value={user.karigarId} width={200} height={32} />
              <div style={S.barcodeId}>{user.karigarId}-W</div>
            </div>
          </div>

          {/* Right section — QR isolated */}
          <div style={S.backRight}>
            <div style={{ ...S.backQrLabel, marginBottom: 4 }}>Profile QR</div>
            <div style={S.backQrBox}>
              <QRCode value={publicURL} size={116} />
            </div>
            <div style={S.backQrId}>{user.karigarId}</div>
            <div style={S.backQrLabel}>karigarconnect.in/profile</div>

            {/* Worker category pill */}
            <div style={{
              marginTop: 8,
              background: "#FFF3E0",
              border: "1px solid #FECBA1",
              borderRadius: 6,
              padding: "6px 12px",
              textAlign: "center",
              width: "100%",
            }}>
              <div style={{ fontSize: 8, color: "#92400E", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>Category</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: "#E85D04", letterSpacing: 1 }}>
                {user.overallExperience || "SKILLED WORKER"}
              </div>
            </div>
          </div>
        </div>

        {/* Orange footer */}
        <div style={S.backFooter}>
          <div style={S.backFooterText}>Employment · Temporary Services · Skilled Workers</div>
          <div style={S.backFooterText}>© {new Date().getFullYear()} KarigarConnect</div>
        </div>
      </div>

      {/* ── Download button ── */}
      <button
        onClick={downloadPDF}
        style={{
          ...S.downloadBtn,
          transform: btnHover ? "translateY(-2px)" : "translateY(0)",
          boxShadow: btnHover
            ? "0 14px 40px rgba(232,93,4,0.45)"
            : "0 8px 28px rgba(232,93,4,0.35)",
        }}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
      >
        ↓ Download PDF
      </button>
      <p style={S.printNote}>A6 Landscape · Front & Back · 300 DPI Print Ready</p>
    </div>
  );
};

export default ViewIdCard;