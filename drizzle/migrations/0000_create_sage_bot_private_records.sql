CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  dose text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#14b8a6',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, id),
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO authenticated;
GRANT ALL ON public.medicines TO service_role;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY medicines_select_own ON public.medicines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY medicines_insert_own ON public.medicines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY medicines_update_own ON public.medicines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY medicines_delete_own ON public.medicines FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.slots (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_number integer NOT NULL CHECK (slot_number BETWEEN 1 AND 8),
  medicine_id uuid,
  pills_remaining integer NOT NULL DEFAULT 0 CHECK (pills_remaining >= 0),
  status text NOT NULL DEFAULT 'empty' CHECK (status IN ('empty', 'loaded')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot_number),
  FOREIGN KEY (user_id, medicine_id) REFERENCES public.medicines(user_id, id) ON DELETE SET NULL (medicine_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slots TO authenticated;
GRANT ALL ON public.slots TO service_role;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY slots_select_own ON public.slots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY slots_insert_own ON public.slots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY slots_update_own ON public.slots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY slots_delete_own ON public.slots FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_number integer NOT NULL,
  medicine_id uuid,
  time_of_day time NOT NULL,
  days integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  pills_per_dose integer NOT NULL DEFAULT 1 CHECK (pills_per_dose BETWEEN 1 AND 20),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, slot_number) REFERENCES public.slots(user_id, slot_number) ON DELETE CASCADE,
  FOREIGN KEY (user_id, medicine_id) REFERENCES public.medicines(user_id, id) ON DELETE SET NULL (medicine_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedules_select_own ON public.schedules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY schedules_insert_own ON public.schedules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY schedules_update_own ON public.schedules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY schedules_delete_own ON public.schedules FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.dose_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  slot_number integer NOT NULL CHECK (slot_number BETWEEN 1 AND 8),
  medicine_name text NOT NULL,
  dose text NOT NULL DEFAULT '',
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','taken','missed','skipped','snoozed')),
  taken_at timestamptz,
  taken_via text CHECK (taken_via IN ('button','website','simulator')),
  snooze_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, scheduled_for)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_events TO authenticated;
GRANT ALL ON public.dose_events TO service_role;
ALTER TABLE public.dose_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY dose_events_select_own ON public.dose_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dose_events_insert_own ON public.dose_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY dose_events_update_own ON public.dose_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY dose_events_delete_own ON public.dose_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','simulated')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commands TO authenticated;
GRANT ALL ON public.commands TO service_role;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY commands_select_own ON public.commands FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY commands_insert_own ON public.commands FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY commands_update_own ON public.commands FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY commands_delete_own ON public.commands FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.hardware_config (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name text NOT NULL DEFAULT 'Sage Bot',
  has_oled boolean NOT NULL DEFAULT true,
  has_stepper boolean NOT NULL DEFAULT false,
  has_hall boolean NOT NULL DEFAULT false,
  has_ir boolean NOT NULL DEFAULT false,
  has_servo boolean NOT NULL DEFAULT false,
  has_button boolean NOT NULL DEFAULT false,
  has_led boolean NOT NULL DEFAULT false,
  has_buzzer boolean NOT NULL DEFAULT false,
  num_slots integer NOT NULL DEFAULT 8 CHECK (num_slots BETWEEN 4 AND 8),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  snooze_minutes integer NOT NULL DEFAULT 10 CHECK (snooze_minutes BETWEEN 1 AND 120),
  missed_after_minutes integer NOT NULL DEFAULT 30 CHECK (missed_after_minutes BETWEEN 1 AND 360),
  low_stock_threshold integer NOT NULL DEFAULT 3 CHECK (low_stock_threshold BETWEEN 0 AND 100),
  simulator_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hardware_config TO authenticated;
GRANT ALL ON public.hardware_config TO service_role;
ALTER TABLE public.hardware_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY hardware_config_select_own ON public.hardware_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY hardware_config_insert_own ON public.hardware_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY hardware_config_update_own ON public.hardware_config FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY hardware_config_delete_own ON public.hardware_config FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.device_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen timestamptz,
  state text NOT NULL DEFAULT 'offline',
  current_slot integer,
  active_event_id uuid,
  ip text,
  rssi integer,
  firmware text,
  uptime_s bigint,
  oled_screen jsonb NOT NULL DEFAULT '{"screen":"home","lines":["SAGE BOT","READY","LOAD MEDICINE"]}'::jsonb,
  parts_ok jsonb NOT NULL DEFAULT '{"oled":true,"stepper":false,"hall":false,"ir":false,"servo":false,"button":false,"led":false,"buzzer":false}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_status TO authenticated;
GRANT ALL ON public.device_status TO service_role;
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_status_select_own ON public.device_status FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY device_status_insert_own ON public.device_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY device_status_update_own ON public.device_status FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY device_status_delete_own ON public.device_status FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_sage_bot_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  INSERT INTO public.slots (user_id, slot_number)
  SELECT NEW.id, generate_series(1, 8);
  INSERT INTO public.hardware_config (user_id) VALUES (NEW.id);
  INSERT INTO public.device_status (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_sage_bot
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_sage_bot_signup();

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medicines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dose_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hardware_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status;