import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar'; // Adjust path if needed
import { Menu } from 'lucide-react';

const WorkerLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="relative min-h-screen lg:flex">
            {/* Sidebar 
              - On mobile: 'fixed', 'inset-y-0', 'z-50', controlled by 'isSidebarOpen'
              - On desktop: 'lg:sticky', 'lg:translate-x-0'
            */}
            <Sidebar 
                isSidebarOpen={isSidebarOpen} 
                setIsSidebarOpen={setIsSidebarOpen} 
            />

            {/* Mobile-only Overlay: Closes sidebar when clicked */}
            {isSidebarOpen && (
                <div 
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                ></div>
            )}

            {/* Main Content Area - FIXED */}
            <main className="flex-1 w-full"> {/* <-- Bug 'lg:ml-80' is removed here */}
                
                {/* Mobile Header with Hamburger Menu */}
                <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between p-4 bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-200">
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 text-orange-600 rounded-lg hover:bg-orange-100"
                        aria-label="Open navigation"
                    >
                        <Menu size={24} />
                    </button>
                    <h2 className="text-lg font-bold text-orange-700">Worker Portal</h2>
                </div>

                {/* Page Content (e.g., WorkerDashboard) */}
                <div className="w-full">
                    <Outlet /> {/* This is where your routed components will render */}
                </div>
            </main>
        </div>
    );
};

export default WorkerLayout;