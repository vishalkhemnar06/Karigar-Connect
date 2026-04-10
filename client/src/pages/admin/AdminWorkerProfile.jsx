import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../../api';
import { getImageUrl } from '../../constants/config';
import Header from '../../components/Header';
import AdminSidebar from './AdminSidebar';
import {
  Phone, FileText,
} from 'lucide-react';

const AdminWorkerProfile = () => {
  const { workerId } = useParams(); // karigarId from admin dashboard route
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewerBlobUrl, setViewerBlobUrl] = useState('');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [viewMode, setViewMode] = useState('stats');
  const [stats, setStats] = useState({
    totalWorkers: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    blocked: 0,
    totalClients: 0,
  });
  const [dashboardStats, setDashboardStats] = useState({
    ivrStats: {},
    shops: 0,
    couponsGenerated: 0,
    topSkills: [],
  });
  const [viewerKind, setViewerKind] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.getAdminUserProfile(workerId);
        setWorker(data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to fetch user details.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [workerId]);

  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const [workersRes, clientsRes, adminStatsRes] = await Promise.all([
          api.getAllWorkers(),
          api.getAllClients(),
          api.getAdminStats(),
        ]);

        const workers = Array.isArray(workersRes.data) ? workersRes.data : [];
        const clients = Array.isArray(clientsRes.data) ? clientsRes.data : [];

        setStats({
          totalWorkers: workers.length,
          pending: workers.filter((w) => w.verificationStatus === 'pending').length,
          approved: workers.filter((w) => w.verificationStatus === 'approved').length,
          rejected: workers.filter((w) => w.verificationStatus === 'rejected').length,
          blocked: workers.filter((w) => w.verificationStatus === 'blocked').length,
          totalClients: clients.length,
        });

        setDashboardStats(adminStatsRes.data || {});
      } catch {
        // Keep profile usable even if sidebar counters fail to load.
      }
    };

    fetchSidebarData();
  }, []);

  const handleSidebarFilterChange = (filter) => {
    setActiveFilter(filter);
    navigate('/admin/dashboard', {
      state: { activeFilter: filter, currentSection: 'dashboard', viewMode: 'records' },
    });
  };

  const handleSidebarSectionChange = (section) => {
    setCurrentSection(section);

    if (section === 'dashboard') {
      navigate('/admin/dashboard', {
        state: { currentSection: 'dashboard', viewMode: 'stats' },
      });
      return;
    }

    const sectionRoutes = {
      fraud: '/admin/fraud',
      complaints: '/admin/complaints',
      'worker-complaints': '/admin/worker-complaints',
      community: '/admin/community',
      shops: '/admin/shops',
    };

    const targetRoute = sectionRoutes[section] || '/admin/dashboard';
    navigate(targetRoute);
  };

  const getAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age >= 0 ? age : null;
  };

  const documentLink = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${getImageUrl(path)}`;
  };

  const getDocumentType = (url) => {
    if (!url) return 'other';
    const lower = String(url).toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/)) return 'image';
    return 'other';
  };

  const resetDocumentViewer = () => {
    setSelectedDocument(null);
    setViewerError('');
    setViewerKind('');
    setViewerLoading(false);
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl);
      setViewerBlobUrl('');
    }
  };

  const openDocumentInViewer = async (doc) => {
    if (!doc?.url) return;
    const resolvedUrl = documentLink(doc.url);
    setSelectedDocument({ label: doc.label || 'Document', url: resolvedUrl });
    setViewerLoading(true);
    setViewerError('');
    setViewerKind('');

    try {
      // Use proxy endpoint to fetch document (axios automatically adds auth header from API interceptor)
      const response = await api.proxyDocument(resolvedUrl);
      const blob = response.data;
      const mimeType = blob.type || response.headers?.['content-type'] || '';
      const docType = getDocumentType(resolvedUrl);

      let kind = 'other';
      if (docType === 'pdf' || mimeType.includes('pdf')) kind = 'pdf';
      else if (docType === 'image' || mimeType.startsWith('image/')) kind = 'image';

      if (kind === 'image' || kind === 'pdf') {
        if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
        const previewBlob = kind === 'pdf' && !mimeType.includes('pdf') ? new Blob([blob], { type: 'application/pdf' }) : blob;
        const objectUrl = URL.createObjectURL(previewBlob);
        setViewerBlobUrl(objectUrl);
        setViewerKind(kind);
      } else {
        setViewerError('Preview unavailable for this file type.');
        setViewerKind('other');
      }
    } catch (err) {
      const kind = getDocumentType(resolvedUrl);
      if (kind === 'image' || kind === 'pdf') {
        setViewerKind(kind);
      } else {
        setViewerError('Unable to preview this document.');
        setViewerKind('other');
      }
    } finally {
      setViewerLoading(false);
    }
  };

  const closePreview = () => resetDocumentViewer();

  const DocumentViewerCard = () => (
    <div className="bg-white border border-orange-200 rounded-xl overflow-hidden shadow-sm mt-4">
      <div className="flex items-center justify-between p-3 border-b border-orange-100 bg-orange-50">
        <p className="text-sm font-semibold text-gray-800 truncate">{selectedDocument?.label || 'Document Preview'}</p>
        <button
          type="button"
          onClick={resetDocumentViewer}
          className="text-xs px-2 py-1 rounded-lg bg-white border border-orange-200 text-orange-700 hover:bg-orange-100"
        >
          Close
        </button>
      </div>

      <div className="bg-gray-50 h-72 sm:h-96 flex items-center justify-center">
        {viewerLoading && (
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        )}

        {!viewerLoading && viewerError && (
          <div className="text-sm text-gray-600 p-4 text-center">{viewerError || 'Unable to preview document.'}</div>
        )}

        {!viewerLoading && !viewerError && viewerKind === 'image' && (viewerBlobUrl || selectedDocument?.url) && (
          <img src={viewerBlobUrl || selectedDocument.url} alt={selectedDocument?.label} className="max-w-full max-h-full object-contain" />
        )}

        {!viewerLoading && !viewerError && viewerKind === 'pdf' && (viewerBlobUrl || selectedDocument?.url) && (
          <iframe
            title={selectedDocument?.label || 'PDF Document'}
            src={viewerBlobUrl || selectedDocument.url}
            className="w-full h-full border-0"
          />
        )}

        {!viewerLoading && !viewerError && viewerKind === 'other' && (
          <div className="text-sm text-gray-600 p-4 text-center">Inline preview available only for image/PDF files.</div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4">
        <div className="w-14 h-14 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-orange-200 text-center max-w-md w-full">
          <p className="text-lg font-semibold text-red-600 mb-2">{error}</p>
          <button onClick={() => navigate(-1)} className="mt-3 px-4 py-2 rounded-lg bg-orange-500 text-white">Go Back</button>
        </div>
      </div>
    );
  }

  const age = getAge(worker?.dob);
  const position = worker?.overallExperience || 'Not specified';
  const _skills = Array.isArray(worker?.skills) ? worker.skills : [];
  const portfolioPhotos = Array.isArray(worker?.portfolioPhotos) && worker.portfolioPhotos.length
    ? worker.portfolioPhotos
    : (Array.isArray(worker?.workPhotos) ? worker.workPhotos : []);

  const _docs = [
    { label: 'ID Proof', url: worker?.idProof?.filePath },
    { label: 'e-Shram Card', url: worker?.eShramCardPath },
    ...(Array.isArray(worker?.skillCertificates) ? worker.skillCertificates.map((url, idx) => ({ label: `Skill Certificate ${idx + 1}`, url })) : []),
    ...(Array.isArray(worker?.otherCertificates) ? worker.otherCertificates.map((url, idx) => ({ label: `Other Doc ${idx + 1}`, url })) : []),
  ].filter((doc) => doc.url);

  const locationHref = worker?.address?.latitude && worker?.address?.longitude
    ? `https://maps.google.com?q=${worker.address.latitude},${worker.address.longitude}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-white">
      <Header />
      <div className="flex">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeFilter={activeFilter}
          onFilterChange={handleSidebarFilterChange}
          currentSection={currentSection}
          onSectionChange={handleSidebarSectionChange}
          stats={stats}
          dashboardStats={dashboardStats}
          onViewModeChange={setViewMode}
        />

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 min-w-0 overflow-auto">
          <div className="max-w-6xl mx-auto p-4 md:p-6 pt-8">
            <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden relative z-20">
          <div className="px-4 sm:px-6 pb-6 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={getImageUrl(worker.photo, `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=ea580c&color=fff&size=200`)}
                  alt={worker.name}
                  className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-lg"
                  onError={(e) => { e.target.src = getImageUrl(worker.photo); }}
                />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{worker.name || 'Unnamed Worker'}</h1>
                  <p className="text-xs sm:text-sm text-orange-600 font-medium uppercase">{worker.karigarId || 'No ID'} • {worker.role}</p>
                  <p className="text-xs text-gray-500 mt-1">{worker.verificationStatus ? worker.verificationStatus.toUpperCase() : 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2"> 
                {worker.verificationStatus === 'approved' && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">Verified</span>}
                {worker.verificationStatus === 'pending' && <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold">Pending</span>}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-orange-100 p-3 bg-orange-50">
                <p className="text-xs font-semibold uppercase text-orange-700 mb-1">Personal</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><strong>Karigar ID:</strong> {worker.karigarId || 'N/A'}</p>
                  <p><strong>Phone:</strong> {worker.mobile || 'N/A'}</p>
                  <p><strong>Email:</strong> {worker.email || 'N/A'}</p>
                  <p><strong>Age:</strong> {age || 'N/A'}</p>
                  <p><strong>Gender:</strong> {worker.gender || 'N/A'}</p>
                  <p><strong>DOB:</strong> {worker.dob ? new Date(worker.dob).toLocaleDateString() : 'N/A'}</p>
                  <p><strong>Experience:</strong> {worker.experience || 'N/A'} years</p>
                  <p><strong>Overall:</strong> {worker.overallExperience || 'N/A'}</p>
                  <p><strong>Skills:</strong> {_skills.length ? _skills.map((s) => (s.name ? `${s.name} (${s.proficiency || 'unknown'})` : s)).join(', ') : 'N/A'}</p>
                  <p><strong>Points:</strong> {worker.points ?? 0}</p>
                </div>
              </div>

              <div className="rounded-xl border border-orange-100 p-3 bg-orange-50">
                <p className="text-xs font-semibold uppercase text-orange-700 mb-1">Location</p>
                <div className="space-y-1 text-sm text-gray-700 break-words">
                  <p><strong>Address:</strong> {worker.address?.fullAddress || 'N/A'}</p>
                  <p><strong>City:</strong> {worker.address?.city || 'N/A'}</p>
                  <p><strong>Pincode:</strong> {worker.address?.pincode || 'N/A'}</p>
                  <p><strong>Latitude / Longitude:</strong> {worker.address?.latitude ?? 'N/A'}, {worker.address?.longitude ?? 'N/A'}</p>
                  {locationHref && <a href={locationHref} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:text-orange-800 font-bold">Open in Google Maps</a>}
                </div>

                {worker.address?.latitude && worker.address?.longitude && (
                  <div className="mt-2 border rounded-xl overflow-hidden relative" style={{ paddingTop: '56.25%' }}>
                    <iframe
                      title="Worker Location"
                      src={`https://maps.google.com/maps?q=${worker.address.latitude},${worker.address.longitude}&z=15&output=embed`}
                      className="absolute inset-0 w-full h-full"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-orange-100 p-3 bg-white">
                <p className="text-xs font-semibold uppercase text-orange-700 mb-2">Documents</p>
                <div className="space-y-2">
                  {_docs.length ? _docs.map((doc) => (
                    <button
                      key={doc.label}
                      onClick={() => openDocumentInViewer(doc)}
                      className="w-full text-left flex items-center justify-between gap-2 border border-orange-100 rounded-lg px-2 py-2 hover:bg-orange-50 transition"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-orange-500" />
                        <span className="text-sm text-gray-800">{doc.label}</span>
                      </div>
                      <span className="text-xs text-indigo-600 font-semibold">Preview</span>
                    </button>
                  )) : <p className="text-sm text-gray-500">No documents uploaded.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-orange-100 p-3 bg-white">
                <p className="text-xs font-semibold uppercase text-orange-700 mb-2">Portfolio / Work Photos</p>
                {portfolioPhotos.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {portfolioPhotos.map((url, idx) => (
                      <button
                        key={`${url}-${idx}`}
                        onClick={() => openDocumentInViewer({ label: `Portfolio ${idx + 1}`, url })}
                        className="focus:outline-none"
                      >
                        <img
                          src={getImageUrl(url)}
                          alt={`Work ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-orange-100 cursor-pointer"
                          onError={(e) => { e.target.src = getImageUrl(url); }}
                        />
                      </button>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-500">No portfolio/work photos available.</p>}
              </div>

              <div className="rounded-xl border border-orange-100 p-3 bg-white">
                <p className="text-xs font-semibold uppercase text-orange-700 mb-2">Face Verification (Registration)</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Status:</strong> {worker.faceVerificationStatus || 'Not triggered'}</p>
                  <p><strong>Predicted Similarity:</strong> {worker.faceVerificationScore != null ? `${worker.faceVerificationScore}%` : 'N/A'}</p>
                  <p><strong>Live face photo (registered):</strong>{' '}
                    {worker.liveFacePhoto
                      ? <button onClick={() => openDocumentInViewer({ label: 'Registered Face Photo', url: worker.liveFacePhoto })} className="text-indigo-600 hover:text-indigo-900 font-semibold">View</button>
                      : 'N/A'}
                  </p>
                  <p><strong>Face Verified:</strong> {worker.faceVerified ? 'Yes' : 'No'}</p>
                  <p><strong>Verified At:</strong> {worker.faceVerifiedAt ? new Date(worker.faceVerifiedAt).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            </div>

            <DocumentViewerCard />
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
  );
};

export default AdminWorkerProfile;
