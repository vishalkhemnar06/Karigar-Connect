// src/pages/worker/ViewIdCard.jsx
// Professional ID Card — Government-style design with security features
// Print dimensions: 105mm × 74mm (A7 landscape) at 300 DPI
// Fixes all previous bugs (address object, Cloudinary URLs, auth token)
// FULLY MOBILE RESPONSIVE with proper photo loading

import React, { useRef, useState, useEffect } from "react";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import * as api from "../../api";

// ── Google Fonts loader ───────────────────────────────────────────────────────
const loadFonts = () => {
    if (document.getElementById('idcard-fonts')) return;
    const link = document.createElement('link');
    link.id   = 'idcard-fonts';
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Bebas+Neue&family=Share+Tech+Mono&display=swap';
    document.head.appendChild(link);
};

// ── Micro-pattern SVG (security background) ──────────────────────────────────
const MICRO_PATTERN = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">
  <defs>
    <pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="0.8" fill="rgba(255,255,255,0.07)"/>
      <line x1="0" y1="10" x2="20" y2="10" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>
      <line x1="10" y1="0" x2="10" y2="20" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="60" height="60" fill="url(#p)"/>
</svg>
`)}`;

const DIAGONAL_LINES = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
  <defs>
    <pattern id="d" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,0.035)" stroke-width="3"/>
    </pattern>
  </defs>
  <rect width="40" height="40" fill="url(#d)"/>
</svg>
`)}`;

// ── Star/seal SVG ─────────────────────────────────────────────────────────────
const Emblem = ({ size = 56 }) => (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="27" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2"/>
        <circle cx="28" cy="28" r="22" stroke="#f59e0b" strokeWidth="0.8" opacity="0.5"/>
        <circle cx="28" cy="28" r="16" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="0.8"/>
        {/* Gear-like outer ring */}
        {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 360) / 16;
            const rad   = (angle * Math.PI) / 180;
            const x1    = 28 + 24 * Math.cos(rad);
            const y1    = 28 + 24 * Math.sin(rad);
            const x2    = 28 + 26 * Math.cos(rad);
            const y2    = 28 + 26 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth="1.5" opacity="0.7"/>;
        })}
        {/* KC letters */}
        <text x="28" y="25" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="Bebas Neue, sans-serif" letterSpacing="1">KC</text>
        <text x="28" y="35" textAnchor="middle" fill="#f59e0b" fontSize="5" fontFamily="Rajdhani, sans-serif" letterSpacing="2" opacity="0.8">VERIFIED</text>
    </svg>
);

// ── Barcode simulation ────────────────────────────────────────────────────────
const FakeBarcode = ({ value = '', width = 160, height = 28 }) => {
    const bars = React.useMemo(() => {
        const seed = value.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const rng  = (n) => {
            let x = Math.sin(seed * n + n) * 10000;
            return x - Math.floor(x);
        };
        const result = [];
        let x = 0;
        let i = 0;
        while (x < width) {
            const w = Math.max(1, Math.floor(rng(i + 1) * 4));
            const isBar = i % 3 !== 2;
            result.push({ x, w, fill: isBar });
            x += w;
            i++;
        }
        return result;
    }, [value, width]);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {bars.map((b, i) =>
                b.fill
                    ? <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#ffffff" opacity="0.9"/>
                    : null
            )}
        </svg>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ViewIdCard = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [photoError, setPhotoError] = useState(false);
    const idCardRef = useRef(null);

    useEffect(() => {
        loadFonts();
        fetchUser();
        
        // Add resize listener for responsive scaling
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchUser = async () => {
        try {
            const local = JSON.parse(localStorage.getItem('user') || '{}');
            const id    = local?.karigarId || local?._id || local?.id;
            if (!id) { toast.error('User not found'); return; }
            const { data } = await api.getPublicWorkerProfile(id);
            setUser(data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load profile');
        } finally { setLoading(false); }
    };

   const downloadPDF = async () => {
    if (!idCardRef.current) return;

    const toastId = toast.loading('Generating PDF…');

    try {
        // ✅ Wait for images to load
        const images = idCardRef.current.querySelectorAll("img");
        await Promise.all(
            Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            })
        );

        // ✅ Mobile optimized canvas
        const canvas = await html2canvas(idCardRef.current, {
            scale: window.innerWidth < 768 ? 1.5 : 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
        });

        const img = canvas.toDataURL('image/jpeg', 0.9);

        const pdf = new jsPDF('l', 'mm', [148, 105]);

        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();

        const ratio = Math.min(pw / canvas.width, ph / canvas.height);

        pdf.addImage(
            img,
            'JPEG',
            (pw - canvas.width * ratio) / 2,
            (ph - canvas.height * ratio) / 2,
            canvas.width * ratio,
            canvas.height * ratio
        );

        // ✅ Mobile-safe download
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `Karigar_ID_${user.karigarId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // ✅ fallback for mobile browsers
        window.open(url, "_blank");

        toast.success('Downloaded!', { id: toastId });

    } catch (e) {
        console.error(e);
        toast.error('Download failed', { id: toastId });
    }
};

    // Calculate responsive scale for the card - MORE AGRESSIVE SCALING FOR MOBILE
    const getCardScale = () => {
        if (windowWidth >= 1024) return 1;
        if (windowWidth >= 768) return 0.7;
        if (windowWidth >= 640) return 0.55;
        if (windowWidth >= 480) return 0.45;
        return 0.38; // For very small phones
    };

    const cardScale = getCardScale();
    const cardWidth = 760 * cardScale;
    const cardHeight = 460 * cardScale;

    // Get photo URL with better error handling
    const getPhotoUrl = () => {
        if (photoError) {
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Worker')}&background=ea580c&color=fff&bold=true&size=200`;
        }
        
        if (!user?.photo) {
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Worker')}&background=ea580c&color=fff&bold=true&size=200`;
        }
        
        if (user.photo.startsWith('http')) {
            return user.photo;
        }
        
        // Handle local file path
        // Handle local file path
const BASE_URL = import.meta.env.VITE_API_URL || "http://192.168.0.103:5000";

return `${BASE_URL}/${user.photo.replace(/\\/g, '/')}`;
    };

    const photoUrl = getPhotoUrl();

    const handlePhotoError = () => {
        setPhotoError(true);
    };

    if (loading) return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d1117' }}>
            <div style={{ textAlign:'center', color:'#f59e0b', fontFamily:'Rajdhani, sans-serif' }}>
                <div style={{ width:48, height:48, border:'3px solid rgba(245,158,11,0.3)', borderTopColor:'#f59e0b', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <p>Loading Profile…</p>
            </div>
        </div>
    );

    if (!user) return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d1117' }}>
            <p style={{ color:'#ef4444', fontFamily:'Rajdhani, sans-serif', fontSize:18 }}>Failed to load profile.</p>
        </div>
    );

    // Derived data
    const city     = user.address?.city     || user.city     || '';
    const pincode  = user.address?.pincode  || user.pincode  || '';
    const locality = user.address?.locality || user.locality || '';
    const fullAddr = [locality, city, pincode].filter(Boolean).join(', ');
    const skills   = (user.skills || []).map(s => s.name || s).filter(Boolean);
    const publicURL= `${window.location.origin}/profile/public/${user.karigarId}`;
    const issueDate= new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const expYear  = new Date().getFullYear() + 3;

    // Face verification badge
    const fvStatus  = user.faceVerificationStatus;
    const fvPassed  = fvStatus === 'passed';
    const fvScore   = user.faceVerificationScore;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            justifyContent: 'center', 
            padding: windowWidth < 640 ? '1rem' : '2rem 1rem',
            fontFamily: 'Rajdhani, sans-serif',
            overflowX: 'auto',
        }}>
            {/* Title - Responsive */}
            <div style={{ textAlign:'center', marginBottom: windowWidth < 640 ? '1rem' : '2rem' }}>
                <h1 style={{ 
                    color:'#f59e0b', 
                    fontFamily:'Bebas Neue, sans-serif', 
                    fontSize: windowWidth < 480 ? 16 : (windowWidth < 640 ? 20 : 28), 
                    letterSpacing: windowWidth < 640 ? 2 : 6, 
                    margin:0 
                }}>
                    KARIGARCONNECT
                </h1>
                <p style={{ 
                    color:'#64748b', 
                    fontSize: windowWidth < 640 ? 9 : 13, 
                    marginTop: 4, 
                    letterSpacing: windowWidth < 640 ? 1 : 3, 
                    textTransform:'uppercase' 
                }}>
                    Official Identity Card
                </p>
            </div>

            {/* Card Container with Responsive Scaling */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                overflowX: 'auto',
                padding: '10px 0',
            }}>
                <div style={{
                    width: cardWidth,
                    height: cardHeight,
                    position: 'relative',
                    flexShrink: 0,
                }}>
                    {/* Inner card content remains exactly the same dimensions but scaled */}
                    <div style={{
                        transform: `scale(${cardScale})`,
                        transformOrigin: 'top left',
                        width: 760,
                        height: 460,
                        position: 'relative',
                    }}>
                        <div ref={idCardRef} style={{
                            width: 760, 
                            height: 460,
                            borderRadius: 16,
                            overflow: 'hidden',
                            position: 'relative',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,158,11,0.3)',
                            fontFamily: 'Rajdhani, sans-serif',
                        }}>

                            {/* ── BASE BACKGROUND ── */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(135deg, #0c1220 0%, #111827 40%, #0f172a 70%, #0c1220 100%)',
                            }}/>

                            {/* ── MICRO PATTERN ── */}
                            <div style={{
                                position:'absolute', inset:0,
                                backgroundImage: `url("${MICRO_PATTERN}")`,
                                backgroundSize: '60px 60px',
                                opacity: 0.6,
                            }}/>
                            <div style={{
                                position:'absolute', inset:0,
                                backgroundImage: `url("${DIAGONAL_LINES}")`,
                                backgroundSize: '40px 40px',
                            }}/>

                            {/* ── ORANGE ACCENT BAND (top) ── */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: 6,
                                background: 'linear-gradient(90deg, #ea580c, #f59e0b, #ea580c)',
                            }}/>

                            {/* ── LARGE WATERMARK ── */}
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%) rotate(-20deg)',
                                fontFamily: 'Bebas Neue, sans-serif',
                                fontSize: 130, color: 'rgba(245,158,11,0.03)',
                                letterSpacing: 10, whiteSpace: 'nowrap',
                                pointerEvents: 'none', userSelect: 'none',
                            }}>
                                KARIGARCONNECT
                            </div>

                            {/* ── LEFT SIDEBAR ── */}
                            <div style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0, width: 220,
                                background: 'linear-gradient(180deg, rgba(234,88,12,0.18) 0%, rgba(234,88,12,0.08) 100%)',
                                borderRight: '1px solid rgba(234,88,12,0.25)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: '0 16px',
                                paddingTop: 20,
                            }}>

                                {/* Org name */}
                                <div style={{ textAlign:'center', marginBottom:14 }}>
                                    <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:22, color:'#f59e0b', letterSpacing:3, lineHeight:1 }}>KARIGAR</div>
                                    <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:22, color:'#ea580c', letterSpacing:3, lineHeight:1 }}>CONNECT</div>
                                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', letterSpacing:3, marginTop:2, textTransform:'uppercase' }}>Platform ID Card</div>
                                </div>

                                {/* Photo frame with error handling */}
                                <div style={{
                                    width: 110, height: 130,
                                    border: '2px solid #f59e0b',
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    boxShadow: '0 0 20px rgba(245,158,11,0.3), inset 0 0 20px rgba(0,0,0,0.5)',
                                    marginBottom: 12,
                                    background: '#1a2035',
                                    flexShrink: 0,
                                }}>
                                    <img 
                                        src={photoUrl} 
                                        alt={user.name}
                                        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                                        crossOrigin="anonymous"
                                        onError={handlePhotoError}
                                    />
                                    {/* Corner accents */}
                                    {[{t:0,l:0},{t:0,r:0},{b:0,l:0},{b:0,r:0}].map((p,i)=>(
                                        <div key={i} style={{
                                            position:'absolute', ...p, width:12, height:12,
                                            borderTop: (p.t===0)?'2px solid #f59e0b':'none',
                                            borderBottom: (p.b===0)?'2px solid #f59e0b':'none',
                                            borderLeft: (p.l===0)?'2px solid #f59e0b':'none',
                                            borderRight: (p.r===0)?'2px solid #f59e0b':'none',
                                        }}/>
                                    ))}
                                </div>

                                {/* Verification status */}
                                <div style={{
                                    background: fvPassed ? 'rgba(34,197,94,0.15)' : 'rgba(234,88,12,0.15)',
                                    border: `1px solid ${fvPassed ? 'rgba(34,197,94,0.5)' : 'rgba(234,88,12,0.4)'}`,
                                    borderRadius: 20, padding: '4px 10px',
                                    fontSize: 9, color: fvPassed ? '#4ade80' : '#fbbf24',
                                    letterSpacing: 2, textTransform:'uppercase', fontWeight:700,
                                    marginBottom: 10,
                                }}>
                                    {fvPassed ? '✓ FACE VERIFIED' : user.verificationStatus === 'approved' ? '✓ APPROVED' : '⏳ PENDING'}
                                </div>

                                {/* Emblem */}
                                <div style={{ marginTop: 'auto', marginBottom: 12, opacity: 0.8 }}>
                                    <Emblem size={46}/>
                                </div>

                                {/* Issue / Expiry */}
                                <div style={{ textAlign:'center', marginBottom:10 }}>
                                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)', letterSpacing:2, textTransform:'uppercase' }}>VALID UNTIL</div>
                                    <div style={{ fontSize:11, color:'#f59e0b', fontWeight:700, letterSpacing:1 }}>DEC {expYear}</div>
                                </div>
                            </div>

                            {/* ── RIGHT CONTENT AREA ── */}
                            <div style={{
                                position: 'absolute', left: 220, right: 0, top: 0, bottom: 0,
                                padding: '20px 22px',
                                display: 'flex', flexDirection: 'column',
                            }}>
                                {/* TOP ROW: name + QR */}
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                                    <div style={{ flex:1, marginRight:16 }}>
                                        {/* Role badge */}
                                        <div style={{
                                            display:'inline-block',
                                            background:'linear-gradient(90deg, rgba(234,88,12,0.3), rgba(245,158,11,0.15))',
                                            border:'1px solid rgba(234,88,12,0.5)',
                                            borderRadius:3, padding:'2px 10px',
                                            fontSize:9, color:'#fbbf24',
                                            letterSpacing:3, textTransform:'uppercase', fontWeight:700,
                                            marginBottom:8,
                                        }}>
                                            Karigar / Skilled Worker
                                        </div>

                                        {/* Name */}
                                        <div style={{
                                            fontFamily:'Bebas Neue, sans-serif',
                                            fontSize:32, color:'#ffffff', letterSpacing:2,
                                            lineHeight:1, marginBottom:6,
                                            textShadow:'0 0 30px rgba(245,158,11,0.3)',
                                        }}>
                                            {user.name}
                                        </div>

                                        {/* Karigar ID */}
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                                            <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', letterSpacing:2, textTransform:'uppercase' }}>ID:</span>
                                            <span style={{
                                                fontFamily:'Share Tech Mono, monospace',
                                                fontSize:15, color:'#f59e0b', letterSpacing:3, fontWeight:700,
                                            }}>
                                                {user.karigarId}
                                            </span>
                                        </div>

                                        {/* Experience badge */}
                                        {user.overallExperience && (
                                            <div style={{
                                                display:'inline-flex', alignItems:'center', gap:5,
                                                background:'rgba(245,158,11,0.12)',
                                                border:'1px solid rgba(245,158,11,0.3)',
                                                borderRadius:4, padding:'3px 10px', marginTop:4,
                                            }}>
                                                <span style={{ fontSize:10, color:'#fbbf24', letterSpacing:2 }}>
                                                    ★ {user.overallExperience.toUpperCase()}
                                                </span>
                                                {user.experience && (
                                                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginLeft:4 }}>
                                                        {user.experience} YRS
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* QR Code */}
                                    <div style={{
                                        background:'white', padding:8, borderRadius:8,
                                        boxShadow:'0 0 20px rgba(245,158,11,0.2)',
                                        flexShrink:0,
                                    }}>
                                        <QRCode value={publicURL} size={72}/>
                                        <div style={{ textAlign:'center', fontSize:7, color:'#374151', marginTop:4, letterSpacing:1, fontFamily:'Share Tech Mono, monospace', fontWeight:700 }}>
                                            SCAN TO VERIFY
                                        </div>
                                    </div>
                                </div>

                                {/* DIVIDER */}
                                <div style={{ height:1, background:'linear-gradient(90deg, rgba(234,88,12,0.6), rgba(245,158,11,0.3), transparent)', marginBottom:14 }}/>

                                {/* INFO GRID */}
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px 16px', marginBottom:14 }}>
                                    {[
                                        { label:'Mobile', value: user.mobile || '—' },
                                        { label:'Gender', value: user.gender || '—' },
                                        { label:'Location', value: city || '—' },
                                    ].map(({ label, value }) => (
                                        <div key={label}>
                                            <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', letterSpacing:2, textTransform:'uppercase', marginBottom:2 }}>{label}</div>
                                            <div style={{ fontSize:12, color:'#e2e8f0', fontWeight:600, letterSpacing:0.5 }}>{value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* SKILLS */}
                                {skills.length > 0 && (
                                    <div style={{ marginBottom:14 }}>
                                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>Skills</div>
                                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                            {skills.slice(0,5).map((sk,i) => (
                                                <span key={i} style={{
                                                    fontSize:9, padding:'3px 10px', borderRadius:3,
                                                    background:i<3 ? 'rgba(234,88,12,0.25)' : 'rgba(255,255,255,0.07)',
                                                    border:`1px solid ${i<3 ? 'rgba(234,88,12,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                                    color:i<3 ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                                                    letterSpacing:1, textTransform:'uppercase', fontWeight:600,
                                                }}>
                                                    {sk}
                                                </span>
                                            ))}
                                            {skills.length > 5 && (
                                                <span style={{ fontSize:9, padding:'3px 8px', borderRadius:3, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.35)', letterSpacing:1 }}>
                                                    +{skills.length-5}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ADDRESS + BARCODE ROW */}
                                <div style={{ marginTop:'auto', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                                    <div style={{ flex:1, marginRight:16 }}>
                                        {fullAddr && (
                                            <div style={{ marginBottom:8 }}>
                                                <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)', letterSpacing:2, textTransform:'uppercase', marginBottom:2 }}>Address</div>
                                                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', letterSpacing:0.3, lineHeight:1.4 }}>{fullAddr}</div>
                                            </div>
                                        )}
                                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.2)', letterSpacing:1 }}>
                                            ISSUED: {issueDate} · www.karigarconnect.in
                                        </div>
                                    </div>

                                    {/* Barcode */}
                                    <div style={{ flexShrink:0 }}>
                                        <FakeBarcode value={user.karigarId} width={150} height={26}/>
                                        <div style={{
                                            fontFamily:'Share Tech Mono, monospace',
                                            fontSize:7, color:'rgba(255,255,255,0.3)',
                                            textAlign:'center', marginTop:3, letterSpacing:2,
                                        }}>
                                            {user.karigarId}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── HOLOGRAPHIC STRIP (bottom accent) ── */}
                            <div style={{
                                position:'absolute', bottom:0, left:0, right:0, height:4,
                                background:'linear-gradient(90deg, #1e40af, #7c3aed, #ea580c, #f59e0b, #ea580c, #7c3aed, #1e40af)',
                                backgroundSize:'400% 100%',
                            }}/>

                            {/* ── CORNER SECURITY NUMBER ── */}
                            <div style={{
                                position:'absolute', top:10, right:14,
                                fontFamily:'Share Tech Mono, monospace',
                                fontSize:8, color:'rgba(255,255,255,0.2)', letterSpacing:2,
                            }}>
                                {user.karigarId}-{new Date().getFullYear()}
                            </div>

                            {/* ── MRZ ZONE (bottom-left, inside sidebar) ── */}
                            <div style={{
                                position:'absolute', bottom:16, left:10, right: 'auto',
                                width:190,
                                fontFamily:'Share Tech Mono, monospace',
                                fontSize:7, color:'rgba(255,255,255,0.15)',
                                letterSpacing:1.5, lineHeight:1.8, wordBreak:'break-all',
                                overflow:'hidden',
                            }}>
                                {'KC'.padEnd(6,'<')}{(user.karigarId||'').replace('-','').padEnd(12,'<')}<br/>
                                {(user.name||'').replace(/\s+/g,'<').toUpperCase().slice(0,20).padEnd(20,'<')}
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* Download button - Responsive */}
            <button onClick={downloadPDF} style={{
                marginTop: '1.5rem',
                padding: windowWidth < 640 ? '10px 24px' : '14px 40px',
                background: 'linear-gradient(90deg, #ea580c, #f59e0b)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: windowWidth < 640 ? 12 : 18,
                letterSpacing: windowWidth < 640 ? 2 : 4,
                cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(234,88,12,0.4)',
                transition: 'all 0.2s',
                zIndex: 10,
            }}
            onMouseOver={e => { e.target.style.transform='translateY(-2px)'; e.target.style.boxShadow='0 12px 40px rgba(234,88,12,0.6)'; }}
            onMouseOut={e  => { e.target.style.transform='translateY(0)'; e.target.style.boxShadow='0 8px 30px rgba(234,88,12,0.4)'; }}>
                ↓ DOWNLOAD PDF
            </button>

            <p style={{ 
                marginTop: 12, 
                fontSize: windowWidth < 640 ? 8 : 12, 
                color: '#374151', 
                letterSpacing: windowWidth < 640 ? 0.5 : 1, 
                textTransform: 'uppercase',
                textAlign: 'center'
            }}>
                A6 Landscape · 300 DPI Print Ready
            </p>
        </div>
    );
};

export default ViewIdCard;