import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '../../lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  id,
  className,
}: SwitchProps) {
  const switchId = id ?? (label ? `switch-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    /* min-h-[48px] ensures the entire row is a comfortable tap target */
    <div className={cn('flex min-h-[48px] items-center justify-between gap-4', className)}>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              htmlFor={switchId}
              className={cn(
                'cursor-pointer text-sm font-medium text-slate-800 dark:text-slate-200',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={cn('text-xs text-slate-500 dark:text-slate-400', disabled && 'opacity-50')}>
              {description}
            </p>
          )}
        </div>
      )}

      <RadixSwitch.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'bg-primary-500'
            : 'bg-slate-200 dark:bg-slate-600',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md',
            'transition-transform duration-200 ease-in-out',
            'data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0.5',
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
}
