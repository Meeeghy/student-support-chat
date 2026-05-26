import { MiddlewareHandler } from 'hono'
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

export const authMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing token' }, 401)
  }

  const token = authHeader.substring(7) // Remove 'Bearer '
  const supabase = getSupabaseAdmin(c.env)

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    console.error('authMiddleware: getUser failed:', error)
    return c.json({ error: `Unauthorized: Invalid token: ${error?.message || 'No user'}` }, 401)
  }

  // Fetch user profile from profiles table
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.warn(`authMiddleware: Profile not found for user ${user.id}. Attempting to auto-create profile...`)
    const defaultName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    const defaultRole = user.user_metadata?.role || 'student'

    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        role: defaultRole,
        full_name: defaultName,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (createError || !newProfile) {
      console.error('authMiddleware: profiles fetch failed and auto-create failed:', profileError, createError)
      return c.json({ error: `Unauthorized: User profile not found: ${profileError?.message || 'No profile record'}` }, 401)
    }

    profile = newProfile
  }

  // Attach profile to context
  c.set('user', profile)

  await next()
}
