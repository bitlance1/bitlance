"use client";

import { useEffect, useState } from "react";
import Tag from "@/components/atoms/Tag";

interface ClientJobPostCardProps {
  id?: string;
  title: string;
  description?: string;
  status: "Open" | "Paused" | "In Review";
  budget: string;
  proposals: number;
  tags: string[];
  clientAvatarUrl?: string;
  clientName?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  showDetailsHint?: boolean;
}

export default function ClientJobPostCard({
  id,
  title,
  description,
  status,
  budget,
  proposals,
  tags,
  clientAvatarUrl,
  clientName,
  isSelected = false,
  onSelect,
  onEdit,
  showDetailsHint = true,
}: ClientJobPostCardProps) {
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [clientAvatarUrl]);

  const statusStyles = {
    Open: "bg-[#E6F4EA] text-[#2E7D32]",
    Paused: "bg-[#FDECEA] text-[#C62828]",
    "In Review": "bg-[#E8F0FE] text-[#1565C0]",
  } as const;

  const budgetLabel = budget?.trim()
    ? budget.toLowerCase().includes("sats")
      ? budget
      : `${budget} sats`
    : null;

  const cleanDescription = description?.trim()
    ? description
        .replace(/[\r\n]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    : null;

  const showAvatar = !!clientAvatarUrl && !avatarLoadFailed;

  return (
    <div
      onClick={onSelect}
      className={`w-full cursor-pointer rounded-[12px] border bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all ${
        isSelected
          ? "border-[#F5A623] ring-1 ring-[#F5A623]/30"
          : "border-[#EAE7E2] hover:border-[#F2D8AA]"
      }`}
      data-job-id={id}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[5px] bg-[#F7F4F0] ring-1 ring-[#EAE7E2]">
            {showAvatar ? (
              <img
                src={clientAvatarUrl}
                alt={clientName ? `${clientName} avatar` : "Client avatar"}
                className="h-full w-full object-cover"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-[#8C4F00]"
              >
                <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
                <path d="M4 21c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" />
              </svg>
            )}
          </div>
        </div>

        {/* ✅ overflow-hidden here is critical — constrains children so line-clamp works */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-start justify-between gap-3">

            {/* ✅ overflow-hidden + w-0 min-w-0 forces this column to shrink properly */}
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-[14px] font-semibold text-[#1a1a1a] break-words">
                {title}
              </div>

              {cleanDescription ? (
                <div
                  className="mt-1 text-[11px] text-[#6b6762] leading-[1.4]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                     overflowWrap: "anywhere",
                    overflow: "hidden",
                    wordBreak: "break-word",
                    maxWidth: "100%",
                  }}
                >
                  {cleanDescription}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${statusStyles[status]}`}
              >
                {status}
              </span>
              {budgetLabel ? (
                <span className="text-[12px] font-semibold text-[#8C4F00]">
                  {budgetLabel}
                </span>
              ) : null}
              {onEdit ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#EAE7E2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b6762] hover:bg-[#F7F4F0]"
                  aria-label="Edit job"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                  Edit
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#9e9690]">
            <span>
              {proposals} proposal{proposals !== 1 ? "s" : ""} received
            </span>
            {clientName ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F3F1] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[#666]">
                Client: {clientName}
              </span>
            ) : null}
          </div>

          {showDetailsHint ? (
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8C4F00]">
              View details
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}