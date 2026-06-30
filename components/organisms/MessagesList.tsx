'use client';

import React from 'react';
import MessageItem from '@/components/molecules/MessageItem';

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
    /** Raw epoch milliseconds — used for smart date label and sorting */
    createdAtMs?: number;
    isRead: boolean;
  };
  unreadCount: number;
}

interface MessagesListProps {
  messages: Message[];
  onSelectChat: (chatId: string) => void;
  selectedChat: string | null;
}

export default function MessagesList({ messages, onSelectChat, selectedChat }: MessagesListProps) {
  return (
    <div className="h-full flex  flex-col bg-[#F6F3F1]">
      {/* Header */}
      <div className="border-b flex justify-end border-[#e8e6e1] bg-[#F6F3F1] px-3 pb-2 pt-2 sm:p-5 sm:pb-2">
        <div className=" min-w-0 sm:ml-0">
          <h1 className="mb-0.5 truncate text-[14px] font-bold text-[#232323] sm:mb-1 sm:text-lg">Conversations</h1>
          <p className="truncate text-[10px] text-gray-400 sm:text-xs">
            {messages.filter(m => m.unreadCount > 0).length} unread conversation{messages.filter(m => m.unreadCount > 0).length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Search - optional for now */}
      <div className="border-b border-[#f0ede8] bg-[#F6F3F1] px-3 py-1.5 sm:p-5 sm:pt-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full rounded-full bg-white py-1.5 pl-8 pr-3 text-[11px] focus:outline-none focus:ring-2 focus:ring-orange-400/20 sm:py-2 sm:pl-10 sm:pr-4 sm:text-sm"
          />
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transform text-gray-400 sm:left-3 sm:h-4 sm:w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p>No messages yet</p>
              <p className="text-sm">Start a conversation with a client</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isSelected={selectedChat === message.id}
              onClick={() => onSelectChat(message.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
