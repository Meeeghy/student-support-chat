import { Hono } from 'hono'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

type Variables = {
  user: {
    id: string
    email: string
    role: 'student' | 'sales' | 'manager'
    full_name: string
    [key: string]: any
  }
}

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/* ─────────────────────────────────────────────
   POST /conversations/:threadId/messages
   ───────────────────────────────────────────── */
router.post('/conversations/:threadId/messages', async (c) => {
  const threadId = c.req.param('threadId')
  const user = c.get('user')
  const supabase = getSupabaseAdmin(c.env)

  let bodyData: { body?: string }
  try {
    bodyData = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { body } = bodyData
  if (!body) {
    return c.json({ error: 'Message body is required' }, 400)
  }

  // Fetch thread details to check authorization
  const { data: thread, error: fetchError } = await supabase
    .from('conversation_threads')
    .select('*')
    .eq('id', threadId)
    .single()

  if (fetchError || !thread) {
    return c.json({ error: fetchError?.message || 'Thread not found' }, 404)
  }

  // Authorization checks
  if (user.role === 'student' && thread.student_id !== user.id) {
    return c.json({ error: 'Forbidden: Access denied' }, 403)
  }
  if (user.role === 'sales' && thread.assigned_to !== user.id && thread.assigned_to !== null) {
    return c.json({ error: 'Forbidden: Access denied' }, 403)
  }

  // Determine sender type
  const senderType = user.role === 'student' ? 'student' : 'team'

  // Insert message
  const { data: message, error: messageError } = await supabase
    .from('conversation_messages')
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_type: senderType,
      body,
    })
    .select()
    .single()

  if (messageError || !message) {
    return c.json({ error: messageError?.message || 'Failed to send message' }, 500)
  }

  // Update thread last_message_at & updated_at
  const now = new Date().toISOString()
  await supabase
    .from('conversation_threads')
    .update({
      last_message_at: now,
      updated_at: now,
    })
    .eq('id', threadId)

  return c.json(message, 201)
})

export default router
