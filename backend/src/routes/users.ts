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

router.get('/me', (c) => {
  const user = c.get('user')
  return c.json(user)
})

router.get('/users/sales', async (c) => {
  const supabase = getSupabaseAdmin(c.env)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'sales')

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

export default router
