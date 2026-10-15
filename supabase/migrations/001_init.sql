-- ============================================================
-- Sage Bot – Initial Database Schema
-- Run this once in your Supabase SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- Medicines catalogue
-- ----------------------------------------------------------
create table if not exists medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dose text,
  notes text,
  color text default '#14b8a6',
  created_at timestamptz default now()
);

-- ----------------------------------------------------------
-- Slots (physical compartments on the disc)
-- ----------------------------------------------------------
create table if not exists slots (
  slot_number int primary key check (slot_number between 1 and 8),
  medicine_id uuid references medicines(id) on delete set null,
  pills_remaining int default 0,
  status text default 'empty' check (status in ('empty','loaded')),
  updated_at timestamptz default now()
);
insert into slots (slot_number)
select generate_series(1,8)
on conflict (slot_number) do nothing;

-- ----------------------------------------------------------
-- Schedules
-- ----------------------------------------------------------
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  slot_number int references slots(slot_number) on delete cascade,
  medicine_id uuid references medicines(id) on delete set null,
  time_of_day time not null,
  days int[] not null default '{0,1,2,3,4,5,6}',  -- 0 = Sunday … 6 = Saturday
  pills_per_dose int default 1,
  enabled boolean default true,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------
-- Dose events (one row per alarm instance)
-- ----------------------------------------------------------
create table if not exists dose_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references schedules(id) on delete set null,
  slot_number int,
  medicine_name text,
  dose text,
  scheduled_for timestamptz not null,
  status text default 'due' check (status in ('due','taken','missed','skipped','snoozed')),
  taken_at timestamptz,
  taken_via text check (taken_via in ('button','website','simulator')),
  snooze_until timestamptz,
  created_at timestamptz default now(),
  unique (schedule_id, scheduled_for)
);

-- ----------------------------------------------------------
-- Commands (website → device communication queue)
-- ----------------------------------------------------------
create table if not exists commands (
  id bigserial primary key,
  type text not null,
  payload jsonb default '{}'::jsonb,
  status text default 'pending' check (status in ('pending','running','done','failed','simulated')),
  result jsonb,
  created_at timestamptz default now(),
  done_at timestamptz
);

-- ----------------------------------------------------------
-- Hardware configuration (single row, id = 1)
-- ----------------------------------------------------------
create table if not exists hardware_config (
  id int primary key default 1 check (id = 1),
  has_oled boolean default true,
  has_stepper boolean default false,
  has_hall boolean default false,
  has_ir boolean default false,
  has_servo boolean default false,
  has_button boolean default false,
  has_led boolean default false,
  has_buzzer boolean default false,
  num_slots int default 8 check (num_slots between 4 and 8),
  timezone text default 'Asia/Kolkata',
  snooze_minutes int default 10,
  missed_after_minutes int default 30,
  low_stock_threshold int default 3,
  updated_at timestamptz default now()
);
insert into hardware_config (id) values (1)
on conflict (id) do nothing;

-- ----------------------------------------------------------
-- Device status (single row, id = 1) – written by the ESP32
-- ----------------------------------------------------------
create table if not exists device_status (
  id int primary key default 1 check (id = 1),
  last_seen timestamptz,
  state text default 'offline',  -- idle | alarm | loading | moving | offline
  current_slot int,
  active_event_id uuid,
  ip text,
  rssi int,
  firmware text,
  uptime_s bigint,
  oled_screen jsonb,             -- {"screen":"home","lines":["10:42","Tue 13 Oct","Next: ..."]}
  parts_ok jsonb                 -- device self-report, e.g. {"oled":true,"stepper":false}
);
insert into device_status (id) values (1)
on conflict (id) do nothing;

-- ----------------------------------------------------------
-- Enable RLS without granting prototype-wide access. The second migration
-- installs the owner/device policies after Auth user IDs are configured.
-- ----------------------------------------------------------
alter table medicines enable row level security;
alter table slots enable row level security;
alter table schedules enable row level security;
alter table dose_events enable row level security;
alter table commands enable row level security;
alter table hardware_config enable row level security;
alter table device_status enable row level security;

-- ----------------------------------------------------------
-- Enable Realtime for all tables
-- ----------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'device_status', 'commands', 'dose_events', 'slots',
    'hardware_config', 'schedules', 'medicines'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
