import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { TabId } from '../types';

// ─── State shape ────────────────────────────────────────────────────────────

export interface PinLock {
  enabled: boolean;
  pin: string;
}

export interface AppState {
  darkMode: boolean;
  simulatorMode: boolean;
  pinLock: PinLock;
  activeTab: TabId;
  commandDrawerOpen: boolean;
  deviceName: string;
}

// ─── LocalStorage helpers ────────────────────────────────────────────────────

const LS_KEYS = {
  darkMode: 'sage_dark_mode',
  simulatorMode: 'sage_simulator_mode',
  pinLock: 'sage_pin_lock',
  deviceName: 'sage_device_name',
} as const;

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as boolean;
  } catch {
    return fallback;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

// ─── Initial state ───────────────────────────────────────────────────────────

const defaultPinLock: PinLock = { enabled: false, pin: '' };

function buildInitialState(): AppState {
  return {
    darkMode: readBool(LS_KEYS.darkMode, false),
    simulatorMode: readBool(LS_KEYS.simulatorMode, false),
    pinLock: readJson<PinLock>(LS_KEYS.pinLock, defaultPinLock),
    activeTab: 'dashboard',
    commandDrawerOpen: false,
    deviceName: readString(LS_KEYS.deviceName, 'Sage Bot'),
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'SET_DARK_MODE'; payload: boolean }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'SET_SIMULATOR_MODE'; payload: boolean }
  | { type: 'TOGGLE_SIMULATOR_MODE' }
  | { type: 'SET_PIN_LOCK'; payload: PinLock }
  | { type: 'SET_ACTIVE_TAB'; payload: TabId }
  | { type: 'SET_COMMAND_DRAWER_OPEN'; payload: boolean }
  | { type: 'TOGGLE_COMMAND_DRAWER' }
  | { type: 'SET_DEVICE_NAME'; payload: string };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DARK_MODE':
      return { ...state, darkMode: action.payload };

    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode };

    case 'SET_SIMULATOR_MODE':
      return { ...state, simulatorMode: action.payload };

    case 'TOGGLE_SIMULATOR_MODE':
      return { ...state, simulatorMode: !state.simulatorMode };

    case 'SET_PIN_LOCK':
      return { ...state, pinLock: action.payload };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_COMMAND_DRAWER_OPEN':
      return { ...state, commandDrawerOpen: action.payload };

    case 'TOGGLE_COMMAND_DRAWER':
      return { ...state, commandDrawerOpen: !state.commandDrawerOpen };

    case 'SET_DEVICE_NAME':
      return { ...state, deviceName: action.payload };

    default:
      return state;
  }
}

// ─── Contexts ────────────────────────────────────────────────────────────────

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<Dispatch<AppAction> | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, undefined, buildInitialState);

  // Sync dark mode class on <html>
  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem(LS_KEYS.darkMode, JSON.stringify(state.darkMode));
    } catch { /* storage quota exceeded */ }
  }, [state.darkMode]);

  // Persist simulator mode
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.simulatorMode, JSON.stringify(state.simulatorMode));
    } catch { /* storage quota exceeded */ }
  }, [state.simulatorMode]);

  // Persist pin lock
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.pinLock, JSON.stringify(state.pinLock));
    } catch { /* storage quota exceeded */ }
  }, [state.pinLock]);

  // Persist device name
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.deviceName, state.deviceName);
    } catch { /* storage quota exceeded */ }
  }, [state.deviceName]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// ─── Consumer hooks ───────────────────────────────────────────────────────────

export function useAppStore(): AppState {
  const ctx = useContext(AppStateContext);
  if (ctx === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return ctx;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const ctx = useContext(AppDispatchContext);
  if (ctx === undefined) {
    throw new Error('useAppDispatch must be used within an AppProvider');
  }
  return ctx;
}
