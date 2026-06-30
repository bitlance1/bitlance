'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, Sparkles, Headphones, Clock, Mail } from 'lucide-react';
import Header from '@/components/organisms/Header';
import Footer from '@/components/organisms/Footer';
import AISupportChat from '@/components/organisms/AISupportChat';

// ─── Freelancer Data ─────────────────────────────────────────────────────────

const FREELANCER_GUIDES = [
  {
    title: 'Overview',
    desc: 'Your home base shows your latest proposals, pending replies, approved work, and a quick path back to the job feed.',
    steps: [
      'Use Find New Gigs to jump straight into open jobs.',
      'Check Recent Activity to see the newest proposal updates.',
      'Watch Pending Proposals and Proposals Sent for a fast status check.',
    ],
  },
  {
    title: 'Job Feed',
    desc: 'Browse live client jobs, search by keyword, filter categories, save roles, and open a job to apply.',
    steps: [
      'Search by job title, stack, skill, or keyword.',
      'Use category chips to narrow the feed.',
      'Bookmark jobs with the save button, then open My Saved Jobs when you are ready.',
      'Choose Apply Now to review the full job and send your proposal.',
    ],
  },
  {
    title: 'Proposals',
    desc: 'Every proposal you send is tracked here with the client, rate, pricing type, status, cover note, and related job details.',
    steps: [
      'Filter proposals by All, Pending, Accepted, or Rejected.',
      'Open a proposal card to review your cover note and the original job description.',
      'Accepted proposals can become client conversations and contracts.',
    ],
  },
  {
    title: 'Contracts',
    desc: 'Contracts organize active work, escrow status, milestones, submissions, revision requests, and client messaging.',
    steps: [
      'Open a contract to see terms, value, escrow status, scope, and milestones.',
      'Submit work only after escrow is funded for the current milestone.',
      'Add a delivery note, link, or attachment when submitting work.',
      'If the client requests changes, update the work and resubmit from the same contract view.',
    ],
  },
  {
    title: 'Messages',
    desc: 'Message clients from active conversations, share files, and follow system updates about escrow, milestones, and work reviews.',
    steps: [
      'Unread conversations show in the sidebar and message list.',
      'Open a chat to send messages or attachments.',
      'Use payment status and milestone context in the chat to understand what is ready for work.',
    ],
  },
  {
    title: 'Earnings',
    desc: 'Track sats across released earnings, funded escrow, available balance, contract history, fees, and milestone payouts.',
    steps: [
      'Total Earnings includes released sats plus funded work still in escrow.',
      'In Escrow shows funded sats waiting on approval or release.',
      'Open a transaction to inspect contract value, platform fees, milestones, and released amounts.',
    ],
  },
];

const FREELANCER_WORKFLOW = [
  'Start in Job Feed. Search, filter, and save anything worth reviewing before you apply.',
  'Apply from the job page. Your proposal then appears in Proposals as pending, accepted, or rejected.',
  'Accepted work moves into contracts and messages. Begin the current milestone once the contract shows funded escrow.',
  'Submit the milestone with a note, link, or file. When the client approves, sats move from escrow into released earnings.',
];

const FREELANCER_FAQS = [
  {
    q: 'Where do I apply for work on BitLance?',
    a: 'Go to Job Feed, open a job card with Apply Now, then submit your proposal from the job detail page.',
  },
  {
    q: 'How do I see if a client replied?',
    a: 'Check Proposals for status changes. Accepted proposals can also create a conversation in Messages and a contract in Contracts.',
  },
  {
    q: 'When should I start the work?',
    a: 'Start work when the contract or chat shows escrow funded for the current milestone. If escrow is not funded, ask the client to fund it first.',
  },
  {
    q: 'How do I submit completed work?',
    a: 'Open the contract, add a delivery note, optional link, or attachment, then use Submit Work for the current milestone.',
  },
  {
    q: 'What if the client asks for changes?',
    a: 'The contract will show an adjustment request with the client note. Make the updates and resubmit the adjusted work from Contracts.',
  },
  {
    q: 'Where can I track my sats?',
    a: 'Use Earnings to see total earnings, sats in escrow, available balance, transaction history, platform fees, and milestone details.',
  },
];

// ─── Client Data ─────────────────────────────────────────────────────────────

const CLIENT_WORKFLOW = [
  'Start on Overview to check hiring status and recent activity.',
  'Create or manage roles from Job Posts.',
  'Review proposals, view the related job, then accept, reject, or message the freelancer.',
  'Use Messages to coordinate, share files, and fund escrow.',
  'Track delivery in Contracts, then approve work or request changes.',
  'Review invoices and funded milestones in Payments.',
];

const CLIENT_FAQS = [
  {
    q: 'What does the Overview page show?',
    a: 'It gives you a quick snapshot of active contracts, open job posts, total spend, latest jobs, and recent contracts.',
  },
  {
    q: 'How do I post or edit a job on BitLance?',
    a: 'Go to Job Posts, click Post New Job, add the title, category, budget, duration, logo, description, and skills. Existing jobs can be opened and edited from the same page.',
  },
  {
    q: 'Where do proposals live?',
    a: 'Use the Proposals page to review all proposals across jobs, or open a job from Job Posts to see proposals for that specific role.',
  },
  {
    q: 'How do contracts and submitted work work?',
    a: 'The Contracts page shows active, ongoing, and finished contracts. Submitted work appears there for approval or change requests.',
  },
  {
    q: 'How do escrow payments work?',
    a: 'Open a conversation in Messages, create a Lightning invoice for full escrow or a milestone, then verify payment after funding. Payments appear in the Payments tab.',
  },
  {
    q: 'Where do I update company information?',
    a: 'Use Profile for public company and contact details. Use Settings for billing email, timezone, notifications, privacy, and password reset.',
  },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function HelpCenterPage() {
  const [activeTab, setActiveTab] = useState<'freelancer' | 'client'>('freelancer');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState('');
  const [isAiActive, setIsAiActive] = useState(false);
  const [prefilledMsg, setPrefilledMsg] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const activeFaqs = activeTab === 'freelancer' ? FREELANCER_FAQS : CLIENT_FAQS;
  const activeWorkflow = activeTab === 'freelancer' ? FREELANCER_WORKFLOW : CLIENT_WORKFLOW;

  const handleEmailClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigator.clipboard.writeText('Bitlance1@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    window.open('https://mail.google.com/mail/?view=cm&fs=1&to=Bitlance1@gmail.com&su=Support+Request', '_blank');
  };

  const handleSuggestionClick = (question: string) => {
    setPrefilledMsg(question);
    setIsAiActive(true);
  };

  const filteredFaqs = activeFaqs.filter(
    (faq) =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FCF9F7] font-sans text-[#1a1a1a] flex flex-col justify-between">
      
      {/* Landing Page Header */}
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 lg:px-8 mt-16">
        {isAiActive ? (
          <AISupportChat
            open={isAiActive}
            onOpenChange={setIsAiActive}
            fullPage
            className="w-full"
            intro={
              activeTab === 'freelancer'
                ? 'Hi, I can help with the freelancer dashboard. Ask me how proposals, jobs, escrow, contracts, messages, or earnings work.'
                : 'Hi, I can help with the client dashboard. Ask me how to post jobs, review proposals, fund escrow, approve contracts, or check payments.'
            }
            prefilledQuestion={prefilledMsg}
          />
        ) : (
          <>
            {/* Category above header */}
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#F7931A]">
              Help Center
            </div>

            {/* Header with Search */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a] sm:text-4xl">
                  How can we help you today?
                </h1>
                <p className="mt-1 text-sm text-[#6b6560] font-medium">
                  Find answers, use AI, or reach out to our support team.
                </p>
              </div>

              {/* Search input */}
              <div className="relative w-full md:max-w-[340px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#F7931A] h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search help articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-[#EAE7E2] focus:border-[#F7931A] rounded-xl px-4 py-2.5 pl-10 focus:outline-none bg-white shadow-sm placeholder-gray-400 text-xs font-semibold text-[#1a1a1a]"
                />
              </div>
            </header>

            {/* Tabs for Freelancer/Client selection */}
            <div className="flex gap-2 mb-8 p-1 bg-[#F4F1EE] rounded-[14px] max-w-sm border border-[#EAE7E2]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('freelancer');
                  setOpenFaq('');
                }}
                className={`flex-1 py-2.5 rounded-[10px] text-xs font-bold transition-all ${
                  activeTab === 'freelancer'
                    ? 'bg-white text-[#1a1a1a] shadow-sm border border-[#EAE7E2]'
                    : 'text-[#6b6560] hover:text-[#1a1a1a]'
                }`}
              >
                For Freelancers
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('client');
                  setOpenFaq('');
                }}
                className={`flex-1 py-2.5 rounded-[10px] text-xs font-bold transition-all ${
                  activeTab === 'client'
                    ? 'bg-white text-[#1a1a1a] shadow-sm border border-[#EAE7E2]'
                    : 'text-[#6b6560] hover:text-[#1a1a1a]'
                }`}
              >
                For Clients
              </button>
            </div>

            {/* Cards Grid: AI Card & Support Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 items-stretch">
              
              {/* Ask BitLance AI Card */}
              <div className="bg-[#FFF9F6] border border-orange-100/80 rounded-2xl p-6 relative flex flex-col justify-between shadow-sm min-h-[220px]">
                <span className="absolute top-5 right-5 inline-flex items-center bg-orange-100/60 text-[#F7931A] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Fastest ⚡
                </span>

                <div className="flex items-start gap-3.5 pr-16">
                  <div className="w-10 h-10 rounded-full bg-[#F7931A] flex items-center justify-center text-white flex-shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                      Ask BitLance AI
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-[1.5]">
                      Get instant answers to your questions. AI is trained on BitLance help docs.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => handleSuggestionClick('')}
                    className="w-full bg-[#F7931A] hover:bg-[#e07f0f] text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" /> Ask AI Assistant
                  </button>

                  <div className="mt-3">
                    <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">
                      Try asking:
                    </span>
                    <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
                      <button
                        onClick={() => handleSuggestionClick('How does escrow work?')}
                        className="whitespace-nowrap text-[10px] text-gray-700 bg-white border border-[#EAE7E2] hover:border-[#F7931A] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                      >
                        How does escrow work?
                      </button>
                      <button
                        onClick={() => handleSuggestionClick(activeTab === 'freelancer' ? 'How do I submit work?' : 'How do I post a job?')}
                        className="whitespace-nowrap text-[10px] text-gray-700 bg-white border border-[#EAE7E2] hover:border-[#F7931A] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                      >
                        {activeTab === 'freelancer' ? 'How do I submit work?' : 'How do I post a job?'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat with Support Card */}
              <div className="bg-white border border-[#EAE7E2] rounded-2xl p-6 flex flex-col justify-between shadow-sm min-h-[220px]">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white flex-shrink-0">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                      Chat with Support
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-[1.5]">
                      Can't find what you need? Our team is here to help.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=Bitlance1@gmail.com&su=Support+Request"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleEmailClick}
                    className="w-full border border-gray-300 hover:border-gray-800 text-gray-900 bg-white hover:bg-gray-50 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer text-center"
                  >
                    <Mail className="h-4 w-4 text-gray-500" /> {copiedEmail ? 'Copied!' : 'Email Support'}
                  </a>

                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400 font-semibold border-t border-[#F5F3F0] pt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F7931A]" />
                      <span>Replies in under 5 minutes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Available 24/7</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Workflow & FAQs */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 mt-6">
              
              {/* Left: Workflow */}
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 uppercase tracking-wide">
                  Typical Workflow
                </h2>
                <p className="text-xs text-[#6b6560] font-semibold mt-1 mb-6 leading-relaxed">
                  Follow these steps to coordinate projects and settle payments.
                </p>

                <div className="flex flex-col gap-4 relative">
                  <div className="absolute left-[17px] top-4.5 bottom-4.5 w-px border-l border-dashed border-gray-300" />
                  
                  {activeWorkflow.map((item, index) => (
                    <div key={index} className="flex items-start gap-4 relative z-10">
                      <div className="flex-shrink-0 w-8.5 h-8.5 rounded-full bg-black text-white text-xs font-black flex items-center justify-center shadow-sm mt-1">
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 bg-white border border-[#EAE7E2] rounded-xl px-4 py-3 shadow-sm text-xs text-gray-700 leading-relaxed font-semibold">
                        {item}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: FAQs */}
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 uppercase tracking-wide">
                  Frequently Asked Questions
                </h2>
                <p className="text-xs text-[#6b6560] font-semibold mt-1 mb-6 leading-relaxed">
                  Explore immediate answers to common dashboard inquiries.
                </p>

                <div className="flex flex-col gap-3">
                  {filteredFaqs.length > 0 ? (
                    filteredFaqs.map((faq) => (
                      <div key={faq.q} className="overflow-hidden rounded-xl border border-[#EFECE7] bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => setOpenFaq((current) => (current === faq.q ? '' : faq.q))}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50/50"
                        >
                          <span className="text-xs font-bold text-gray-950">{faq.q}</span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-[#F7931A] transition-transform ${
                              openFaq === faq.q ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        
                        <div
                          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                            openFaq === faq.q ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="border-t border-[#EFECE7] px-5 py-4 text-xs leading-[1.7] text-gray-500 bg-[#FAF9F7] font-medium">
                              {faq.a}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-xs text-gray-400 border border-dashed border-[#EFECE7] rounded-xl bg-white font-medium">
                      No FAQ articles found matching "{searchQuery}".
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Dashboard Guides for Freelancers (Shown only on freelancer tab) */}
            {activeTab === 'freelancer' && (
              <div className="mt-16">
                <h2 className="text-lg font-extrabold text-gray-900 uppercase tracking-wide mb-2">
                  Dashboard Guides
                </h2>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {FREELANCER_GUIDES.map((guide) => (
                    <div key={guide.title} className="bg-white border border-[#EAE7E2] rounded-2xl p-5 shadow-sm">
                      <h3 className="text-sm font-extrabold text-[#1a1a1a] mb-2">{guide.title} Dashboard</h3>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed font-semibold">{guide.desc}</p>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-600 font-medium">
                        {guide.steps.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Landing Page Footer */}
      <Footer />

    </div>
  );
}
