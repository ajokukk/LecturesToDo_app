-- Departments, levels, venue, lecturer and cancellation for timetable slots.
-- Existing rows stay visible to everyone: they become "General Studies" (all
-- departments) with no level (all levels).
ALTER TABLE public.timetable_slots
  ADD COLUMN course_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN department TEXT NOT NULL DEFAULT 'General Studies',
  ADD COLUMN level SMALLINT CHECK (level IS NULL OR level IN (100, 200, 300, 400, 500)),
  ADD COLUMN venue TEXT NOT NULL DEFAULT '',
  ADD COLUMN lecturer TEXT NOT NULL DEFAULT '',
  ADD COLUMN cancelled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX timetable_slots_audience_idx
  ON public.timetable_slots (department, level);
