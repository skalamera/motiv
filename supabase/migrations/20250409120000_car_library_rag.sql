-- Workshop / Car_Libraries RAG: chunked HTML exports + pgvector

create extension if not exists vector;

alter table public.cars
  add column if not exists car_library_key text;

comment on column public.cars.car_library_key is
  'Exact Car_Libraries folder name after indexing (e.g. 2018 Porsche 911 Carrera S).';

create table public.car_library_chunks (
  id bigint generated always as identity primary key,
  library_key text not null,
  source_path text not null,
  chunk_index int not null,
  content text not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now(),
  unique (library_key, source_path, chunk_index)
);

create index car_library_chunks_library_key_idx
  on public.car_library_chunks (library_key);

create index car_library_chunks_embedding_hnsw_idx
  on public.car_library_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.car_library_chunks enable row level security;
-- No policies: authenticated/anon have no access; service role bypasses RLS for API + indexer.

create or replace function public.match_car_library_chunks(
  query_embedding vector(768),
  match_library_key text,
  match_count int default 12
)
returns table (
  id bigint,
  source_path text,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
parallel safe
as $$
  select
    c.id,
    c.source_path,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.car_library_chunks c
  where c.library_key = match_library_key
  order by c.embedding <=> query_embedding
  limit least(coalesce(match_count, 12), 24);
$$;

revoke all on function public.match_car_library_chunks(vector(768), text, int) from public;
grant execute on function public.match_car_library_chunks(vector(768), text, int)
  to service_role;

notify pgrst, 'reload schema';
