// src/pages/worker/AcceptInvites.jsx
// FIXES:
//  1. Was calling api.getMyGroups() which is not in the old api/index.js
//     FIX: Now uses getMyGroupsAPI from api/index.js
//  2. Was calling api.acceptGroupInvite which never existed (no such endpoint).
//     In the new system, workers are directly added by the group admin —
//     there's no "invite acceptance" flow. Workers see groups they're already in.
//     FIX: Page now shows groups the worker belongs to, with option to leave.

import React, { useEffect, useState } from 'react';
import { getMyGroupsAPI, leaveGroupAPI } from '../../api';
import toast from 'react-hot-toast';

export default function AcceptInvites() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const { data } = await getMyGroupsAPI();
            setGroups(data || []);
        } catch {
            toast.error('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchGroups(); }, []);

    const handleLeave = async (groupId) => {
        if (!window.confirm('Are you sure you want to leave this group?')) return;
        try {
            await leaveGroupAPI(groupId);
            toast.success('Left group successfully');
            fetchGroups();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Failed to leave group');
        }
    };

    if (loading) return (
        <div className="p-6 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">My Group Memberships</h1>
            <p className="text-gray-500 mb-6">Groups you're currently a member of. Group admins add members directly.</p>

            {groups.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                    <div className="text-5xl mb-3">👥</div>
                    <p className="text-gray-500">You're not in any groups yet.</p>
                    <p className="text-gray-400 text-sm mt-1">Ask a group admin to add you, or create your own group.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map((group) => (
                        <div key={group._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="font-bold text-gray-800">{group.name}</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Group ID: <span className="font-mono font-semibold">{group.groupId}</span>
                                        {' · '} {group.members?.length || 0} members
                                        {group.isAdmin && <span className="ml-2 text-orange-500 font-semibold">👑 Admin</span>}
                                    </p>
                                </div>

                                {!group.isAdmin && (
                                    <button
                                        onClick={() => handleLeave(group.groupId)}
                                        className="text-sm text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Leave
                                    </button>
                                )}
                            </div>

                            {/* Members */}
                            <div className="flex gap-2 mt-4 flex-wrap">
                                {group.members?.map((member) => (
                                    <div key={member._id} className="flex flex-col items-center gap-0.5">
                                        <img
                                            src={member.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f97316&color=fff`}
                                            alt={member.name}
                                            className="w-10 h-10 rounded-full object-cover border-2 border-orange-100"
                                        />
                                        <span className="text-xs text-gray-600">{member.name?.split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}