import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AccountType } from '@/lib/access-control';
import { query, withTransaction } from '@/lib/server/database';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured_result: unknown | null;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  title: string;
  updated_at: string;
}

export async function loadConversationHistory(ownerId: string, role: AccountType, requestedConversationId: string | null = null) {
  const conversationList = await query<ConversationRow>(
    `select id, title, updated_at
       from public.vediora_chat_conversations
      where owner_id = $1 and workspace_role = $2
      order by updated_at desc
      limit 30`,
    [ownerId, role],
  );
  const conversation = requestedConversationId
    ? conversationList.rows.find(item => item.id === requestedConversationId) || null
    : conversationList.rows[0] || null;
  if (!conversation) return { conversations: conversationList.rows, conversation: null, messages: [] as StoredChatMessage[] };
  const messages = await query<StoredChatMessage>(
    `select id, role, content, structured_result, created_at
       from public.vediora_chat_messages
      where conversation_id = $1
      order by created_at,
               case role when 'user' then 0 else 1 end,
               id
      limit 100`,
    [conversation.id],
  );
  return { conversations: conversationList.rows, conversation, messages: messages.rows };
}

export async function loadConversationContext(conversationId: string | null, ownerId: string, role: AccountType) {
  if (!conversationId) return [] as Array<{ role: 'user' | 'assistant'; content: string }>;
  const messages = await query<{ role: 'user' | 'assistant'; content: string }>(
    `select m.role, m.content
       from public.vediora_chat_messages m
       join public.vediora_chat_conversations c on c.id = m.conversation_id
      where c.id = $1 and c.owner_id = $2 and c.workspace_role = $3
      order by m.created_at desc,
               case m.role when 'assistant' then 0 else 1 end,
               m.id desc
      limit 10`,
    [conversationId, ownerId, role],
  );
  return messages.rows.reverse();
}

export async function appendConversationTurn(input: {
  conversationId: string | null;
  ownerId: string;
  role: AccountType;
  question: string;
  answer: string;
  result: unknown;
}) {
  return withTransaction(async client => {
    let conversationId = input.conversationId;
    if (conversationId) {
      const owned = await client.query<{ id: string }>(
        `select id from public.vediora_chat_conversations
          where id = $1 and owner_id = $2 and workspace_role = $3
          for update`,
        [conversationId, input.ownerId, input.role],
      );
      if (!owned.rows[0]) conversationId = null;
    }
    if (!conversationId) {
      conversationId = randomUUID();
      const title = input.question.replace(/\s+/g, ' ').trim().slice(0, 120);
      await client.query(
        `insert into public.vediora_chat_conversations (id, owner_id, workspace_role, title)
         values ($1, $2, $3, $4)`,
        [conversationId, input.ownerId, input.role, title],
      );
    }
    await client.query(
      `insert into public.vediora_chat_messages (id, conversation_id, role, content)
       values ($1, $2, 'user', $3)`,
      [randomUUID(), conversationId, input.question],
    );
    await client.query(
      `insert into public.vediora_chat_messages (id, conversation_id, role, content, structured_result)
       values ($1, $2, 'assistant', $3, $4::jsonb)`,
      [randomUUID(), conversationId, input.answer, JSON.stringify(input.result)],
    );
    await client.query(
      `update public.vediora_chat_conversations set updated_at = now() where id = $1`,
      [conversationId],
    );
    return conversationId;
  });
}
