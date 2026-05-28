import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://student-support-chat-cdw.pages.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

import { getSupabaseAdmin } from './lib/supabaseAdmin'

app.get('/api/users/sales', async (c) => {
  const supabase = getSupabaseAdmin(c.env)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'sales')

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Apply auth middleware to all secure /api/* endpoints
app.use('/api/*', authMiddleware)

// Mount routers
app.route('/api', usersRouter)
app.route('/api', conversationsRouter)
app.route('/api', messagesRouter)

app.get('/', (c) => c.json({ status: 'ok', message: 'SupportChat API' }))

export default app
