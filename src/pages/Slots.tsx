import { useState, useMemo } from 'react';
import {
  RotateCw,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Disc,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSlots } from '../hooks/useSlots';
import { useMedicines } from '../hooks/useMedicines';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { useCommands } from '../hooks/useCommands';
import { sendCommand } from '../lib/commands';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import type { Slot, Medicine } from '../types';

const PRESET_COLORS = [
  '#14b8a6', // Teal (default)
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

export function Slots() {
  const { slots, refresh: refreshSlots } = useSlots();
  const { medicines, refresh: refreshMeds } = useMedicines();
  const { config } = useHardwareConfig();
  const { commands } = useCommands();

  const numSlots = config?.num_slots ?? 8;
  const activeSlots = slots.slice(0, numSlots);

  // Disc visual angle state
  const [currentDiscSlot, setCurrentDiscSlot] = useState(1);
  const [selectedSlotNum, setSelectedSlotNum] = useState<number>(1);

  // Dialog states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2 | 3>(1); // 1: moving/command, 2: medicine form, 3: done
  const [pendingCmdId, setPendingCmdId] = useState<number | null>(null);

  // Form states for adding/editing medicine
  const [selectedMedId, setSelectedMedId] = useState<string>('new');
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medNotes, setMedNotes] = useState('');
  const [medColor, setMedColor] = useState(PRESET_COLORS[0]);
  const [pillCount, setPillCount] = useState(20);

  // Refill dialog
  const [refillModalOpen, setRefillModalOpen] = useState(false);
  const [refillAmount, setRefillAmount] = useState(20);

  // Edit medicine dialog
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);

  // Selected slot item
  const activeSlot = useMemo(
    () => slots.find((s) => s.slot_number === selectedSlotNum) ?? slots[0],
    [slots, selectedSlotNum]
  );

  // Disc rotation calculation: slot 1 is at top (-90 deg)
  const discAngle = -(currentDiscSlot - 1) * (360 / numSlots);

  // 1. Begin Add Medicine Flow
  const startAddMedicine = async (slotNum: number) => {
    setSelectedSlotNum(slotNum);
    setAddStep(1);
    setAddModalOpen(true);
    setSelectedMedId('new');
    setMedName('');
    setMedDose('');
    setMedNotes('');
    setMedColor(PRESET_COLORS[0]);
    setPillCount(20);

    try {
      const cmd = await sendCommand('rotate_to_slot', { slot: slotNum, mode: 'load' });
      setPendingCmdId(cmd.id);
      setCurrentDiscSlot(slotNum);

      // Transition to form step automatically after 1.5s or simulated
      setTimeout(() => {
        setAddStep(2);
      }, 1500);
    } catch {
      toast.error('Failed to issue rotate command.');
      setAddStep(2);
    }
  };

  // 2. Complete Add Medicine
  const handleSaveMedicine = async () => {
    if (selectedMedId === 'new' && !medName.trim()) {
      toast.error('Medicine name is required.');
      return;
    }
    if (pillCount < 0) {
      toast.error('Pill count must be 0 or more.');
      return;
    }

    try {
      let finalMedId = selectedMedId;

      if (selectedMedId === 'new') {
        const { data: newMed, error: medErr } = await supabase
          .from('medicines')
          .insert({
            name: medName.trim(),
            dose: medDose.trim() || null,
            notes: medNotes.trim() || null,
            color: medColor,
          })
          .select()
          .single();

        if (medErr || !newMed) throw medErr ?? new Error('Failed to create medicine');
        finalMedId = newMed.id;
        refreshMeds();
      }

      // Update local storage immediately for instantaneous UI update
      try {
        const raw = localStorage.getItem('sage_local_slots');
        if (raw) {
          const localSlots: Slot[] = JSON.parse(raw);
          const foundMed = (medicines ?? []).find((m) => m.id === finalMedId) || {
            id: finalMedId,
            name: medName.trim(),
            dose: medDose.trim() || null,
            notes: medNotes.trim() || null,
            color: medColor,
            created_at: new Date().toISOString(),
          };
          const updated = localSlots.map((s) =>
            s.slot_number === selectedSlotNum
              ? {
                  ...s,
                  medicine_id: finalMedId,
                  pills_remaining: pillCount,
                  status: 'loaded' as const,
                  medicine: foundMed,
                  updated_at: new Date().toISOString(),
                }
              : s
          );
          localStorage.setItem('sage_local_slots', JSON.stringify(updated));
        }
      } catch (err) {
        console.warn('Local slot update error:', err);
      }

      // Update slot in Supabase
      const { error: slotErr } = await supabase
        .from('slots')
        .update({
          medicine_id: finalMedId,
          pills_remaining: pillCount,
          status: 'loaded',
          updated_at: new Date().toISOString(),
        })
        .eq('slot_number', selectedSlotNum);

      if (slotErr) throw slotErr;

      // Issue load_done command to update physical OLED
      await sendCommand('load_done', { slot: selectedSlotNum });
      refreshSlots();

      setAddStep(3);
    } catch {
      toast.error('Failed to save medicine to slot.');
    }
  };

  // 3. Handle Refill
  const handleRefill = async () => {
    if (!activeSlot || refillAmount <= 0) return;
    try {
      const newTotal = (activeSlot.pills_remaining ?? 0) + refillAmount;

      try {
        const raw = localStorage.getItem('sage_local_slots');
        if (raw) {
          const localSlots: Slot[] = JSON.parse(raw);
          const updated = localSlots.map((s) =>
            s.slot_number === activeSlot.slot_number
              ? { ...s, pills_remaining: newTotal, updated_at: new Date().toISOString() }
              : s
          );
          localStorage.setItem('sage_local_slots', JSON.stringify(updated));
        }
      } catch {}

      const { error } = await supabase
        .from('slots')
        .update({ pills_remaining: newTotal, updated_at: new Date().toISOString() })
        .eq('slot_number', activeSlot.slot_number);

      if (error) throw error;
      toast.success(`Slot ${activeSlot.slot_number} refilled with +${refillAmount} pills.`);
      setRefillModalOpen(false);
      refreshSlots();
    } catch {
      toast.error('Failed to update pill count.');
    }
  };

  // 4. Handle Empty Slot
  const handleEmptySlot = async (slotNum: number) => {
    if (!confirm(`Are you sure you want to empty Slot ${slotNum}? Any schedules for this slot will stop.`)) {
      return;
    }
    try {
      try {
        const raw = localStorage.getItem('sage_local_slots');
        if (raw) {
          const localSlots: Slot[] = JSON.parse(raw);
          const updated = localSlots.map((s) =>
            s.slot_number === slotNum
              ? {
                  ...s,
                  medicine_id: null,
                  medicine: null,
                  pills_remaining: 0,
                  status: 'empty' as const,
                  updated_at: new Date().toISOString(),
                }
              : s
          );
          localStorage.setItem('sage_local_slots', JSON.stringify(updated));
        }
      } catch {}

      const { error } = await supabase
        .from('slots')
        .update({
          medicine_id: null,
          pills_remaining: 0,
          status: 'empty',
          updated_at: new Date().toISOString(),
        })
        .eq('slot_number', slotNum);

      if (error) throw error;
      toast.success(`Slot ${slotNum} is now empty.`);
      refreshSlots();
    } catch {
      toast.error('Failed to empty slot.');
    }
  };

  // 5. Handle Rotate Here
  const handleRotateToSlot = async (slotNum: number) => {
    try {
      setCurrentDiscSlot(slotNum);
      setSelectedSlotNum(slotNum);
      const cmd = await sendCommand('rotate_to_slot', { slot: slotNum, mode: 'load' });
      if (!config?.has_stepper) {
        toast.info(`Simulated: Stepper is OFF. OLED shows LOAD SLOT ${slotNum}.`);
      } else {
        toast.success(`Moving disc to Slot ${slotNum} (Cmd #${cmd.id})`);
      }
    } catch {
      toast.error('Failed to send rotate command.');
    }
  };

  // 6. Handle Edit Medicine
  const handleEditMedicine = async () => {
    if (!editingMed || !editingMed.name.trim()) return;
    try {
      const { error } = await supabase
        .from('medicines')
        .update({
          name: editingMed.name.trim(),
          dose: editingMed.dose || null,
          notes: editingMed.notes || null,
          color: editingMed.color || PRESET_COLORS[0],
        })
        .eq('id', editingMed.id);

      if (error) throw error;
      toast.success('Medicine details updated!');
      setEditModalOpen(false);
      refreshMeds();
      refreshSlots();
    } catch {
      toast.error('Failed to update medicine.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2>Medicine Compartments</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {config?.has_stepper
              ? 'Rotary disc with 8 indexed pill pockets.'
              : 'Stepper motor disabled — slots are managed as virtual compartments.'}
          </p>
        </div>
        {!config?.has_stepper && (
          <Badge
            size="md"
            variant="amber"
            label="Virtual Slots (Stepper OFF)"
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
          />
        )}
      </div>

      {/* Main interactive area: Circular Disc on left, Selected slot details on right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Disc Visualizer */}
        <div className="md:col-span-6 retro-card flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Interactive Rotor Disc
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
              Window: Slot {currentDiscSlot}
            </span>
          </div>

          {/* SVG Circular Disc */}
          <div className="relative w-full max-w-[340px] aspect-square my-2">
            <svg
              viewBox="0 0 400 400"
              className="w-full h-full transition-transform duration-1000 ease-out"
              style={{ transform: `rotate(${discAngle}deg)` }}
            >
              {/* Outer rim */}
              <circle cx="200" cy="200" r="190" fill="#2b2e31" />
              <circle cx="200" cy="200" r="176" fill="var(--mint)" stroke="var(--kb)" strokeWidth="2" />

              {/* 8 Compartment Pockets */}
              {Array.from({ length: 8 }).map((_, i) => {
                const slotNum = i + 1;
                const angleRad = (-90 + i * 45) * (Math.PI / 180);
                const cx = 200 + 125 * Math.cos(angleRad);
                const cy = 200 + 125 * Math.sin(angleRad);
                const slot = slots.find((s) => s.slot_number === slotNum);
                const isLoaded = slot?.status === 'loaded';
                const isSelected = selectedSlotNum === slotNum;
                const isCurrentWindow = currentDiscSlot === slotNum;

                return (
                  <g
                    key={slotNum}
                    className="cursor-pointer"
                    onClick={() => setSelectedSlotNum(slotNum)}
                  >
                    {/* Reverse rotation for text/content upright readability */}
                    <g
                      transform={`rotate(${-discAngle} ${cx} ${cy})`}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r="38"
                        fill="var(--card)"
                        stroke={
                          isSelected
                            ? 'var(--pri)'
                            : isLoaded
                            ? slot.medicine?.color ?? 'var(--pri)'
                            : 'var(--kb)'
                        }
                        strokeWidth={isSelected ? 4 : 2}
                        strokeDasharray={isLoaded ? 'none' : '4 3'}
                      />
                      {/* Slot number label */}
                      <text
                        x={cx}
                        y={cy - 12}
                        textAnchor="middle"
                        fontSize="11"
                        fontFamily="Space Mono"
                        fontWeight="700"
                        fill="var(--mut)"
                      >
                        S{slotNum}
                      </text>
                      {/* Pill count or Plus */}
                      {isLoaded ? (
                        <>
                          <text
                            x={cx}
                            y={cy + 8}
                            textAnchor="middle"
                            fontSize="16"
                            fontFamily="Space Mono"
                            fontWeight="700"
                            fill="var(--tx)"
                          >
                            {slot.pills_remaining}
                          </text>
                          <text
                            x={cx}
                            y={cy + 22}
                            textAnchor="middle"
                            fontSize="8"
                            fontFamily="Space Grotesk"
                            fill="var(--mut)"
                          >
                            {(slot.medicine?.name ?? '').slice(0, 7)}
                          </text>
                        </>
                      ) : (
                        <text
                          x={cx}
                          y={cy + 10}
                          textAnchor="middle"
                          fontSize="18"
                          fill="var(--mut)"
                        >
                          +
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

              {/* Center Hub */}
              <circle cx="200" cy="200" r="50" fill="var(--card)" stroke="var(--kb)" strokeWidth="3" />
            </svg>

            {/* Dispense Chute Indicator at Top (0 deg) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 flex flex-col items-center pointer-events-none">
              <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] border-t-amber-500" />
              <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded shadow">
                CHUTE
              </span>
            </div>

            {/* Center Label Hub overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
              <div className="text-[9px] font-mono font-bold text-muted-foreground uppercase">
                AT CHUTE
              </div>
              <div className="text-xl font-mono font-bold text-slate-800 dark:text-slate-100">
                {currentDiscSlot}
              </div>
              <div className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                {config?.has_stepper ? 'READY' : 'VIRTUAL'}
              </div>
            </div>
          </div>

          {/* Stepper Manual Advance Controls */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              className="sm flex items-center gap-1"
              onClick={() => {
                const prev = currentDiscSlot === 1 ? numSlots : currentDiscSlot - 1;
                handleRotateToSlot(prev);
              }}
            >
              <ChevronLeft className="w-4 h-4" /> Prev Slot
            </button>
            <button
              type="button"
              className="sm flex items-center gap-1"
              onClick={() => {
                const next = currentDiscSlot === numSlots ? 1 : currentDiscSlot + 1;
                handleRotateToSlot(next);
              }}
            >
              Next Slot <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Slot Detail Card */}
        <div className="md:col-span-6 space-y-4">
          <div className="retro-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60 mb-4">
              <div>
                <h3 className="text-lg font-bold">
                  Slot {selectedSlotNum}{' '}
                  {selectedSlotNum === currentDiscSlot ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 ml-1">
                      (at dispense window)
                    </span>
                  ) : null}
                </h3>
                <span className="text-xs text-muted-foreground">
                  Status: {activeSlot?.status === 'loaded' ? 'Loaded' : 'Empty'}
                </span>
              </div>
              {activeSlot?.status === 'loaded' && (
                <div
                  className="w-4 h-4 rounded-full border border-black/20"
                  style={{ backgroundColor: activeSlot.medicine?.color ?? '#14b8a6' }}
                />
              )}
            </div>

            {activeSlot?.status === 'loaded' && activeSlot.medicine ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {activeSlot.medicine.name}
                    </h4>
                    <p className="text-sm font-medium text-slate-500">
                      {activeSlot.medicine.dose ?? 'No dose specified'}
                    </p>
                    {activeSlot.medicine.notes && (
                      <p className="text-xs text-slate-400 mt-1">
                        Note: {activeSlot.medicine.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-3xl font-mono font-bold text-slate-800 dark:text-slate-100">
                      {activeSlot.pills_remaining}
                    </span>
                    <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                      pills left
                    </span>
                  </div>
                </div>

                {activeSlot.pills_remaining <= (config?.low_stock_threshold ?? 3) && (
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Low stock alert: Remaining pills at or below threshold.</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="sm flex-1 flex items-center justify-center gap-1.5"
                    onClick={() => handleRotateToSlot(selectedSlotNum)}
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Rotate Here
                  </button>
                  <button
                    type="button"
                    className="sm flex-1 flex items-center justify-center gap-1.5"
                    onClick={() => {
                      setRefillAmount(20);
                      setRefillModalOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Refill
                  </button>
                  <button
                    type="button"
                    className="sm flex-1 flex items-center justify-center gap-1.5"
                    onClick={() => {
                      setEditingMed(activeSlot.medicine!);
                      setEditModalOpen(true);
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    className="sm d flex items-center justify-center gap-1.5"
                    onClick={() => handleEmptySlot(selectedSlotNum)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Empty
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <Disc className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-500">This compartment is currently empty.</p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    className="p sm flex items-center gap-1.5"
                    onClick={() => startAddMedicine(selectedSlotNum)}
                  >
                    <Plus className="w-4 h-4" /> Add Medicine
                  </button>
                  <button
                    type="button"
                    className="sm flex items-center gap-1.5"
                    onClick={() => handleRotateToSlot(selectedSlotNum)}
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Rotate Here
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid of all 8 slot cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeSlots.map((s) => (
          <div
            key={s.slot_number}
            onClick={() => setSelectedSlotNum(s.slot_number)}
            className={`retro-card cursor-pointer transition-all ${
              selectedSlotNum === s.slot_number
                ? 'ring-2 ring-emerald-600 dark:ring-emerald-400'
                : 'hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-sm text-muted-foreground">
                Slot {s.slot_number}
              </span>
              <Badge
                size="sm"
                label={s.status}
                variant={s.status === 'loaded' ? 'green' : 'slate'}
              />
            </div>

            {s.status === 'loaded' && s.medicine ? (
              <div>
                <h4 className="font-bold text-base truncate">{s.medicine.name}</h4>
                <p className="text-xs text-muted-foreground truncate">{s.medicine.dose}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {s.pills_remaining} pills
                  </span>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: s.medicine.color }}
                  />
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <span className="text-xs text-muted-foreground block mb-2">Empty pocket</span>
                <button
                  type="button"
                  className="sm w-full text-xs font-bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    startAddMedicine(s.slot_number);
                  }}
                >
                  + Add Medicine
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal: Add Medicine Flow (3 Steps) */}
      <Modal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title={`Load Compartment — Slot ${selectedSlotNum}`}
        description={
          addStep === 1
            ? 'Positioning disc compartment...'
            : addStep === 2
            ? 'Enter medicine details and quantity.'
            : 'Compartment loaded successfully!'
        }
      >
        {addStep === 1 && (
          <div className="py-6 text-center space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-emerald-600" />
            <p className="text-sm font-semibold">Moving disc to Slot {selectedSlotNum}...</p>
            {!config?.has_stepper && (
              <p className="text-xs p-3 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-lg">
                Stepper is not enabled. Place the medicine into virtual Slot {selectedSlotNum} by hand. The physical OLED display shows "LOAD SLOT {selectedSlotNum}".
              </p>
            )}
          </div>
        )}

        {addStep === 2 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs">Medicine Selection</label>
              <select
                value={selectedMedId}
                onChange={(e) => {
                  setSelectedMedId(e.target.value);
                  const found = medicines.find((m) => m.id === e.target.value);
                  if (found) {
                    setMedName(found.name);
                    setMedDose(found.dose ?? '');
                    setMedNotes(found.notes ?? '');
                    setMedColor(found.color);
                  }
                }}
              >
                <option value="new">+ Create New Medicine</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.dose ? `(${m.dose})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedMedId === 'new' && (
              <>
                <div>
                  <label className="text-xs">Medicine Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Metformin"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs">Dose / Strength</label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg, 1 tablet"
                    value={medDose}
                    onChange={(e) => setMedDose(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs">Instructions / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Take after meal"
                    value={medNotes}
                    onChange={(e) => setMedNotes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs">Color Badge</label>
                  <div className="flex gap-2 mt-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        style={{ backgroundColor: c }}
                        onClick={() => setMedColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          medColor === c ? 'scale-125 ring-2 ring-black dark:ring-white' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs">Number of Pills to Load</label>
              <input
                type="number"
                min={1}
                max={50}
                value={pillCount}
                onChange={(e) => setPillCount(Number(e.target.value))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
              <button type="button" className="sm" onClick={() => setAddModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="p sm" onClick={handleSaveMedicine}>
                Confirm & Load
              </button>
            </div>
          </div>
        )}

        {addStep === 3 && (
          <div className="py-6 text-center space-y-4">
            <Check className="w-12 h-12 mx-auto text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 rounded-full p-2" />
            <h4 className="text-lg font-bold">Slot {selectedSlotNum} Loaded!</h4>
            <p className="text-sm text-muted-foreground">
              Physical OLED screen now reflects the updated compartment status.
            </p>
            <button
              type="button"
              className="p sm w-full"
              onClick={() => setAddModalOpen(false)}
            >
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: Refill Pills */}
      <Modal
        open={refillModalOpen}
        onOpenChange={setRefillModalOpen}
        title={`Refill Slot ${activeSlot?.slot_number}`}
        description="Add pills to this compartment's existing supply."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setRefillModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="p sm" onClick={handleRefill}>
              Add Pills
            </button>
          </>
        }
      >
        <div className="space-y-3 font-mono">
          <label className="text-xs font-sans">Number of Pills to Add</label>
          <input
            type="number"
            min={1}
            value={refillAmount}
            onChange={(e) => setRefillAmount(Number(e.target.value))}
          />
        </div>
      </Modal>

      {/* Modal: Edit Medicine Details */}
      <Modal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        title="Edit Medicine Details"
        description="Update prescription name, strength or notes."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="p sm" onClick={handleEditMedicine}>
              Save Changes
            </button>
          </>
        }
      >
        {editingMed && (
          <div className="space-y-3">
            <div>
              <label className="text-xs">Medicine Name</label>
              <input
                type="text"
                value={editingMed.name}
                onChange={(e) => setEditingMed({ ...editingMed, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs">Dose</label>
              <input
                type="text"
                value={editingMed.dose ?? ''}
                onChange={(e) => setEditingMed({ ...editingMed, dose: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs">Notes</label>
              <input
                type="text"
                value={editingMed.notes ?? ''}
                onChange={(e) => setEditingMed({ ...editingMed, notes: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
