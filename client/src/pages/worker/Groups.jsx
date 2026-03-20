// src/pages/worker/Groups.jsx
// FIXES:
//  1. Was importing from '../../api/groupApi' which doesn't exist.
//     FIX: Now imports from '../../api' (main index.js)
//  2. Redirects to CreateGroup/MyGroups which are the actual implementations.
//     This page serves as a hub/redirect to the proper group management pages.

import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Groups() {
    const navigate = useNavigate();

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Groups</h1>
            <p className="text-gray-500 mb-8">Create and manage your worker groups to get hired for group jobs.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <button
                    onClick={() => navigate('/worker/create-group')}
                    className="bg-white border-2 border-orange-200 hover:border-orange-400 rounded-2xl p-6 text-left transition-all hover:shadow-md group"
                >
                    <div className="text-4xl mb-3">➕</div>
                    <h2 className="text-lg font-bold text-gray-800 group-hover:text-orange-600">Create a Group</h2>
                    <p className="text-sm text-gray-500 mt-1">Start a new worker group with a fellow Karigar</p>
                </button>

                <button
                    onClick={() => navigate('/worker/my-groups')}
                    className="bg-white border-2 border-blue-200 hover:border-blue-400 rounded-2xl p-6 text-left transition-all hover:shadow-md group"
                >
                    <div className="text-4xl mb-3">👥</div>
                    <h2 className="text-lg font-bold text-gray-800 group-hover:text-blue-600">My Groups</h2>
                    <p className="text-sm text-gray-500 mt-1">View and manage groups you're part of</p>
                </button>

                <button
                    onClick={() => navigate('/worker/active-group-jobs')}
                    className="bg-white border-2 border-green-200 hover:border-green-400 rounded-2xl p-6 text-left transition-all hover:shadow-md group"
                >
                    <div className="text-4xl mb-3">🔨</div>
                    <h2 className="text-lg font-bold text-gray-800 group-hover:text-green-600">Active Group Jobs</h2>
                    <p className="text-sm text-gray-500 mt-1">Jobs your group is currently working on</p>
                </button>

                <button
                    onClick={() => navigate('/worker/proposals')}
                    className="bg-white border-2 border-purple-200 hover:border-purple-400 rounded-2xl p-6 text-left transition-all hover:shadow-md group"
                >
                    <div className="text-4xl mb-3">📨</div>
                    <h2 className="text-lg font-bold text-gray-800 group-hover:text-purple-600">Job Proposals</h2>
                    <p className="text-sm text-gray-500 mt-1">Accept or decline client job proposals</p>
                </button>
            </div>
        </div>
    );
}