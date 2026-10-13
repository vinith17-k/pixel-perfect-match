import { useState, useEffect, useRef } from 'react';
import {
  AppProvider,
  useAppStore,
  useAppDispatch,
} from './stores/appStore';
import { useHardwareConfig } from './hooks/useHardwareConfig';
import { useDeviceStatus } from './hooks/useDeviceStatus';
import { useSlots } from './hooks/useSlots';
import { useSchedules } from './hooks/useSchedules';
import { useDoseEvents } from './hooks/useDoseEvents';
import { PART_META } from './lib/hardware';
import { startSimulator, fastForward } from './lib/simulator';
import { isDbEmpty, loadDemoData } from './lib/demo';
import { markTaken, snoozeDose } from './lib/commands';
import { Toaster, toast } from 'sonner';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Slots } from './pages/Slots';
import { Schedule } from './pages/Schedule';
import { History } from './pages/History';
import { Hardware } from './pages/Hardware';
import { Settings } from './pages/Settings';

// Overlays
import { CommandLogDrawer } from './components/CommandLogDrawer';
import { PinLockModal } from './components/PinLockModal';
import type { TabId } from './types';

// Icons for navigation
import {
  LayoutDashboard,
  Disc,
  Clock,
  History as HistoryIcon,
  Cpu,
  Settings as SettingsIcon,
  Bell,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';

function SageBotApp() {
  const { darkMode, simulatorMode, pinLock, activeTab, deviceName } = useAppStore();
  const dispatch = useAppDispatch();

  const { config } = useHardwareConfig();
  const { status, isOnline } = useDeviceStatus();
  const { slots } = useSlots();
  const { schedules } = useSchedules();
  const { dueEvents } = useDoseEvents();

  const [unlocked, setUnlocked] = useState(false);
  const simCleanupRef = useRef<(() => void) | null>(null);

  // 1. Initial Database Seed Check
  useEffect(() => {
    isDbEmpty().then((empty) => {
      if (empty) {
        console.info('[Init] DB is empty, seeding demo data...');
        loadDemoData().catch(console.error);
      }
    });
  }, []);

  // 2. Real Device Auto-Detection
  // If a real device appears online (firmware not "simulator" and updated in last 30s), switch simulator off
  useEffect(() => {
    if (
      simulatorMode &&
      status &&
      status.firmware &&
      status.firmware !== 'simulator' &&
      isOnline
    ) {
      toast.info('Real ESP32 hardware detected online! Turning simulator off.');
      dispatch({ type: 'SET_SIMULATOR_MODE', payload: false });
    }
  }, [status, isOnline, simulatorMode, dispatch]);

  // 3. Simulator Lifecycle
  useEffect(() => {
    if (simulatorMode && config) {
      console.info('[Simulator] Starting virtual ESP32 engine...');
      const cleanup = startSimulator(config, schedules, slots);
      simCleanupRef.current = cleanup;
      return () => {
        cleanup();
        simCleanupRef.current = null;
      };
    } else {
      if (simCleanupRef.current) {
        simCleanupRef.current();
        simCleanupRef.current = null;
      }
    }
  }, [simulatorMode, config, schedules, slots]);

  // 4. Keyboard Shortcuts: 1-6 for tabs, T for theme, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        dispatch({ type: 'TOGGLE_DARK_MODE' });
      }

      const tabMap: Record<string, TabId> = {
        '1': 'dashboard',
        '2': 'slots',
        '3': 'schedule',
        '4': 'history',
        '5': 'hardware',
        '6': 'settings',
      };

      if (tabMap[e.key]) {
        dispatch({ type: 'SET_ACTIVE_TAB', payload: tabMap[e.key] });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // Active dose for floating alert bar
  const activeDue = dueEvents[0] ?? null;

  // Render current tab page
  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'slots':
        return <Slots />;
      case 'schedule':
        return <Schedule />;
      case 'history':
        return <History />;
      case 'hardware':
        return <Hardware />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  // Hardware part chips count
  const enabledPartsCount = config
    ? PART_META.filter((p) => config[p.key as keyof typeof config] === true).length
    : 1;

  return (
    <div className="bg-app">
      {/* USB-C connector on top of casing */}
      <div className="usb">
        <i /> USB-C
      </div>

      {/* Main retro tactile shell */}
      <div className="shell">
        {/* Corner screws */}
        <b className="scr tl" />
        <b className="scr tr" />
        <b className="scr bl" />
        <b className="scr br" />

        {/* 1. Header */}
        <header className="flex items-center gap-3 p-2 mb-2 flex-wrap border-b border-slate-300/60 dark:border-slate-700/60 pb-3">
          {/* Logo with spinning gear and pill */}
          <svg
            width="38"
            height="38"
            viewBox="0 0 40 40"
            role="img"
            aria-label="Sage Bot logo"
            className="shrink-0"
          >
            <circle cx="20" cy="20" r="19" fill="#2b2e31" />
            <g className="spin" style={{ transformOrigin: '20px 20px', animationDuration: '14s' }}>
              <circle cx="33" cy="20" r="2" fill="#e8531e" />
              <circle cx="29.2" cy="29.2" r="2" fill="#7a8087" />
              <circle cx="20" cy="33" r="2" fill="#7a8087" />
              <circle cx="10.8" cy="29.2" r="2" fill="#7a8087" />
              <circle cx="7" cy="20" r="2" fill="#7a8087" />
              <circle cx="10.8" cy="10.8" r="2" fill="#7a8087" />
              <circle cx="20" cy="7" r="2" fill="#7a8087" />
              <circle cx="29.2" cy="10.8" r="2" fill="#7a8087" />
            </g>
            <g transform="rotate(-35 20 20)">
              <rect x="11" y="16" width="18" height="8" rx="4" fill="#f4f3ee" />
              <path d="M20 16h5a4 4 0 0 1 0 8h-5z" fill="#e8531e" />
            </g>
          </svg>

          {/* Title & Device name */}
          <div className="flex-1 min-w-[140px]">
            <span className="font-bold text-base tracking-widest text-slate-900 dark:text-slate-100 uppercase">
              SAGE·BOT
            </span>
            <small className="ml-2 text-xs font-mono font-normal text-muted-foreground">
              {deviceName}
            </small>
          </div>

          {/* Online/Offline Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isOnline
                ? 'text-emerald-700 bg-emerald-100 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'text-red-700 bg-red-100 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            {isOnline ? 'Online' : 'Offline'}
          </span>

          {/* Physical speaker grille */}
          <span className="spk hidden sm:block" aria-hidden="true" />

          {/* Theme Toggle Button */}
          <button
            type="button"
            className="sm flex items-center gap-1.5"
            onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
            aria-label="Toggle dark/light theme"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span>Theme</span>
          </button>
        </header>

        {/* 2. Simulator Active Banner */}
        {simulatorMode && (
          <div className="sim-banner">
            <span>Virtual Device Simulator Running (Firmware: simulator) &middot;</span>
            <button
              type="button"
              className="sm !min-h-[28px] !py-0.5 !px-2 text-xs font-bold"
              onClick={async () => {
                if (config) {
                  await fastForward(schedules, slots, config);
                  toast.success('Simulated alarm triggered!');
                }
              }}
            >
              Trigger Next Dose
            </button>
          </div>
        )}

        {/* 3. Hardware parts chips row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 border-b border-slate-300/40 dark:border-slate-700/40">
          <button
            type="button"
            className="hwsum shrink-0"
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'hardware' })}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{enabledPartsCount} of 8 parts ON:</span>
          </button>

          {PART_META.map((part) => {
            const isPartOn = config ? config[part.key as keyof typeof config] === true : false;
            return (
              <span
                key={part.key}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase shrink-0 border ${
                  isPartOn
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 opacity-60'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPartOn ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                {part.shortLabel}
              </span>
            );
          })}
        </div>

        {/* 4. Main Page View Content */}
        <main className="min-h-[460px] pb-10">
          {renderPage()}
        </main>

        {/* 5. Floating Due Bar at Bottom (when alarm is active and not on dashboard) */}
        {activeDue && activeTab !== 'dashboard' && (
          <div className="duebar" role="alert">
            <div className="flex items-center gap-2 font-bold truncate">
              <Bell className="w-4 h-4 text-amber-600 animate-bounce shrink-0" />
              <span className="truncate">
                <b>{activeDue.medicine_name}</b> due &middot; Slot {activeDue.slot_number}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="p sm !py-1 !px-3 font-bold !bg-emerald-700 !text-white"
                onClick={async () => {
                  await markTaken(activeDue.id);
                  toast.success('Dose taken!');
                }}
              >
                Take
              </button>
              <button
                type="button"
                className="sm !py-1 !px-2.5"
                onClick={async () => {
                  const m = config?.snooze_minutes ?? 10;
                  await snoozeDose(activeDue.id, m);
                  toast.info(`Snoozed ${m}m`);
                }}
              >
                Snooze
              </button>
            </div>
          </div>
        )}

        {/* 6. Tactile Floating Bottom Navigation Bar */}
        <nav className="app-nav" aria-label="Main Navigation">
          {[
            { id: 'dashboard' as TabId, label: 'Today', icon: LayoutDashboard },
            { id: 'slots' as TabId, label: 'Slots', icon: Disc },
            { id: 'schedule' as TabId, label: 'Schedule', icon: Clock },
            { id: 'history' as TabId, label: 'History', icon: HistoryIcon },
            { id: 'hardware' as TabId, label: 'Hardware', icon: Cpu },
            { id: 'settings' as TabId, label: 'Settings', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={isCurrent ? 'cur' : ''}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Keyboard hints footer */}
      <p className="hints">
        <kbd>1-6</kbd> Switch Tab &middot; <kbd>T</kbd> Toggle Theme &middot; <kbd>Esc</kbd> Close Dialog
      </p>

      {/* Command Log Drawer Dialog */}
      <CommandLogDrawer />

      {/* Optional PIN Lock Screen */}
      <PinLockModal unlocked={unlocked} onUnlock={() => setUnlocked(true)} />

      {/* Toaster for notifications */}
      <Toaster position="bottom-center" richColors />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SageBotApp />
    </AppProvider>
  );
}
