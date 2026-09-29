-- Account-owned, append-only chat history for patient and doctor workspaces.
begin;

create table if not exists public.vediora_chat_conversations (
  id uuid primary key,
  owner_id uuid not null references public.vediora_profiles(id) on delete cascade,
  workspace_role text not null check (workspace_role in ('patient', 'doctor')),
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vediora_chat_messages (
  id uuid primary key,
  conversation_id uuid not null references public.vediora_chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  structured_result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vediora_chat_conversations_owner_updated
  on public.vediora_chat_conversations (owner_id, workspace_role, updated_at desc);
create index if not exists vediora_chat_messages_conversation_created
  on public.vediora_chat_messages (conversation_id, created_at, id);

alter table public.vediora_chat_conversations enable row level security;
alter table public.vediora_chat_messages enable row level security;
revoke all on public.vediora_chat_conversations from public, anon, authenticated;
revoke all on public.vediora_chat_messages from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';
