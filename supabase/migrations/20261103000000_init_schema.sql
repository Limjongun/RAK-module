-- ================================================================
-- SKEMA LENGKAP RAK MODUL (SUPABASE POSTGRESQL)
-- Mendukung Sinkronisasi: Modul, Halaman, Catatan/Stabilo/Stylus,
-- Progres Baca, To-Do List & Agenda, Kode Bank, Flashcard SM-2, Pomodoro.
-- ================================================================

-- 1. Tabel Modul & Dokumen Kuliah
create table if not exists documents (
  id text primary key,
  user_id text default 'default_user',
  title text not null,
  source_type text check (source_type in ('pdf','docx','pptx','md','html','image','epub','txt')),
  course_id text,
  course_name text default 'Umum',
  original_key text,
  pdf_key text,
  thumb_key text,
  page_count int default 1,
  language text default 'id',
  tags text[] default '{}',
  status text default 'ready' check (status in ('uploaded','converting','ready','error')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Tabel Teks Halaman (Untuk Full-Text Search)
create table if not exists pages (
  document_id text references documents(id) on delete cascade,
  page_no int not null,
  text text,
  tsv tsvector generated always as (to_tsvector('simple', coalesce(text,''))) stored,
  primary key (document_id, page_no)
);
create index if not exists pages_tsv on pages using gin (tsv);

-- 3. Tabel Catatan, Stabilo, & Coretan Stylus (Annotations)
create table if not exists annotations (
  id text primary key,
  user_id text default 'default_user',
  document_id text references documents(id) on delete cascade,
  page_no int not null,
  kind text check (kind in ('highlight','underline','strike','ink','shape','sticky','textbox')),
  color text,
  geometry jsonb,                -- Titik coretan stylus / koordinat rects stabilo
  quote text,                    -- Teks rujukan yang disorot
  note_md text,                  -- Catatan Markdown / LaTeX
  tags text[] default '{}',
  updated_at timestamptz default now(),
  deleted boolean default false
);

-- 4. Tabel Progres Membaca
create table if not exists reading_progress (
  document_id text primary key references documents(id) on delete cascade,
  user_id text default 'default_user',
  last_page int default 1,
  scroll_ratio real default 0,
  tts_sentence int default 0,
  percent real default 0,
  updated_at timestamptz default now()
);

-- 5. Tabel To-Do List & Agenda Belajar Real-Time
create table if not exists todos (
  id text primary key,
  user_id text default 'default_user',
  title text not null,
  description text default '',
  due_datetime text,             -- ISO string YYYY-MM-DDTHH:mm
  priority text default 'medium' check (priority in ('high','medium','low')),
  course_name text default 'Umum',
  duration_minutes int default 30,
  document_id text,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Tabel Kode Bank (Google Colab Format Notebooks)
create table if not exists code_notebooks (
  id text primary key,
  user_id text default 'default_user',
  title text not null,
  course_name text default 'Umum',
  language text default 'python',
  tags text[] default '{}',
  cells jsonb default '[]'::jsonb, -- Array sel code dan markdown beserta output
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Tabel Flashcards Hafalan Spaced Repetition (SM-2)
create table if not exists flashcards (
  id text primary key,
  user_id text default 'default_user',
  annotation_id text,
  document_id text,
  course_name text default 'Umum',
  front text not null,
  back text not null,
  due_at timestamptz default now(),
  interval_days real default 0,
  ease real default 2.5,
  reps int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Tabel Riwayat Sesi Belajar & Pomodoro
create table if not exists study_sessions (
  id bigserial primary key,
  user_id text default 'default_user',
  document_id text,
  minutes int default 25,
  pages_read int default 0,
  started_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ================================================================
-- POLICIES & KEAMANAN ROW LEVEL SECURITY (RLS)
-- Mengizinkan sinkronisasi via Supabase Anon Public Key
-- ================================================================
alter table documents enable row level security;
alter table pages enable row level security;
alter table annotations enable row level security;
alter table reading_progress enable row level security;
alter table todos enable row level security;
alter table code_notebooks enable row level security;
alter table flashcards enable row level security;
alter table study_sessions enable row level security;

-- Izinkan operasi SELECT, INSERT, UPDATE, DELETE dengan Anon Key
create policy "Allow all documents" on documents for all using (true) with check (true);
create policy "Allow all pages" on pages for all using (true) with check (true);
create policy "Allow all annotations" on annotations for all using (true) with check (true);
create policy "Allow all reading_progress" on reading_progress for all using (true) with check (true);
create policy "Allow all todos" on todos for all using (true) with check (true);
create policy "Allow all code_notebooks" on code_notebooks for all using (true) with check (true);
create policy "Allow all flashcards" on flashcards for all using (true) with check (true);
create policy "Allow all study_sessions" on study_sessions for all using (true) with check (true);
