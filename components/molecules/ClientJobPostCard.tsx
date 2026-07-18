"use client";

import { useEffect, useState } from "react";

const FALLBACK_COLORS = ["#F7931A", "#8C4F00", "#9E9690", "#6b6762", "#C8A87A"];

function AvatarStack({ avatars, total }: { avatars: { url?: string; name: string }[]; total: number }) {
  const visible = avatars.slice(0, 4);
  const overflow = total > 4 ? total - 4 : 0;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {visible.map((av, i) => (
          <div
            key={i}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[10px] font-bold text-white"
            style={{
              marginLeft: i === 0 ? 0 : -10,
              zIndex: visible.length - i,
              position: "relative",
              backgroundColor: av.url ? "transparent" : FALLBACK_COLORS[i % FALLBACK_COLORS.length],
            }}
          >
            {av.url ? (
              <img src={av.url} alt={av.name} className="h-full w-full object-cover" />
            ) : (
              (av.name?.[0] ?? "F").toUpperCase()
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#EAE7E2] text-[10px] font-bold text-[#6b6762]"
            style={{ marginLeft: -10, position: "relative", zIndex: 0 }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}

interface ClientJobPostCardProps {
  id?: string;
  title: string;
  description?: string;
  status: "Open" | "Paused" | "In Review" | "Closed";
  budget: string;
  duration?: string;
  proposals: number;
  views?: number;
  tags: string[];
  companyLogoUrl?: string;
  clientName?: string;
  applicantAvatars?: { url?: string; name: string }[];
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export default function ClientJobPostCard({
  id,
  title,
  description,
  status,
  budget,
  duration,
  proposals,
  views = 0,
  tags,
  companyLogoUrl,
  clientName,
  applicantAvatars = [],
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
  onClose,
}: ClientJobPostCardProps) {
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => { setLogoLoadFailed(false); }, [companyLogoUrl]);

  const statusStyles = {
    Open: "bg-[#E8F5E9] text-[#2E7D32]",
    Paused: "bg-[#FDECEA] text-[#C62828]",
    "In Review": "bg-[#E8F0FE] text-[#1565C0]",
    Closed: "bg-gray-100 text-gray-700 border border-gray-300",
  } as const;

  const budgetNumeric = budget?.replace(/[^0-9,]/g, "").trim() || "0";
  const cleanDescription = description?.trim()
    ? description.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim()
    : null;
  const durationLabel = duration?.trim() || null;
  const showLogo = !!companyLogoUrl && !logoLoadFailed;

  return (
    <div
      onClick={onSelect}
      className={`w-full cursor-pointer rounded-[16px] border bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all ${isSelected
          ? "border-[#F7931A] ring-1 ring-[#F7931A]/30"
          : "border-[#EAE7E2] hover:border-[#F7931A]/40 hover:shadow-[0_4px_20px_rgba(0,0,0,0.09)]"
        }`}
      data-job-id={id}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(); } }}
    >
      {/* ── TOP ROW ── */}
      <div className="flex items-start gap-3">
        {/* Company logo */}
        <div className="flex-shrink-0 h-12 w-12 rounded-[12px] overflow-hidden bg-[#F7931A] flex items-center justify-center shadow-sm">
          {showLogo ? (
            <img
              src={companyLogoUrl}
              alt={clientName ?? "Company"}
              className="h-full w-full object-cover"
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <span className="text-[20px] font-black text-white">B</span>
          )}
        </div>

        {/* Title + description */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="text-[15px] font-bold leading-[1.3] text-[#1a1a1a]"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {title}
          </div>
          {cleanDescription && (
            <div
              className="mt-1.5 text-[12px] leading-[1.6] text-[#6b6762]"
              style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}
            >
              {cleanDescription}
            </div>
          )}
        </div>

        {/* Right column: status + budget + duration */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1 min-w-[90px]">
          <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${statusStyles[status]}`}>
            {status}
          </span>
          <div className="flex items-center gap-1 mt-1">
            <svg width="14" height="16" viewBox="0 0 12 18" fill="#F7931A">
              <path d="M7 0L0 10h5l-1 8 8-11H7V0z" />
            </svg>
            <span className="text-[26px] font-black leading-none text-[#1a1a1a] tabular-nums">{budgetNumeric}</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9e9690]">sats</span>
          {durationLabel && (
            <div className="flex items-center gap-1 text-[10px] text-[#9e9690] mt-0.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="font-medium whitespace-nowrap">{durationLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SKILL TAGS ── */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#F3F0EC] px-3 py-1 text-[11px] font-medium text-[#555]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── DIVIDER ── */}
      <div className="mt-4 border-t border-[#F3F0EC]" />

      {/* ── STATS ROW: avatars | proposals | views ── */}
      <div className="mt-3 flex items-center gap-0">
        {/* Avatar stack */}
        <div className="flex-1 flex items-center">
          <AvatarStack avatars={applicantAvatars} total={proposals} />
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-[#EAE7E2] mx-3" />

        {/* Proposals */}
        <div className="flex items-center gap-2 flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9e9690" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div>
            <div className="text-[15px] font-bold leading-none text-[#1a1a1a]">{proposals}</div>
            <div className="text-[10px] text-[#9e9690] mt-0.5">Proposals</div>
          </div>
        </div>

        {/* Divider */}
        {/* <div className="h-8 w-px bg-[#EAE7E2] mx-3" /> */}

        {/* Views */}
        {/* <div className="flex items-center gap-2 flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9e9690" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <div>
            <div className="text-[15px] font-bold leading-none text-[#1a1a1a]">{views}</div>
            <div className="text-[10px] text-[#9e9690] mt-0.5">Views</div>
          </div>
        </div> */}
      </div>

      {/* ── ACTION ROW ── */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          className="flex w-full sm:w-auto sm:flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#F7931A] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#e8841a] active:bg-[#d4760f]"
        >
          View Applicants <span className="text-[15px]">→</span>
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-[10px] border border-[#EAE7E2] px-4 py-2.5 text-[13px] font-semibold text-[#6b6762] transition-colors hover:bg-[#F3F0EC] hover:text-[#1a1a1a]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              Edit
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-[10px] border border-[#EAE7E2] px-4 py-2.5 text-[13px] font-semibold text-[#6b6762] transition-colors hover:bg-[#F3F0EC] hover:text-[#1a1a1a]"
            >
              {status === "Closed" ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Reopen
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Close
                </>
              )}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete job post"
              className="flex items-center justify-center rounded-[10px] border border-[#EAE7E2] p-2.5 text-[#9e9690] transition-colors hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
