"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import FreelancerSidebar from "@/components/molecules/FreelancerSidebar";
import AISupportChat from "@/components/organisms/AISupportChat";

const DASHBOARD_GUIDES = [
  {
    title: "Overview",
    href: "/freelancer/dashboard",
    desc: "Your home base shows your latest proposals, pending replies, approved work, and a quick path back to the job feed.",
    steps: [
      "Use Find New Gigs to jump straight into open jobs.",
      "Check Recent Activity to see the newest proposal updates.",
      "Watch Pending Proposals and Proposals Sent for a fast status check.",
    ],
  },
  {
    title: "Job Feed",
    href: "/freelancer/dashboard/job-feed",
    desc: "Browse live client jobs, search by keyword, filter categories, save roles, and open a job to apply.",
    steps: [
      "Search by job title, stack, skill, or keyword.",
      "Use category chips to narrow the feed.",
      "Bookmark jobs with the save button, then open My Saved Jobs when you are ready.",
      "Choose Apply Now to review the full job and send your proposal.",
    ],
  },
  {
    title: "Proposals",
    href: "/freelancer/dashboard/proposals",
    desc: "Every proposal you send is tracked here with the client, rate, pricing type, status, cover note, and related job details.",
    steps: [
      "Filter proposals by All, Pending, Accepted, or Rejected.",
      "Open a proposal card to review your cover note and the original job description.",
      "Accepted proposals can become client conversations and contracts.",
    ],
  },
  {
    title: "Contracts",
    href: "/freelancer/dashboard/contracts",
    desc: "Contracts organize active work, escrow status, milestones, submissions, revision requests, and client messaging.",
    steps: [
      "Open a contract to see terms, value, escrow status, scope, and milestones.",
      "Submit work only after escrow is funded for the current milestone.",
      "Add a delivery note, link, or attachment when submitting work.",
      "If the client requests changes, update the work and resubmit from the same contract view.",
    ],
  },
  {
    title: "Messages",
    href: "/freelancer/dashboard/messages",
    desc: "Message clients from active conversations, share files, and follow system updates about escrow, milestones, and work reviews.",
    steps: [
      "Unread conversations show in the sidebar and message list.",
      "Open a chat to send messages or attachments.",
      "Use payment status and milestone context in the chat to understand what is ready for work.",
    ],
  },
  {
    title: "Earnings",
    href: "/freelancer/dashboard/earnings",
    desc: "Track sats across released earnings, funded escrow, available balance, contract history, fees, and milestone payouts.",
    steps: [
      "Total Earnings includes released sats plus funded work still in escrow.",
      "In Escrow shows funded sats waiting on approval or release.",
      "Open a transaction to inspect contract value, platform fees, milestones, and released amounts.",
    ],
  },
];

const WORKFLOW = [
  {
    title: "Find the right job",
    copy: "Start in Job Feed. Search, filter, and save anything worth reviewing before you apply.",
  },
  {
    title: "Send a clear proposal",
    copy: "Apply from the job page. Your proposal then appears in Proposals as pending, accepted, or rejected.",
  },
  {
    title: "Work after escrow is funded",
    copy: "Accepted work moves into contracts and messages. Begin the current milestone once the contract shows funded escrow.",
  },
  {
    title: "Submit and get paid",
    copy: "Submit the milestone with a note, link, or file. When the client approves, sats move from escrow into released earnings.",
  },
];

const FAQS = [
  {
    q: "Where do I apply for work?",
    a: "Go to Job Feed, open a job card with Apply Now, then submit your proposal from the job detail page.",
  },
  {
    q: "How do I see if a client replied?",
    a: "Check Proposals for status changes. Accepted proposals can also create a conversation in Messages and a contract in Contracts.",
  },
  {
    q: "When should I start the work?",
    a: "Start work when the contract or chat shows escrow funded for the current milestone. If escrow is not funded, ask the client to fund it first.",
  },
  {
    q: "How do I submit completed work?",
    a: "Open the contract, add a delivery note, optional link, or attachment, then use Submit Work for the current milestone.",
  },
  {
    q: "What if the client asks for changes?",
    a: "The contract will show an adjustment request with the client note. Make the updates and resubmit the adjusted work from Contracts.",
  },
  {
    q: "Where can I track my sats?",
    a: "Use Earnings to see total earnings, sats in escrow, available balance, transaction history, platform fees, and milestone details.",
  },
];

export default function HelpCenterPage() {
  const [isAiActive, setIsAiActive] = useState(false);
  const [openFaq, setOpenFaq] = useState(FAQS[0]?.q ?? "");

  return (
    <div className="min-h-screen bg-[#FCF9F7] font-sans text-[#1a1a1a]">
      <div className="flex">
        <FreelancerSidebar active="/help" />

        <main className="flex-1 lg:ml-0">
          <div className="min-h-screen overflow-y-auto max-md:pt-[58px]">
            <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {isAiActive ? (
                <AISupportChat
                  open={isAiActive}
                  onOpenChange={setIsAiActive}
                  fullPage
                  className="w-full"
                  intro="Hi, I can help with the freelancer and client dashboards. Ask me how proposals, jobs, escrow, contracts, messages, or earnings work."
                />
              ) : (
                <>
              <header className="mb-8 rounded-[16px] border border-[#EAE7E2] bg-white px-5 py-6 shadow-sm sm:px-7">
                <div className="inline-flex items-center rounded-full border border-[#F6D6AD] bg-[#FFF8F2] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8C4F00]">
                  Freelancer Help
                </div>
                <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h1 className="text-[28px] font-black tracking-tight text-[#1a1a1a] sm:text-[36px]">
                      How Bitlance works for freelancers
                    </h1>
                    <p className="mt-3 max-w-3xl text-[13px] leading-[1.8] text-[#6b6560] sm:text-[14px]">
                      Use this page as your dashboard guide: find Bitcoin jobs, submit proposals,
                      manage escrow-backed contracts, deliver milestones, message clients, and
                      track sats from one place.
                    </p>
                  </div>
                  <Link
                    href="/freelancer/dashboard/job-feed"
                    className="inline-flex items-center justify-center rounded-[12px] bg-gradient-to-r from-orange-600 to-orange-400 px-5 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-white shadow-sm transition hover:opacity-95"
                  >
                    Find Bitcoin Jobs
                  </Link>
                </div>
              </header>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                {WORKFLOW.map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-[12px] border border-[#EAE7E2] bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FFF3E6] text-[13px] font-black text-[#F7931A]">
                      {index + 1}
                    </div>
                    <h2 className="text-[14px] font-black text-[#1a1a1a]">{item.title}</h2>
                    <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6560]">{item.copy}</p>
                  </div>
                ))}
              </section>

              <section className="mt-8 rounded-[16px] border border-[#EAE7E2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8C4F00]">
                      Dashboard Guide
                    </div>
                    <h2 className="mt-2 text-[22px] font-black tracking-tight text-[#1a1a1a]">
                      What each sidebar page does
                    </h2>
                  </div>
                  <p className="max-w-md text-[12px] leading-[1.7] text-[#6b6560]">
                    These sections match the freelancer sidebar so you can jump directly to the
                    place you need.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {DASHBOARD_GUIDES.map((guide) => (
                    <article
                      key={guide.title}
                      className="rounded-[12px] border border-[#EFECE7] bg-[#FAF8F5] p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-[15px] font-black text-[#1a1a1a]">{guide.title}</h3>
                          <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6560]">
                            {guide.desc}
                          </p>
                        </div>
                        <Link
                          href={guide.href}
                          className="shrink-0 rounded-full border border-[#E5D8CA] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#8C4F00] transition hover:border-[#F7931A]"
                        >
                          Open
                        </Link>
                      </div>
                      <ul className="mt-4 space-y-2">
                        {guide.steps.map((step) => (
                          <li key={step} className="flex gap-2 text-[12px] leading-[1.6] text-[#5f5a55]">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F7931A]" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-5 shadow-sm sm:p-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8C4F00]">
                    Common Questions
                  </div>
                  <div className="mt-4 space-y-3">
                    {FAQS.map((faq) => (
                      <div key={faq.q} className="overflow-hidden rounded-[12px] border border-[#EFECE7] bg-[#FAF8F5]">
                        <button
                          type="button"
                          onClick={() => setOpenFaq((current) => (current === faq.q ? "" : faq.q))}
                          aria-expanded={openFaq === faq.q}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white"
                        >
                          <span className="text-[13px] font-black text-[#1a1a1a]">{faq.q}</span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-[#8C4F00] transition-transform ${
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
                            <p className="border-t border-[#EFECE7] px-4 py-3 text-[12px] leading-[1.7] text-[#6b6560]">
                              {faq.a}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="rounded-[16px] border border-[#1f1f1f] bg-[#1a1a1a] p-5 text-white shadow-sm sm:p-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F7931A]">
                    Before You Deliver
                  </div>
                  <h2 className="mt-3 text-[20px] font-black tracking-tight">
                    Quick escrow checklist
                  </h2>
                  <div className="mt-4 space-y-3 text-[12px] leading-[1.7] text-[#E9E0D8]">
                    <p>Confirm the contract is assigned to you and the current milestone is funded.</p>
                    <p>Keep delivery notes clear, and attach the file or link the client needs to review.</p>
                    <p>Use Messages for context, but use Contracts for official milestone submissions.</p>
                    <p>Check Earnings after approval to see released sats, fees, and transaction history.</p>
                  </div>
                  <Link
                    href="/freelancer/dashboard/contracts"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-[12px] bg-gradient-to-r from-orange-600 to-orange-400 px-4 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-white"
                  >
                    Review Contracts
                  </Link>
                  <div className="mt-3">
                    <AISupportChat
                      open={isAiActive}
                      onOpenChange={setIsAiActive}
                      intro="Hi, I can help with the freelancer and client dashboards. Ask me how proposals, jobs, escrow, contracts, messages, or earnings work."
                    />
                  </div>
                </aside>
              </section>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
