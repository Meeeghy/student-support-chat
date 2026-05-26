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
   GET /conversations
   ───────────────────────────────────────────── */
router.get('/conversations', async (c) => {
  const user = c.get('user')
  const supabase = getSupabaseAdmin(c.env)

  const status = c.req.query('status')
  const assignedTo = c.req.query('assignedTo')
  const q = c.req.query('q')

  let query = supabase
    .from('conversation_threads')
    .select('*, conversation_messages(body, sender_type, created_at), student:profiles!student_id(full_name), assignee:profiles!assigned_to(full_name)')

  // Role-based visibility
  if (user.role === 'student') {
    query = query.eq('student_id', user.id)
  } else if (user.role === 'sales') {
    query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`)
  } else if (user.role === 'manager') {
    // sees all
  }

  // Filter query parameters
  if (status) {
    query = query.eq('status', status)
  }
  if (assignedTo) {
    if (assignedTo === 'null') {
      query = query.is('assigned_to', null)
    } else {
      query = query.eq('assigned_to', assignedTo)
    }
  }
  if (q) {
    query = query.ilike('subject', `%${q}%`)
  }

  // Order by last_message_at desc
  query = query.order('last_message_at', { ascending: false })
  query = query.order('created_at', { referencedTable: 'conversation_messages', ascending: false })

  const { data, error } = await query
  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json(data)
})

/* ─────────────────────────────────────────────
   POST /conversations
   ───────────────────────────────────────────── */
router.post('/conversations', async (c) => {
  const user = c.get('user')
  const supabase = getSupabaseAdmin(c.env)

  if (user.role !== 'student') {
    return c.json({ error: 'Forbidden: Only students can create conversations' }, 403)
  }

  let body: { subject?: string; message?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { subject, message } = body
  if (!subject || !message) {
    return c.json({ error: 'Missing subject or message' }, 400)
  }

  // Insert thread
  const { data: thread, error: threadError } = await supabase
    .from('conversation_threads')
    .insert({
      student_id: user.id,
      subject,
      status: 'open',
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (threadError || !thread) {
    return c.json({ error: threadError?.message || 'Failed to create thread' }, 500)
  }

  // Insert initial message
  const { error: messageError } = await supabase
    .from('conversation_messages')
    .insert({
      thread_id: thread.id,
      sender_id: user.id,
      sender_type: 'student',
      body: message,
    })

  if (messageError) {
    // rollback thread creation
    await supabase.from('conversation_threads').delete().eq('id', thread.id)
    return c.json({ error: messageError.message }, 500)
  }

  return c.json(thread, 201)
})

/* ─────────────────────────────────────────────
   GET /conversations/:threadId
   ───────────────────────────────────────────── */
router.get('/conversations/:threadId', async (c) => {
  const threadId = c.req.param('threadId')
  const user = c.get('user')
  const supabase = getSupabaseAdmin(c.env)

  const { data: thread, error: threadError } = await supabase
    .from('conversation_threads')
    .select('*, student:profiles!student_id(full_name), assignee:profiles!assigned_to(full_name)')
    .eq('id', threadId)
    .single()

  if (threadError || !thread) {
    return c.json({ error: threadError?.message || 'Thread not found' }, 404)
  }

  // Role Access restrictions
  if (user.role === 'student' && thread.student_id !== user.id) {
    return c.json({ error: 'Forbidden: Access denied' }, 403)
  }
  if (user.role === 'sales' && thread.assigned_to !== user.id && thread.assigned_to !== null) {
    return c.json({ error: 'Forbidden: Access denied' }, 403)
  }

  // Fetch messages
  const { data: messages, error: messagesError } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (messagesError) {
    return c.json({ error: messagesError.message }, 500)
  }

  return c.json({ thread, messages })
})

/* ─────────────────────────────────────────────
   PATCH /conversations/:threadId/status
   ───────────────────────────────────────────── */
router.patch('/conversations/:threadId/status', async (c) => {
  const threadId = c.req.param('threadId')
  const user = c.get('user')
  const supabase = getSupabaseAdmin(c.env)

  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students cannot modify status' }, 403)
  }

  let body: { status?: 'open' | 'pending' | 'closed' }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { status } = body
  if (!status || !['open', 'pending', 'closed'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  const { data: thread, error: fetchError } = await supabase
    .from('conversation_threads')
    .select('assigned_to')
    .eq('id', threadId)
    .single()

  if (fetchError || !thread) {
    return c.json({ error: fetchError?.message || 'Thread not found' }, 404)
  }

  if (user.role === 'sales' && thread.assigned_to !== user.id) {
    return c.json({ error: 'Forbidden: Can only modify assigned conversations' }, 403)
  }

  const { data: updatedThread, error: updateError } = await supabase
    .from('conversation_threads')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .select()
    .single()

  if (updateError) {
    return c.json({ error: updateError.message }, 500)
  }

  return c.json(updatedThread)
})

/* ─────────────────────────────────────────────
   PATCH /conversations/:threadId/assign
   ───────────────────────────────────────────── */
router.patch('/conversations/:threadId/assign', async (c) => {
  const threadId = c.req.param('threadId')
  const user = c.get('user')
  const supabase = getSupabaseAdmin(c.env)

  if (user.role === 'student') {
    return c.json({ error: 'Forbidden: Students cannot assign threads' }, 403)
  }

  let body: { assignedTo?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { assignedTo } = body
  if (assignedTo === undefined) {
    return c.json({ error: 'Missing assignedTo field' }, 400)
  }

  const { data: thread, error: fetchError } = await supabase
    .from('conversation_threads')
    .select('assigned_to')
    .eq('id', threadId)
    .single()

  if (fetchError || !thread) {
    return c.json({ error: fetchError?.message || 'Thread not found' }, 404)
  }

  if (user.role === 'sales') {
    if (thread.assigned_to !== null) {
      return c.json({ error: 'Forbidden: Thread is already assigned' }, 403)
    }
    if (assignedTo !== user.id) {
      return c.json({ error: 'Forbidden: Sales reps can only assign to themselves' }, 403)
    }
  }

  const { data: updatedThread, error: updateError } = await supabase
    .from('conversation_threads')
    .update({
      assigned_to: assignedTo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .select()
    .single()

  if (updateError) {
    return c.json({ error: updateError.message }, 500)
  }

  // Insert assignment log event
  await supabase.from('conversation_assignment_events').insert({
    thread_id: threadId,
    assigned_by: user.id,
    assigned_to: assignedTo,
  })

  return c.json(updatedThread)
})

export default router
