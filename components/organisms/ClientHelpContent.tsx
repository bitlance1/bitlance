"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Button from "@/components/atoms/Button";
import AISupportChat from "@/components/organisms/AISupportChat";

const TOPICS = [
  { title: "Overview", desc: "See active contracts, open job posts, total spend, and recent activity." },
  { title: "Job Posts", desc: "Create roles, upload a company logo, and edit job details." },
  { title: "Proposals", desc: "Review freelancers by job, view job context, then accept, reject, or message." },
  { title: "Contracts", desc: "Track active work, submitted milestones, approvals, and change requests." },
];

const FAQS = [
  {
    q: "What does the Overview page show?",
    a: "It gives you a quick snapshot of active contracts, open job posts, total spend, latest jobs, and recent contracts.",
  },
  {
    q: "How do I post or edit a job?",
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
  "Review invoices and funded milestones in Payments.",
];

export default function ClientHelpContent() {
  const [isAiActive, setIsAiActive] = useState(false);
  const [openFaq, setOpenFaq] = useState(FAQS[0]?.q ?? "");

  if (isAiActive) {
    return (
      <AISupportChat
        open={isAiActive}
        onOpenChange={setIsAiActive}
        fullPage
        className="w-full"
      />
    );
  }

  return (
    <section className="w-full">
      <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
          Help Center
        </div>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
          How the client dashboard works
        </h1>
        <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">
          Use this page as a quick guide to hiring, messaging, escrow, contracts, and account setup.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TOPICS.map((topic) => (
          <div
            key={topic.title}
            className="rounded-[12px] border border-[#EAE7E2] bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.04)]"
          >
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#F5A623]">
              {topic.title}
            </div>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">{topic.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
            Dashboard Guide
          </div>
          <div className="flex flex-col gap-3">
            {FAQS.map((faq) => (
              <div key={faq.q} className="overflow-hidden rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5]">
                <button
                  type="button"
                  onClick={() => setOpenFaq((current) => (current === faq.q ? "" : faq.q))}
                  aria-expanded={openFaq === faq.q}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white"
                >
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">{faq.q}</span>
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
                    <div className="border-t border-[#EFECE7] px-4 py-3 text-[12px] leading-[1.7] text-[#6b6762]">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
            Typical Workflow
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {WORKFLOW.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] p-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-white">
                  {index + 1}
                </div>
                <div className="text-[12px] leading-[1.6] text-[#6b6762]">{step}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[10px] border border-[#EFECE7] bg-[#1a1a1a] p-4 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
              Need support?
            </div>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#d9d3cc]">
              Use live chat or email support when an invoice, milestone, or contract status needs help.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <AISupportChat open={isAiActive} onOpenChange={setIsAiActive} />
              <Button size="sm" className="rounded-full border-white/30 text-white hover:text-white">
                Email Support
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
