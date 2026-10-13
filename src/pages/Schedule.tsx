import { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Check,
  List,
  Grid,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchedules } from '../hooks/useSchedules';
import { useSlots } from '../hooks/useSlots';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { supabase } from '../lib/supabase';
import { DAY_LABELS, formatInTz } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import type { Schedule } from '../types';

export function Schedule() {
  const { schedules, refresh: refreshSchedules } = useSchedules();
  const { slots } = useSlots();
  const { config } = useHardwareConfig();

  const [viewMode, setViewMode] = useState<'list' | 'week'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Form states
  const [formSlot, setFormSlot] = useState<number>(1);
  const [formTime, setFormTime] = useState('08:00');
  const [formDays, setFormDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [formPills, setFormPills] = useState(1);
  const [formEnabled, setFormEnabled] = useState(true);

  const tz = config?.timezone ?? 'Asia/Kolkata';

  // Loaded slots only
  const loadedSlots = useMemo(
    () => slots.filter((s) => s.status === 'loaded' && s.medicine_id),
    [slots]
  );

  // Group schedules by slot
  const schedulesBySlot = useMemo(() => {
    const map = new Map<number, Schedule[]>();
    for (const sched of schedules) {
      const arr = map.get(sched.slot_number) ?? [];
      arr.push(sched);
      map.set(sched.slot_number, arr);
    }
    return map;
  }, [schedules]);

  // Open modal for new schedule
  const handleOpenAdd = () => {
    if (!loadedSlots.length) {
      toast.error('No loaded compartments found. Load medicine in Slots first!');
      return;
    }
    setEditingSchedule(null);
    setFormSlot(loadedSlots[0]?.slot_number ?? 1);
    setFormTime('08:00');
    setFormDays([0, 1, 2, 3, 4, 5, 6]);
    setFormPills(1);
    setFormEnabled(true);
    setModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (sched: Schedule) => {
    setEditingSchedule(sched);
    setFormSlot(sched.slot_number);
    setFormTime(sched.time_of_day.slice(0, 5));
    setFormDays(sched.days);
    setFormPills(sched.pills_per_dose);
    setFormEnabled(sched.enabled);
    setModalOpen(true);
  };

  // Toggle day selection
  const toggleDay = (dayIndex: number) => {
    if (formDays.includes(dayIndex)) {
      if (formDays.length === 1) {
        toast.warning('Schedule must have at least one active day.');
        return;
      }
      setFormDays(formDays.filter((d) => d !== dayIndex));
    } else {
      setFormDays([...formDays, dayIndex].sort());
    }
  };

  // Save schedule
  const handleSave = async () => {
    if (!formTime) {
      toast.error('Please select a time of day.');
      return;
    }
    if (!formDays.length) {
      toast.error('Please select at least one day of the week.');
      return;
    }
    if (formPills < 1) {
      toast.error('Pills per dose must be at least 1.');
      return;
    }

    const slot = slots.find((s) => s.slot_number === formSlot);
    if (!slot || !slot.medicine_id) {
      toast.error('Selected slot is empty. Please choose a loaded slot.');
      return;
    }

    // Check collision with another slot's schedule at identical time
    const collision = schedules.find(
      (s) =>
        s.slot_number !== formSlot &&
        s.time_of_day.slice(0, 5) === formTime &&
        s.days.some((d) => formDays.includes(d)) &&
        (!editingSchedule || s.id !== editingSchedule.id)
    );

    if (collision) {
      toast.info(
        'Note: Another slot shares this time. The device will run them 1 minute apart automatically.'
      );
    }

    try {
      const timeFormatted = `${formTime}:00`;

      if (editingSchedule) {
        const { error } = await supabase
          .from('schedules')
          .update({
            slot_number: formSlot,
            medicine_id: slot.medicine_id,
            time_of_day: timeFormatted,
            days: formDays,
            pills_per_dose: formPills,
            enabled: formEnabled,
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;
        toast.success('Schedule updated.');
      } else {
        const { error } = await supabase.from('schedules').insert({
          slot_number: formSlot,
          medicine_id: slot.medicine_id,
          time_of_day: timeFormatted,
          days: formDays,
          pills_per_dose: formPills,
          enabled: formEnabled,
        });

        if (error) throw error;
        toast.success('New schedule created.');
      }

      setModalOpen(false);
      refreshSchedules();
    } catch {
      toast.error('Failed to save schedule.');
    }
  };

  // Toggle enabled
  const handleToggleEnabled = async (sched: Schedule) => {
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ enabled: !sched.enabled })
        .eq('id', sched.id);

      if (error) throw error;
      toast.success(sched.enabled ? 'Schedule paused.' : 'Schedule enabled.');
      refreshSchedules();
    } catch {
      toast.error('Failed to toggle schedule.');
    }
  };

  // Delete schedule
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Schedule deleted.');
      refreshSchedules();
    } catch {
      toast.error('Failed to delete schedule.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2>Medication Schedule</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Automated dosing times synchronized to the ESP32 internal clock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              className={`sm !min-h-[34px] !py-1 !px-2.5 text-xs font-bold !shadow-none !border-0 ${
                viewMode === 'list'
                  ? '!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100'
                  : '!bg-transparent !text-slate-600 dark:!text-slate-400'
              }`}
              onClick={() => setViewMode('list')}
            >
              <List className="w-3.5 h-3.5 inline mr-1" /> List
            </button>
            <button
              type="button"
              className={`sm !min-h-[34px] !py-1 !px-2.5 text-xs font-bold !shadow-none !border-0 ${
                viewMode === 'week'
                  ? '!bg-white dark:!bg-slate-700 !text-slate-800 dark:!text-slate-100'
                  : '!bg-transparent !text-slate-600 dark:!text-slate-400'
              }`}
              onClick={() => setViewMode('week')}
            >
              <Grid className="w-3.5 h-3.5 inline mr-1" /> Week Grid
            </button>
          </div>

          <button
            type="button"
            className="p sm flex items-center gap-1.5 font-bold"
            onClick={handleOpenAdd}
          >
            <Plus className="w-4 h-4" /> Add Schedule
          </button>
        </div>
      </div>

      {/* Week Grid View */}
      {viewMode === 'week' ? (
        <div className="retro-card overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-slate-700/60">
                <th className="p-2 text-left text-muted-foreground font-sans">Time</th>
                {DAY_LABELS.map((d) => (
                  <th key={d} className="p-2 text-center text-muted-foreground font-sans">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {schedules
                .slice()
                .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day))
                .map((sched) => (
                  <tr key={sched.id}>
                    <td className="p-2 font-bold whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {sched.time_of_day.slice(0, 5)} <span className="opacity-60 font-normal">S{sched.slot_number}</span>
                    </td>
                    {DAY_LABELS.map((_, i) => (
                      <td key={i} className="p-2 text-center">
                        {sched.days.includes(i) && sched.enabled ? (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                            style={{ backgroundColor: sched.medicine?.color ?? '#14b8a6' }}
                          >
                            {(sched.medicine?.name ?? `S${sched.slot_number}`).slice(0, 5)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* List View: Grouped by Slot */
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <div className="retro-card text-center py-10 space-y-3">
              <Clock className="w-10 h-10 mx-auto text-slate-400" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No active schedules
              </h3>
              <p className="text-xs text-muted-foreground">
                Set times for your medicine slots to start automatic reminders.
              </p>
              <button type="button" className="p sm mx-auto" onClick={handleOpenAdd}>
                + Create Schedule
              </button>
            </div>
          ) : (
            Array.from(schedulesBySlot.entries()).map(([slotNum, slotScheds]) => {
              const slot = slots.find((s) => s.slot_number === slotNum);
              const med = slot?.medicine;

              return (
                <div key={slotNum} className="retro-card">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: med?.color ?? '#14b8a6' }}
                      />
                      <h3 className="text-base font-bold">
                        Slot {slotNum}: {med?.name ?? 'Empty Compartment'}
                      </h3>
                      {med?.dose && (
                        <span className="text-xs text-muted-foreground">({med.dose})</span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {slot?.pills_remaining ?? 0} pills left
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {slotScheds.map((sched) => (
                      <div
                        key={sched.id}
                        className="py-3 flex items-center justify-between flex-wrap gap-2"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-100">
                            {sched.time_of_day.slice(0, 5)}
                          </span>

                          {/* Day Pills */}
                          <div className="flex gap-1">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => (
                              <span
                                key={i}
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  sched.days.includes(i)
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                }`}
                              >
                                {l}
                              </span>
                            ))}
                          </div>

                          <span className="text-xs text-muted-foreground">
                            {sched.pills_per_dose} pill{sched.pills_per_dose > 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`sm !py-1 !px-2.5 text-xs font-bold ${
                              sched.enabled
                                ? '!bg-emerald-100 dark:!bg-emerald-950/60 !text-emerald-800 dark:!text-emerald-300'
                                : '!bg-slate-200 dark:!bg-slate-800 !text-slate-500'
                            }`}
                            onClick={() => handleToggleEnabled(sched)}
                          >
                            {sched.enabled ? 'Active' : 'Paused'}
                          </button>
                          <button
                            type="button"
                            className="sm !p-1.5"
                            title="Edit"
                            onClick={() => handleOpenEdit(sched)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="sm d !p-1.5"
                            title="Delete"
                            onClick={() => handleDelete(sched.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal: Add/Edit Schedule */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingSchedule ? 'Edit Dose Schedule' : 'Create Dose Schedule'}
        description="Choose the medicine compartment, trigger time and recurrence."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="p sm font-bold" onClick={handleSave}>
              Save Schedule
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs">Medicine Compartment *</label>
            <select
              value={formSlot}
              onChange={(e) => setFormSlot(Number(e.target.value))}
            >
              {loadedSlots.map((s) => (
                <option key={s.slot_number} value={s.slot_number}>
                  Slot {s.slot_number} — {s.medicine?.name} ({s.medicine?.dose})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs">Dispense Time ({tz}) *</label>
            <input
              type="time"
              value={formTime}
              onChange={(e) => setFormTime(e.target.value)}
              className="font-mono text-base"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs m-0">Days of the Week *</label>
              <button
                type="button"
                className="text-[11px] text-emerald-700 dark:text-emerald-400 underline font-bold"
                onClick={() =>
                  setFormDays(
                    formDays.length === 7 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]
                  )
                }
              >
                {formDays.length === 7 ? 'Weekdays only' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, idx) => {
                const isSelected = formDays.includes(idx);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`h-10 text-xs font-bold rounded-lg border transition-all ${
                      isSelected
                        ? '!bg-emerald-600 !text-white border-emerald-700 shadow-sm'
                        : '!bg-slate-100 dark:!bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs">Pills to Dispense</label>
            <input
              type="number"
              min={1}
              max={5}
              value={formPills}
              onChange={(e) => setFormPills(Number(e.target.value))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
