import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Override default max-w-lg */
  maxWidth?: string;
  /** Hide the X close button */
  hideClose?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-lg',
  hideClose = false,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />

        {/* Panel */}
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl bg-white shadow-xl dark:bg-slate-900',
            'ring-1 ring-slate-200/60 dark:ring-slate-700/60',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            maxWidth,
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700/60">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {!hideClose && (
              <Dialog.Close
                className={cn(
                  'rounded-lg p-1 text-slate-400 transition-colors',
                  'hover:bg-slate-100 hover:text-slate-600',
                  'dark:hover:bg-slate-800 dark:hover:text-slate-300',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                )}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700/60 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Convenience re-export so callers can use <Modal.Trigger> without importing Dialog separately.
 */
export const ModalTrigger = Dialog.Trigger;
