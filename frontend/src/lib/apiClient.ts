import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export async function apiClient(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  // Ensure path starts with a slash if it's relative
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = path.startsWith('http') ? path : `${API_URL}${cleanPath}`

  const res = await fetch(url, {
    ...options,
    headers,
  })

  return res
}
