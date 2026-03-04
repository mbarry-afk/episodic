const SIZES = {
  leaderboard: { width: 728, height: 90,  label: "Leaderboard 728×90" },
  rectangle:   { width: 300, height: 250, label: "Medium Rectangle 300×250" },
} as const;

export type AdSize = keyof typeof SIZES;

interface AdUnitProps {
  size: AdSize;
  className?: string;
}

export function AdUnit({ size, className = "" }: AdUnitProps) {
  const { width, height, label } = SIZES[size];

  return (
    <div
      style={{ width, height }}
      className={`flex flex-col items-center justify-center gap-1 border border-dashed border-zinc-700 bg-zinc-900 text-zinc-600 ${className}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest">
        Advertisement
      </span>
      <span className="text-[10px]">{label}</span>
    </div>
  );
}
