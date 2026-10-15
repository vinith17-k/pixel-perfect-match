import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('./supabase', () => ({
  supabase: { rpc },
}));

import { markTaken, skipDose, snoozeDose } from './commands';

describe('dose command RPCs', () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
  });

  it('acknowledges a taken dose through the transactional RPC', async () => {
    rpc.mockResolvedValue({ data: { status: 'taken' }, error: null });

    await markTaken('event-123');

    expect(rpc).toHaveBeenCalledWith('mark_dose_taken', {
      p_event_id: 'event-123',
      p_taken_via: 'website',
    });
  });

  it('surfaces dose acknowledgement errors', async () => {
    const error = new Error('not authorized');
    rpc.mockResolvedValue({ data: null, error });

    await expect(markTaken('event-123')).rejects.toBe(error);
  });

  it('snoozes with the requested duration', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await snoozeDose('event-123', 15);

    expect(rpc).toHaveBeenCalledWith('resolve_device_dose', {
      p_event_id: 'event-123',
      p_status: 'snoozed',
      p_snooze_minutes: 15,
    });
  });

  it('skips through the dose resolution RPC', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await skipDose('event-123');

    expect(rpc).toHaveBeenCalledWith('resolve_device_dose', {
      p_event_id: 'event-123',
      p_status: 'skipped',
      p_snooze_minutes: null,
    });
  });
});
