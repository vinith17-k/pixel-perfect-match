import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
}

/** A single animated skeleton rectangle */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700',
        className,
      )}
    />
  );
}

/* ─── Preset skeletons ───────────────────────────────────────────────────── */

/** Skeleton for a single card row (icon + two text lines) */
export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

/** Skeleton for a card block with title + body lines */
export function SkeletonCard({ className, lines = 3 }: SkeletonProps & { lines?: number }) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60',
        className,
      )}
    >
      <Skeleton className="mb-4 h-4 w-1/3" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-3', i === lines - 1 ? 'w-4/6' : 'w-full')}
          />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for a stat summary box */
export function SkeletonStat({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60 space-y-3',
        className,
      )}
    >
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-2.5 w-2/3" />
    </div>
  );
}
