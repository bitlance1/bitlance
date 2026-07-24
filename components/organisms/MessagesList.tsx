'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  SlidersHorizontal, 
  Search, 
  X, 
  Briefcase, 
  Loader2, 
  Check 
} from 'lucide-react';
import MessageItem from '@/components/molecules/MessageItem';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Message {
  id: string;
  subject?: string;
  isAdminOutreach?: boolean;
  jobTitle?: string;
  proposalId?: string;
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

interface MessagesListProps {
  messages: Message[];
  onSelectChat: (chatId: string) => void;
  selectedChat: string | null;
}

type TabType = 'all' | 'unread' | 'starred' | 'archived';
type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'unreadFirst';

interface ContractInfo {
  id: string;
  title: string;
  jobId: string;
  clientId: string;
  clientName: string;
  freelancerId: string;
  freelancerName: string;
  status: string;
}

export default function MessagesList({ messages, onSelectChat, selectedChat }: MessagesListProps) {
  // Tabs & Search
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Local Storage Starring & Archiving
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);

  // Sorting & Advanced Filtering
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  // Compose Modal State
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Load Starred and Archived list from localStorage
  useEffect(() => {
    try {
      const storedStarred = localStorage.getItem('bitlance_starred_chats');
      if (storedStarred) setStarredIds(JSON.parse(storedStarred));

      const storedArchived = localStorage.getItem('bitlance_archived_chats');
      if (storedArchived) setArchivedIds(JSON.parse(storedArchived));
    } catch (e) {
      console.error('Failed to load local storage star/archive states', e);
    }
  }, []);

  const toggleStar = (chatId: string) => {
    setStarredIds((prev) => {
      const next = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      localStorage.setItem('bitlance_starred_chats', JSON.stringify(next));
      return next;
    });
  };

  const toggleArchive = (chatId: string) => {
    setArchivedIds((prev) => {
      const next = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      localStorage.setItem('bitlance_archived_chats', JSON.stringify(next));
      return next;
    });
  };

  // Close filter menu when clicking outside
  useEffect(() => {
    if (!filterMenuOpen) return;
    const handleOutsideClick = () => setFilterMenuOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [filterMenuOpen]);

  // Open Compose Modal & Fetch contracts
  const handleOpenCompose = async () => {
    setComposeModalOpen(true);
    setLoadingContracts(true);
    setComposeError(null);
    setContracts([]);

    try {
      const user = firebaseAuth.currentUser;
      if (!user) {
        setComposeError('Please log in to compose messages.');
        setLoadingContracts(false);
        return;
      }

      const isClient = window.location.pathname.includes('/client');
      const contractsCol = collection(firebaseDb, 'contracts');
      
      let contractsQuery;
      if (isClient) {
        contractsQuery = query(contractsCol, where('clientId', '==', user.uid));
      } else {
        contractsQuery = query(contractsCol, where('freelancerId', '==', user.uid));
      }

      const snap = await getDocs(contractsQuery);
      const loaded: ContractInfo[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          title: data.title ?? 'Untitled Contract',
          jobId: data.jobId ?? '',
          clientId: data.clientId ?? '',
          clientName: data.clientName ?? 'Client',
          freelancerId: data.freelancerId ?? '',
          freelancerName: data.freelancerName ?? 'Freelancer',
          status: data.status ?? 'Active',
        };
      });

      setContracts(loaded);
    } catch (e: any) {
      console.error(e);
      setComposeError(e.message || 'Failed to retrieve active contracts.');
    } finally {
      setLoadingContracts(false);
    }
  };

  const handleComposeSelect = (contract: ContractInfo) => {
    const conversationId = contract.jobId && contract.freelancerId
      ? `${contract.jobId}_${contract.freelancerId}`
      : contract.id;
    
    onSelectChat(conversationId);
    setComposeModalOpen(false);
  };

  // Filter messages dynamically
  const filteredMessages = useMemo(() => {
    return messages
      .filter((msg) => {
        const isStarred = starredIds.includes(msg.id);
        const isArchived = archivedIds.includes(msg.id);

        if (activeTab === 'archived') {
          if (!isArchived) return false;
        } else {
          if (isArchived) return false;
          if (activeTab === 'starred' && !isStarred) return false;
          if (activeTab === 'unread' && msg.unreadCount === 0) return false;
        }

        if (searchQuery.trim()) {
          const queryStr = searchQuery.toLowerCase();
          const matchesName = msg.sender.name.toLowerCase().includes(queryStr);
          const matchesSubject = msg.subject?.toLowerCase().includes(queryStr) ?? false;
          const matchesSnippet = msg.lastMessage.text.toLowerCase().includes(queryStr);
          if (!matchesName && !matchesSubject && !matchesSnippet) return false;
        }

        if (filterOnlineOnly && !msg.sender.isOnline) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'alphabetical') {
          return a.sender.name.localeCompare(b.sender.name);
        }
        if (sortBy === 'unreadFirst') {
          if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        }
        
        const aMs = a.lastMessage.createdAtMs ?? 0;
        const bMs = b.lastMessage.createdAtMs ?? 0;
        
        if (sortBy === 'oldest') {
          return aMs - bMs;
        }
        return bMs - aMs;
      });
  }, [messages, activeTab, searchQuery, starredIds, archivedIds, sortBy, filterOnlineOnly]);

  // Compute unread totals
  const unreadTotal = useMemo(() => {
    return messages.filter((m) => m.unreadCount > 0 && !archivedIds.includes(m.id)).length;
  }, [messages, archivedIds]);

  return (
    <div className=" max-md:pb-[100px] md:h-full flex flex-col bg-[#FAF9F6] border-r border-[#e8e6e1] select-none font-sans">
      
      {/* ── HEADER ── */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-black text-gray-900 leading-none tracking-tight">
              Messages
            </h1>
            <p className="text-xs text-gray-400 font-medium mt-1 leading-snug">
              Stay connected and keep conversations moving.
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Filter Button */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterMenuOpen(!filterMenuOpen);
                }}
                className={`
                  flex items-center justify-center w-11 h-11 rounded-[14px] border transition-all duration-150 shadow-2xs
                  ${filterMenuOpen || filterOnlineOnly || sortBy !== 'newest'
                    ? 'border-[#E05206] bg-[#FFF9F2] text-[#E05206]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }
                `}
                title="Filter / Sort Messages"
              >
                <SlidersHorizontal className="w-[18px] h-[18px]" />
              </button>

              {/* Filter Dropdown */}
              {filterMenuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-150 bg-white p-3.5 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                    Sort By
                  </p>
                  <div className="space-y-1 mb-4">
                    {([
                      { value: 'newest', label: 'Newest first' },
                      { value: 'oldest', label: 'Oldest first' },
                      { value: 'unreadFirst', label: 'Unread first' },
                      { value: 'alphabetical', label: 'Alphabetical (A-Z)' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.value);
                          setFilterMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between text-xs font-semibold px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.value && <Check className="w-3.5 h-3.5 text-[#E05206]" />}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                    Status
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterOnlineOnly(!filterOnlineOnly);
                      setFilterMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between text-xs font-semibold px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span>Online contacts only</span>
                    {filterOnlineOnly && <Check className="w-3.5 h-3.5 text-[#E05206]" />}
                  </button>
                </div>
              )}
            </div>

            {/* Compose Button */}
            <button
              type="button"
              onClick={handleOpenCompose}
              className="flex items-center justify-center w-11 h-11 rounded-[14px] border border-[#E05206] bg-white text-[#E05206] hover:bg-orange-50/20 transition-all shadow-2xs"
              title="Compose New Message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      <div className="px-4 sm:px-6 pb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full rounded-[14px] border border-gray-200 bg-white py-3 pl-11 pr-9 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/10 focus:border-orange-300 shadow-2xs"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-455 hover:text-gray-700 p-0.5 rounded-full hover:bg-gray-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── TAB PILLS ── */}
      <div className="px-4 sm:px-6 pb-5">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {/* Tab: All */}
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`
              flex items-center gap-1.5 px-4.5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all shrink-0 border
              ${activeTab === 'all'
                ? 'bg-[#FCF5F0] border-[#FFF0E5] text-[#E05206] font-bold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            All
          </button>

          {/* Tab: Unread */}
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`
              flex items-center gap-1.5 px-4.5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all shrink-0 border
              ${activeTab === 'unread'
                ? 'bg-[#FCF5F0] border-[#FFF0E5] text-[#E05206] font-bold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <span>Unread</span>
            {unreadTotal > 0 && (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E05206] px-1 text-[9px] font-bold text-white leading-none">
                {unreadTotal}
              </span>
            )}
          </button>

          {/* Tab: Starred */}
          <button
            type="button"
            onClick={() => setActiveTab('starred')}
            className={`
              flex items-center gap-1.5 px-4.5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all shrink-0 border
              ${activeTab === 'starred'
                ? 'bg-[#FCF5F0] border-[#FFF0E5] text-[#E05206] font-bold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            Starred
          </button>

          {/* Tab: Archived */}
          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={`
              flex items-center gap-1.5 px-4.5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all shrink-0 border
              ${activeTab === 'archived'
                ? 'bg-[#FCF5F0] border-[#FFF0E5] text-[#E05206] font-bold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            Archived
          </button>
        </div>
      </div>

      {/* ── SEPARATE INDIVIDUAL CARDS WITH VERTICAL SPACE ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 bg-[#FAF9F6]">
        {filteredMessages.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-center p-6 bg-white rounded-[14px]  shadow-2xs mt-1">
            <div>
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-gray-800">
                {searchQuery ? 'No matching conversations' : `No ${activeTab} messages yet`}
              </p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-[200px] mx-auto leading-normal">
                {searchQuery 
                  ? 'Try checking spelling or search for another participant name.' 
                  : activeTab === 'starred'
                    ? 'Flag conversations to keep track of important projects.'
                    : activeTab === 'archived'
                      ? 'Archived messages will appear here.'
                      : 'Conversations about active work and support will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {filteredMessages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                isSelected={selectedChat === message.id}
                onClick={() => onSelectChat(message.id)}
                isStarred={starredIds.includes(message.id)}
                isArchived={archivedIds.includes(message.id)}
                onToggleStar={toggleStar}
                onToggleArchive={toggleArchive}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── COMPOSE MODAL (CONTRACT SELECTOR) ── */}
      {composeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-xs" 
            onClick={() => setComposeModalOpen(false)} 
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-[20px] bg-white shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 z-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8C4F00]">
                  New Conversation
                </p>
                <h3 className="mt-0.5 text-lg font-black text-gray-900 leading-tight">
                  Choose a Contract
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setComposeModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-150 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {loadingContracts ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-[#CC7000] animate-spin" />
                  <p className="text-xs text-gray-400 font-semibold">Retrieving contracts...</p>
                </div>
              ) : composeError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700 font-medium">
                  {composeError}
                </div>
              ) : contracts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mx-auto mb-3">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">No active contracts found</p>
                  <p className="text-[11px] text-gray-400 mt-1 max-w-[240px] mx-auto leading-normal">
                    You can start message threads after hiring a freelancer or submitting a proposal.
                  </p>
                </div>
              ) : (
                contracts.map((contract) => {
                  const isClient = window.location.pathname.includes('/client');
                  const partnerName = isClient ? contract.freelancerName : contract.clientName;
                  return (
                    <div
                      key={contract.id}
                      onClick={() => handleComposeSelect(contract)}
                      className="p-3.5 rounded-xl border border-gray-150 bg-white hover:bg-orange-50/30 hover:border-orange-200 cursor-pointer transition-all duration-150 shadow-2xs hover:shadow-xs"
                    >
                      <h4 className="text-xs font-black text-gray-900 leading-snug truncate">
                        {contract.title}
                      </h4>
                      <div className="flex items-center justify-between gap-3 mt-2 text-[10px] text-gray-500 font-semibold">
                        <span>Partner: {partnerName}</span>
                        <span className="uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-50 text-[9px] border border-gray-100">
                          {contract.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-3 shrink-0 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setComposeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-[12px] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
