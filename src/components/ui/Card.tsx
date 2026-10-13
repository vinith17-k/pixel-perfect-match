import { cn } from '../../lib/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export function Card({ children, className, title, action }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60',
        'dark:bg-slate-900 dark:ring-slate-700/60',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
          {title && (
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {title}
            </h3>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Borderless inner card for nesting inside another card */
export function CardInner({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50',
        className,
      )}
    >
      {children}
    </div>
  );
}
