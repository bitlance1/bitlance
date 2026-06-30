'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChatHeaderProps {
  sender: {
    name: string;
    avatar: string;
    isOnline: boolean;
    profileUrl?: string;
  };
  onBack: () => void;
  onViewJobDetails?: () => void;
  onRaiseDispute?: () => void;
  subtext?: string;
}

export default function ChatHeader({ sender, onBack, onViewJobDetails, onRaiseDispute, subtext }: ChatHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className="bg-[#F6F3F1] border-b border-[#e8e6e1] px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3 min-h-[56px] relative z-[50]"
      style={{ minHeight: '48px' }}
    >
      <button
        onClick={onBack}
        className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </button>

      <div className="relative">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-900 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
          {sender.avatar === 'support' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 text-orange-500">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          ) : imgError || !sender.avatar ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C4F00" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          ) : (
            <img
              src={sender.avatar}
              alt={sender.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        {sender.isOnline && sender.avatar !== 'support' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 border-2 border-white rounded-full"></div>
        )}
      </div>

      <div className="flex flex-col min-w-0">
        <h2 className="font-bold text-[#1a1a1a] truncate text-sm sm:text-base leading-tight">{sender.name}</h2>
        <span className={`text-xs font-medium leading-none ${subtext ? 'text-gray-400' : sender.isOnline ? 'text-green-500' : 'text-gray-400'}`}>
          {subtext || (sender.isOnline ? 'Online' : 'Offline')}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button
          className="text-xs sm:text-sm font-medium text-[#232323] hover:underline mr-1 sm:mr-2 disabled:text-gray-400 disabled:no-underline"
          onClick={() => sender.profileUrl && router.push(sender.profileUrl)}
          disabled={!sender.profileUrl}
        >
          View Profile
        </button>

        {/* Dropdown Menu */}
        {(onViewJobDetails || onRaiseDispute) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-xl border border-[#EAE7E2] bg-white py-1.5 shadow-lg z-[200]">
                {onViewJobDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewJobDetails();
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    View Job Details
                  </button>
                )}
                {onRaiseDispute && (
                  <button
                    type="button"
                    onClick={() => {
                      onRaiseDispute();
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Raise Dispute
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
