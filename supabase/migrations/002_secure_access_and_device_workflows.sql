-- Sage Bot single-owner access model.
-- Create owner/device users in Supabase Auth and set their UUIDs in app_access
-- using the SQL editor (service role) before using the application or device.

create table if not exists public.app_access (
  id integer primary key check (id = 1),
  owner_user_id uuid references auth.users(id) on delete restrict,
  device_user_id uuid references auth.users(id) on delete restrict,
  check (owner_user_id is null or device_user_id is null or owner_user_id <> device_user_id)
);

insert into public.app_access (id) values (1)
on conflict (id) do nothing;

alter table public.app_access enable row level security;

create or replace function public.is_sage_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.app_access
    where id = 1 and owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_sage_device()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.app_access
    where id = 1 and device_user_id = auth.uid()
  );
$$;

revoke all on function public.is_sage_owner() from public, anon;
revoke all on function public.is_sage_device() from public, anon;
grant execute on function public.is_sage_owner() to authenticated;
grant execute on function public.is_sage_device() to authenticated;

-- Hall, IR, and servo support has been intentionally removed from this version.
alter table public.hardware_config
  drop column if exists has_hall,
  drop column if exists has_ir,
  drop column if exists has_servo;

-- A device can recover an interrupted command after its lease expires.
alter table public.commands
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by uuid references auth.users(id) on delete set null;

create index if not exists commands_pending_created_at_idx
  on public.commands (created_at, id)
  where status = 'pending';

create index if not exists dose_events_due_scheduled_for_idx
  on public.dose_events (scheduled_for)
  where status in ('due', 'snoozed');

-- Remove the prototype's unrestricted anonymous policies and any stale policies
-- from a prior run before adding the single-owner policies below.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'medicines', 'slots', 'schedules', 'dose_events',
    'commands', 'hardware_config', 'device_status'
  ]
  loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy sage_owner_all on public.%I for all to authenticated using (public.is_sage_owner()) with check (public.is_sage_owner())',
      t
    );
  end loop;
end $$;

create policy sage_device_read_medicines
  on public.medicines for select to authenticated
  using (public.is_sage_device());
create policy sage_device_read_slots
  on public.slots for select to authenticated
  using (public.is_sage_device());
create policy sage_device_read_schedules
  on public.schedules for select to authenticated
  using (public.is_sage_device());
create policy sage_device_read_hardware_config
  on public.hardware_config for select to authenticated
  using (public.is_sage_device());
create policy sage_device_update_status
  on public.device_status for update to authenticated
  using (public.is_sage_device())
  with check (public.is_sage_device());

revoke all on public.app_access from anon, authenticated;
revoke all on public.medicines, public.slots, public.schedules,
  public.dose_events, public.commands, public.hardware_config,
  public.device_status from anon;
grant select, insert, update, delete on public.medicines, public.slots,
  public.schedules, public.dose_events, public.commands,
  public.hardware_config, public.device_status to authenticated;
grant usage, select on sequence public.commands_id_seq to authenticated;

create or replace function public.claim_next_command()
returns table (id bigint, type text, payload jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_sage_device() and not public.is_sage_owner() then
    raise exception 'Device authentication required';
  end if;

  return query
    with next_command as (
      select c.id
      from public.commands as c
      where c.status = 'pending'
         or (c.status = 'running'
             and (c.claimed_at is null or c.claimed_at < now() - interval '2 minutes'))
      order by c.created_at, c.id
      for update skip locked
      limit 1
    )
    update public.commands as c
    set status = 'running',
        claimed_at = now(),
        claimed_by = auth.uid()
    from next_command as n
    where c.id = n.id
    returning c.id, c.type, c.payload;
end;
$$;

create or replace function public.complete_device_command(
  p_id bigint,
  p_status text,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_sage_device() and not public.is_sage_owner() then
    raise exception 'Device authentication required';
  end if;
  if p_status not in ('done', 'failed', 'simulated') then
    raise exception 'Invalid terminal command status';
  end if;

  update public.commands
  set status = p_status,
      result = p_result,
      done_at = now(),
      claimed_at = null,
      claimed_by = null
  where commands.id = p_id
    and commands.status = 'running'
    and commands.claimed_by = auth.uid();

  return found;
end;
$$;

create or replace function public.mark_dose_taken(
  p_event_id uuid,
  p_taken_via text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.dose_events%rowtype;
  v_pills_per_dose integer;
  v_remaining integer;
begin
  if not public.is_sage_owner()
     and not (public.is_sage_device() and p_taken_via = 'button') then
    raise exception 'Not authorized to acknowledge this dose';
  end if;
  if p_taken_via not in ('button', 'website', 'simulator') then
    raise exception 'Invalid dose acknowledgement source';
  end if;

  select * into v_event
  from public.dose_events
  where dose_events.id = p_event_id
  for update;

  if not found then
    raise exception 'Dose event not found';
  end if;
  if v_event.status = 'taken' then
    return jsonb_build_object('status', 'taken', 'already_taken', true);
  end if;
  if v_event.status not in ('due', 'snoozed') then
    raise exception 'Dose event is no longer actionable';
  end if;

  update public.dose_events
  set status = 'taken',
      taken_at = now(),
      taken_via = p_taken_via,
      snooze_until = null
  where dose_events.id = p_event_id;

  insert into public.commands (type, payload)
  values ('stop_alarm', jsonb_build_object('event_id', p_event_id));

  if v_event.slot_number is not null then
    select coalesce(s.pills_per_dose, 1) into v_pills_per_dose
    from public.schedules as s
    where s.id = v_event.schedule_id;
    v_pills_per_dose := coalesce(v_pills_per_dose, 1);

    update public.slots
    set pills_remaining = greatest(0, coalesce(slots.pills_remaining, 0) - v_pills_per_dose),
        updated_at = now()
    where slots.slot_number = v_event.slot_number
    returning slots.pills_remaining into v_remaining;
  end if;

  return jsonb_build_object(
    'status', 'taken',
    'already_taken', false,
    'slot_number', v_event.slot_number,
    'pills_remaining', v_remaining
  );
end;
$$;

create or replace function public.resolve_device_dose(
  p_event_id uuid,
  p_status text,
  p_snooze_minutes integer default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_sage_owner() then
    raise exception 'Owner authentication required';
  end if;
  if p_status not in ('snoozed', 'skipped') then
    raise exception 'Invalid device dose resolution';
  end if;
  if p_status = 'snoozed' and (p_snooze_minutes is null or p_snooze_minutes < 1 or p_snooze_minutes > 1440) then
    raise exception 'Invalid snooze interval';
  end if;

  update public.dose_events
  set status = p_status,
      snooze_until = case
        when p_status = 'snoozed' then now() + make_interval(mins => p_snooze_minutes)
        else null
      end
  where dose_events.id = p_event_id
    and dose_events.status in ('due', 'snoozed');

  if not found then
    return false;
  end if;

  insert into public.commands (type, payload)
  values (
    case when p_status = 'snoozed' then 'snooze' else 'skip' end,
    jsonb_build_object('event_id', p_event_id, 'minutes', p_snooze_minutes)
  );
  return true;
end;
$$;

revoke all on function public.claim_next_command() from public, anon;
revoke all on function public.complete_device_command(bigint, text, jsonb) from public, anon;
revoke all on function public.mark_dose_taken(uuid, text) from public, anon;
revoke all on function public.resolve_device_dose(uuid, text, integer) from public, anon;
grant execute on function public.claim_next_command() to authenticated;
grant execute on function public.complete_device_command(bigint, text, jsonb) to authenticated;
grant execute on function public.mark_dose_taken(uuid, text) to authenticated;
grant execute on function public.resolve_device_dose(uuid, text, integer) to authenticated;
