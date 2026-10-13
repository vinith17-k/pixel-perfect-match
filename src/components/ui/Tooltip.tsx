import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/cn';

interface TooltipProps {
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Tooltip text content */
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Delay in ms before tooltip shows (default 400) */
  delayDuration?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delayDuration = 400,
  className,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={6}
            className={cn(
              'z-50 max-w-xs rounded-lg px-3 py-1.5 text-xs font-medium leading-snug',
              'bg-slate-900 text-slate-50 shadow-md dark:bg-slate-100 dark:text-slate-900',
              'animate-in fade-in-0 zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-2',
              'data-[side=left]:slide-in-from-right-2',
              'data-[side=right]:slide-in-from-left-2',
              'data-[side=top]:slide-in-from-bottom-2',
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-slate-900 dark:fill-slate-100" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
