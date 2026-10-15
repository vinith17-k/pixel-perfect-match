import { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  RotateCw,
  Circle,
  Lightbulb,
  Volume2,
  CheckCircle2,
  XCircle,
  Minus,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Info,
  Zap,
  FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useCommands } from '../hooks/useCommands';
import { sendCommand } from '../lib/commands';
import { PART_META } from '../lib/hardware';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/cn';
import type { PartKey, HardwareConfig, Command } from '../types';

// ─── Icon map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Monitor,
  RotateCw,
  Circle,
  Lightbulb,
  Volume2,
};

function PartIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? Zap;
  return <Icon className={cn('h-5 w-5 shrink-0', className)} />;
}

// ─── Switch component ─────────────────────────────────────────────────────────

interface SwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  id?: string;
}

function Switch({ checked, onChange, disabled, id }: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-primary-500'
          : 'bg-slate-300 dark:bg-slate-600',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md',
          'transform transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ─── Degradation notes ────────────────────────────────────────────────────────

function degradationNote(key: PartKey, _config: HardwareConfig): string | null {
  switch (key) {
    case 'has_stepper':
      return 'Rotate commands will be simulated. OLED shows slot to use.';
    case 'has_button':
      return 'User taps Mark as taken on website.';
    case 'has_led':
      return 'Skipped silently.';
    case 'has_buzzer':
      return 'Skipped silently.';
    case 'has_oled':
      return 'Only website shows alerts.';
    default:
      return null;
  }
}

// ─── Test result display ──────────────────────────────────────────────────────

type TestState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'waiting'; commandId: number }
  | { phase: 'done'; command: Command }
  | { phase: 'error'; message: string };

function resultColor(status: Command['status']): string {
  switch (status) {
    case 'done':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    case 'simulated':
      return 'text-amber-400';
    default:
      return 'text-slate-400';
  }
}

// ─── Part Card ────────────────────────────────────────────────────────────────

interface PartCardProps {
  partKey: PartKey;
  config: HardwareConfig;
  commands: Command[];
  onToggle: (key: PartKey, value: boolean) => Promise<void>;
  toggling: boolean;
}

function PartCard({ partKey, config, commands, onToggle, toggling }: PartCardProps) {
  const meta = PART_META.find((p) => p.key === partKey)!;
  const isEnabled = config[partKey];
  const [testState, setTestState] = useState<TestState>({ phase: 'idle' });

  // Watch for command completion
  useEffect(() => {
    if (testState.phase !== 'waiting') return;
    const cmd = commands.find((c) => c.id === testState.commandId);
    if (cmd && (cmd.status === 'done' || cmd.status === 'failed' || cmd.status === 'simulated')) {
      setTestState({ phase: 'done', command: cmd });
    }
  }, [commands, testState]);

  const handleTest = useCallback(async () => {
    try {
      setTestState({ phase: 'sending' });
      const cmd = await sendCommand(meta.testCommand);
      setTestState({ phase: 'waiting', commandId: cmd.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send test command';
      setTestState({ phase: 'error', message: msg });
      toast.error(`Test failed: ${msg}`);
    }
  }, [meta.testCommand]);

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200',
        isEnabled
          ? 'border-primary-200 bg-white shadow-sm dark:border-primary-800/50 dark:bg-slate-900'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/30',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            isEnabled
              ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400'
              : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
          )}
        >
          <PartIcon name={meta.icon} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {meta.label}
          </p>
          <p
            className={cn(
              'text-xs',
              isEnabled
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {isEnabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>

        <Switch
          checked={isEnabled}
          onChange={(val) => onToggle(partKey, val)}
          disabled={toggling}
        />
      </div>

      {/* Expanded body when enabled */}
      {isEnabled && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700/60">

          {/* Pin table */}
          <div className="mb-3 overflow-hidden rounded-lg bg-slate-900 dark:bg-slate-950">
            <p className="border-b border-slate-700 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Wiring
            </p>
            <div className="divide-y divide-slate-800">
              {meta.pins.map(({ pin, label }) => (
                <div
                  key={pin + label}
                  className="grid grid-cols-[auto_1fr] items-center gap-0 px-3 py-1.5"
                >
                  <span className="font-mono text-xs font-semibold text-emerald-400 pr-3">
                    {pin}
                  </span>
                  <span className="font-mono text-xs text-slate-300">→ {label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Wiring note */}
          <p className="mb-2 text-xs italic text-slate-500 dark:text-slate-400">
            {meta.wiringNote}
          </p>

          {/* Warning */}
          {meta.warning && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-900/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                {meta.warning}
              </p>
            </div>
          )}

          {/* Test button + result */}
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={
                testState.phase === 'sending' || testState.phase === 'waiting' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FlaskConical className="h-3.5 w-3.5" />
                )
              }
              loading={false}
              disabled={testState.phase === 'sending' || testState.phase === 'waiting'}
              onClick={handleTest}
            >
              {testState.phase === 'waiting' ? 'Waiting for device…' : `Test ${meta.shortLabel}`}
            </Button>

            {testState.phase === 'done' && (
              <div className="rounded-lg bg-slate-900 px-3 py-2 dark:bg-slate-950">
                <p
                  className={cn(
                    'font-mono text-xs',
                    resultColor(testState.command.status),
                  )}
                >
                  [{testState.command.status.toUpperCase()}]{' '}
                  {testState.command.result
                    ? JSON.stringify(testState.command.result)
                    : 'No result payload'}
                </p>
              </div>
            )}

            {testState.phase === 'error' && (
              <div className="rounded-lg bg-red-900/30 px-3 py-2">
                <p className="font-mono text-xs text-red-400">{testState.message}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed degradation note */}
      {!isEnabled && (() => {
        const note = degradationNote(partKey, config);
        return note ? (
          <div className="border-t border-slate-200 px-4 py-2.5 dark:border-slate-700/60">
            <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              {note}
            </p>
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700', className)}
    />
  );
}

// ─── Next-step suggestions ────────────────────────────────────────────────────

interface Suggestion {
  icon: React.ElementType;
  text: string;
}

function getSuggestions(config: HardwareConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (!config.has_oled) {
    suggestions.push({
      icon: Monitor,
      text: 'Connect an I²C OLED (0x3C) for on-device status display.',
    });
  }

  if (config.has_oled && !config.has_stepper) {
    suggestions.push({
      icon: RotateCw,
      text: 'Next: Connect stepper + ULN2003 driver for automatic dispensing.',
    });
  }

  if (config.has_stepper && !config.has_button) {
    suggestions.push({
      icon: Circle,
      text: 'Add a push button so patients can mark doses at the device.',
    });
  }

  if (config.has_stepper && !config.has_led) {
    suggestions.push({
      icon: Lightbulb,
      text: 'Add an LED indicator for visual dose alerts.',
    });
  }

  if (config.has_stepper && !config.has_buzzer) {
    suggestions.push({
      icon: Volume2,
      text: 'Add a buzzer for audible dose alarms.',
    });
  }

  if (
    config.has_oled &&
    config.has_stepper &&
    config.has_button &&
    config.has_led &&
    config.has_buzzer
  ) {
    suggestions.push({
      icon: CheckCircle2,
      text: 'All currently supported hardware components are enabled.',
    });
  }

  return suggestions;
}

// ─── Developer Section ────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
) as string;

const ESP32_ENDPOINTS = [
  `POST /rest/v1/rpc/claim_next_command`,
  `POST /rest/v1/rpc/complete_device_command`,
  `PATCH /rest/v1/device_status?id=eq.1`,
  `GET /rest/v1/schedules?enabled=eq.true`,
  `POST /rest/v1/rpc/mark_dose_taken`,
];

function DeveloperSection() {
  const [keyCopied, setKeyCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const maskedKey = SUPABASE_KEY
    ? `${SUPABASE_KEY.slice(0, 10)}…`
    : '(not set)';

  const copyToClipboard = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Card title="Developer / ESP32 Integration">
      <div className="space-y-5">
        {/* Supabase URL */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Supabase URL
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <code className="flex-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">
              {SUPABASE_URL || '(VITE_SUPABASE_URL not set)'}
            </code>
            <button
              type="button"
              title="Copy URL"
              onClick={() => copyToClipboard(SUPABASE_URL, setUrlCopied)}
              className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {urlCopied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Publishable key */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Publishable key (masked)
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <code className="flex-1 font-mono text-xs text-slate-700 dark:text-slate-200">
              {maskedKey}
            </code>
            <button
              type="button"
              title="Copy full publishable key"
              onClick={() => copyToClipboard(SUPABASE_KEY, setKeyCopied)}
              className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {keyCopied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Required headers */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Required Headers
          </p>
          <div className="overflow-hidden rounded-lg bg-slate-900 dark:bg-slate-950">
            <pre className="px-4 py-3 font-mono text-xs leading-6 text-slate-200">
              {`apikey: ANON_KEY\nAuthorization: Bearer ANON_KEY`}
            </pre>
          </div>
        </div>

        {/* Endpoints */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ESP32 Endpoints
          </p>
          <div className="overflow-x-auto overflow-hidden rounded-lg bg-slate-900 dark:bg-slate-950">
            <pre className="px-4 py-3 font-mono text-xs leading-6">
              {ESP32_ENDPOINTS.map((ep, i) => {
                const method = ep.split(' ')[0];
                const path = ep.slice(method.length + 1);
                const methodColor =
                  method === 'GET'
                    ? 'text-emerald-400'
                    : method === 'POST'
                    ? 'text-blue-400'
                    : 'text-amber-400';
                return (
                  <span key={i} className="block">
                    <span className={cn('font-semibold', methodColor)}>{method}</span>
                    <span className="text-slate-300"> {path}</span>
                  </span>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Hardware() {
  const { config, loading: configLoading, update } = useHardwareConfig();
  const { status, loading: statusLoading } = useDeviceStatus();
  const { commands } = useCommands();

  const [toggling, setToggling] = useState<PartKey | null>(null);

  const handleToggle = useCallback(
    async (key: PartKey, value: boolean) => {
      if (!config) return;
      setToggling(key);
      try {
        await update({ [key]: value });
        toast.success(
          `${PART_META.find((p) => p.key === key)?.label} ${value ? 'enabled' : 'disabled'}.`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setToggling(null);
      }
    },
    [config, update],
  );

  // Progress
  const enabledCount = config
    ? PART_META.filter((p) => config[p.key]).length
    : 0;
  const totalParts = PART_META.length;

  const suggestions = config ? getSuggestions(config) : [];

  // Loading skeleton
  if (configLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
          Could not load hardware config
        </p>
        <p className="text-sm text-slate-500">
          Check your Supabase connection and the hardware_config table.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Hardware Setup
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure which physical parts are connected to your ESP32.
        </p>
      </div>

      {/* ── Section 1: Progress Bar ── */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {enabledCount} of {totalParts} parts connected
            </p>
            <Badge
              label={
                enabledCount === totalParts
                  ? 'Fully configured'
                  : enabledCount === 0
                  ? 'No parts enabled'
                  : 'Partial setup'
              }
              variant={
                enabledCount === totalParts
                  ? 'green'
                  : enabledCount === 0
                  ? 'red'
                  : 'amber'
              }
              size="sm"
            />
          </div>

          {/* Track */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-3 rounded-full bg-primary-500 transition-all duration-500"
              style={{ width: `${(enabledCount / totalParts) * 100}%` }}
            />
          </div>

          {/* Mini chip row */}
          <div className="flex flex-wrap gap-1.5">
            {PART_META.map((p) => (
              <span
                key={p.key}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-medium',
                  config[p.key]
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                )}
              >
                {p.shortLabel}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Section 2: Part Toggle Cards ── */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          Parts
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PART_META.map((p) => (
            <PartCard
              key={p.key}
              partKey={p.key}
              config={config}
              commands={commands}
              onToggle={handleToggle}
              toggling={toggling !== null}
            />
          ))}
        </div>
      </section>

      {/* ── Section 3: Device Self-Report ── */}
      <Card title="Device Self-Report">
        {statusLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : status?.parts_ok ? (
          <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700/60">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {PART_META.map((p) => {
                  const ok = status.parts_ok![p.key];
                  return (
                    <tr key={p.key} className="bg-white dark:bg-slate-900">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {ok === true ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                          ) : ok === false ? (
                            <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                          ) : (
                            <Minus className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {p.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500 dark:text-slate-400">
                        {ok === true
                          ? p.key === 'has_oled'
                            ? 'Found on I²C 0x3C'
                            : 'OK'
                          : ok === false
                          ? 'Not configured'
                          : 'No report'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-6 text-center dark:bg-slate-800/40">
            <Minus className="h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No self-report from device yet. The ESP32 hasn't posted its parts status.
            </p>
          </div>
        )}
      </Card>

      {/* ── Section 4: Positioning limitation ── */}
      {config.has_stepper && (
        <Card title="Carousel Positioning">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Position is estimated from the boot position. With no position sensor installed, the device cannot automatically re-home after a restart; align the carousel manually before relying on slot selection.
          </p>
        </Card>
      )}

      {/* ── Section 5: What to do next ── */}
      {suggestions.length > 0 && (
        <Card title="What to do next">
          <ul className="space-y-3">
            {suggestions.map((s, i) => {
              const Icon = s.icon;
              const isComplete = s.icon === CheckCircle2;
              return (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      isComplete
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-primary-100 dark:bg-primary-900/30',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        isComplete
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-primary-600 dark:text-primary-400',
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      'text-sm',
                      isComplete
                        ? 'font-medium text-green-700 dark:text-green-300'
                        : 'text-slate-700 dark:text-slate-300',
                    )}
                  >
                    {s.text}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ── Section 6: Developer Section ── */}
      <DeveloperSection />
    </div>
  );
}
