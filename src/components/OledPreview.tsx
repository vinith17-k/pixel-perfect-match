/**
 * OledPreview.tsx
 * Renders a scaled 2× replica of the physical 128×64 OLED display.
 * Supports all device screen layouts plus an offline sample picker.
 */

import { useState, useEffect, useRef } from 'react';
import type { OledScreen } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OledPreviewProps {
  /** Live data from device_status.oled_screen */
  screen: OledScreen | null;
  /** hardware_config.has_oled */
  oledEnabled: boolean;
  deviceOnline: boolean;
}

// ─── Sample data for the picker ───────────────────────────────────────────────

const SAMPLE_SCREENS: Record<string, OledScreen> = {
  boot:    { screen: 'boot',    lines: ['Sage Bot', 'Starting...'] },
  home:    { screen: 'home',    lines: ['10:42', 'Tue 13 Oct', 'Next: Metformin 13:00 S3'] },
  alarm:   { screen: 'alarm',   lines: ['TAKE MEDICINE', 'Metformin', '500mg Slot 1', 'Press button'] },
  taken:   { screen: 'taken',   lines: ['Dose taken', 'Metformin'] },
  missed:  { screen: 'missed',  lines: ['Missed dose', 'Metformin', '13:00'] },
  loading: { screen: 'loading', lines: ['LOAD SLOT 1', 'Metformin', 'Tap Done in app'] },
  moving:  { screen: 'moving',  lines: ['Moving disc', 'to slot 1'] },
  message: { screen: 'message', lines: ['Custom line 1', 'Custom line 2', 'Custom line 3'] },
  error:   { screen: 'error',   lines: ['Device error', 'E_NTP_FAIL', 'Check WiFi'] },
  wifi:    { screen: 'wifi',    lines: ['Connecting WiFi...', 'Open setup page'] },
};

const SCREEN_LABELS: Record<string, string> = {
  boot:    'Boot',
  home:    'Home',
  alarm:   'Alarm',
  taken:   'Taken',
  missed:  'Missed',
  loading: 'Loading',
  moving:  'Moving',
  message: 'Message',
  error:   'Error',
  wifi:    'WiFi',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a string to N chars + ellipsis for the tiny screen. */
function clamp(s = '', n = 20) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ─── Sub-renderers (each returns JSX for the 256×128 canvas) ─────────────────

/** Blinking cursor block used in boot screen */
function Cursor({ visible }: { visible: boolean }) {
  return (
    <span
      className="inline-block w-[7px] h-[14px] align-middle"
      style={{ backgroundColor: visible ? '#5eead4' : 'transparent', marginLeft: 2 }}
    />
  );
}

/** WiFi icon (top-right corner on home screen) */
function WifiIcon() {
  return (
    <svg
      width="18"
      height="14"
      viewBox="0 0 18 14"
      fill="none"
      className="absolute top-[6px] right-[6px]"
      style={{ color: '#5eead4' }}
    >
      {/* 3-arc wifi shape */}
      <path d="M9 11a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="currentColor" />
      <path d="M5.2 8.2a5.4 5.4 0 0 1 7.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M2.4 5.4a9 9 0 0 1 13.2 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Check-mark icon for 'taken' screen */
function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="#5eead4" strokeWidth="1.5" />
      <path d="M8 14l4 4 8-8" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Spinning dots for loading/wifi/moving */
function SpinDots({ tick }: { tick: number }) {
  const dots = [0, 1, 2, 3].map(i => (tick / 2) % 4 === i);
  return (
    <span className="inline-flex gap-[3px] ml-[4px] align-middle">
      {dots.map((active, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 4,
            height: 4,
            backgroundColor: active ? '#5eead4' : '#1e4040',
            transition: 'background-color 0.15s',
          }}
        />
      ))}
    </span>
  );
}

// ─── Screen Renderers ─────────────────────────────────────────────────────────

function BootScreen({ lines, tick }: { lines: string[]; tick: number }) {
  const cursorVisible = tick % 2 === 0;
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[4px]">
      {/* Large title */}
      <div
        className="font-mono font-bold tracking-widest uppercase"
        style={{ fontSize: 22, color: '#5eead4', letterSpacing: '0.15em' }}
      >
        {lines[0] ?? 'Sage Bot'}
      </div>
      {/* Subtitle with cursor */}
      <div
        className="font-mono"
        style={{ fontSize: 11, color: '#3db8a0' }}
      >
        {lines[1] ?? 'Starting...'}
        <Cursor visible={cursorVisible} />
      </div>
    </div>
  );
}

function HomeScreen({ lines }: { lines: string[] }) {
  const time = lines[0] ?? '--:--';
  const date = lines[1] ?? '';
  const next = lines[2] ?? '';
  return (
    <div className="relative flex flex-col w-full h-full px-[8px] py-[5px]">
      <WifiIcon />
      {/* Big clock */}
      <div
        className="font-mono font-bold leading-none"
        style={{ fontSize: 44, color: '#5eead4', letterSpacing: '0.04em', marginTop: 4 }}
      >
        {time}
      </div>
      {/* Date line */}
      <div
        className="font-mono"
        style={{ fontSize: 10, color: '#3db8a0', marginTop: 2 }}
      >
        {date}
      </div>
      {/* Divider */}
      <div
        className="w-full mt-auto"
        style={{ borderTop: '1px solid #1e4040', paddingTop: 4 }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9, color: '#3db8a0' }}
        >
          {clamp(next, 28)}
        </div>
      </div>
    </div>
  );
}

function AlarmScreen({ lines, tick }: { lines: string[]; tick: number }) {
  // Alternating flash: header inverts every 500 ms (tick changes every ~500 ms)
  const flash = tick % 2 === 0;
  return (
    <div className="flex flex-col w-full h-full">
      {/* Flashing header bar */}
      <div
        className="flex items-center justify-center w-full font-mono font-bold tracking-widest"
        style={{
          height: 24,
          fontSize: 11,
          backgroundColor: flash ? '#5eead4' : 'transparent',
          color: flash ? '#0d0d0d' : '#5eead4',
          borderBottom: '1px solid #2a6060',
          transition: 'background-color 0.15s, color 0.15s',
        }}
      >
        {lines[0] ?? 'TAKE MEDICINE'}
      </div>
      {/* Medicine name */}
      <div
        className="font-mono font-bold text-center"
        style={{ fontSize: 16, color: '#5eead4', marginTop: 6 }}
      >
        {clamp(lines[1] ?? '', 18)}
      </div>
      {/* Dose + slot */}
      <div
        className="font-mono text-center"
        style={{ fontSize: 10, color: '#3db8a0', marginTop: 3 }}
      >
        {clamp(lines[2] ?? '', 24)}
      </div>
      {/* Hint */}
      <div
        className="font-mono text-center mt-auto"
        style={{ fontSize: 9, color: '#2a8080', paddingBottom: 4 }}
      >
        {clamp(lines[3] ?? '', 26)}
      </div>
    </div>
  );
}

function TakenScreen({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[4px]">
      <CheckIcon />
      <div className="font-mono font-bold" style={{ fontSize: 13, color: '#5eead4' }}>
        {lines[0] ?? 'Dose taken'}
      </div>
      <div className="font-mono" style={{ fontSize: 10, color: '#3db8a0' }}>
        {clamp(lines[1] ?? '', 22)}
      </div>
    </div>
  );
}

function MissedScreen({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[3px]">
      {/* Warning symbol */}
      <div style={{ fontSize: 20, color: '#f87171', lineHeight: 1 }}>⚠</div>
      <div className="font-mono font-bold" style={{ fontSize: 13, color: '#f87171' }}>
        {lines[0] ?? 'Missed dose'}
      </div>
      <div className="font-mono" style={{ fontSize: 10, color: '#fca5a5' }}>
        {clamp(lines[1] ?? '', 22)}
      </div>
      {lines[2] && (
        <div className="font-mono" style={{ fontSize: 9, color: '#7f1d1d' }}>
          {lines[2]}
        </div>
      )}
    </div>
  );
}

function LoadingScreen({ lines, tick }: { lines: string[]; tick: number }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[4px]">
      <div
        className="font-mono font-bold tracking-wider"
        style={{ fontSize: 14, color: '#5eead4' }}
      >
        {lines[0] ?? 'LOAD SLOT'}
      </div>
      <div className="font-mono" style={{ fontSize: 11, color: '#3db8a0' }}>
        {clamp(lines[1] ?? '', 22)}
      </div>
      <div
        className="font-mono flex items-center"
        style={{ fontSize: 9, color: '#2a8080', marginTop: 4 }}
      >
        {lines[2] ?? 'Tap Done in app'}
        <SpinDots tick={tick} />
      </div>
    </div>
  );
}

function MovingScreen({ lines, tick }: { lines: string[]; tick: number }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[4px]">
      <div className="font-mono" style={{ fontSize: 13, color: '#5eead4' }}>
        {lines[0] ?? 'Moving disc'}
      </div>
      <div className="font-mono flex items-center" style={{ fontSize: 11, color: '#3db8a0' }}>
        {lines[1] ?? 'to slot N'}
        <SpinDots tick={tick} />
      </div>
    </div>
  );
}

function MessageScreen({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[4px] px-[6px]">
      {lines.slice(0, 3).map((line, i) => (
        <div
          key={i}
          className="font-mono text-center"
          style={{ fontSize: 11, color: i === 0 ? '#5eead4' : '#3db8a0' }}
        >
          {clamp(line, 26)}
        </div>
      ))}
    </div>
  );
}

function ErrorScreen({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[3px]">
      <div style={{ fontSize: 18, color: '#f87171', lineHeight: 1 }}>✕</div>
      <div className="font-mono font-bold" style={{ fontSize: 12, color: '#f87171' }}>
        {lines[0] ?? 'Device error'}
      </div>
      <div className="font-mono" style={{ fontSize: 10, color: '#fca5a5' }}>
        {lines[1] ?? ''}
      </div>
      {lines[2] && (
        <div className="font-mono" style={{ fontSize: 9, color: '#7f1d1d' }}>
          {lines[2]}
        </div>
      )}
    </div>
  );
}

function WifiScreen({ lines, tick }: { lines: string[]; tick: number }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[4px]">
      {/* Animated wifi signal bars */}
      <div className="flex items-end gap-[2px]" style={{ height: 20 }}>
        {[6, 10, 14, 18].map((h, i) => (
          <div
            key={i}
            style={{
              width: 5,
              height: h,
              backgroundColor: (tick % 5) > i ? '#5eead4' : '#1e4040',
              borderRadius: 1,
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </div>
      <div className="font-mono" style={{ fontSize: 10, color: '#5eead4' }}>
        {clamp(lines[0] ?? 'Connecting WiFi...', 24)}
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: '#3db8a0' }}>
        {lines[1] ?? ''}
      </div>
    </div>
  );
}

function DisabledScreen() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-[4px]">
      <div
        className="font-mono text-center"
        style={{ fontSize: 11, color: '#444', letterSpacing: '0.05em' }}
      >
        OLED disabled
      </div>
      <div style={{ fontSize: 9, color: '#333', fontFamily: 'monospace' }}>
        (hardware_config.has_oled = false)
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OledPreview({ screen, oledEnabled, deviceOnline }: OledPreviewProps) {
  // Animation tick (increments every 500 ms — drives blink/spin/flash)
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Sample picker state
  const [selectedSample, setSelectedSample] = useState<string>('');

  // Resolve which OledScreen to render:
  //  • if user picked a sample → show that sample
  //  • else if live data exists and device is online → live
  //  • else → null (blank/offline)
  const activeScreen: OledScreen | null =
    selectedSample !== ''
      ? SAMPLE_SCREENS[selectedSample] ?? null
      : (deviceOnline && screen) ? screen : null;

  const isLive = selectedSample === '' && deviceOnline && screen !== null;
  const isSample = selectedSample !== '';

  // Caption
  let caption = 'No signal';
  if (!oledEnabled) caption = 'OLED disabled';
  else if (isLive) caption = 'Mirrors the real OLED';
  else if (isSample) caption = `Sample: ${selectedSample}`;
  else caption = 'Device offline';

  // Render the correct screen layout
  function renderScreen() {
    if (!oledEnabled) return <DisabledScreen />;
    if (!activeScreen) {
      // Offline / no data: show offline message
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-[4px]">
          <div style={{ fontSize: 20, color: '#2a4040', lineHeight: 1 }}>—</div>
          <div className="font-mono" style={{ fontSize: 10, color: '#2a4040' }}>
            {deviceOnline ? 'No screen data' : 'Device offline'}
          </div>
        </div>
      );
    }

    switch (activeScreen.screen) {
      case 'boot':
        return <BootScreen lines={activeScreen.lines} tick={tick} />;
      case 'home':
        return <HomeScreen lines={activeScreen.lines} />;
      case 'alarm':
        return <AlarmScreen lines={activeScreen.lines} tick={tick} />;
      case 'taken':
        return <TakenScreen lines={activeScreen.lines} />;
      case 'missed':
        return <MissedScreen lines={activeScreen.lines} />;
      case 'loading':
        return <LoadingScreen lines={activeScreen.lines} tick={tick} />;
      case 'moving':
        return <MovingScreen lines={activeScreen.lines} tick={tick} />;
      case 'message':
        return <MessageScreen lines={activeScreen.lines} />;
      case 'error':
        return <ErrorScreen lines={activeScreen.lines} />;
      case 'wifi':
        return <WifiScreen lines={activeScreen.lines} tick={tick} />;
      default:
        return <MessageScreen lines={activeScreen.lines} />;
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Outer bezel */}
      <div
        className="relative rounded-[6px] p-[6px]"
        style={{
          background: 'linear-gradient(145deg, #1a1a1a 0%, #111111 100%)',
          boxShadow: '0 0 0 1.5px #2a2a2a, 0 4px 20px rgba(0,0,0,0.7)',
        }}
      >
        {/* Screen surface */}
        <div
          className="relative overflow-hidden rounded-[3px]"
          style={{
            width: 256,
            height: 128,
            background: '#0d0d0d',
            /* Subtle scanline texture */
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)',
            boxShadow: oledEnabled && activeScreen
              ? '0 0 12px rgba(94,234,212,0.12), inset 0 0 8px rgba(0,0,0,0.8)'
              : 'inset 0 0 10px rgba(0,0,0,0.9)',
          }}
        >
          {/* Pixel glow overlay (only when screen active) */}
          {oledEnabled && activeScreen && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(94,234,212,0.04) 0%, transparent 70%)',
              }}
            />
          )}

          {/* Screen content */}
          <div className="absolute inset-0" style={{ zoom: 1 }}>
            {renderScreen()}
          </div>
        </div>

        {/* Tiny corner screws for realism */}
        {(['top-[3px] left-[3px]', 'top-[3px] right-[3px]', 'bottom-[3px] left-[3px]', 'bottom-[3px] right-[3px]'] as const).map(pos => (
          <div
            key={pos}
            className={`absolute ${pos} rounded-full`}
            style={{ width: 4, height: 4, background: '#222', border: '0.5px solid #333' }}
          />
        ))}
      </div>

      {/* Controls row: caption + sample picker */}
      <div className="flex items-center justify-between w-full max-w-[256px] gap-2">
        {/* Caption badge */}
        <div className="flex items-center gap-1.5">
          {/* Live indicator dot */}
          {isLive && (
            <span
              className="inline-block rounded-full"
              style={{
                width: 6,
                height: 6,
                backgroundColor: '#5eead4',
                boxShadow: '0 0 4px #5eead4',
                animation: 'pulse 2s infinite',
              }}
            />
          )}
          <span
            className="font-mono text-[10px] leading-none"
            style={{ color: isLive ? '#5eead4' : '#4a6060' }}
          >
            {caption}
          </span>
        </div>

        {/* Sample picker */}
        <div className="relative">
          <select
            value={selectedSample}
            onChange={e => setSelectedSample(e.target.value)}
            className="font-mono text-[10px] rounded px-2 py-1 pr-5 appearance-none cursor-pointer outline-none focus:ring-1 focus:ring-teal-500/50"
            style={{
              background: '#141414',
              color: selectedSample ? '#5eead4' : '#4a6060',
              border: '1px solid #2a3a3a',
              minWidth: 90,
            }}
            title="Preview a sample screen"
          >
            <option value="" style={{ color: '#4a6060' }}>
              {deviceOnline && screen ? '▶ Live' : '— Pick sample'}
            </option>
            {Object.entries(SCREEN_LABELS).map(([key, label]) => (
              <option key={key} value={key} style={{ color: '#5eead4' }}>
                {label}
              </option>
            ))}
          </select>
          {/* Dropdown chevron */}
          <span
            className="pointer-events-none absolute right-[6px] top-1/2 -translate-y-1/2"
            style={{ fontSize: 8, color: '#4a6060' }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Pulse keyframe injected inline once */}
      <style>{`
        @keyframes oled-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
