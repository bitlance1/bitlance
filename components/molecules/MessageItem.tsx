'use client';

import React from 'react';

interface Message {
  id: string;
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
    // Today — show time only
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  if (date >= startOfYesterday) {
    return 'Yesterday';
  }

  if (date >= startOf7DaysAgo) {
    // Within last 7 days — show weekday name
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }

  // Older — show "May 12" or "May 12, 2023" if different year
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export default function MessageItem({ message, isSelected, onClick }: MessageItemProps) {
  const displayTime = message.lastMessage.createdAtMs
    ? formatSmartDate(message.lastMessage.createdAtMs)
    : message.lastMessage.timestamp;

  return (
    <div
      onClick={onClick}
      className={`
        p-3 sm:p-4 border-b border-[#f0ede8] cursor-pointer transition-all flex items-stretch bg-[#F6F3F1]
        ${isSelected
          ? 'border-l-4 border-l-[#F7931A] bg-[#FFFFFF] shadow-sm'
          : 'hover:bg-[#f9f6f2]'}
      `}
      style={{ minHeight: 64 }}
    >
      <div className="flex items-center gap-2 sm:gap-3 w-full">
        {/* Avatar */}
        <div className="relative">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-[#e8dfd4] flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            <img
              src={message.sender.avatar}
              alt={message.sender.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#8C4F00\" strokeWidth=\"1.5\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 20c0-4 3.6-7 8-7s8 3 8 7\"/></svg>`;
              }}
            />
          </div>
          {/* Online indicator */}
          {message.sender.isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 text-xs sm:text-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm text-[#1a1a1a] truncate">
              {message.sender.name}
            </h3>
            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
              {displayTime}
            </span>
          </div>

          <p className={`
            text-xs sm:text-sm truncate
            ${message.lastMessage.isRead ? 'text-gray-500' : 'text-[#1a1a1a] font-medium'}
          `}>
            {message.lastMessage.text.length > 40
              ? message.lastMessage.text.slice(0, 40) + '…'
              : message.lastMessage.text}
          </p>
        </div>

        {/* Unread count */}
        {message.unreadCount > 0 && (
          <div className="w-6 h-6 bg-[#CC7000] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {message.unreadCount > 9 ? '9+' : message.unreadCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}