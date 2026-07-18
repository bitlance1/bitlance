'use client';

import React from 'react';
import { Star, Archive, FolderUp } from 'lucide-react';

interface Message {
  id: string;
  subject?: string;
  isAdminOutreach?: boolean;
  sender: {
    name: string;
    avatar: string;
    isOnline: boolean;
  };
  lastMessage: {
    text: string;
    timestamp: string;
    /** Raw epoch milliseconds for smart date formatting */
    createdAtMs?: number;
    isRead: boolean;
  };
  unreadCount: number;
}

interface MessageItemProps {
  message: Message;
  isSelected: boolean;
  onClick: () => void;
  isStarred?: boolean;
  isArchived?: boolean;
  onToggleStar?: (chatId: string, e: React.MouseEvent) => void;
  onToggleArchive?: (chatId: string, e: React.MouseEvent) => void;
}

/**
 * Smart date label:
 * - Same calendar day  → "2:45 PM"
 * - Yesterday          → "Yesterday"
 * - Within last 7 days → "Monday", "Tuesday", …
 * - Older              → "May 12" or "Dec 3, 2024"
 */
function formatSmartDate(ms: number): string {
  const now = new Date();
  const date = new Date(ms);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOf7DaysAgo = new Date(startOfToday.getTime() - 6 * 86400000);

  if (date >= startOfToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  if (date >= startOfYesterday) {
    return 'Yesterday';
  }

  if (date >= startOf7DaysAgo) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export default function MessageItem({
  message,
  isSelected,
  onClick,
  isStarred = false,
  isArchived = false,
  onToggleStar,
  onToggleArchive,
}: MessageItemProps) {
  const [imgError, setImgError] = React.useState(false);
  const displayTime = message.lastMessage.createdAtMs
    ? formatSmartDate(message.lastMessage.createdAtMs)
    : message.lastMessage.timestamp;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStar) {
      onToggleStar(message.id, e);
    }
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleArchive) {
      onToggleArchive(message.id, e);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative group flex items-start gap-4 p-4 rounded-[14px] cursor-pointer transition-all duration-150 border select-none shadow-2xs hover:shadow-xs
        w-full min-w-0 max-w-full overflow-hidden
        ${isSelected
          ? 'border-[white] bg-[#FFF9F2] ring-1 ring-[white]/10'
          : 'border-[white] bg-white '
        }
      `}
      style={{ minHeight: 82 }}
    >
      {/* Avatar Container */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-150 shadow-3xs">
          {message.sender.avatar === 'support' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E05206" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          ) : imgError || !message.sender.avatar ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8C4F00" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          ) : (
            <img
              src={message.sender.avatar}
              alt={message.sender.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        {/* Online Indicator Dot */}
        {message.sender.isOnline && !message.isAdminOutreach && (
          <span className="absolute bottom-0.5 right-0.5 block h-3 w-3 rounded-full bg-[#22C55E] ring-2 ring-white" />
        )}
      </div>

      {/* Info Body */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="font-bold text-[15px] text-gray-900 truncate leading-snug">
            {message.subject || message.sender.name}
          </h3>

          {/* NEW Badge next to Name */}
          {!message.lastMessage.isRead && (
            <span className="inline-flex items-center rounded-full bg-[#E05206] px-2 py-0.5 text-[8px] font-black text-white uppercase tracking-wider">
              NEW
            </span>
          )}

          {/* Support Indicator Badge */}
          {message.subject && (
            <span className="inline-flex items-center rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-[#8C4F00] ring-1 ring-inset ring-orange-200">
              Support
            </span>
          )}
        </div>

        <p className="text-[13px] text-gray-500 font-medium truncate mt-1 leading-snug max-w-[200px] sm:max-w-[260px]">
          {message.lastMessage.text}
        </p>
      </div>

      {/* Right side: Time stamp */}
      <div className="absolute top-4 right-4 flex flex-col items-end select-none">
        <span className="text-[11px] font-medium text-gray-400">
          {displayTime}
        </span>
      </div>

      {/* Star / Unread Badge / Archive Toggle Container (always aligned bottom-right) */}
      <div className="absolute bottom-3 right-4 flex items-center justify-end select-none min-h-[22px]">
        {/* Hover Action Mode: Star + Archive */}
        <div className="hidden group-hover:flex items-center gap-1 bg-white/95 rounded-full shadow-2xs border border-gray-100 px-1 py-0.5">
          <button
            type="button"
            onClick={handleStarClick}
            className={`p-1 rounded-full transition-colors ${
              isStarred
                ? 'text-orange-400 hover:text-orange-500'
                : 'text-gray-300 hover:text-orange-400 hover:bg-gray-50'
            }`}
            title={isStarred ? 'Unstar conversation' : 'Star conversation'}
          >
            <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-orange-400 text-orange-400' : ''}`} />
          </button>
          
          <button
            type="button"
            onClick={handleArchiveClick}
            className="p-1 text-gray-300 hover:text-blue-500 hover:bg-gray-50 rounded-full transition-colors"
            title={isArchived ? 'Unarchive conversation' : 'Archive conversation'}
          >
            {isArchived ? (
              <FolderUp className="w-3.5 h-3.5" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Static State (Non-hovered) */}
        <div className="group-hover:hidden flex items-center">
          {message.unreadCount > 0 ? (
            <div className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] bg-[#E05206] rounded-full flex items-center justify-center shadow-2xs">
              <span className="text-[9px] sm:text-[10px] font-black text-white leading-none">
                {message.unreadCount}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStarClick}
              className={`p-0.5 rounded-full transition-colors ${isStarred ? 'text-orange-400' : 'text-gray-300 hover:text-orange-400'}`}
            >
              <Star className={`w-4 h-4 ${isStarred ? 'fill-orange-400 text-orange-400' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}