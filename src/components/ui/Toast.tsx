import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

/* ─── Re-export toast helpers ────────────────────────────────────────────── */

export const toast = {
  /** Default informational message */
  info: (message: string, description?: string) =>
    sonnerToast(message, { description }),

  /** Success (teal) */
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),

  /** Warning */
  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description }),

  /** Error */
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description }),

  /** Medicine taken confirmation */
  taken: (medicineName: string) =>
    sonnerToast.success(`✅ ${medicineName} marked as taken`, {
      description: 'Keep up the great work!',
    }),

  /** Medicine snoozed */
  snoozed: (medicineName: string, minutes: number) =>
    sonnerToast(`⏰ ${medicineName} snoozed`, {
      description: `Reminder in ${minutes} minute${minutes !== 1 ? 's' : ''}`,
    }),

  /** Dismiss a specific toast by id */
  dismiss: sonnerToast.dismiss,

  /** Promise toast */
  promise: sonnerToast.promise,
};

/* ─── Toaster component ──────────────────────────────────────────────────── */

interface ToasterProps {
  /** Place in your app root once */
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
}

export function Toaster({ position = 'bottom-right' }: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      richColors
      expand={false}
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            'font-sans text-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-700',
          title: 'font-semibold text-slate-900 dark:text-slate-100',
          description: 'text-slate-500 dark:text-slate-400',
          success:
            '!bg-teal-50 !border-teal-200 dark:!bg-teal-900/30 dark:!border-teal-700',
          error:
            '!bg-red-50 !border-red-200 dark:!bg-red-900/30 dark:!border-red-700',
          warning:
            '!bg-amber-50 !border-amber-200 dark:!bg-amber-900/30 dark:!border-amber-700',
          actionButton:
            'bg-primary-500 text-white hover:bg-primary-600 rounded-lg text-xs font-medium',
          cancelButton:
            'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium',
          closeButton:
            'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
        },
      }}
    />
  );
}
