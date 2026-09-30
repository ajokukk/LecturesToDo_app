CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'lecture' CHECK (session_type IN ('lecture', 'tutorial', 'practical')),
  subject TEXT NOT NULL DEFAULT 'General',
  due_date DATE,
  owner TEXT NOT NULL DEFAULT 'teacher' CHECK (owner IN ('teacher', 'student')),
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO anon;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.tasks FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Public insert access" ON public.tasks FOR INSERT TO anon WITH CHECK (TRUE);
CREATE POLICY "Public update access" ON public.tasks FOR UPDATE TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Public delete access" ON public.tasks FOR DELETE TO anon USING (TRUE);
