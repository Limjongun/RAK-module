-- Skema Database Rak Modul
-- Sesuai dengan Blueprint Web Pembaca Modul Kuliah Pribadi

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,            -- Contoh: "Machine Learning"
  code text,                     -- Contoh: "CS170"
  semester text,
  color text
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  course_id uuid references courses on delete set null,
  title text not null,
  source_type text check (source_type in ('pdf','docx','pptx','md','html','image','epub')),
  original_key text,             -- R2: originals/...
  pdf_key text,                  -- R2: derived/.../view.pdf
  thumb_key text,
  page_count int,
  language text default 'id',
  tags text[] default '{}',
  status text default 'uploaded' check (status in ('uploaded','converting','ready','error')),
  created_at timestamptz default now()
);

create table if not exists pages (
  document_id uuid references documents on delete cascade,
  page_no int,
  text text,
  tsv tsvector generated always as (to_tsvector('simple', coalesce(text,''))) stored,
  primary key (document_id, page_no)
);
create index if not exists pages_tsv on pages using gin (tsv);

create table if not exists annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  document_id uuid references documents on delete cascade,
  page_no int not null,
  kind text check (kind in ('highlight','underline','strike','ink','shape','sticky','textbox')),
  color text,
  geometry jsonb,                -- rects[] / points[] / shape, koordinat relatif 0..1
  quote text,                    -- teks yang diseleksi
  note_md text,                  -- isi catatan (Markdown + LaTeX)
  tags text[] default '{}',
  updated_at timestamptz default now(),
  deleted boolean default false  -- soft delete untuk sinkronisasi offline
);

create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  document_id uuid references documents on delete cascade,
  page_no int,
  label text
);

create table if not exists reading_progress (
  user_id uuid default auth.uid(),
  document_id uuid references documents on delete cascade,
  last_page int,
  scroll_ratio real,
  tts_sentence int,
  percent real,
  updated_at timestamptz default now(),
  primary key (user_id, document_id)
);

create table if not exists study_sessions (
  id bigserial primary key,
  user_id uuid default auth.uid(),
  document_id uuid,
  started_at timestamptz default now(),
  minutes int default 0,
  pages_read int default 0
);

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  annotation_id uuid references annotations on delete set null,
  front text,
  back text,
  due_at timestamptz default now(),
  interval_days real default 0,
  ease real default 2.5,
  reps int default 0
);

create table if not exists tts_audio (
  document_id uuid references documents on delete cascade,
  page_from int,
  page_to int,
  voice text,
  audio_key text,
  primary key (document_id, page_from, page_to, voice)
);

-- Fase 3: RAG & Embedding
create extension if not exists vector;
create table if not exists chunks (
  id bigserial primary key,
  document_id uuid references documents on delete cascade,
  page_no int,
  content text,
  embedding vector(768)
);

-- Row Level Security (RLS)
alter table courses enable row level security;
alter table documents enable row level security;
alter table pages enable row level security;
alter table annotations enable row level security;
alter table bookmarks enable row level security;
alter table reading_progress enable row level security;
alter table study_sessions enable row level security;
alter table flashcards enable row level security;
alter table tts_audio enable row level security;
alter table chunks enable row level security;

-- Policies: Hanya pemilik data yang bisa baca dan tulis
create policy "User manages own courses" on courses for all using (auth.uid() = user_id);
create policy "User manages own documents" on documents for all using (auth.uid() = user_id);
create policy "User manages own pages" on pages for all using (
  exists (select 1 from documents where documents.id = pages.document_id and documents.user_id = auth.uid())
);
create policy "User manages own annotations" on annotations for all using (auth.uid() = user_id);
create policy "User manages own bookmarks" on bookmarks for all using (auth.uid() = user_id);
create policy "User manages own reading progress" on reading_progress for all using (auth.uid() = user_id);
create policy "User manages own study sessions" on study_sessions for all using (auth.uid() = user_id);
create policy "User manages own flashcards" on flashcards for all using (auth.uid() = user_id);

