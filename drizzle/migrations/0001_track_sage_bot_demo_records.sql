ALTER TABLE public.medicines ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.schedules ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.dose_events ADD COLUMN is_demo boolean NOT NULL DEFAULT false;