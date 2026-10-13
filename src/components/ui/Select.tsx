import { forwardRef, useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

/* ─── Field wrapper (shared) ─────────────────────────────────────────────── */

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

function FieldWrapper({ label, error, hint, required, htmlFor, children, className }: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700 dark:text-slate-300">
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

/* ─── Native Select ──────────────────────────────────────────────────────── */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, id, placeholder, className, wrapperClassName, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={selectId} className={wrapperClassName}>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            className={cn(
              'w-full appearance-none rounded-xl border bg-white px-3.5 py-3 pr-10 text-sm text-slate-800',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:bg-slate-800 dark:text-slate-100',
              'dark:focus:ring-primary-500',
              'min-h-[48px]',
              error
                ? 'border-red-400 focus:ring-red-400 focus:border-red-400 dark:border-red-500'
                : 'border-slate-300 dark:border-slate-600',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </FieldWrapper>
    );
  },
);

Select.displayName = 'Select';

/* ─── Combobox ───────────────────────────────────────────────────────────── */

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  wrapperClassName?: string;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select…',
  error,
  hint,
  required,
  disabled,
  id,
  wrapperClassName,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleSelect = useCallback(
    (opt: ComboboxOption) => {
      if (opt.disabled) return;
      onChange?.(opt.value);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={inputId} className={wrapperClassName}>
      <div ref={containerRef} className="relative">
        {/* Trigger button */}
        <button
          type="button"
          id={inputId}
          disabled={disabled}
          onClick={() => {
            setOpen((p) => !p);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={cn(
            'flex w-full items-center justify-between rounded-xl border bg-white px-3.5 py-3 text-sm',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-slate-800 dark:text-slate-100',
            'min-h-[48px]',
            error
              ? 'border-red-400 focus:ring-red-400 dark:border-red-500'
              : 'border-slate-300 dark:border-slate-600',
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={cn(selected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400')}>
            {selected ? (
              <span className="flex items-center gap-2">
                {selected.icon && <span className="shrink-0">{selected.icon}</span>}
                {selected.label}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {/* Search */}
            <div className="border-b border-slate-100 p-2 dark:border-slate-700">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            {/* Options */}
            <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No results</li>
              ) : (
                filtered.map((opt) => (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    aria-disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                      opt.disabled
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/60',
                      opt.value === value && 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
                    )}
                  >
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="flex-1">
                      <span className="block">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-xs text-slate-400 dark:text-slate-500">{opt.description}</span>
                      )}
                    </span>
                    {opt.value === value && <Check className="h-4 w-4 shrink-0 text-primary-500" />}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}
