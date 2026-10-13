import { useState } from 'react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { Modal } from './ui/Modal';

interface PinLockModalProps {
  unlocked: boolean;
  onUnlock: () => void;
}

export function PinLockModal({ unlocked, onUnlock }: PinLockModalProps) {
  const { pinLock } = useAppStore();
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState(false);

  if (!pinLock.enabled || unlocked) {
    return null;
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin === pinLock.pin) {
      setError(false);
      setInputPin('');
      onUnlock();
    } else {
      setError(true);
      setInputPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm retro-card !bg-white dark:!bg-slate-900 text-center p-6 space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold">Sage Bot Locked</h3>
        <p className="text-xs text-muted-foreground">
          Enter your 4-digit security PIN to access the dispenser console.
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="password"
            maxLength={6}
            placeholder="••••"
            autoFocus
            value={inputPin}
            onChange={(e) => {
              setError(false);
              setInputPin(e.target.value.replace(/\D/g, ''));
            }}
            className="text-center text-2xl tracking-widest font-mono font-bold"
          />

          {error && (
            <p className="text-xs font-bold text-red-500 flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Incorrect PIN. Please try again.
            </p>
          )}

          <button type="submit" className="p sm w-full font-bold">
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
