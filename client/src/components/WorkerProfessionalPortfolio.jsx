// src/components/WorkerProfessionalPortfolio.jsx
// Professional Resume Component - A4 optimized, industry-ready format
// Clean, modern layout with enhanced typography and spacing

import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Download, X, Loader2 } from 'lucide-react';
import { getImageUrl } from '../constants/config';
import * as api from '../api';
import toast from 'react-hot-toast';

const WorkerProfessionalPortfolio = ({ profile, onClose }) => {
    const [leaderboardData, setLeaderboardData] = useState(null);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const portfolioRef = useRef(null);

    useEffect(() => {
        fetchLeaderboardData();
    }, []);

    const fetchLeaderboardData = async () => {
        try {
            const { data } = await api.getLeaderboard();
            if (Array.isArray(data)) {
                const rankIndex = data.findIndex(w => w.workerId === profile._id);
                setLeaderboardData({
                    rank: rankIndex >= 0 ? rankIndex + 1 : 'N/A',
                    totalWorkers: data.length,
                    workerData: data[rankIndex] || {},
                });
            }
        } catch (err) {
            console.log('Could not fetch leaderboard data:', err);
            setLeaderboardData({ rank: 'N/A', totalWorkers: 0 });
        }
    };

    const getAgeFromDob = (dob) => {
        if (!dob) return 'N/A';
        const birth = new Date(dob);
        if (Number.isNaN(birth.getTime())) return 'N/A';
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
        return age >= 0 ? age : 'N/A';
    };

    const downloadPDF = async () => {
        setGeneratingPdf(true);
        try {
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const marginLeft = 18;
            const marginRight = 18;
            const marginTop = 18;
            let yPosition = marginTop;

            // Helper function for text with color
            const addColorText = (text, x, y, fontSizePt, color = [0, 0, 0], bold = false) => {
                pdf.setTextColor(color[0], color[1], color[2]);
                pdf.setFont('helvetica', bold ? 'bold' : 'normal');
                pdf.setFontSize(fontSizePt);
                pdf.text(text, x, y);
                pdf.setTextColor(0, 0, 0);
            };

            const addSection = (title) => {
                yPosition += 4;
                addColorText(title, marginLeft, yPosition, 11, [249, 115, 22], true);
                yPosition += 2;
                pdf.setDrawColor(249, 115, 22);
                pdf.setLineWidth(0.4);
                pdf.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
                yPosition += 5;
                return yPosition;
            };

            const addField = (label, value, isImportant = false) => {
                const fontSize = 9.5;
                const valueStr = String(value || 'N/A');
                const labelStr = String(label || '');
                
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(80, 80, 80);
                pdf.setFontSize(fontSize - 0.5);
                pdf.text(labelStr, marginLeft + 1, yPosition);
                
                pdf.setFont('helvetica', isImportant ? 'bold' : 'normal');
                if (isImportant) {
                    pdf.setTextColor(249, 115, 22);
                } else {
                    pdf.setTextColor(40, 40, 40);
                }
                pdf.setFontSize(fontSize);
                pdf.text(valueStr, marginLeft + 48, yPosition);
                pdf.setTextColor(0, 0, 0);
                
                yPosition += 4;
            };

            const checkNewPage = (linesNeeded = 3) => {
                if (yPosition + (linesNeeded * 4) > pageHeight - 18) {
                    pdf.addPage();
                    yPosition = marginTop;
                    // Add border on new page
                    pdf.setDrawColor(200, 200, 200);
                    pdf.setLineWidth(0.5);
                    pdf.rect(5, 5, pageWidth - 10, pageHeight - 10);
                }
            };

            // Draw page border
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.5);
            pdf.rect(5, 5, pageWidth - 10, pageHeight - 10);

            // ===== HEADER / NAME & TITLE =====
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(22);
            addColorText(profile?.name || 'PROFESSIONAL', marginLeft, yPosition, 22, [33, 33, 33], true);
            yPosition += 8;
            
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(12);
            addColorText(profile?.overallExperience || 'Skilled Professional', marginLeft, yPosition, 12, [249, 115, 22], false);
            yPosition += 6;
            
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            addColorText(`Karigar ID: ${profile?.karigarId || 'N/A'} | ${profile?.mobile || ''} | ${profile?.email || ''}`, marginLeft, yPosition, 8.5, [120, 120, 120]);
            yPosition += 8;

            // Divider line
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.5);
            pdf.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
            yPosition += 7;

            // ===== PHOTO (Right-aligned, larger) =====
            const photoSize = 28;
            let photoUrl = profile?.photo ? getImageUrl(profile.photo) : '';
            
            if (photoUrl) {
                try {
                    const response = await fetch(photoUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        const photoDataUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        const imageType = blob.type.includes('png') ? 'PNG' : 'JPEG';
                        pdf.addImage(photoDataUrl, imageType, pageWidth - marginRight - photoSize, marginTop + 2, photoSize, photoSize);
                    }
                } catch (e) {
                    console.log('Photo error:', e);
                }
            }

            // ===== SECTION 1: CONTACT & PERSONAL =====
            addSection('CONTACT & PERSONAL INFORMATION');
            checkNewPage(8);

            addField('Mobile Number:', profile?.mobile || 'N/A');
            addField('Email Address:', profile?.email || 'N/A');
            addField('Date of Birth:', profile?.dob ? new Date(profile.dob).toLocaleDateString() : 'N/A');
            addField('Age:', getAgeFromDob(profile?.dob));
            addField('Gender:', profile?.gender || 'N/A');
            addField('Phone Type:', profile?.phoneType || 'N/A');

            // ===== SECTION 2: ADDRESS =====
            addSection('ADDRESS DETAILS');
            checkNewPage(6);

            addField('Full Address:', profile?.address?.fullAddress || 'N/A');
            addField('City / District:', profile?.address?.city || 'N/A');
            addField('Area / Village:', profile?.address?.village || 'N/A');
            addField('Locality:', profile?.address?.locality || 'N/A');
            addField('Postal Code:', profile?.address?.pincode || 'N/A');

            // ===== SECTION 3: PROFESSIONAL SUMMARY =====
            addSection('PROFESSIONAL SUMMARY');
            checkNewPage(6);

            addField('Experience Level:', profile?.overallExperience || 'N/A', true);
            addField('Years of Experience:', `${profile?.experience || 0} years`);
            addField('Educational Qualification:', profile?.education || 'Not specified');
            addField('e-Shram Number:', profile?.eShramNumber || 'N/A');
            addField('Travel Availability:', profile?.travelMethod || 'N/A');

            // ===== SECTION 4: SKILLS & EXPERTISE =====
            if (Array.isArray(profile?.skills) && profile.skills.length > 0) {
                addSection('CORE SKILLS & EXPERTISE');
                checkNewPage(6);

                profile.skills.forEach((skill, idx) => {
                    const skillName = skill?.name || `Skill ${idx + 1}`;
                    const proficiency = skill?.proficiency || 'Medium';
                    addField(`${idx + 1}. ${skillName}:`, proficiency);
                });
            }

            // ===== SECTION 5: PERFORMANCE HIGHLIGHTS =====
            addSection('PERFORMANCE HIGHLIGHTS');
            checkNewPage(6);

            const avgRating = profile?.averageRating ? parseFloat(profile.averageRating).toFixed(1) : '0.0';
            const completedJobs = profile?.completedJobs || 0;
            const leaderboardRank = leaderboardData?.rank || 'N/A';

            addField('Average Customer Rating:', `${avgRating} / 5.0 ★`, true);
            addField('Total Jobs Completed:', completedJobs.toString(), true);
            addField('Leaderboard Position:', `#${leaderboardRank}`, true);
            addField('Verification Status:', 'Verified Professional', true);

            // ===== SECTION 6: CERTIFICATIONS =====
            if (Array.isArray(profile?.skillCertificates) && profile.skillCertificates.length > 0) {
                addSection('CERTIFICATIONS & DOCUMENTS');
                checkNewPage(4);
                addField('Verified Certificates:', `${profile.skillCertificates.length} document(s) on file`, false);
            }

            // ===== FOOTER =====
            yPosition = pageHeight - 12;
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(7.5);
            addColorText(
                'Official resume from Karigar Connect · For verification contact: support@karigarconnect.com',
                marginLeft, 
                yPosition, 
                7.5, 
                [150, 150, 150]
            );

            // Save
            const fileName = `${profile?.name || 'Resume'}_${profile?.karigarId || 'ID'}.pdf`.replace(/[^a-z0-9-_]/gi, '_');
            pdf.save(fileName);
            toast.success('Professional resume downloaded successfully!');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 sm:p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold">Professional Resume</h2>
                        <p className="text-orange-100 text-xs sm:text-sm mt-1">Industry standard · A4 optimized</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-orange-700 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content - Resume Preview with Page Border */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-100">
                    <div 
                        ref={portfolioRef} 
                        className="bg-white shadow-xl mx-auto relative"
                        style={{ 
                            width: '210mm', 
                            minHeight: '297mm', 
                            padding: '12mm 10mm',
                            border: '1px solid #e5e5e5',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        {/* Page Border for preview */}
                        <div className="absolute inset-0 border border-gray-300 pointer-events-none" style={{ margin: '2mm' }}></div>
                        
                        <div className="relative" style={{ padding: '2mm' }}>
                            {/* ===== RESUME CONTENT - A4 SIZE ===== */}
                            
                            {/* Header with Name and Title */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex-1">
                                    <h1 className="text-4xl font-bold text-gray-800 mb-1">{profile?.name || 'Professional'}</h1>
                                    <p className="text-orange-600 text-lg font-medium mt-1">{profile?.overallExperience || 'Skilled Professional'}</p>
                                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 mt-3">
                                        <span className="flex items-center gap-1">📱 {profile?.mobile || 'N/A'}</span>
                                        <span className="flex items-center gap-1">✉️ {profile?.email || 'N/A'}</span>
                                        <span className="flex items-center gap-1">🆔 ID: {profile?.karigarId || 'N/A'}</span>
                                    </div>
                                </div>
                                {profile?.photo && (
                                    <div className="flex-shrink-0 ml-4">
                                        <img 
                                            src={getImageUrl(profile.photo)}
                                            alt={profile?.name}
                                            className="w-28 h-28 rounded-full object-cover border-3 border-orange-300 shadow-md"
                                        />
                                    </div>
                                )}
                            </div>

                            <hr className="border-orange-200 my-4" />

                            {/* Two-column layout for compactness */}
                            <div className="grid grid-cols-2 gap-6 text-sm">
                                {/* LEFT COLUMN */}
                                <div>
                                    {/* Contact & Personal */}
                                    <div className="mb-5">
                                        <h3 className="font-bold text-orange-600 text-base uppercase tracking-wide mb-3">Personal Details</h3>
                                        <div className="space-y-2 text-sm">
                                            <p><span className="font-medium text-gray-600 w-28 inline-block">Date of Birth:</span> {profile?.dob ? new Date(profile.dob).toLocaleDateString() : 'N/A'} <span className="text-gray-500">({getAgeFromDob(profile?.dob)} years)</span></p>
                                            <p><span className="font-medium text-gray-600 w-28 inline-block">Gender:</span> {profile?.gender || 'N/A'}</p>
                                            <p><span className="font-medium text-gray-600 w-28 inline-block">Phone Type:</span> {profile?.phoneType || 'N/A'}</p>
                                            <p><span className="font-medium text-gray-600 w-28 inline-block">Education:</span> {profile?.education || 'Not specified'}</p>
                                            <p><span className="font-medium text-gray-600 w-28 inline-block">e-Shram No:</span> {profile?.eShramNumber || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="mb-5">
                                        <h3 className="font-bold text-orange-600 text-base uppercase tracking-wide mb-3">Address</h3>
                                        <div className="space-y-2 text-sm">
                                            <p className="text-gray-700">{profile?.address?.fullAddress || 'N/A'}</p>
                                            <p><span className="font-medium text-gray-600 w-24 inline-block">City:</span> {profile?.address?.city || 'N/A'}</p>
                                            <p><span className="font-medium text-gray-600 w-24 inline-block">Area/Village:</span> {profile?.address?.village || 'N/A'}</p>
                                            <p><span className="font-medium text-gray-600 w-24 inline-block">Locality:</span> {profile?.address?.locality || 'N/A'}</p>
                                            <p><span className="font-medium text-gray-600 w-24 inline-block">Postal Code:</span> {profile?.address?.pincode || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Certifications */}
                                    {Array.isArray(profile?.skillCertificates) && profile.skillCertificates.length > 0 && (
                                        <div className="mb-5">
                                            <h3 className="font-bold text-orange-600 text-base uppercase tracking-wide mb-3">Certifications</h3>
                                            <div className="space-y-1 text-sm">
                                                <p className="text-gray-700">✓ {profile.skillCertificates.length} verified certificate(s) on file</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT COLUMN */}
                                <div>
                                    {/* Skills */}
                                    {Array.isArray(profile?.skills) && profile.skills.length > 0 && (
                                        <div className="mb-5">
                                            <h3 className="font-bold text-orange-600 text-base uppercase tracking-wide mb-3">Core Skills</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.skills.map((skill, idx) => (
                                                    <span key={idx} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                                                        {skill?.name} • {skill?.proficiency || 'Medium'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Professional Experience */}
                                    <div className="mb-5">
                                        <h3 className="font-bold text-orange-600 text-base uppercase tracking-wide mb-3">Experience</h3>
                                        <div className="space-y-2 text-sm">
                                            <p><span className="font-medium text-gray-600 w-32 inline-block">Experience Level:</span> {profile?.overallExperience || 'N/A'}</p>
                                            <p><span className="font-medium text-gray-600 w-32 inline-block">Years Active:</span> {profile?.experience || 0} years</p>
                                            <p><span className="font-medium text-gray-600 w-32 inline-block">Travel Availability:</span> {profile?.travelMethod || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Performance */}
                                    <div className="mb-5">
                                        <h3 className="font-bold text-orange-600 text-base uppercase tracking-wide mb-3">Performance Metrics</h3>
                                        <div className="space-y-2 text-sm">
                                            <p><span className="font-medium text-gray-600 w-32 inline-block">Rating:</span> <span className="text-orange-600 font-bold">{profile?.averageRating ? parseFloat(profile.averageRating).toFixed(1) : '0.0'}</span> / 5.0 ★</p>
                                            <p><span className="font-medium text-gray-600 w-32 inline-block">Jobs Completed:</span> <span className="font-semibold">{profile?.completedJobs || 0}</span></p>
                                            {leaderboardData && <p><span className="font-medium text-gray-600 w-32 inline-block">Rank:</span> <span className="font-semibold text-orange-600">#{leaderboardData.rank}</span></p>}
                                            <p><span className="font-medium text-gray-600 w-32 inline-block">Status:</span> <span className="text-green-600 font-medium"> Verified Professional</span></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                                <p>Official resume from Karigar Connect — Verified professional document</p>
                                <p className="mt-1">Generated on {new Date().toLocaleDateString()} · support@karigarconnect.com</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="bg-white border-t border-gray-200 p-4 sm:p-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={downloadPDF}
                        disabled={generatingPdf}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-60"
                    >
                        {generatingPdf ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Download Resume (PDF)
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkerProfessionalPortfolio;