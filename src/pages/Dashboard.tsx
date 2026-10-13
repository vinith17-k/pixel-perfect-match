import { useState, useMemo } from 'react';
import {
  Bell,
  Check,
  RotateCw,
  Clock,
  Sparkles,
  Wifi,
  ChevronRight,
  Send,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useCommands } from '../hooks/useCommands';
import { useSlots } from '../hooks/useSlots';
import { useSchedules } from '../hooks/useSchedules';
import { useDoseEvents } from '../hooks/useDoseEvents';
import { useAppStore, useAppDispatch } from '../stores/appStore';
import { sendCommand, markTaken, snoozeDose, skipDose } from '../lib/commands';
import { PART_META } from '../lib/hardware';
import {
  formatInTz,
  countdown,
  rssiToBars,
  rssiToLabel,
} from '../lib/utils';
import { fastForward } from '../lib/simulator';
import { OledPreview } from '../components/OledPreview';
import { VirtualHardwareStage } from '../components/VirtualHardwareStage';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';

export function Dashboard() {
  const { config } = useHardwareConfig();
  const { status, isOnline } = useDeviceStatus();
  const { commands } = useCommands();
  const { slots } = useSlots();
  const { schedules } = useSchedules();
  const { todayEvents, dueEvents } = useDoseEvents();
  const { deviceName, simulatorMode } = useAppStore();
  const dispatch = useAppDispatch();

  // Modals state
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  const [msgLines, setMsgLines] = useState({ line1: '', line2: '', line3: '' });
  const [rotModalOpen, setRotModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [isSendingCmd, setIsSendingCmd] = useState(false);

  const tz = config?.timezone ?? 'Asia/Kolkata';

  // Active alarm dose (first due event)
  const activeAlarm = dueEvents[0] ?? null;

  // Next upcoming dose (future scheduled dose for today)
  const nextDose = useMemo(() => {
    if (!schedules.length) return null;
    const nowStr = new Date().toISOString();
    // Filter today events that are upcoming or snoozed
    const upcomingFromEvents = todayEvents
      .filter((e) => e.status === 'due' || e.status === 'snoozed' || (e.scheduled_for > nowStr && e.status !== 'taken' && e.status !== 'skipped' && e.status !== 'missed'))
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0];

    if (upcomingFromEvents) return upcomingFromEvents;

    // Or find from schedules matching current day
    const now = new Date();
    const dayOfWeek = now.getDay();
    const activeScheds = schedules
      .filter((s) => s.enabled && s.days.includes(dayOfWeek) && s.medicine)
      .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));

    if (!activeScheds.length) return null;

    // Find first schedule whose time_of_day is after current local time
    const currentLocalTime = formatInTz(nowStr, tz, 'HH:mm:ss');
    const nextSched = activeScheds.find((s) => s.time_of_day >= currentLocalTime) ?? activeScheds[0];

    if (!nextSched) return null;

    return {
      id: nextSched.id,
      slot_number: nextSched.slot_number,
      medicine_name: nextSched.medicine?.name ?? `Slot ${nextSched.slot_number}`,
      dose: nextSched.medicine?.dose ?? '',
      scheduled_for: nowStr, // display purpose
      time_of_day: nextSched.time_of_day,
      status: 'upcoming' as const,
    };
  }, [schedules, todayEvents, tz]);

  // Adherence calculation
  const stats = useMemo(() => {
    const takenCount = todayEvents.filter((e) => e.status === 'taken').length;
    const totalToday = todayEvents.length;
    const adherence = totalToday > 0 ? Math.round((takenCount / totalToday) * 100) : 100;

    const lowStockCount = slots.filter(
      (s) => s.status === 'loaded' && s.pills_remaining <= (config?.low_stock_threshold ?? 3)
    ).length;

    return { adherence, takenCount, totalToday, lowStockCount };
  }, [todayEvents, slots, config]);

  // Handle Mark Taken
  const handleMarkTaken = async (eventId: string) => {
    try {
      await markTaken(eventId);
      toast.success('Dose marked as taken! Dispenser updated.');
    } catch {
      toast.error('Failed to mark dose taken.');
    }
  };

  // Handle Snooze
  const handleSnooze = async (eventId: string) => {
    try {
      const mins = config?.snooze_minutes ?? 10;
      await snoozeDose(eventId, mins);
      toast.info(`Snoozed for ${mins} minutes.`);
    } catch {
      toast.error('Failed to snooze dose.');
    }
  };

  // Handle Skip
  const handleSkip = async (eventId: string) => {
    try {
      await skipDose(eventId);
      toast.warning('Dose skipped.');
    } catch {
      toast.error('Failed to skip dose.');
    }
  };

  // Send message to OLED
  const handleSendMessage = async () => {
    const lines = [msgLines.line1, msgLines.line2, msgLines.line3].filter(Boolean);
    if (!lines.length) {
      toast.error('Please enter at least one line.');
      return;
    }
    setIsSendingCmd(true);
    try {
      await sendCommand('show_message', { lines, seconds: 5 });
      toast.success('Message sent to OLED!');
      setMsgModalOpen(false);
      setMsgLines({ line1: '', line2: '', line3: '' });
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setIsSendingCmd(false);
    }
  };

  // Rotate to slot
  const handleRotate = async (slotNum: number) => {
    setIsSendingCmd(true);
    try {
      const res = await sendCommand('rotate_to_slot', { slot: slotNum, mode: 'dispense' });
      if (!config?.has_stepper) {
        toast.info(`Simulated: Stepper not enabled. OLED shows LOAD SLOT ${slotNum}.`);
      } else {
        toast.success(`Rotating disc to Slot ${slotNum}... (Command #${res.id})`);
      }
      setRotModalOpen(false);
    } catch {
      toast.error('Failed to send rotate command.');
    } finally {
      setIsSendingCmd(false);
    }
  };

  // Test Alarm
  const handleFastForward = async () => {
    try {
      if (simulatorMode && config) {
        await fastForward(schedules, slots, config);
        toast.success('Simulated alarm triggered!');
      } else {
        await sendCommand('test_alarm', { slot: 1 });
        toast.success('Test alarm sent to device!');
      }
    } catch {
      toast.error('Failed to trigger test alarm.');
    }
  };

  const wifiBars = rssiToBars(status?.rssi ?? null);

  return (
    <div className="space-y-6">
      {/* Offline warning banner if not online */}
      {!isOnline && (
        <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>Device is currently offline. Commands will be queued until it reconnects.</span>
          </div>
          <span className="text-xs opacity-75 font-mono">Last seen: {status?.last_seen ? formatInTz(status.last_seen, tz, 'HH:mm:ss') : 'Never'}</span>
        </div>
      )}

      {/* Interactive Virtual Hardware Simulator Stage */}
      <VirtualHardwareStage />

      {/* Main 2-column layout matching the Sage Bot physical enclosure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Alarm Banner / Next Dose + Today's Doses + Stats */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Alarm Banner if due */}
          {activeAlarm ? (
            <div className="alarm-card" role="alert">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <Bell className="w-5 h-5 animate-bounce" />
                  <span className="text-sm uppercase tracking-wider">DOSE DUE NOW</span>
                </div>
                {!config?.has_stepper && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-mono font-bold">
                    Virtual Slot {activeAlarm.slot_number}
                  </span>
                )}
              </div>

              <div className="my-3">
                <h2 className="text-2xl font-bold tracking-tight">
                  {activeAlarm.medicine_name}
                </h2>
                <p className="text-sm font-medium opacity-80">
                  {activeAlarm.dose} &middot; Compartment Slot {activeAlarm.slot_number}
                </p>
                {!config?.has_button && (
                  <p className="text-xs font-semibold mt-1 text-amber-900 dark:text-amber-200">
                    Physical button is off — mark as taken here on the website.
                  </p>
                )}
                {dueEvents.length > 1 && (
                  <p className="text-xs font-bold mt-1 text-amber-800 dark:text-amber-300">
                    +{dueEvents.length - 1} more dose queued
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => handleMarkTaken(activeAlarm.id)}
                  className="p sm flex-1 min-w-[140px] flex items-center justify-center gap-2 !bg-emerald-700 !text-white !border-emerald-800 font-bold"
                >
                  <Check className="w-4 h-4" />
                  Mark as taken
                </button>
                <button
                  type="button"
                  onClick={() => handleSnooze(activeAlarm.id)}
                  className="sm flex-1 min-w-[100px] flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Snooze ({config?.snooze_minutes ?? 10}m)
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(activeAlarm.id)}
                  className="sm d flex-1 min-w-[80px]"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : nextDose ? (
            /* Next Dose Card */
            <div className="retro-card">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Next Dose
                </span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {countdown(nextDose.scheduled_for)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {nextDose.medicine_name}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {nextDose.dose ? `${nextDose.dose} · ` : ''}Slot {nextDose.slot_number} &middot;{' '}
                    {'time_of_day' in nextDose && nextDose.time_of_day
                      ? (nextDose.time_of_day as string).slice(0, 5)
                      : formatInTz(nextDose.scheduled_for, tz, 'HH:mm')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRotate(nextDose.slot_number ?? 1)}
                  className="sm flex items-center gap-1.5"
                  title={config?.has_stepper ? 'Rotate disc to slot' : 'Rotate (simulated)'}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Slot {nextDose.slot_number}
                </button>
              </div>
            </div>
          ) : (
            <div className="retro-card text-center py-8">
              <Sparkles className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400 mb-2 opacity-80" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">All Done For Today</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No more doses scheduled for today. Have a restful day!
              </p>
            </div>
          )}

          {/* Today's doses timeline */}
          <div className="retro-card">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Today's Schedule
              </h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {stats.takenCount} of {stats.totalToday} taken
              </span>
            </div>

            {todayEvents.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                No doses recorded for today yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {todayEvents.map((evt) => (
                  <div key={evt.id} className={`tli ${evt.status} py-2.5`}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">
                        {formatInTz(evt.scheduled_for, tz, 'HH:mm')}
                      </span>
                      <span className="font-semibold text-sm">
                        {evt.medicine_name}
                      </span>
                      <span className="text-xs opacity-60">
                        S{evt.slot_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        size="sm"
                        label={
                          evt.status === 'taken'
                            ? `Taken ${evt.taken_at ? formatInTz(evt.taken_at, tz, 'HH:mm') : ''}${evt.taken_via ? ` (${evt.taken_via})` : ''}`
                            : evt.status === 'due'
                            ? 'Due now'
                            : evt.status
                        }
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="stats">
            <div>
              <b>{stats.adherence}%</b>
              <span>Adherence</span>
            </div>
            <div>
              <b>{stats.takenCount}</b>
              <span>Taken Today</span>
            </div>
            <div className={stats.lowStockCount > 0 ? 'warn' : ''}>
              <b>{stats.lowStockCount}</b>
              <span>Low Stock Slots</span>
            </div>
          </div>
        </div>

        {/* Right Column: OLED Preview & Hardware Tools */}
        <div className="lg:col-span-5 space-y-6">
          {/* OLED Screen Bezel Card */}
          <div className={`retro-card ${activeAlarm ? 'ring-2 ring-amber-500/80 ring-offset-2' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                OLED Monitor
              </h3>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>{rssiToLabel(status?.rssi ?? null)} ({wifiBars}/4)</span>
              </div>
            </div>

            {/* Canvas/Display component */}
            <div className="flex justify-center my-2">
              <OledPreview
                screen={status?.oled_screen ?? null}
                oledEnabled={config?.has_oled ?? true}
                deviceOnline={isOnline}
              />
            </div>

            {/* Encoder Controls simulation bar */}
            <div className="ctl mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="ledw">
                <i className={`led ${isOnline ? 'live' : ''}`} />
                <span>LED {config?.has_led ? 'ON' : 'OFF'}</span>
              </span>
              <span className="text-xs font-mono text-slate-500 uppercase">
                {status?.state ?? 'IDLE'}
              </span>
              <span className="ledw">
                <button
                  type="button"
                  className="knob"
                  title="Simulate rotary encoder"
                  onClick={() => {
                    toast.info('Rotary encoder turned!');
                  }}
                />
                <span>ENCODER</span>
              </span>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="retro-card space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="sm flex items-center justify-center gap-1.5"
                onClick={async () => {
                  try {
                    await sendCommand('test_oled', {});
                    toast.success('OLED test pattern requested.');
                  } catch {
                    toast.error('Failed to trigger OLED test.');
                  }
                }}
              >
                Test OLED
              </button>
              <button
                type="button"
                className="sm flex items-center justify-center gap-1.5"
                onClick={() => setMsgModalOpen(true)}
              >
                Send Message
              </button>
              <button
                type="button"
                className="sm flex items-center justify-center gap-1.5"
                onClick={() => setRotModalOpen(true)}
              >
                Rotate to Slot
              </button>
              <button
                type="button"
                className="sm flex items-center justify-center gap-1.5"
                onClick={handleFastForward}
              >
                <Play className="w-3 h-3 text-amber-600" />
                Test Alarm
              </button>
            </div>
          </div>

          {/* Recent Commands Drawer trigger card */}
          <div className="retro-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Command Log
              </h3>
              <button
                type="button"
                className="sm text-xs font-bold"
                onClick={() => dispatch({ type: 'TOGGLE_COMMAND_DRAWER' })}
              >
                View all ({commands.length})
              </button>
            </div>
            {commands.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No commands issued yet.</p>
            ) : (
              <div className="space-y-1.5 text-xs font-mono">
                {commands.slice(0, 3).map((cmd) => (
                  <div
                    key={cmd.id}
                    className="flex items-center justify-between p-1.5 rounded bg-slate-100 dark:bg-slate-800"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      #{cmd.id} {cmd.type}
                    </span>
                    <Badge
                      size="sm"
                      label={cmd.status}
                      variant={
                        cmd.status === 'done'
                          ? 'green'
                          : cmd.status === 'pending'
                          ? 'amber'
                          : cmd.status === 'simulated'
                          ? 'purple'
                          : 'red'
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Show Message on OLED */}
      <Modal
        open={msgModalOpen}
        onOpenChange={setMsgModalOpen}
        title="Show Message on OLED"
        description="Display up to 3 custom lines on the device display."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setMsgModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="p sm"
              disabled={isSendingCmd}
              onClick={handleSendMessage}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Send to Device
            </button>
          </>
        }
      >
        <div className="space-y-3 font-mono">
          <div>
            <label className="text-xs">Line 1 (Max 16 chars)</label>
            <input
              type="text"
              maxLength={16}
              placeholder="e.g. Sage Bot"
              value={msgLines.line1}
              onChange={(e) => setMsgLines({ ...msgLines, line1: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs">Line 2 (Max 16 chars)</label>
            <input
              type="text"
              maxLength={16}
              placeholder="e.g. Good morning!"
              value={msgLines.line2}
              onChange={(e) => setMsgLines({ ...msgLines, line2: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs">Line 3 (Max 16 chars)</label>
            <input
              type="text"
              maxLength={16}
              placeholder="e.g. Remember water"
              value={msgLines.line3}
              onChange={(e) => setMsgLines({ ...msgLines, line3: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Rotate to Slot */}
      <Modal
        open={rotModalOpen}
        onOpenChange={setRotModalOpen}
        title="Rotate Disc to Slot"
        description="Position a specific medicine compartment at the dispense chute."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setRotModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="p sm"
              disabled={isSendingCmd}
              onClick={() => handleRotate(selectedSlot)}
            >
              Rotate Disc
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {!config?.has_stepper && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold">
              Stepper motor is currently OFF in Hardware settings. This command will be logged as simulated, and the OLED will display "LOAD SLOT {selectedSlot}".
            </div>
          )}
          <label className="text-xs">Select Target Slot</label>
          <select
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(Number(e.target.value))}
          >
            {slots.slice(0, config?.num_slots ?? 8).map((s) => (
              <option key={s.slot_number} value={s.slot_number}>
                Slot {s.slot_number} {s.medicine ? `— ${s.medicine.name} (${s.pills_remaining} pills)` : '(Empty)'}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
