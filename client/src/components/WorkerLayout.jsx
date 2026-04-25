import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import WorkerOnboardingModal from './WorkerOnboardingModal';
import { WorkerOnboardingProvider } from '../context/WorkerOnboardingContext';

const WorkerLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <WorkerOnboardingProvider>
            <div className="relative min-h-screen lg:flex">

                <Sidebar 
                    isSidebarOpen={isSidebarOpen} 
                    setIsSidebarOpen={setIsSidebarOpen} 
                />

                {isSidebarOpen && (
                    <div 
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    ></div>
                )}

                {/* ✅ NO HEADER HERE */}
                <main className="flex-1 w-full">
                    <div className="w-full m-0 p-0">
                        <Outlet />
                    </div>
                </main>

                <WorkerOnboardingModal />
            </div>
        </WorkerOnboardingProvider>
    );
};

export default WorkerLayout;