import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type NewTask = Database["public"]["Tables"]["tasks"]["Insert"];
type Slot = Database["public"]["Tables"]["timetable_slots"]["Row"];
type NewSlot = Database["public"]["Tables"]["timetable_slots"]["Insert"];
type SessionType = "lecture" | "tutorial" | "practical";
type Role = "teacher" | "student";

const TASKS_KEY = ["tasks"] as const;
const SLOTS_KEY = ["timetable"] as const;

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "practical", label: "Practical" },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const typeClasses: Record<SessionType, string> = {
  lecture: "bg-lecture text-foreground",
  tutorial: "bg-tutorial text-foreground",
  practical: "bg-practical text-accent-foreground",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDue(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
    .toUpperCase();
}

function shortTime(t: string): string {
  return t.slice(0, 5);
}

/* ---------------- Task row ---------------- */

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const overdue = !task.done && task.due_date !== null && task.due_date < todayISO();
  return (
    <li
      className={`flex items-stretch border-4 border-foreground bg-card shadow-brutal ${
        task.done ? "opacity-70" : ""
      }`}
    >
      <button
        onClick={() => onToggle(task)}
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
        className={`flex w-14 shrink-0 items-center justify-center border-r-4 border-foreground transition-colors ${
          task.done ? "bg-success text-card" : "bg-card hover:bg-muted"
        }`}
      >
        {task.done && <span className="font-display text-xl">✓</span>}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
        <span
          className={`shrink-0 border-2 border-foreground px-2 py-1 text-[10px] font-bold tracking-widest uppercase sm:text-[11px] ${typeClasses[task.session_type as SessionType]}`}
        >
          {task.session_type}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-bold sm:text-lg ${
              task.done ? "line-through" : ""
            }`}
          >
            {task.title}
          </p>
          <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
            {task.subject} · {task.owner}
          </p>
        </div>
        {task.due_date && (
          <span
            className={`shrink-0 border-2 border-foreground px-2 py-1 text-[10px] font-bold tracking-wider uppercase sm:text-xs ${
              overdue
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {overdue ? "OVERDUE " : "DUE "}
            {formatDue(task.due_date)}
          </span>
        )}
      </div>
      <button
        onClick={() => onDelete(task.id)}
        aria-label="Delete to-do"
        className="flex w-12 shrink-0 items-center justify-center border-l-4 border-foreground bg-card font-display text-lg transition-colors hover:bg-accent hover:text-accent-foreground sm:w-14"
      >
        ✕
      </button>
    </li>
  );
}

/* ---------------- Tasks section ---------------- */

function TasksSection({ role }: { role: Role }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("lecture");
  const [dueDate, setDueDate] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SessionType>("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "done" | "all">("open");
  const [formError, setFormError] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addTask = useMutation({
    mutationFn: async (task: NewTask) => {
      const { error } = await supabase.from("tasks").insert(task);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      setTitle("");
      setSubject("");
      setDueDate("");
      setFormError("");
    },
    onError: () => setFormError("COULD NOT SAVE. TRY AGAIN."),
  });

  const toggleTask = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase
        .from("tasks")
        .update({ done: !task.done })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("TITLE IS REQUIRED.");
      return;
    }
    addTask.mutate({
      title: title.trim(),
      subject: subject.trim() || "General",
      session_type: sessionType,
      owner: role,
      due_date: dueDate || null,
    });
  };

  const filtered = tasks.filter(
    (t) =>
      (typeFilter === "all" || t.session_type === typeFilter) &&
      (statusFilter === "all" || (statusFilter === "done") === t.done),
  );

  return (
    <div>
      {/* Add task form */}
      <form
        onSubmit={handleSubmit}
        className="mb-8 border-4 border-foreground bg-card p-4 shadow-brutal sm:p-6"
      >
        <h2 className="mb-4 font-display text-base tracking-wide uppercase sm:text-lg">
          {role === "teacher" ? "Add a class to-do" : "Add my to-do"}
        </h2>

        <label className="mb-1 block text-xs font-bold tracking-widest uppercase">
          What needs doing?
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            role === "teacher"
              ? "e.g. Prepare week 4 data structures lecture"
              : "e.g. Revise chapter 3 before Friday"
          }
          className="mb-4 w-full border-3 border-foreground bg-background px-3 py-2.5 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring"
        />

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold tracking-widest uppercase">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Biology"
              className="w-full border-3 border-foreground bg-background px-3 py-2.5 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold tracking-widest uppercase">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border-3 border-foreground bg-background px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-ring"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs font-bold tracking-widest uppercase">
          Session type
        </label>
        <div className="mb-4 flex">
          {SESSION_TYPES.map((t, i) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setSessionType(t.value)}
              className={`flex-1 border-3 border-foreground px-2 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                sessionType === t.value
                  ? typeClasses[t.value]
                  : "bg-card hover:bg-muted"
              } ${i > 0 ? "border-l-0" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {formError && (
          <p className="mb-4 border-3 border-foreground bg-accent px-3 py-2 text-xs font-bold tracking-widest text-accent-foreground uppercase">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={addTask.isPending}
          className="w-full border-4 border-foreground bg-primary px-4 py-3 font-display text-sm tracking-widest uppercase shadow-brutal-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {addTask.isPending ? "Saving…" : "Add to-do →"}
        </button>
      </form>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex">
          {(["all", "lecture", "tutorial", "practical"] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`border-3 border-foreground px-2.5 py-2 text-[10px] font-bold tracking-wider uppercase transition-colors sm:px-3 sm:text-xs ${
                typeFilter === f
                  ? "bg-foreground text-background"
                  : "bg-card hover:bg-muted"
              } ${i > 0 ? "border-l-0" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex">
          {(["open", "done", "all"] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`border-3 border-foreground px-2.5 py-2 text-[10px] font-bold tracking-wider uppercase transition-colors sm:px-3 sm:text-xs ${
                statusFilter === f
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-card hover:bg-muted"
              } ${i > 0 ? "border-l-0" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <p className="border-4 border-foreground bg-card px-4 py-6 text-center font-display text-sm tracking-widest uppercase">
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <p className="border-4 border-dashed border-foreground bg-card px-4 py-10 text-center font-display text-xs tracking-widest uppercase sm:text-sm">
          {tasks.length === 0
            ? "Nothing to do yet. Add your first to-do above."
            : "No to-dos match these filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 sm:gap-4">
          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(t) => toggleTask.mutate(t)}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Timetable section ---------------- */

const GENERAL = "General Studies";

// "General Studies" courses (GST etc.) are open to every department.
const DEPARTMENTS = [
  GENERAL,
  "Accounting",
  "Biochemistry",
  "Chemistry",
  "Civil Engineering",
  "Computer Science",
  "Economics",
  "Electrical Engineering",
  "Law",
  "Mass Communication",
  "Mathematics",
  "Mechanical Engineering",
  "Microbiology",
  "Nursing",
  "Physics",
  "Statistics",
] as const;

const LEVELS = [100, 200, 300, 400, 500] as const;

const DEPT_KEY = "classboard-dept";
const LEVEL_KEY = "classboard-level";

const FIELD =
  "w-full border-3 border-foreground bg-background px-3 py-2.5 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring";
const LABEL = "mb-1 block text-xs font-bold tracking-widest uppercase";

function toMin(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
}

// day_of_week is 1 (Mon) to 7 (Sun); JS getDay() is 0 (Sun) to 6 (Sat)
function jsDay(dayOfWeek: number): number {
  return dayOfWeek === 7 ? 0 : dayOfWeek;
}

function inText(mins: number): string {
  if (mins < 60) return `in ${mins} min`;
  if (mins < 1440) return `in ${Math.floor(mins / 60)} h ${mins % 60} min`;
  const d = Math.floor(mins / 1440);
  return `in ${d} ${d === 1 ? "day" : "days"}`;
}

function nextSlot(slots: Slot[], now: Date): { slot: Slot; mins: number; live: boolean } | null {
  const nowDay = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: { slot: Slot; mins: number; live: boolean } | null = null;
  for (const s of slots) {
    if (s.cancelled) continue;
    const start = toMin(s.start_time);
    const end = toMin(s.end_time);
    if (jsDay(s.day_of_week) === nowDay && nowMin >= start && nowMin < end) {
      return { slot: s, mins: 0, live: true };
    }
    let delta = ((jsDay(s.day_of_week) - nowDay + 7) % 7) * 1440 + start - nowMin;
    if (delta < 0) delta += 7 * 1440;
    if (!best || delta < best.mins) best = { slot: s, mins: delta, live: false };
  }
  return best;
}

function findClash(
  c: { day: number; start: string; end: string; venue: string; lecturer: string },
  existing: Slot[],
): string | null {
  const s = toMin(c.start);
  const e = toMin(c.end);
  for (const o of existing) {
    if (o.cancelled || o.day_of_week !== c.day) continue;
    if (!(s < toMin(o.end_time) && toMin(o.start_time) < e)) continue;
    const label = `${o.course_code || o.subject} ${shortTime(o.start_time)}–${shortTime(o.end_time)}`;
    if (c.venue && o.venue && o.venue.toLowerCase() === c.venue.toLowerCase()) {
      return `${c.venue} IS ALREADY BOOKED: ${label}.`.toUpperCase();
    }
    if (c.lecturer && o.lecturer && o.lecturer.toLowerCase() === c.lecturer.toLowerCase()) {
      return `${c.lecturer} ALREADY HAS ${label}.`.toUpperCase();
    }
  }
  return null;
}

function audienceLabel(s: Slot): string {
  const dept = s.department === GENERAL ? "All departments" : s.department;
  return `${dept} · ${s.level ? `${s.level}L` : "All levels"}`;
}

function TimetableSection({ role }: { role: Role }) {
  const queryClient = useQueryClient();

  // audience filter (which department and level am I looking at?)
  const [deptFilter, setDeptFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [audienceReady, setAudienceReady] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // form state
  const [courseCode, setCourseCode] = useState("");
  const [subject, setSubject] = useState("");
  const [department, setDepartment] = useState<string>(GENERAL);
  const [level, setLevel] = useState("all");
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venue, setVenue] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [note, setNote] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("lecture");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const d = window.localStorage.getItem(DEPT_KEY);
    const l = window.localStorage.getItem(LEVEL_KEY);
    if (d && (DEPARTMENTS as readonly string[]).includes(d)) setDeptFilter(d);
    if (l && (LEVELS as readonly number[]).includes(Number(l))) setLevelFilter(l);
    setAudienceReady(true);
  }, []);

  useEffect(() => {
    if (!audienceReady) return;
    window.localStorage.setItem(DEPT_KEY, deptFilter);
    window.localStorage.setItem(LEVEL_KEY, levelFilter);
  }, [deptFilter, levelFilter, audienceReady]);

  // clock for the "next class" banner (set after mount to avoid hydration mismatch)
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: slots = [], isLoading } = useQuery({
    queryKey: SLOTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("*")
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("timetable-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetable_slots" },
        () => queryClient.invalidateQueries({ queryKey: SLOTS_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const addSlot = useMutation({
    mutationFn: async (slot: NewSlot) => {
      const { error } = await supabase.from("timetable_slots").insert(slot);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SLOTS_KEY });
      setCourseCode("");
      setSubject("");
      setStartTime("");
      setEndTime("");
      setVenue("");
      setLecturer("");
      setNote("");
      setFormError("");
    },
    onError: () => setFormError("COULD NOT SAVE. TRY AGAIN."),
  });

  const toggleCancelled = useMutation({
    mutationFn: async (slot: Slot) => {
      const { error } = await supabase
        .from("timetable_slots")
        .update({ cancelled: !slot.cancelled })
        .eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SLOTS_KEY }),
  });

  const deleteSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("timetable_slots")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SLOTS_KEY }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = courseCode.trim().toUpperCase();
    if (!code) {
      setFormError("COURSE CODE IS REQUIRED, E.G. STA 111.");
      return;
    }
    if (!venue.trim()) {
      setFormError("VENUE IS REQUIRED, E.G. LT1.");
      return;
    }
    if (!startTime || !endTime) {
      setFormError("START AND END TIME ARE REQUIRED.");
      return;
    }
    if (endTime <= startTime) {
      setFormError("END TIME MUST BE AFTER START TIME.");
      return;
    }
    const clash = findClash(
      { day, start: startTime, end: endTime, venue: venue.trim(), lecturer: lecturer.trim() },
      slots,
    );
    if (clash) {
      setFormError(clash);
      return;
    }
    addSlot.mutate({
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      subject: subject.trim() || "General",
      course_code: code,
      department,
      level: level === "all" ? null : Number(level),
      venue: venue.trim(),
      lecturer: lecturer.trim(),
      note: note.trim() || null,
      session_type: sessionType,
    });
  };

  // Students see their own department's classes plus General Studies,
  // at their level (or classes marked "all levels").
  const visible = slots.filter(
    (s) =>
      (deptFilter === "all" || s.department === deptFilter || s.department === GENERAL) &&
      (levelFilter === "all" || s.level === null || String(s.level) === levelFilter),
  );

  const next = now ? nextSlot(visible, now) : null;
  const filtering = deptFilter !== "all" || levelFilter !== "all";

  return (
    <div>
      {/* Audience filter */}
      <div className="mb-6 grid gap-4 border-4 border-foreground bg-card p-4 shadow-brutal sm:grid-cols-2 sm:p-6">
        <div>
          <label htmlFor="aud-dept" className={LABEL}>
            Department
          </label>
          <select
            id="aud-dept"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className={FIELD}
          >
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aud-level" className={LABEL}>
            Level
          </label>
          <select
            id="aud-level"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className={FIELD}
          >
            <option value="all">All levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l} level
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Next class */}
      {next && (
        <section
          aria-live="polite"
          className="mb-8 border-4 border-foreground bg-secondary p-4 text-secondary-foreground shadow-brutal sm:p-6"
        >
          <p className="text-xs font-bold tracking-widest uppercase">
            {next.live ? "Happening now" : `Next class, starts ${inText(next.mins)}`}
          </p>
          <p className="mt-2 font-display text-5xl leading-none uppercase sm:text-7xl">
            {next.slot.course_code || next.slot.subject}
          </p>
          <p className="mt-3 text-sm font-bold sm:text-base">
            {next.slot.session_type.charAt(0).toUpperCase() + next.slot.session_type.slice(1)},{" "}
            {DAYS[next.slot.day_of_week - 1]} {shortTime(next.slot.start_time)}–
            {shortTime(next.slot.end_time)}
            {next.slot.venue ? `, ${next.slot.venue}` : ""}
          </p>
        </section>
      )}

      {role === "teacher" && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 border-4 border-foreground bg-card p-4 shadow-brutal sm:p-6"
        >
          <h2 className="mb-4 font-display text-base tracking-wide uppercase sm:text-lg">
            Publish a session to your timetable
          </h2>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="f-code" className={LABEL}>
                Course code
              </label>
              <input
                id="f-code"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. STA 111"
                maxLength={20}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="f-subject" className={LABEL}>
                Course title
              </label>
              <input
                id="f-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Descriptive Statistics"
                className={FIELD}
              />
            </div>
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="f-dept" className={LABEL}>
                Department
              </label>
              <select
                id="f-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={FIELD}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d === GENERAL ? "General Studies (all departments)" : d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-level" className={LABEL}>
                Level
              </label>
              <select
                id="f-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={FIELD}
              >
                <option value="all">All levels</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l} level
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="f-day" className={LABEL}>
                Day
              </label>
              <select
                id="f-day"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className={FIELD}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-start" className={LABEL}>
                Starts
              </label>
              <input
                id="f-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="f-end" className={LABEL}>
                Ends
              </label>
              <input
                id="f-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="f-venue" className={LABEL}>
                Venue
              </label>
              <input
                id="f-venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. LT1, ICT Lab"
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="f-lecturer" className={LABEL}>
                Lecturer
              </label>
              <input
                id="f-lecturer"
                value={lecturer}
                onChange={(e) => setLecturer(e.target.value)}
                placeholder="e.g. Dr. Okafor"
                className={FIELD}
              />
            </div>
          </div>

          <label htmlFor="f-note" className={LABEL}>
            Note for students
          </label>
          <input
            id="f-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Bring your laptop"
            maxLength={200}
            className={`mb-4 ${FIELD}`}
          />

          <label className={LABEL}>Session type</label>
          <div className="mb-4 flex">
            {SESSION_TYPES.map((t, i) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSessionType(t.value)}
                className={`flex-1 border-3 border-foreground px-2 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  sessionType === t.value
                    ? typeClasses[t.value]
                    : "bg-card hover:bg-muted"
                } ${i > 0 ? "border-l-0" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {formError && (
            <p
              role="alert"
              className="mb-4 border-3 border-foreground bg-accent px-3 py-2 text-xs font-bold tracking-widest text-accent-foreground uppercase"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={addSlot.isPending}
            className="w-full border-4 border-foreground bg-primary px-4 py-3 font-display text-sm tracking-widest uppercase shadow-brutal-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {addSlot.isPending ? "Saving…" : "Publish →"}
          </button>
        </form>
      )}

      <h2 className="mb-4 font-display text-base tracking-wide uppercase sm:text-lg">
        {role === "teacher" ? "Weekly timetable" : "Your timetable"}
      </h2>

      {isLoading ? (
        <p className="border-4 border-foreground bg-card px-4 py-6 text-center font-display text-sm tracking-widest uppercase">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="border-4 border-dashed border-foreground bg-card px-4 py-10 text-center font-display text-xs tracking-widest uppercase sm:text-sm">
          {slots.length === 0
            ? role === "teacher"
              ? "Your timetable is empty. Publish your first session above."
              : "No schedule published yet. Check back soon."
            : filtering
              ? "No classes for this department and level."
              : "No sessions to show."}
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:gap-4">
          {DAYS.map((dayName, i) => {
            const daySlots = visible.filter((s) => s.day_of_week === i + 1);
            if (daySlots.length === 0) return null;
            return (
              <div
                key={dayName}
                className="border-4 border-foreground bg-card shadow-brutal"
              >
                <div className="border-b-4 border-foreground bg-foreground px-3 py-2 font-display text-xs tracking-widest text-primary uppercase">
                  {dayName}
                </div>
                <ul>
                  {daySlots.map((slot) => (
                    <li
                      key={slot.id}
                      className={`flex items-stretch border-b-4 border-foreground last:border-b-0 ${
                        slot.cancelled ? "opacity-70" : ""
                      }`}
                    >
                      <span className="flex w-24 shrink-0 items-center justify-center border-r-4 border-foreground bg-background px-2 py-3 font-display text-[10px] uppercase sm:w-28 sm:text-xs">
                        {shortTime(slot.start_time)}
                        <br />–<br />
                        {shortTime(slot.end_time)}
                      </span>
                      <div className="min-w-0 flex-1 px-3 py-3">
                        <p
                          className={`text-sm font-bold sm:text-base ${
                            slot.cancelled ? "line-through" : ""
                          }`}
                        >
                          <span className="font-display">{slot.course_code}</span>
                          {slot.course_code && slot.subject ? " " : ""}
                          {slot.subject}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span
                            className={`inline-block border-2 border-foreground px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${typeClasses[slot.session_type as SessionType]}`}
                          >
                            {slot.session_type}
                          </span>
                          {slot.cancelled && (
                            <span className="inline-block border-2 border-foreground bg-accent px-2 py-0.5 text-[10px] font-bold tracking-widest text-accent-foreground uppercase">
                              Cancelled
                            </span>
                          )}
                          <span className="inline-block border-2 border-foreground bg-muted px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                            {audienceLabel(slot)}
                          </span>
                          {slot.venue && (
                            <span className="inline-block border-2 border-foreground bg-card px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                              {slot.venue}
                            </span>
                          )}
                        </div>
                        {slot.lecturer && (
                          <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                            {slot.lecturer}
                          </p>
                        )}
                        {slot.note && (
                          <p className="mt-1 text-xs font-bold">{slot.note}</p>
                        )}
                      </div>
                      {role === "teacher" && (
                        <>
                          <button
                            onClick={() => toggleCancelled.mutate(slot)}
                            aria-label={slot.cancelled ? "Restore class" : "Cancel class"}
                            className="flex w-16 shrink-0 items-center justify-center border-l-4 border-foreground px-1 text-[10px] font-bold tracking-wider uppercase transition-colors hover:bg-primary"
                          >
                            {slot.cancelled ? "Restore" : "Cancel"}
                          </button>
                          <button
                            onClick={() => deleteSlot.mutate(slot.id)}
                            aria-label="Delete session"
                            className="flex w-12 shrink-0 items-center justify-center border-l-4 border-foreground font-display text-lg transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Page ---------------- */

function Index() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>("teacher");
  const [tab, setTab] = useState<"tasks" | "timetable">("tasks");
  const [roleReady, setRoleReady] = useState(false);

  // Remember who is using this device
  useEffect(() => {
    const saved = window.localStorage.getItem("classboard-role");
    if (saved === "student" || saved === "teacher") setRole(saved);
    setRoleReady(true);
  }, []);

  useEffect(() => {
    if (roleReady) window.localStorage.setItem("classboard-role", role);
  }, [role, roleReady]);

  // Live sync for tasks
  useEffect(() => {
    const channel = supabase
      .channel("tasks-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: tasks = [] } = useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Marquee strip */}
      <div className="overflow-hidden border-b-4 border-foreground bg-foreground py-2">
        <div className="marquee-track flex w-max whitespace-nowrap">
          {[0, 1].map((copy) => (
            <span
              key={copy}
              className="px-4 font-display text-xs tracking-widest text-primary uppercase sm:text-sm"
            >
              ✦ The To-Do App For Class ✦ To-Dos ✦ Timetables ✦ Lectures ✦ Tutorials
              ✦ Practicals ✦ One Board For Teachers & Students ✦ No Rounds ✦ No
              Gradients ✦
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-3 pb-16 sm:px-6">
        {/* Header */}
        <header className="pt-8 pb-6 sm:pt-10">
          <h1 className="font-display text-4xl leading-none tracking-tight uppercase sm:text-7xl">
            Class<span className="bg-primary px-1">Board</span>
          </h1>
          <p className="mt-3 max-w-xl text-base font-bold sm:text-lg">
            The to-do app for your classes. Write down what needs doing for
            each lecture, tutorial and practical, tick it off, and check the
            timetable.
          </p>

          {/* Role switch */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold tracking-widest uppercase">
              I am a:
            </span>
            <div className="flex">
              {(["teacher", "student"] as Role[]).map((r, i) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`border-4 border-foreground px-3 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${
                    role === r
                      ? r === "teacher"
                        ? "bg-foreground text-primary"
                        : "bg-foreground text-tutorial"
                      : "bg-card hover:bg-muted"
                  } ${i > 0 ? "border-l-0" : ""}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex">
            {(
              [
                { id: "tasks", label: "To-do" },
                { id: "timetable", label: "Timetable" },
              ] as const
            ).map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`border-4 border-foreground px-4 py-2.5 font-display text-xs tracking-widest uppercase transition-colors sm:px-6 sm:text-sm ${
                  tab === t.id
                    ? "bg-primary text-foreground"
                    : "bg-card hover:bg-muted"
                } ${i > 0 ? "border-l-0" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="mt-4 inline-block border-4 border-foreground bg-secondary px-3 py-1 font-display text-[10px] tracking-widest text-secondary-foreground uppercase shadow-brutal-sm sm:text-xs">
            {role === "teacher"
              ? "Teacher mode · students see your timetable"
              : "Student mode · viewing teachers' timetable"}
            {tab === "tasks" ? ` · ${openCount} open to-do${openCount === 1 ? "" : "s"}` : ""}
          </p>
        </header>

        {tab === "tasks" ? <TasksSection role={role} /> : <TimetableSection role={role} />}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "ClassBoard — To-do & Timetable App for Lectures and Practicals",
      },
      {
        name: "description",
        content:
          "A to-do web app for classes. Teachers publish their lecture, tutorial and practical timetable; students keep their own to-do list and view the schedule.",
      },
      {
        property: "og:title",
        content: "ClassBoard — To-do & Timetable App for Lectures and Practicals",
      },
      {
        property: "og:description",
        content:
          "A to-do web app for classes. Teachers publish their lecture, tutorial and practical timetable; students keep their own to-do list and view the schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});
