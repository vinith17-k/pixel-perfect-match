import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '../../lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  /** Badge count shown after the label */
  badge?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  /** Visual style of the tab list */
  variant?: 'underline' | 'pill';
  className?: string;
  listClassName?: string;
}

export function Tabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  variant = 'underline',
  className,
  listClassName,
}: TabsProps) {
  const firstId = tabs[0]?.id;

  return (
    <RadixTabs.Root
      defaultValue={defaultValue ?? firstId}
      value={value}
      onValueChange={onValueChange}
      className={cn('flex flex-col', className)}
    >
      {/* Tab list */}
      <RadixTabs.List
        className={cn(
          variant === 'underline'
            ? 'flex gap-0 border-b border-slate-200 dark:border-slate-700'
            : 'flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800',
          listClassName,
        )}
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-40',

              variant === 'underline'
                ? [
                    'border-b-2 px-4 py-3 -mb-px',
                    'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                    'data-[state=active]:border-primary-500 data-[state=active]:text-primary-600',
                    'dark:data-[state=active]:border-primary-400 dark:data-[state=active]:text-primary-400',
                  ]
                : [
                    'flex-1 justify-center rounded-lg px-3 py-2',
                    'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                    'data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm',
                    'dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-slate-100',
                  ],
            )}
          >
            {tab.icon && (
              <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
            )}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none',
                  'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
                )}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {/* Tab panels */}
      {tabs.map((tab) => (
        <RadixTabs.Content
          key={tab.id}
          value={tab.id}
          className={cn(
            'flex-1 focus-visible:outline-none',
            'data-[state=inactive]:hidden',
          )}
        >
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
