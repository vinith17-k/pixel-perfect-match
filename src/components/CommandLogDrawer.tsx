import { useCommands } from '../hooks/useCommands';
import { useAppStore, useAppDispatch } from '../stores/appStore';
import { cancelCommand, sendCommand } from '../lib/commands';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { toast } from 'sonner';
import { formatInTz } from '../lib/utils';
import { Clock, RefreshCw, XCircle, AlertCircle } from 'lucide-react';
import type { Command } from '../types';

export function CommandLogDrawer() {
  const { commands } = useCommands();
  const { commandDrawerOpen } = useAppStore();
  const dispatch = useAppDispatch();

  // Handle retry
  const handleRetry = async (cmd: Command) => {
    try {
      await sendCommand(cmd.type, cmd.payload);
      toast.success(`Retrying command "${cmd.type}"...`);
    } catch {
      toast.error('Failed to retry command.');
    }
  };

  // Handle cancel
  const handleCancel = async (id: number) => {
    try {
      await cancelCommand(id);
      toast.info('Command cancelled.');
    } catch {
      toast.error('Failed to cancel command.');
    }
  };

  const isStuck = (cmd: Command) => {
    if (cmd.status !== 'pending' && cmd.status !== 'running') return false;
    const createdTime = new Date(cmd.created_at).getTime();
    return Date.now() - createdTime > 20000; // > 20 seconds
  };

  return (
    <Modal
      open={commandDrawerOpen}
      onOpenChange={(open) => dispatch({ type: 'SET_COMMAND_DRAWER_OPEN', payload: open })}
      title="Hardware Command Queue"
      description="Live telemetry of outbound instructions to the ESP32 controller."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {commands.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No command history recorded yet.
          </p>
        ) : (
          commands.map((cmd) => {
            const stuck = isStuck(cmd);
            return (
              <div
                key={cmd.id}
                className={`p-3 rounded-xl border text-xs font-mono flex flex-col gap-2 ${
                  stuck
                    ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      #{cmd.id} {cmd.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(cmd.created_at).toLocaleTimeString()}
                    </span>
                  </div>

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

                {/* Payload */}
                {Object.keys(cmd.payload ?? {}).length > 0 && (
                  <div className="text-[11px] text-slate-500 font-mono bg-white/70 dark:bg-slate-800/70 p-1.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                    payload: {JSON.stringify(cmd.payload)}
                  </div>
                )}

                {/* Result or Warning */}
                {cmd.result && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    result: {JSON.stringify(cmd.result)}
                  </div>
                )}

                {/* Stuck in pending alert */}
                {stuck && (
                  <div className="flex items-center justify-between pt-1 border-t border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300">
                    <span className="flex items-center gap-1 font-bold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" /> Device not responding ({'>'}20s)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="sm !py-0.5 !px-2 text-[10px] font-bold"
                        onClick={() => handleRetry(cmd)}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="sm d !py-0.5 !px-2 text-[10px] font-bold"
                        onClick={() => handleCancel(cmd.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
