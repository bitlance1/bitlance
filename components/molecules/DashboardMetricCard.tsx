interface DashboardMetricCardProps {
  label: string;
  value: string;
  change?: string;
  tone?: "up" | "down" | "neutral";
}

export default function DashboardMetricCard({
  label,
  value,
  change,
  tone = "neutral",
}: DashboardMetricCardProps) {
  const toneStyles = {
    up: "text-[#2E7D32] bg-[#E6F4EA]",
    down: "text-[#C62828] bg-[#FDECEA]",
    neutral: "text-[#8C4F00] bg-[#F5EFE8]",
  } as const;

  return (
    <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
      <div className="text-[10px] max-[400px]:text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9e9690]">
        {label}
      </div>
      <div className="mt-2 text-[22px] max-[400px]:text-[18px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
        {value}
      </div>
      {change ? (
        <span
          className={`mt-3 max-[400px]:hidden inline-flex items-center rounded-full px-2.5 max-[400px]:px-2 py-1 text-[10px] max-[400px]:text-[9px] font-semibold uppercase tracking-[0.08em] ${toneStyles[tone]}`}
        >
          {change}
        </span>
      ) : null}
    </div>
  );
}
