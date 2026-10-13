import { useState, useMemo } from 'react';
import {
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { toast } from 'sonner';
import { subDays, format, parseISO } from 'date-fns';
import { useDoseEvents } from '../hooks/useDoseEvents';
import { useMedicines } from '../hooks/useMedicines';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { formatInTz } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import type { DoseStatus } from '../types';

export function History() {
  const { config } = useHardwareConfig();
  const { medicines } = useMedicines();
  const tz = config?.timezone ?? 'Asia/Kolkata';

  // Date range for history (defaults to last 30 days)
  const [filterMed, setFilterMed] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFromDate, setFilterFromDate] = useState<string>(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );

  const { events } = useDoseEvents({
    from: `${filterFromDate}T00:00:00.000Z`,
  });

  // Modal for CSV export review
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterMed !== 'all' && e.medicine_name !== filterMed) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      return true;
    });
  }, [events, filterMed, filterStatus]);

  // Unique medicine names from events
  const uniqueMedicines = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.medicine_name) set.add(e.medicine_name);
    }
    return Array.from(set);
  }, [events]);

  // 14-day adherence chart dataset
  const chartData = useMemo(() => {
    const days: Array<{ date: string; displayDate: string; taken: number; missed: number }> = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = subDays(now, i);
      const dayIso = format(d, 'yyyy-MM-dd');
      const display = format(d, 'MMM dd');

      const dayEvents = events.filter(
        (e) => e.scheduled_for.slice(0, 10) === dayIso
      );

      const taken = dayEvents.filter((e) => e.status === 'taken').length;
      const missed = dayEvents.filter((e) => e.status === 'missed').length;

      days.push({
        date: dayIso,
        displayDate: display,
        taken,
        missed,
      });
    }

    return days;
  }, [events]);

  // Overall adherence percentage for filtered view
  const adherence = useMemo(() => {
    if (!filteredEvents.length) return 100;
    const taken = filteredEvents.filter((e) => e.status === 'taken').length;
    const resolved = filteredEvents.filter(
      (e) => e.status === 'taken' || e.status === 'missed'
    ).length;
    if (!resolved) return 100;
    return Math.round((taken / resolved) * 100);
  }, [filteredEvents]);

  // Generate CSV text
  const csvContent = useMemo(() => {
    const headers = ['Date', 'Time', 'Medicine', 'Dose', 'Slot', 'Status', 'Taken At', 'Taken Via'];
    const rows = filteredEvents.map((e) => [
      e.scheduled_for.slice(0, 10),
      formatInTz(e.scheduled_for, tz, 'HH:mm'),
      `"${e.medicine_name ?? ''}"`,
      `"${e.dose ?? ''}"`,
      e.slot_number ?? '',
      e.status,
      e.taken_at ? formatInTz(e.taken_at, tz, 'yyyy-MM-dd HH:mm:ss') : '',
      e.taken_via ?? '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }, [filteredEvents, tz]);

  // Trigger CSV Download
  const handleDownloadCsv = () => {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sage-bot-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded successfully.');
      setCsvModalOpen(false);
    } catch {
      toast.error('Failed to download CSV.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2>Dispensation History</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Adherence logs and timestamp records verified across hardware events.
          </p>
        </div>
        <button
          type="button"
          className="p sm flex items-center gap-1.5 font-bold"
          onClick={() => setCsvModalOpen(true)}
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Analytics Row: 14-day Chart & Adherence Score */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        <div className="md:col-span-8 retro-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Taken vs Missed (Past 14 Days)
            </h3>
            <span className="text-xs font-mono text-muted-foreground">Daily counts</span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="taken" name="Taken" fill="#0b7a5f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" name="Missed" fill="#bf3a2b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Adherence Radial / Gauge */}
        <div className="md:col-span-4 retro-card flex flex-col items-center justify-center text-center py-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
            Adherence Rate
          </h3>
          <div className="relative w-28 h-28 my-2">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="var(--bd)"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#0b7a5f"
                strokeWidth="10"
                strokeDasharray={`${2.512 * adherence} 251.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="text-2xl font-mono font-bold">{adherence}%</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Good</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Calculated across {filteredEvents.length} dose logs in filter.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="retro-card !p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs m-0 mb-1">Filter Medicine</label>
            <select
              value={filterMed}
              onChange={(e) => setFilterMed(e.target.value)}
              className="!min-h-[40px] text-xs"
            >
              <option value="all">All Medicines</option>
              {uniqueMedicines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs m-0 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="!min-h-[40px] text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="taken">Taken</option>
              <option value="due">Due</option>
              <option value="missed">Missed</option>
              <option value="snoozed">Snoozed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>

          <div>
            <label className="text-xs m-0 mb-1">From Date</label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="!min-h-[40px] text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="retro-card overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-200/60 dark:border-slate-700/60 text-muted-foreground font-sans text-left">
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Scheduled</th>
              <th className="p-2.5">Medicine</th>
              <th className="p-2.5">Slot</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Recorded At</th>
              <th className="p-2.5">Via</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground font-sans">
                  No records matching the filter criteria.
                </td>
              </tr>
            ) : (
              filteredEvents.slice(0, 100).map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-2.5 whitespace-nowrap">{evt.scheduled_for.slice(0, 10)}</td>
                  <td className="p-2.5 whitespace-nowrap font-bold">
                    {formatInTz(evt.scheduled_for, tz, 'HH:mm')}
                  </td>
                  <td className="p-2.5 font-sans font-semibold">
                    {evt.medicine_name}{' '}
                    {evt.dose && <span className="text-muted-foreground font-normal">({evt.dose})</span>}
                  </td>
                  <td className="p-2.5">S{evt.slot_number}</td>
                  <td className="p-2.5 whitespace-nowrap">
                    <Badge
                      size="sm"
                      label={evt.status}
                      variant={
                        evt.status === 'taken'
                          ? 'green'
                          : evt.status === 'due'
                          ? 'amber'
                          : evt.status === 'missed'
                          ? 'red'
                          : evt.status === 'snoozed'
                          ? 'purple'
                          : 'slate'
                      }
                    />
                  </td>
                  <td className="p-2.5 whitespace-nowrap text-muted-foreground">
                    {evt.taken_at ? formatInTz(evt.taken_at, tz, 'HH:mm:ss') : '—'}
                  </td>
                  <td className="p-2.5 whitespace-nowrap capitalize text-muted-foreground">
                    {evt.taken_via ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CSV Preview / Export Modal */}
      <Modal
        open={csvModalOpen}
        onOpenChange={setCsvModalOpen}
        title="Export History (CSV)"
        description="Verify and download comma-separated dispensation data."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setCsvModalOpen(false)}>
              Close
            </button>
            <button type="button" className="p sm font-bold" onClick={handleDownloadCsv}>
              <Download className="w-3.5 h-3.5 mr-1 inline" /> Download .csv
            </button>
          </>
        }
      >
        <div className="space-y-3 font-mono text-xs">
          <p className="font-sans text-xs text-muted-foreground">
            {filteredEvents.length} records ready for export.
          </p>
          <textarea
            rows={10}
            readOnly
            value={csvContent}
            className="w-full text-xs font-mono bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 rounded-lg"
          />
        </div>
      </Modal>
    </div>
  );
}
