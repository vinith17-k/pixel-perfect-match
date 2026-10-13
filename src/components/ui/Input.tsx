import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

/* ─── Shared field wrapper ───────────────────────────────────────────────── */

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

function FieldWrapper({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

/* ─── Base input classes ─────────────────────────────────────────────────── */

const inputBase = [
  'w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-800',
  'placeholder:text-slate-400',
  'transition-colors duration-150',
  'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
  'dark:focus:ring-primary-500',
  'min-h-[48px]',
].join(' ');

const inputBorder = {
  normal: 'border-slate-300 dark:border-slate-600',
  error: 'border-red-400 focus:ring-red-400 focus:border-red-400 dark:border-red-500',
};

/* ─── Input ──────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Element rendered inside the input on the left */
  leftElement?: React.ReactNode;
  /** Element rendered inside the input on the right */
  rightElement?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      required,
      id,
      leftElement,
      rightElement,
      className,
      wrapperClassName,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <FieldWrapper
        label={label}
        error={error}
        hint={hint}
        required={required}
        htmlFor={inputId}
        className={wrapperClassName}
      >
        <div className="relative flex items-center">
          {leftElement && (
            <span className="pointer-events-none absolute left-3 text-slate-400 dark:text-slate-500 [&>svg]:h-4 [&>svg]:w-4">
              {leftElement}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            className={cn(
              inputBase,
              error ? inputBorder.error : inputBorder.normal,
              leftElement && 'pl-9',
              rightElement && 'pr-9',
              className,
            )}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3 text-slate-400 dark:text-slate-500 [&>svg]:h-4 [&>svg]:w-4">
              {rightElement}
            </span>
          )}
        </div>
      </FieldWrapper>
    );
  },
);

Input.displayName = 'Input';

/* ─── Textarea ───────────────────────────────────────────────────────────── */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, id, className, wrapperClassName, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <FieldWrapper
        label={label}
        error={error}
        hint={hint}
        required={required}
        htmlFor={inputId}
        className={wrapperClassName}
      >
        <textarea
          ref={ref}
          id={inputId}
          required={required}
          className={cn(
            inputBase,
            'min-h-[96px] resize-y',
            error ? inputBorder.error : inputBorder.normal,
            className,
          )}
          {...props}
        />
      </FieldWrapper>
    );
  },
);

Textarea.displayName = 'Textarea';
