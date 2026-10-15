import { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  Bell,
  Volume2,
  VolumeX,
  Fingerprint,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useSlots } from '../hooks/useSlots';
import { useDoseEvents } from '../hooks/useDoseEvents';
import { sendCommand, markTaken } from '../lib/commands';
import { OledPreview } from './OledPreview';

export function VirtualHardwareStage() {
  const { config } = useHardwareConfig();
  const { status, isOnline } = useDeviceStatus();
  const { slots } = useSlots();
  const { dueEvents } = useDoseEvents();

  // Expanded panel state
  const [isExpanded, setIsExpanded] = useState(true);

  // Local simulated hardware state
  const [currentSlot, setCurrentSlot] = useState(1);
  const [discAngle, setDiscAngle] = useState(0);
  const cumulativeAngle = useRef<number>(0);
  const [isRotating, setIsRotating] = useState(false);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [alertActive, setAlertActive] = useState(false);

  // Active alarm detection
  const hasDueDose = dueEvents.length > 0 || alertActive;

  // Sound generator using Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hasDueDose && soundEnabled && (config?.has_buzzer ?? true)) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      beepTimerRef.current = setInterval(() => {
        try {
          if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
            gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.15);
          }
        } catch {
          // Audio context might be restricted
        }
      }, 700);
    } else {
      if (beepTimerRef.current) {
        clearInterval(beepTimerRef.current);
        beepTimerRef.current = null;
      }
    }
    return () => {
      if (beepTimerRef.current) clearInterval(beepTimerRef.current);
    };
  }, [hasDueDose, soundEnabled, config?.has_buzzer]);

  // Rotate disc smoothly to slot using shortest-path cumulative angle
  // Slot 1 = 0°, Slot N goes to the 0°-45° window. Never animates the long way around.
  const rotateToSlot = async (slotNum: number) => {
    if (isRotating) return;
    setIsRotating(true);
    setCurrentSlot(slotNum);

    // Absolute target angle for this slot (negative = counter-clockwise)
    const absoluteTarget = -(slotNum - 1) * 45;
    // Find the shortest delta from current cumulative position
    const currentMod = ((cumulativeAngle.current % 360) + 360) % 360;
    const targetMod = ((absoluteTarget % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    cumulativeAngle.current += delta;
    setDiscAngle(cumulativeAngle.current);

    toast.info(`Rotating carousel to Slot ${slotNum}...`);

    // Dispatch physical command to ESP32 stepper
    try {
      await sendCommand('rotate_to_slot', { slot: slotNum, mode: 'dispense' });
    } catch {
      // offline simulation
    }

    setTimeout(() => {
      setIsRotating(false);
      toast.success(`Slot ${slotNum} aligned at dispensing window!`);
    }, 1100);
  };

  // Simulate pushing physical tactile button
  const handlePhysicalButtonPress = async () => {
    setIsButtonPressed(true);
    setTimeout(() => setIsButtonPressed(false), 250);

    if (dueEvents.length > 0) {
      await markTaken(dueEvents[0].id);
      setAlertActive(false);
      toast.success('Physical button pressed: dose recorded as taken!');
    } else {
      setAlertActive(false);
      toast.info('Tactile button clicked (no active alarm).');
    }
  };

  // Trigger test alarm
  const handleTriggerAlarm = () => {
    setAlertActive(true);
    if (!soundEnabled) {
      toast.warning('Alarm triggered! (Enable buzzer audio to hear the alert)');
    } else {
      toast.warning('Buzzer sounding! Alarm active on Slot ' + currentSlot);
    }
  };

  // Keep the visual slots empty until real inventory is configured.
  const displaySlots = slots.length > 0
    ? slots
    : Array.from({ length: 8 }, (_, i) => ({
        slot_number: i + 1,
        medicine_id: null,
        pills_remaining: 0,
        status: 'empty' as const,
        medicine: null,
      }));

  return (
    <div className="retro-card !p-0 overflow-hidden border-2 border-slate-300 dark:border-slate-700 shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold tracking-wide text-slate-800 dark:text-slate-100 uppercase flex items-center gap-1.5">
              Interactive Hardware Carousel
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                8 SECTORS (45°)
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              Slot 1 = 0° to 45° Dispensing & Loading Sector &middot; Synchronized with ESP32
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle button */}
          <button
            type="button"
            className={`sm !py-1 !px-2.5 flex items-center gap-1.5 text-xs font-bold ${
              soundEnabled
                ? '!bg-amber-600 !text-white'
                : '!bg-slate-200 dark:!bg-slate-700'
            }`}
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next && !audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
              }
              toast.info(next ? 'Hardware buzzer sound enabled' : 'Buzzer muted');
            }}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 opacity-60" />}
            <span>Buzzer Audio</span>
          </button>

          {/* Minimize / Maximize */}
          <button
            type="button"
            className="sm !py-1 !px-2"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label="Toggle simulator details"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-6 bg-slate-50/50 dark:bg-slate-900/40">
          {/* Main Visual Arena: Disc on Left + ESP32 & OLED on Right */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* 1. Physical Rotating Disc Arena (6 cols) */}
            <div className="md:col-span-6 flex flex-col items-center justify-center p-4 bg-slate-200/50 dark:bg-slate-950/60 rounded-2xl border border-slate-300 dark:border-slate-800 relative">
              <div className="text-xs font-bold font-mono tracking-widest text-slate-600 dark:text-slate-400 uppercase mb-2 flex items-center justify-between w-full px-2">
                <span className="flex items-center gap-1.5">
                  <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>Rotor Position: Slot {currentSlot}</span>
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  Angle: {(-discAngle) % 360}°
                </span>
              </div>

              {/* Dispenser Disc Mechanism Wrapper */}
              <div className="relative w-72 h-72 flex items-center justify-center select-none my-2">
                
                {/* Visible Dispensing & Loading Window Callout Frame (Fixed at 0° to 45°) */}
                <div 
                  className="absolute z-20 pointer-events-none rounded-xl border-2 border-dashed border-amber-500 bg-amber-500/15 flex items-center justify-center shadow-lg"
                  style={{
                    width: '95px',
                    height: '80px',
                    top: '28px',
                    right: '20px',
                    transform: 'rotate(22.5deg)',
                  }}
                >
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 bg-slate-950/90 px-1 py-0.5 rounded shadow">
                    0° - 45° CHUTE
                  </span>
                </div>

                {/* Rotating Turntable SVG with 8 Sectors of 45 Degrees */}
                <svg
                  width="270"
                  height="270"
                  viewBox="0 0 270 270"
                  className="transition-transform duration-1000 ease-out drop-shadow-2xl cursor-grab active:cursor-grabbing"
                  style={{ transform: `rotate(${discAngle}deg)` }}
                >
                  {/* Outer Disc Rim */}
                  <circle cx="135" cy="135" r="130" fill="#1e293b" stroke="#475569" strokeWidth="4" />
                  <circle cx="135" cy="135" r="122" fill="#0f172a" />

                  {/* 8 Sectors (Each 45 degrees, Slot 1 = 0° to 45°) */}
                  {Array.from({ length: 8 }).map((_, i) => {
                    const slotNum = i + 1;
                    const startDeg = i * 45;
                    const endDeg = (i + 1) * 45;
                    const startRad = (startDeg * Math.PI) / 180;
                    const endRad = (endDeg * Math.PI) / 180;
                    const r = 120;

                    const x1 = 135 + r * Math.cos(startRad);
                    const y1 = 135 + r * Math.sin(startRad);
                    const x2 = 135 + r * Math.cos(endRad);
                    const y2 = 135 + r * Math.sin(endRad);

                    const midDeg = startDeg + 22.5;
                    const midRad = (midDeg * Math.PI) / 180;
                    const labelR = 86;
                    const lx = 135 + labelR * Math.cos(midRad);
                    const ly = 135 + labelR * Math.sin(midRad);

                    const slotObj = displaySlots.find((s) => s.slot_number === slotNum);
                    const isLoaded = slotObj && (slotObj.status === 'loaded' || (slotObj.pills_remaining ?? 0) > 0);
                    const medColor = slotObj?.medicine?.color ?? '#14b8a6';

                    // SVG Wedge Path: M 135 135 L x1 y1 A r r 0 0 1 x2 y2 Z
                    return (
                      <g key={slotNum} className="transition-all cursor-pointer" onClick={() => rotateToSlot(slotNum)}>
                        {/* Wedge slice */}
                        <path
                          d={`M 135 135 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                          fill={i % 2 === 0 ? '#1e293b' : '#0f172a'}
                          stroke={currentSlot === slotNum ? '#38bdf8' : '#334155'}
                          strokeWidth={currentSlot === slotNum ? 2.5 : 1}
                          className="hover:opacity-80 transition-opacity"
                        />

                        {/* Compartment Cup Circle */}
                        <circle
                          cx={lx}
                          cy={ly}
                          r="18"
                          fill={isLoaded ? '#0b1324' : '#1e293b'}
                          stroke={currentSlot === slotNum ? '#38bdf8' : '#475569'}
                          strokeWidth="1.5"
                        />

                        {/* Pill glyph */}
                        {isLoaded && (
                          <rect
                            x={lx - 8}
                            y={ly - 4}
                            width="16"
                            height="8"
                            rx="4"
                            fill={medColor}
                            stroke="#fff"
                            strokeWidth="0.8"
                          />
                        )}

                        {/* Slot Number Label */}
                        <text
                          x={lx}
                          y={isLoaded ? ly - 8 : ly + 4}
                          textAnchor="middle"
                          fill="#f8fafc"
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          S{slotNum}
                        </text>

                        {/* Pill count */}
                        {isLoaded && (
                          <text
                            x={lx}
                            y={ly + 11}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            {slotObj?.pills_remaining}p
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Center Motor Hub */}
                  <circle cx="135" cy="135" r="32" fill="#334155" stroke="#64748b" strokeWidth="2" />
                  <circle cx="135" cy="135" r="14" fill="#0f172a" />
                  <circle cx="135" cy="135" r="5" fill="#94a3b8" />

                </svg>

              </div>

              {/* Quick Slot Buttons (1 to 8) */}
              <div className="w-full mt-2">
                <div className="text-[11px] font-mono font-bold text-center text-muted-foreground mb-1.5">
                  CLICK TO ROTATE SLOT TO DISPENSING WINDOW:
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => {
                    const slotInfo = displaySlots.find((sl) => sl.slot_number === s);
                    const isLoaded = slotInfo && slotInfo.status === 'loaded';
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => rotateToSlot(s)}
                        className={`!min-h-[34px] !py-1 !px-1.5 text-[11px] font-mono font-bold flex flex-col items-center justify-center transition-all ${
                          currentSlot === s
                            ? '!bg-amber-600 !text-white !border-amber-700 ring-2 ring-amber-400'
                            : isLoaded
                            ? '!bg-slate-200 dark:!bg-slate-800 !text-slate-800 dark:!text-slate-200'
                            : '!bg-slate-100 dark:!bg-slate-900 opacity-60'
                        }`}
                      >
                        <span>S{s}</span>
                        <span className="text-[9px] font-normal opacity-80 truncate max-w-[48px]">
                          {isLoaded ? slotInfo?.medicine?.name : 'Empty'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. ESP32 Controller Board & Peripheral Modules (6 cols) */}
            <div className="md:col-span-6 space-y-4">
              
              {/* Virtual OLED Mirror */}
              <div className="p-3 bg-slate-900 rounded-2xl border-2 border-slate-700 flex flex-col items-center justify-center shadow-lg">
                <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1 px-1">
                  <span>SH1106 1.3" OLED (I2C 0x3C)</span>
                  <span className="text-emerald-400">D21:SDA / D22:SCL</span>
                </div>
                <OledPreview
                  screen={status?.oled_screen ?? null}
                  oledEnabled={config?.has_oled ?? true}
                  deviceOnline={isOnline || true}
                />
              </div>

              {/* Hardware Actions & Status */}
              <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    ESP32 Physical I/O Controls
                  </span>
                  <span className="text-[11px] text-muted-foreground">{isOnline ? 'Online (10.51.16.35)' : 'Simulated'}</span>
                </div>

                {/* Live Indicator Lights Row */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  {/* Alert LED on GPIO 15 */}
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 flex flex-col items-center gap-1">
                    <span
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
                        hasDueDose
                          ? 'bg-amber-500 shadow-[0_0_12px_#f59e0b] animate-ping'
                          : 'bg-slate-700'
                      }`}
                    />
                    <span className="font-bold">LED (D15)</span>
                    <span className="text-[10px] text-muted-foreground">{hasDueDose ? 'ALERT' : 'PULSE'}</span>
                  </div>

                  {/* Active Buzzer on GPIO 13 */}
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 flex flex-col items-center gap-1">
                    <span
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
                        hasDueDose
                          ? 'bg-red-500 shadow-[0_0_12px_#ef4444] animate-bounce'
                          : 'bg-slate-700'
                      }`}
                    />
                    <span className="font-bold">Buzzer (D13)</span>
                    <span className="text-[10px] text-muted-foreground">{hasDueDose ? 'BEEPING' : 'IDLE'}</span>
                  </div>

                </div>

                {/* Tactile Push Button and Quick Dispense */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Physical Button (D4) */}
                  <button
                    type="button"
                    onClick={handlePhysicalButtonPress}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all text-xs ${
                      isButtonPressed
                        ? 'bg-emerald-600 text-white border-emerald-500 scale-95'
                        : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-600 shadow-sm'
                    }`}
                  >
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                    <span>Push Button (D4)</span>
                  </button>

                  <p className="col-span-2 text-center text-xs text-slate-500">
                    Carousel position is estimated; manually align it after reboot.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Action Ribbon: Fast Simulation & Diagnostic Triggers */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Actions:
            </span>

            <button
              type="button"
              className="p sm !py-1.5 !px-3 flex items-center gap-1.5 text-xs font-bold !bg-amber-600 !text-white"
              onClick={handleTriggerAlarm}
            >
              <Bell className="w-3.5 h-3.5" />
              Simulate Due Dose Alarm
            </button>

            <button
              type="button"
              className="sm !py-1.5 !px-3 flex items-center gap-1.5 text-xs font-bold"
              onClick={() => rotateToSlot((currentSlot % 8) + 1)}
            >
              <RotateCw className="w-3.5 h-3.5" />
              Step to Next Slot (45°)
            </button>

            <button
              type="button"
              className="sm !py-1.5 !px-3 flex items-center gap-1.5 text-xs font-bold"
              onClick={async () => {
                try {
                  await sendCommand('test_oled', {});
                  toast.success('OLED test pattern dispatched.');
                } catch {
                  toast.info('Simulated: OLED test pattern active.');
                }
              }}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              Test OLED Display
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
