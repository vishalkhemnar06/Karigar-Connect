// src/pages/worker/Groups.jsx
// MOBILE-FRIENDLY:
//   - 2-column grid on all sizes (compact on small screens)
//   - min-h-[100px] cards → comfortable tap targets
//   - active:scale-95 press feedback
//   - pb-20 safe bottom padding for mobile nav bar

import React from 'react';
import { useNavigate } from 'react-router-dom';

const ITEMS = [
  {
    emoji: '➕',
    label: 'Create a Group',
    sub: 'Start a new worker group with a fellow Karigar',
    path: '/worker/create-group',
    border: 'border-orange-200',
    hover: 'hover:border-orange-400 hover:bg-orange-50',
    labelHover: 'group-hover:text-orange-600',
  },
  {
    emoji: '👥',
    label: 'My Groups',
    sub: "View and manage groups you're part of",
    path: '/worker/my-groups',
    border: 'border-blue-200',
    hover: 'hover:border-blue-400 hover:bg-blue-50',
    labelHover: 'group-hover:text-blue-600',
  },
  {
    emoji: '🔨',
    label: 'Active Group Jobs',
    sub: 'Jobs your group is currently working on',
    path: '/worker/active-group-jobs',
    border: 'border-green-200',
    hover: 'hover:border-green-400 hover:bg-green-50',
    labelHover: 'group-hover:text-green-600',
  },
  {
    emoji: '📨',
    label: 'Job Proposals',
    sub: 'Accept or decline client job proposals',
    path: '/worker/proposals',
    border: 'border-purple-200',
    hover: 'hover:border-purple-400 hover:bg-purple-50',
    labelHover: 'group-hover:text-purple-600',
  },
];

export default function Groups() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-orange-50/30 p-4 pb-20 sm:p-6 sm:pb-8">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-black text-gray-800">Groups</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Create and manage your worker groups to get hired for group jobs.
        </p>
      </div>

      {/* 2-col grid on all sizes */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {ITEMS.map(({ emoji, label, sub, path, border, hover, labelHover }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`
              bg-white border-2 ${border} ${hover}
              rounded-2xl p-4 sm:p-6 text-left
              transition-all duration-200
              active:scale-95 hover:shadow-md
              group min-h-[100px] flex flex-col gap-2
            `}
          >
            <span className="text-3xl sm:text-4xl leading-none">{emoji}</span>
            <div>
              <h2 className={`text-sm sm:text-base font-bold text-gray-800 ${labelHover} leading-snug`}>
                {label}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}