import { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCw,
  Bell,
  Volume2,
  VolumeX,
  Radio,
  Fingerprint,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  Info,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHardwareConfig } from '../hooks/useHardwareConfig';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { useSlots } from '../hooks/useSlots';
import { useDoseEvents } from '../hooks/useDoseEvents';
import { useAppStore, useAppDispatch } from '../stores/appStore';
import { sendCommand, markTaken } from '../lib/commands';
import { OledPreview } from './OledPreview';

export function VirtualHardwareStage() {
  const { config, update: updateConfig } = useHardwareConfig();
  const { status, isOnline } = useDeviceStatus();
  const { slots } = useSlots();
  const { dueEvents } = useDoseEvents();
  const { simulatorMode } = useAppStore();
  const dispatch = useAppDispatch();

  // Expanded panel state
  const [isExpanded, setIsExpanded] = useState(true);

  // Local simulated hardware state
  const [currentSlot, setCurrentSlot] = useState(1);
  const [discAngle, setDiscAngle] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const [isShutterOpen, setIsShutterOpen] = useState(false);
  const [isIrTriggered, setIsIrTriggered] = useState(false);
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
            osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime); // 880Hz buzzer
            gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.15);
          }
        } catch {
          // Audio context might be restricted before user gesture
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

  // Rotate disc smoothly to slot
  const rotateToSlot = (slotNum: number) => {
    if (isRotating) return;
    setIsRotating(true);
    setCurrentSlot(slotNum);
    // 8 slots = 45 degrees per slot
    const targetAngle = (slotNum - 1) * -45;
    setDiscAngle(targetAngle);
    toast.info(`Stepper: rotating motor to Slot ${slotNum}...`);

    setTimeout(() => {
      setIsRotating(false);
      toast.success(`Disc arrived at Slot ${slotNum}`);
    }, 1200);
  };

  // Simulate pushing physical button
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

  // Simulate dropping a pill through IR shutter
  const handleDropPill = () => {
    setIsShutterOpen(true);
    setIsIrTriggered(true);
    toast.info('Servo shutter opening...');

    setTimeout(() => {
      toast.success('IR Sensor: pill passage confirmed (beam broken)!');
      setTimeout(() => {
        setIsIrTriggered(false);
        setIsShutterOpen(false);
        toast.info('Servo shutter closed.');
      }, 900);
    }, 600);
  };

  // Trigger test alarm
  const handleTriggerAlarm = () => {
    setAlertActive(true);
    if (!soundEnabled) {
      toast.warning('Alarm triggered! (Enable sound below to hear the buzzer)');
    } else {
      toast.warning('Buzzer sounding! Alarm active on Slot ' + currentSlot);
    }
  };

  // Fallback slots if DB empty
  const displaySlots = slots.length > 0
    ? slots
    : Array.from({ length: 8 }, (_, i) => ({
        slot_number: i + 1,
        medicine_id: i < 3 ? `mock-${i}` : null,
        pills_remaining: i < 3 ? 15 - i * 3 : 0,
        status: (i < 3 ? 'loaded' : 'empty') as 'loaded' | 'empty',
        medicine: i === 0
          ? { name: 'Metformin', color: '#14b8a6', dose: '500mg' }
          : i === 1
          ? { name: 'Vitamin D3', color: '#f59e0b', dose: '1000IU' }
          : i === 2
          ? { name: 'Amlodipine', color: '#6366f1', dose: '5mg' }
          : null,
      }));

  return (
    <div className="retro-card !p-0 overflow-hidden border-2 border-slate-300 dark:border-slate-700 shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold tracking-wide text-slate-800 dark:text-slate-100 uppercase flex items-center gap-1.5">
              Interactive Virtual Hardware Stage
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                PRO SIMULATOR
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              Live physics, motor rotation, sensors, and tactile controls
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
            
            {/* 1. Physical Rotating Disc Arena (7 cols on desktop) */}
            <div className="md:col-span-6 flex flex-col items-center justify-center p-4 bg-slate-200/50 dark:bg-slate-950/60 rounded-2xl border border-slate-300 dark:border-slate-800 relative">
              <div className="text-xs font-bold font-mono tracking-widest text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-emerald-600' : ''}`} />
                <span>8-Slot Dispenser Disc (Slot {currentSlot} at Chute)</span>
              </div>

              {/* Dispenser Disc Mechanism Wrapper */}
              <div className="relative w-64 h-64 flex items-center justify-center select-none my-2">
                {/* Fixed Outer Ring & Dispensing Chute Pointer at Top */}
                <div className="absolute top-0 w-8 h-8 -mt-2 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-black z-20 shadow-md border-2 border-white">
                  ▼
                </div>

                {/* Rotating Turntable SVG */}
                <svg
                  width="250"
                  height="250"
                  viewBox="0 0 250 250"
                  className="transition-transform duration-1000 ease-out drop-shadow-xl cursor-grab active:cursor-grabbing"
                  style={{ transform: `rotate(${discAngle}deg)` }}
                >
                  {/* Outer acrylic chassis disc */}
                  <circle cx="125" cy="125" r="120" fill="#1e293b" stroke="#475569" strokeWidth="4" />
                  <circle cx="125" cy="125" r="114" fill="#0f172a" />

                  {/* Radial Divider Spokes */}
                  {Array.from({ length: 8 }).map((_, i) => {
                    const angle = (i * 45 * Math.PI) / 180;
                    const x2 = 125 + 114 * Math.cos(angle);
                    const y2 = 125 + 114 * Math.sin(angle);
                    return (
                      <line
                        key={i}
                        x1="125"
                        y1="125"
                        x2={x2}
                        y2={y2}
                        stroke="#334155"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                    );
                  })}

                  {/* 8 Chamber Compartments */}
                  {displaySlots.slice(0, 8).map((slot, i) => {
                    // Position each slot in a circle (offset by 90deg so slot 1 is at top)
                    const angle = ((i * 45 - 90) * Math.PI) / 180;
                    const cx = 125 + 78 * Math.cos(angle);
                    const cy = 125 + 78 * Math.sin(angle);
                    const isLoaded = slot.status === 'loaded' || (slot.pills_remaining ?? 0) > 0;
                    const medColor = slot.medicine?.color ?? '#14b8a6';

                    return (
                      <g key={slot.slot_number} className="transition-all">
                        {/* Compartment Cup */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r="24"
                          fill={isLoaded ? '#1e293b' : '#090d16'}
                          stroke={currentSlot === slot.slot_number ? '#38bdf8' : '#334155'}
                          strokeWidth={currentSlot === slot.slot_number ? '3' : '1.5'}
                        />

                        {/* Pills Visual Representation inside Cup */}
                        {isLoaded && (
                          <g transform={`translate(${cx - 8}, ${cy - 8})`}>
                            <rect x="0" y="2" width="16" height="7" rx="3.5" fill={medColor} />
                            <circle cx="4" cy="12" r="3" fill="#cbd5e1" opacity="0.8" />
                            <circle cx="12" cy="12" r="3" fill={medColor} opacity="0.9" />
                          </g>
                        )}

                        {/* Slot Number Label */}
                        <text
                          x={cx}
                          y={isLoaded ? cy - 10 : cy + 4}
                          textAnchor="middle"
                          fill="#f8fafc"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          S{slot.slot_number}
                        </text>

                        {/* Pills count badge */}
                        {isLoaded && (
                          <text
                            x={cx}
                            y={cy + 12}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            {slot.pills_remaining}p
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Center Stepper Hub */}
                  <circle cx="125" cy="125" r="34" fill="#334155" stroke="#64748b" strokeWidth="3" />
                  <circle cx="125" cy="125" r="16" fill="#0f172a" />
                  <circle cx="125" cy="125" r="6" fill="#94a3b8" />

                  {/* Hall Effect Magnet at Slot 1 */}
                  <circle cx="125" cy="40" r="4" fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />
                </svg>

                {/* Hall Effect Sensor on Chassis (aligned with Slot 1 top) */}
                <div
                  className={`absolute top-2 w-3 h-3 rounded-sm border ${
                    currentSlot === 1
                      ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_8px_#10b981]'
                      : 'bg-slate-700 border-slate-600'
                  }`}
                  title="Hall Sensor A3144 (GPIO 33): Homing Sensor"
                />
              </div>

              {/* Slot quick-stepper buttons */}
              <div className="flex items-center gap-1 flex-wrap justify-center mt-3">
                {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => rotateToSlot(s)}
                    className={`sm !py-1 !px-2.5 text-xs font-mono font-bold ${
                      currentSlot === s ? '!bg-amber-600 !text-white' : ''
                    }`}
                  >
                    S{s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. ESP32 Controller Board & Peripheral Modules (6 cols) */}
            <div className="md:col-span-6 space-y-4">
              
              {/* Virtual OLED Frame */}
              <div className="p-3 bg-slate-900 rounded-2xl border-2 border-slate-700 flex flex-col items-center justify-center shadow-lg">
                <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1 px-1">
                  <span>SSD1306 0.96" OLED (I2C 0x3C)</span>
                  <span className="text-emerald-400">D21:SDA / D22:SCL</span>
                </div>
                <OledPreview
                  screen={status?.oled_screen ?? null}
                  oledEnabled={config?.has_oled ?? true}
                  deviceOnline={isOnline || true}
                />
              </div>

              {/* ESP32 Hardware Peripheral Board Box */}
              <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 uppercase flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    ESP32 DevKit V1 Telemetry
                  </span>
                  <span className="text-[11px] text-muted-foreground">Firmware: v1.0.0-esp32</span>
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
                    <span className="text-[10px] text-muted-foreground">{hasDueDose ? 'ALERT' : 'OFF'}</span>
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

                  {/* IR Sensor FC-51 on GPIO 32 */}
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 flex flex-col items-center gap-1">
                    <span
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
                        isIrTriggered
                          ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                          : 'bg-slate-700'
                      }`}
                    />
                    <span className="font-bold">IR Beam (D32)</span>
                    <span className="text-[10px] text-muted-foreground">{isIrTriggered ? 'TRIPPED' : 'CLEAR'}</span>
                  </div>
                </div>

                {/* Tactile Hardware Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Clickable Push Button on GPIO 4 */}
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
                    <span>Press Button (D4)</span>
                  </button>

                  {/* Pill Drop Simulator */}
                  <button
                    type="button"
                    onClick={handleDropPill}
                    className="p-2.5 rounded-xl border bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-600 shadow-sm flex items-center justify-center gap-2 font-bold text-xs"
                  >
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span>Drop Pill (IR/Servo)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Action Ribbon: Fast Simulation Triggers */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Test Triggers:
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
              Step Motor to Next Slot
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
              Flash OLED Test Pattern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
