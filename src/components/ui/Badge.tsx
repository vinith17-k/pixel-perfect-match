import { cn } from '../../lib/cn';

type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'purple' | 'teal';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  green: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    dot: 'bg-green-500',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  red: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
  },
  blue: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  purple: {
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  teal: {
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5 gap-1 rounded-md',
  md: 'text-sm px-2.5 py-1 gap-1.5 rounded-lg',
};

export function Badge({
  label,
  variant = 'slate',
  size = 'md',
  icon,
  dot = false,
  className,
}: BadgeProps) {
  const { badge, dot: dotColor } = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium',
        badge,
        sizeStyles[size],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('shrink-0 rounded-full', dotColor, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')}
        />
      )}
      {!dot && icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {label}
    </span>
  );
}
