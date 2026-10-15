-- ==============================================================================
-- RESTORE OPEN PROTOTYPE ACCESS (RUN THIS ONCE IN SUPABASE SQL EDITOR)
-- Project: https://supabase.com/dashboard/project/bhipuyxwjlcfkiguammh/sql/new
-- ==============================================================================

-- 1. Grant public and anonymous roles access to all schema tables and routines
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;

-- 2. Disable Row Level Security (RLS) on all 7 tables
-- This allows both the physical ESP32 and the Web Browser to read/write seamlessly without 401 Unauthorized errors.
alter table if exists public.medicines disable row level security;
alter table if exists public.slots disable row level security;
alter table if exists public.schedules disable row level security;
alter table if exists public.dose_events disable row level security;
alter table if exists public.commands disable row level security;
alter table if exists public.hardware_config disable row level security;
alter table if exists public.device_status disable row level security;

-- 3. Reset device_status row with current timestamp and idle state
insert into public.device_status (id, state, last_seen, current_slot, ip, firmware, oled_screen, parts_ok)
values (
  1,
  'idle',
  now(),
  1,
  '10.51.16.35',
  'v2.0.0-esp32',
  '{"screen":"home","lines":["10:42","Thu 15 Oct","Next: Ready"]}'::jsonb,
  '{"oled":true,"stepper":true,"button":true,"led":true,"buzzer":true}'::jsonb
)
on conflict (id) do update set
  state = 'idle',
  last_seen = now(),
  parts_ok = '{"oled":true,"stepper":true,"button":true,"led":true,"buzzer":true}'::jsonb;

-- 4. Verify 8 slots exist
insert into public.slots (slot_number, status, pills_remaining)
select s, 'empty', 0 from generate_series(1, 8) as s
on conflict (slot_number) do nothing;
