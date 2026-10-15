import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Cpu,
  Trash2,
  Database,
  Lock,
  Unlock,
  AlertTriangle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { useAppStore, useAppDispatch } from '../stores/appStore';
import { loadDemoData, clearDemoData } from '../lib/demo';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { Switch } from '../components/ui/Switch';

export function Settings() {
  const { config, update: updateConfig } = useHardwareConfig();
  const { deviceName, simulatorMode, pinLock, darkMode } = useAppStore();
  const dispatch = useAppDispatch();

  // Local form states
  const [localDevName, setLocalDevName] = useState(deviceName);
  const [pinInput, setPinInput] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Timezones options
  const timezones = [
    'Asia/Kolkata',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
  ];

  // Save device name
  const handleSaveDeviceName = () => {
    if (!localDevName.trim()) {
      toast.error('Device name cannot be blank.');
      return;
    }
    dispatch({ type: 'SET_DEVICE_NAME', payload: localDevName.trim() });
    toast.success('Device name updated.');
  };

  // Toggle browser notifications
  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications are not supported in this browser.');
      return;
    }
    if (Notification.permission === 'granted') {
      toast.info('Notifications are already granted in your browser.');
    } else {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        toast.success('Browser notifications enabled!');
      } else {
        toast.warning('Notifications permission denied.');
      }
    }
  };

  // Save PIN Lock
  const handleSetPin = () => {
    if (pinInput.length < 4) {
      toast.error('PIN must be at least 4 digits.');
      return;
    }
    dispatch({
      type: 'SET_PIN_LOCK',
      payload: { enabled: true, pin: pinInput },
    });
    setPinModalOpen(false);
    setPinInput('');
    toast.success('Security PIN lock enabled.');
  };

  const handleDisablePin = () => {
    dispatch({
      type: 'SET_PIN_LOCK',
      payload: { enabled: false, pin: '' },
    });
    toast.info('PIN lock disabled.');
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(`Could not sign out: ${error.message}`);
      return;
    }
    toast.success('Signed out.');
  };

  // Load Demo Data
  const handleLoadDemo = async () => {
    try {
      await loadDemoData();
      toast.success('Demo data loaded successfully! (3 meds, 3 schedules, 10-day history)');
    } catch (error) {
      toast.error(error instanceof Error ? `Failed to load demo data: ${error.message}` : 'Failed to load demo data.');
    }
  };

  // Clear Demo Data
  const handleClearDemo = async () => {
    if (!confirm('Clear all demo medicines, schedules, and events?')) return;
    try {
      await clearDemoData();
      toast.success('Demo data cleared.');
    } catch (error) {
      toast.error(error instanceof Error ? `Failed to clear demo data: ${error.message}` : 'Failed to clear demo data.');
    }
  };

  // Danger Zone: Full Database Reset
  const handleFullReset = async () => {
    setIsResetting(true);
    try {
      const { error: commandsError } = await supabase.from('commands').delete().neq('id', 0);
      if (commandsError) throw commandsError;
      const { error: eventsError } = await supabase.from('dose_events').delete().not('id', 'is', null);
      if (eventsError) throw eventsError;
      const { error: schedulesError } = await supabase.from('schedules').delete().not('id', 'is', null);
      if (schedulesError) throw schedulesError;
      const { error: slotsError } = await supabase
        .from('slots')
        .update({ medicine_id: null, pills_remaining: 0, status: 'empty' })
        .gte('slot_number', 1);
      if (slotsError) throw slotsError;
      const { error: medicinesError } = await supabase.from('medicines').delete().not('id', 'is', null);
      if (medicinesError) throw medicinesError;

      localStorage.removeItem('sage_local_commands');
      localStorage.removeItem('sage_local_dose_events');
      localStorage.removeItem('sage_local_schedules');
      localStorage.removeItem('sage_local_medicines');
      localStorage.removeItem('sage_local_slots');

      toast.success('Database & local storage reset completed.');
      setResetModalOpen(false);
    } catch (error) {
      console.error('Full database reset failed:', error);
      toast.error(error instanceof Error ? `Reset failed: ${error.message}` : 'Failed to execute full reset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>System Settings</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Configure physical dispenser parameters, prototype modes, and local access.
        </p>
      </div>

      <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
        <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-bold block text-sm">Owner account active</span>
          Database access is restricted by Supabase Auth and the configured single-owner policy.
        </div>
        <button type="button" className="sm shrink-0" onClick={handleSignOut}>Sign out</button>
      </div>

      {/* 1. Device Parameters */}
      <div className="retro-card space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Device Parameters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs">Device Label</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localDevName}
                onChange={(e) => setLocalDevName(e.target.value)}
              />
              <button
                type="button"
                className="sm shrink-0 font-bold"
                onClick={handleSaveDeviceName}
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs">Timezone</label>
            <select
              value={config?.timezone ?? 'Asia/Kolkata'}
              onChange={async (e) => {
                await updateConfig({ timezone: e.target.value });
                toast.success(`Timezone updated to ${e.target.value}`);
              }}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs">Number of Compartments (4 to 8)</label>
            <input
              type="number"
              min={4}
              max={8}
              value={config?.num_slots ?? 8}
              onChange={async (e) => {
                const val = Math.min(8, Math.max(4, Number(e.target.value)));
                await updateConfig({ num_slots: val });
              }}
            />
          </div>

          <div>
            <label className="text-xs">Snooze Duration (minutes)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={config?.snooze_minutes ?? 10}
              onChange={async (e) => {
                await updateConfig({ snooze_minutes: Number(e.target.value) });
              }}
            />
          </div>

          <div>
            <label className="text-xs">Mark Missed After (minutes)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={config?.missed_after_minutes ?? 30}
              onChange={async (e) => {
                await updateConfig({ missed_after_minutes: Number(e.target.value) });
              }}
            />
          </div>

          <div>
            <label className="text-xs">Low Stock Threshold (pills)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={config?.low_stock_threshold ?? 3}
              onChange={async (e) => {
                await updateConfig({ low_stock_threshold: Number(e.target.value) });
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Simulator & Virtual Device Mode */}
      <div className="retro-card space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Browser Device Simulator
        </h3>
        <p className="text-xs text-muted-foreground">
          Allows testing all alarms, OLED mirrors, and commands directly in the browser without physical hardware connected.
        </p>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold">Simulator Active</span>
          </div>
          <button
            type="button"
            className={`sm !py-1 !px-3 font-bold ${
              simulatorMode
                ? '!bg-emerald-600 !text-white'
                : '!bg-slate-300 dark:!bg-slate-700 text-slate-600'
            }`}
            onClick={() => {
              dispatch({ type: 'TOGGLE_SIMULATOR_MODE' });
              toast.info(simulatorMode ? 'Simulator stopped.' : 'Simulator started!');
            }}
          >
            {simulatorMode ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold">Browser Push Alerts</span>
          </div>
          <button
            type="button"
            className="sm text-xs font-bold"
            onClick={handleToggleNotifications}
          >
            Configure
          </button>
        </div>
      </div>

      {/* 3. Local PIN Lock */}
      <div className="retro-card space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Client PIN Protection
        </h3>
        <p className="text-xs text-muted-foreground">
          Restrict accidental dosage modifications on shared family screens with an on-device PIN.
        </p>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            {pinLock.enabled ? (
              <Lock className="w-4 h-4 text-emerald-600" />
            ) : (
              <Unlock className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-sm font-bold">
              {pinLock.enabled ? 'PIN Protection Active' : 'No PIN Set'}
            </span>
          </div>

          {pinLock.enabled ? (
            <button
              type="button"
              className="sm d text-xs font-bold"
              onClick={handleDisablePin}
            >
              Disable PIN
            </button>
          ) : (
            <button
              type="button"
              className="sm text-xs font-bold"
              onClick={() => setPinModalOpen(true)}
            >
              Enable PIN
            </button>
          )}
        </div>
      </div>

      {/* 4. Demo Data Management */}
      <div className="retro-card space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Demo Dataset
        </h3>
        <p className="text-xs text-muted-foreground">
          Instantly load or wipe 3 realistic medications (Metformin, Vitamin D3, Amlodipine) and 10 days of historical data.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="sm font-bold flex items-center gap-1.5"
            onClick={handleLoadDemo}
          >
            <Database className="w-4 h-4 text-emerald-600" /> Load Demo Data
          </button>
          <button
            type="button"
            className="sm font-bold flex items-center gap-1.5"
            onClick={handleClearDemo}
          >
            <Trash2 className="w-4 h-4 text-amber-600" /> Clear Demo Data
          </button>
        </div>
      </div>

      {/* 5. Danger Zone */}
      <div className="retro-card border-red-300 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
          Danger Zone
        </h3>
        <p className="text-xs text-red-600 dark:text-red-300">
          Wipe all history, schedules, loaded slots, and queued commands.
        </p>
        <button
          type="button"
          className="sm d font-bold"
          onClick={() => setResetModalOpen(true)}
        >
          Reset All System Records
        </button>
      </div>

      {/* Modal: Set Security PIN */}
      <Modal
        open={pinModalOpen}
        onOpenChange={setPinModalOpen}
        title="Set Security PIN"
        description="Enter a 4-digit numeric code to protect dispenser controls."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setPinModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="p sm font-bold" onClick={handleSetPin}>
              Save PIN
            </button>
          </>
        }
      >
        <div className="space-y-3 font-mono">
          <label className="text-xs font-sans">4-Digit PIN Code</label>
          <input
            type="password"
            maxLength={6}
            placeholder="••••"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            className="text-center text-xl tracking-widest"
          />
        </div>
      </Modal>

      {/* Modal: Full Reset Confirmation */}
      <Modal
        open={resetModalOpen}
        onOpenChange={setResetModalOpen}
        title="Reset All Records?"
        description="This will permanently delete all dispensation logs, schedules, and loaded slot states."
        footer={
          <>
            <button type="button" className="sm" onClick={() => setResetModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="sm d font-bold"
              disabled={isResetting}
              onClick={handleFullReset}
            >
              {isResetting ? 'Resetting...' : 'Yes, Delete Everything'}
            </button>
          </>
        }
      >
        <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 rounded-lg text-xs font-semibold">
          Warning: This action cannot be reversed. Only use during testing or commissioning.
        </div>
      </Modal>
    </div>
  );
}
