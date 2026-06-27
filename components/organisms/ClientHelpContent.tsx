"use client";

import { useState } from "react";
import { ChevronDown, Search, Sparkles, Headphones, Clock, MessageSquare, Mail } from "lucide-react";
import Button from "@/components/atoms/Button";
import AISupportChat from "@/components/organisms/AISupportChat";

const FAQS = [
  {
    q: "What does the Overview page show?",
    a: "It gives you a quick snapshot of active contracts, open job posts, total spend, latest jobs, and recent contracts.",
  },
  {
    q: "How do I post or edit a job on BitLance?",
    a: "Go to Job Posts, click Post New Job, add the title, category, budget, duration, logo, description, and skills. Existing jobs can be opened and edited from the same page.",
  },
  {
    q: "Where do proposals live?",
    a: "Use the Proposals page to review all proposals across jobs, or open a job from Job Posts to see proposals for that specific role.",
  },
  {
    q: "How do contracts and submitted work work?",
    a: "The Contracts page shows active, ongoing, and finished contracts. Submitted work appears there for approval or change requests.",
  },
  {
    q: "How do escrow payments work?",
    a: "Open a conversation in Messages, create a Lightning invoice for full escrow or a milestone, then verify payment after funding. Payments appear in the Payments tab.",
  },
  {
    q: "Where do I update company information?",
    a: "Use Profile for public company and contact details. Use Settings for billing email, timezone, notifications, privacy, and password reset.",
  },
];

const WORKFLOW = [
  "Start on Overview to check hiring status and recent activity.",
  "Create or manage roles from Job Posts.",
  "Review proposals, view the related job, then accept, reject, or message the freelancer.",
  "Use Messages to coordinate, share files, and fund escrow.",
  "Track delivery in Contracts, then approve work or request changes.",
  "Review invoices and funded milestones in Payments."
];

export default function ClientHelpContent() {
  const [isAiActive, setIsAiActive] = useState(false);
  const [prefilledMsg, setPrefilledMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(FAQS[0]?.q ?? "");
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleEmailClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigator.clipboard.writeText("Bitlance1@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    window.open("https://mail.google.com/mail/?view=cm&fs=1&to=Bitlance1@gmail.com&su=Client+Support+Request", "_blank");
  };

  const handleSuggestionClick = (question: string) => {
    setPrefilledMsg(question);
    setIsAiActive(true);
  };

  const filteredFaqs = FAQS.filter(
    (faq) =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isAiActive) {
    return (
      <AISupportChat
        open={isAiActive}
        onOpenChange={setIsAiActive}
        fullPage
        className="w-full"
        intro="Hi, I can help with the client dashboard. Ask me how to post jobs, review proposals, fund escrow, approve contracts, or check payments."
        prefilledQuestion={prefilledMsg}
      />
    );
  }

  return (
    <section className="w-full">
      {/* Category above header */}
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FF6A00]">
        Help Center
      </div>

      {/* Header with search bar */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1a1a1a] sm:text-[36px]">
            How can we help you today?
          </h1>
          <p className="mt-1 text-sm text-[#6b6762]">
            Find answers, use AI, or reach out to our support team.
          </p>
        </div>

        {/* Search Help Articles */}
        <div className="relative w-full md:max-w-[340px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FF6A00] h-4 w-4" />
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-[#FF6A00]/60 focus:border-[#FF6A00] rounded-xl px-4 py-2.5 pl-10 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white shadow-sm placeholder-gray-400 text-sm"
          />
        </div>
      </header>

      {/* Two Columns Grid: AI Card & Support Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 items-stretch">
        
        {/* Ask BitLance AI Card */}
        <div className="bg-[#FFF9F6] border border-orange-100/80 rounded-2xl p-5 relative flex flex-col justify-between shadow-sm min-h-[230px]">
          <span className="absolute top-5 right-5 inline-flex items-center bg-orange-100/60 text-[#FF6A00] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
            Fastest ⚡
          </span>

          <div className="flex items-start gap-3.5 pr-16">
            <div className="w-11 h-11 rounded-full bg-[#FF6A00] flex items-center justify-center text-white flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 leading-tight">
                Ask BitLance AI
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-[1.5]">
                Get instant answers to your questions. AI is trained on BitLance help docs.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={() => handleSuggestionClick("")}
              className="w-full bg-[#FF6A00] hover:bg-[#E55F00] text-white font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" /> Ask AI Assistant
            </button>

            <div className="mt-3">
              <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">
                Try asking:
              </span>
              <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  onClick={() => handleSuggestionClick("How do I post a job?")}
                  className="whitespace-nowrap text-[10px] text-gray-700 bg-white border border-[#EAE7E2] hover:border-[#FF6A00] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                >
                  How do I post a job?
                </button>
                <button
                  onClick={() => handleSuggestionClick("How does escrow work?")}
                  className="whitespace-nowrap text-[10px] text-gray-700 bg-white border border-[#EAE7E2] hover:border-[#FF6A00] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                >
                  How does escrow work?
                </button>
                <button
                  onClick={() => handleSuggestionClick("Why was my payment declined?")}
                  className="whitespace-nowrap text-[10px] text-gray-700 bg-white border border-[#EAE7E2] hover:border-[#FF6A00] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                >
                  Why was my payment declined?
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chat with Support Card */}
        <div className="bg-white border border-[#EAE7E2] rounded-2xl p-5 flex flex-col justify-between shadow-sm min-h-[230px]">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center text-white flex-shrink-0">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 leading-tight">
                Chat with Support
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-[1.5]">
                Can't find what you need? Our team is here to help.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=Bitlance1@gmail.com&su=Client+Support+Request"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleEmailClick}
              className="w-full border border-gray-300 hover:border-gray-800 text-gray-900 bg-white hover:bg-gray-50 font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer text-center"
            >
              <Mail className="h-4 w-4 text-gray-500" /> {copiedEmail ? "Copied!" : "Email Support"}
            </a>

            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mt-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00]" />
              <span>Usually replies in under 5 minutes</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-4 pt-3 border-t border-[#F5F3F0]">
              <Clock className="h-3.5 w-3.5" />
              <span>Available 24/7</span>
            </div>
          </div>
        </div>

      </div>

      {/* Typical Workflow & Frequently Asked Questions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-10 mt-12">
        
        {/* Left: Typical Workflow */}
        <div>
          <h2 className="text-xl font-black tracking-tight text-gray-900">
            Typical Workflow
          </h2>
          <p className="text-xs text-gray-500 mt-1.5 mb-6 leading-relaxed">
            Follow these steps to hire and collaborate successfully on BitLance.
          </p>

          <div className="flex flex-col gap-4 relative">
            {/* Single vertical dash timeline connector */}
            <div className="absolute left-[17px] top-4.5 bottom-4.5 w-px border-l border-dashed border-gray-300" />
            
            {WORKFLOW.map((item, index) => (
              <div key={index} className="flex items-center gap-4 relative z-10">
                <div className="flex-shrink-0 w-8.5 h-8.5 rounded-full bg-black text-white text-xs font-black flex items-center justify-center shadow-sm">
                  {index + 1}
                </div>
                
                <div className="flex-1 bg-white border border-[#EAE7E2] rounded-xl px-4 py-3 shadow-sm text-xs text-gray-700 leading-relaxed">
                  {item}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: FAQs */}
        <div>
          <h2 className="text-xl font-black tracking-tight text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-gray-500 mt-1.5 mb-6 leading-relaxed">
            Explore immediate resolutions to common platform inquiries.
          </p>

          <div className="flex flex-col gap-3">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => (
                <div key={faq.q} className="overflow-hidden rounded-xl border border-[#EFECE7] bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenFaq((current) => (current === faq.q ? "" : faq.q))}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50/50"
                  >
                    <span className="text-xs font-black text-gray-950">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#FF6A00] transition-transform ${
                        openFaq === faq.q ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                      openFaq === faq.q ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-[#EFECE7] px-5 py-4 text-xs leading-[1.7] text-gray-500 bg-[#FAF9F7]">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-xs text-gray-400 border border-dashed border-[#EFECE7] rounded-xl bg-white">
                No FAQ articles found matching "{searchQuery}".
              </div>
            )}
          </div>

          <div className="mt-5">
            <button
              onClick={() => handleSuggestionClick("How do jobs and contracts work?")}
              className="text-xs font-black text-[#FF6A00] hover:underline inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer"
            >
              Browse all help articles <span>&rarr;</span>
            </button>
          </div>
        </div>

      </div>

      {/* Still need help callout banner commented out
      <div className="w-full bg-[#FFF9F6] border border-orange-100/80 rounded-2xl p-6 sm:p-8 mt-12 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-full bg-[#FF6A00] flex items-center justify-center text-white flex-shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-lg font-black text-gray-900">
              Still need help?
            </h4>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Our support team is happy to assist you with any issues or questions you have.
            </p>
          </div>
        </div>

        <div className="flex flex-row flex-wrap justify-center gap-3 w-full md:w-auto">
          <button
            onClick={() => handleSuggestionClick("Hi, I have a question regarding my client account.")}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-white font-black text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer flex-1 sm:flex-initial"
          >
            <MessageSquare className="h-4 w-4" /> Start Live Chat
          </button>
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=Bitlance1@gmail.com&su=Client+Support+Request"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleEmailClick}
            className="bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400 text-gray-700 font-black text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition duration-200 flex-1 sm:flex-initial text-center cursor-pointer"
          >
            <Mail className="h-4 w-4 text-gray-500" /> {copiedEmail ? "Copied!" : "Email Support"}
          </a>
        </div>
      </div>
      */}
    </section>
  );
}
