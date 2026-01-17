-- Create table for caching route shapes
create table if not exists public.route_shapes (
   route_id text primary key,
   data jsonb not null,
   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.route_shapes enable row level security;

-- Allow public read access (for anon users)
create policy "Allow public read access"
  on public.route_shapes
  for select
  to anon, authenticated
  using (true);

-- Allow service role to manage everything (for Edge Functions)
create policy "Allow service role full access"
  on public.route_shapes
  for all
  to service_role
  using (true)
  with check (true);
