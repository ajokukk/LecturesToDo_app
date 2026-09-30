CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT NOT NULL DEFAULT 'General',
  session_type TEXT NOT NULL DEFAULT 'lecture' CHECK (session_type IN ('lecture', 'tutorial', 'practical')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO anon;
GRANT ALL ON public.timetable_slots TO service_role;

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.timetable_slots FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Public insert access" ON public.timetable_slots FOR INSERT TO anon WITH CHECK (TRUE);
CREATE POLICY "Public update access" ON public.timetable_slots FOR UPDATE TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Public delete access" ON public.timetable_slots FOR DELETE TO anon USING (TRUE);
