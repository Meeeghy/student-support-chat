import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Mail,
  Lock,
  User,
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  GraduationCap,
  Headphones,
  ShieldCheck,
} from 'lucide-react'

type AuthMode = 'signin' | 'signup'
type UserRole = 'student' | 'sales' | 'manager'

/* ─────────────────────────────────────────────
   GlassInput Sub-component (Underline input style)
   ───────────────────────────────────────────── */
interface GlassInputProps {
  id: string
  type: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  icon: React.ReactNode
  rightSlot?: React.ReactNode
  isDark: boolean
}

function GlassInput({
  id,
  type,
  placeholder,
  value,
  onChange,
  disabled,
  icon,
  rightSlot,
}: GlassInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      {/* Left Icon */}
      <span
        style={{
          position: 'absolute',
          left: '0px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: focused
            ? 'var(--input-focus-border)'
            : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
          transition: 'color 0.3s ease',
        }}
      >
        {icon}
      </span>

      {/* Underline Input Field */}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: '46px',
          boxSizing: 'border-box',
          background: 'transparent',
          border: 'none',
          borderBottom: focused
            ? '1px solid var(--input-focus-border)'
            : '1px solid var(--input-border)',
          padding: rightSlot ? '0 32px 0 28px' : '0 0 0 28px',
          color: 'var(--input-text)',
          fontSize: '15px',
          outline: 'none',
          transition: 'all 0.3s ease',
          fontFamily: 'inherit',
          boxShadow: focused
            ? '0 1px 0 var(--input-focus-border)'
            : 'none',
        }}
      />

      {/* Right Slot (Eye Toggle) */}
      {rightSlot && (
        <span
          style={{
            position: 'absolute',
            right: '0px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {rightSlot}
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main LoginPage Component
   ───────────────────────────────────────────── */
export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
  const [showPassword, setShowPassword] = useState(false)

  // Theme states (persisted in localStorage, defaulting to 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  // Feedback states
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Hover states for inline style manipulation
  const [toggleHovered, setToggleHovered] = useState(false)
  const [forgotHovered, setForgotHovered] = useState(false)
  const [eyeHovered, setEyeHovered] = useState(false)
  const [btnHovered, setBtnHovered] = useState(false)
  const [bottomHovered, setBottomHovered] = useState(false)

  const isDark = theme === 'dark'

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
  }

  const authMutation = useMutation({
    mutationFn: async () => {
      setFormError(null)
      setSuccessMsg(null)

      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (!data.user) throw new Error('Authentication failed')

        let userRole: UserRole = 'student'
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()

          if (profileError) {
            const meta = data.user.user_metadata?.role
            if (meta === 'student' || meta === 'sales' || meta === 'manager') {
              userRole = meta
            }
          } else if (profile?.role) {
            userRole = profile.role as UserRole
          }
        } catch {
          userRole = 'student'
        }
        return { role: userRole, isSignUp: false }
      } else {
        // 1. Sign up with Supabase auth
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.user) throw new Error('Registration failed')

        // 2. Insert profile with selected role
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          role: selectedRole
        })
        if (profileError) throw profileError

        // 3. Trigger redirect on success
        return { role: selectedRole, isSignUp: false }
      }
    },
    onSuccess: (data) => {
      if (data.isSignUp) {
        setSuccessMsg('Account created! Please check your email to confirm registration.')
        setEmail('')
        setPassword('')
        setFullName('')
      } else {
        setSuccessMsg(`Success! Redirecting to /${data.role}...`)
        setTimeout(() => navigate(`/${data.role}`), 1400)
      }
    },
    onError: (err: any) => {
      setFormError(err.message || 'Authentication failed. Please check your credentials.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!email || !password) {
      setFormError('Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }
    if (mode === 'signup' && !fullName) {
      setFormError('Please enter your full name.')
      return
    }

    authMutation.mutate()
  }

  const isLoading = authMutation.isPending

  // Generate ribbon points for bottom-left twisted mesh shape
  const renderTwistedRibbon = () => {
    return Array.from({ length: 22 }).map((_, i) => {
      const offset = i * 16
      return (
        <path
          key={i}
          d={`M ${-50 + offset} 450 C 100 ${320 - offset}, 220 ${100 + offset}, 450 ${50 + offset}`}
          fill="none"
          stroke="var(--app-wireframe-stroke)"
          strokeWidth="0.75"
        />
      )
    })
  }

  // Generate polar concentric curves for bottom-right torus shape
  const renderPolarArcs = () => {
    const circles = Array.from({ length: 14 }).map((_, i) => {
      const r = 90 + i * 22
      return (
        <circle
          key={`c-${i}`}
          cx="300"
          cy="300"
          r={r}
          fill="none"
          stroke="var(--app-wireframe-stroke)"
          strokeWidth="0.75"
        />
      )
    })

    const lines = Array.from({ length: 12 }).map((_, i) => {
      const angle = (i * 15) * Math.PI / 180
      const x2 = 300 + 400 * Math.cos(angle)
      const y2 = 300 + 400 * Math.sin(angle)
      return (
        <line
          key={`l-${i}`}
          x1="300"
          y1="300"
          x2={x2}
          y2={y2}
          stroke="var(--app-wireframe-stroke)"
          strokeWidth="0.75"
        />
      )
    })

    return [...circles, ...lines]
  }

  return (
    <div className="theme-transition">
      {/* ── Keyframe Animations & Transitions Injected via Style Tag ── */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.03); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
        .theme-transition, .theme-transition * {
          transition: background 0.3s ease, background-color 0.3s ease, border 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, stroke 0.3s ease, fill 0.3s ease;
        }
        input::placeholder, textarea::placeholder { color: var(--input-placeholder) !important; }
        input, textarea { caret-color: var(--input-focus-border); }
        
        :root {
          --card-padding: 48px 40px;
        }
        @media (max-width: 480px) {
          :root {
            --card-padding: 32px 20px;
          }
          .role-buttons-container {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .role-buttons-container button {
            width: 100% !important;
            flex-direction: row !important;
            padding: 12px 16px !important;
            justify-content: flex-start !important;
            gap: 16px !important;
          }
          .role-buttons-container button div {
            width: 36px !important;
            height: 36px !important;
            border-radius: 8px !important;
          }
          .role-buttons-container button div svg {
            width: 18px !important;
            height: 18px !important;
          }
        }
      `}</style>

      {/* ── Full Page Container ── */}
      <div
        className={theme}
        style={{
          width: '100vw',
          minHeight: '100vh',
          background: 'var(--app-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', -apple-system, sans-serif",
          overflowY: 'auto',
          margin: 0,
          padding: '40px 16px',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Grid Pattern Overlay ── */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: 'var(--app-grid-color)',
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* ── Floating Theme Toggle Pill ── */}
        <button
          type="button"
          onClick={toggleTheme}
          onMouseEnter={() => setToggleHovered(true)}
          onMouseLeave={() => setToggleHovered(false)}
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 20,
            background: 'var(--btn-secondary-bg)',
            border: 'var(--btn-secondary-border)',
            borderRadius: '20px',
            padding: '8px 12px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--btn-secondary-text)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            transform: toggleHovered ? 'scale(1.03)' : 'scale(1)',
          }}
        >
          {isDark ? (
            <>
              <Sun size={14} color="#fca5a5" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={14} color="#4f46e5" />
              <span>Dark Mode</span>
            </>
          )}
        </button>

        {/* ── Background Mesh & SVGs ── */}

        {/* Top-Right Wireframe Sphere */}
        <svg
          width="450"
          height="450"
          viewBox="0 0 400 400"
          style={{
            position: 'fixed',
            top: '-120px',
            right: '-120px',
            zIndex: 0,
            pointerEvents: 'none',
            animation: 'pulse 5s ease-in-out infinite',
          }}
        >
          <defs>
            <radialGradient id="sphereGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--app-wireframe-glow)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="200" fill="url(#sphereGlow)" />
          {/* Latitude circles */}
          <ellipse cx="200" cy="200" rx="190" ry="160" fill="none" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
          <ellipse cx="200" cy="200" rx="190" ry="120" fill="none" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
          <ellipse cx="200" cy="200" rx="190" ry="70" fill="none" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
          <line x1="10" y1="200" x2="390" y2="200" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
          {/* Longitude ellipses */}
          <ellipse cx="200" cy="200" rx="160" ry="190" fill="none" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
          <ellipse cx="200" cy="200" rx="120" ry="190" fill="none" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
          <ellipse cx="200" cy="200" rx="70" ry="190" fill="none" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
          <line x1="200" y1="10" x2="200" y2="390" stroke="var(--app-wireframe-stroke)" strokeWidth="0.5" />
        </svg>

        {/* Bottom-Left Wave Mesh */}
        <svg
          width="450"
          height="450"
          viewBox="0 0 450 450"
          style={{
            position: 'fixed',
            bottom: '-120px',
            left: '-120px',
            zIndex: 0,
            pointerEvents: 'none',
            animation: 'pulse 6s ease-in-out infinite',
          }}
        >
          <defs>
            <radialGradient id="waveGlow" cx="30%" cy="70%" r="50%">
              <stop offset="0%" stopColor="var(--app-wireframe-glow)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="300" r="200" fill="url(#waveGlow)" />
          {renderTwistedRibbon()}
        </svg>

        {/* Bottom-Right Torus Mesh */}
        <svg
          width="400"
          height="400"
          viewBox="0 0 400 400"
          style={{
            position: 'fixed',
            bottom: '-140px',
            right: '-60px',
            zIndex: 0,
            pointerEvents: 'none',
            animation: 'pulse 7s ease-in-out infinite',
          }}
        >
          <defs>
            <radialGradient id="torusGlow" cx="70%" cy="70%" r="50%">
              <stop offset="0%" stopColor="var(--app-wireframe-glow)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx="300" cy="300" r="180" fill="url(#torusGlow)" />
          {renderPolarArcs()}
        </svg>

        {/* ── Glassmorphism Card ── */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: '420px',
            margin: '16px',
            background: 'var(--card-bg)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: 'var(--card-border)',
            borderRadius: '24px',
            padding: 'var(--card-padding)',
            boxShadow: 'var(--card-shadow)',
            animation: 'fadeInUp 0.5s ease-out',
          }}
        >
          {/* Logo Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto',
                borderRadius: '18px',
                padding: '1px',
                background: 'var(--card-border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '17px',
                  background: 'var(--card-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'var(--card-border)',
                }}
              >
                <MessageSquare size={26} color="#6366f1" style={{ fill: 'rgba(99,102,241,0.15)' }} />
              </div>
            </div>

            <h1
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text-heading)',
                textAlign: 'center',
                letterSpacing: '-0.5px',
                marginTop: '18px',
                marginBottom: 0,
              }}
            >
              SupportChat
            </h1>

            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: '5px',
                marginBottom: 0,
                letterSpacing: '0.2px',
              }}
            >
              Student support, reimagined
            </p>
          </div>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              margin: '28px 0 24px 0',
              background: 'var(--divider-bg)',
            }}
          />

          {/* Pill Tabs Container */}
          <div
            style={{
              display: 'flex',
              background: 'var(--tabs-bg)',
              borderRadius: '24px',
              padding: '3px',
              border: 'var(--tabs-border)',
              marginBottom: '28px',
            }}
          >
            {(['signin', 'signup'] as AuthMode[]).map((tab) => {
              const isActive = mode === tab
              return (
                <button
                  key={tab}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setMode(tab)
                    setFormError(null)
                    setSuccessMsg(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '20px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.25s ease',
                    fontFamily: 'inherit',
                    ...(isActive
                      ? {
                          background: 'var(--tab-active-bg)',
                          color: 'var(--tab-active-text)',
                          boxShadow: 'var(--tab-active-shadow)',
                          border: 'var(--tab-active-border)',
                        }
                      : {
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          border: '1px solid transparent',
                        }),
                  }}
                >
                  {tab === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              )
            })}
          </div>

          {/* Feedback banners */}
          {formError && (
            <div
              style={{
                background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
                border: isDark ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(239,68,68,0.15)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: isDark ? '#fca5a5' : '#991b1b',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={16} color={isDark ? '#fca5a5' : '#dc2626'} style={{ flexShrink: 0 }} />
              <span>{formError}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)',
                border: isDark ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(34,197,94,0.15)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: isDark ? '#86efac' : '#166534',
                fontSize: '13px',
              }}
            >
              <CheckCircle2 size={16} color={isDark ? '#86efac' : '#15803d'} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Role selector field (signup only) */}
            {mode === 'signup' && (
              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="role"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--label-color)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    display: 'block',
                    textAlign: 'left',
                  }}
                >
                  Role
                </label>
                <div className="role-buttons-container" style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  {/* Student Button */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setSelectedRole('student')}
                    style={{
                      flex: 1,
                      padding: '16px 8px',
                      background: selectedRole === 'student'
                        ? 'var(--item-selected-bg)'
                        : 'transparent',
                      border: selectedRole === 'student'
                        ? '1px solid var(--tab-active-text)'
                        : '1px solid var(--border-color)',
                      borderRadius: '14px',
                      color: selectedRole === 'student'
                        ? 'var(--tab-active-text)'
                        : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: '600',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: selectedRole === 'student'
                          ? 'var(--app-wireframe-glow)'
                          : 'var(--tabs-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: selectedRole === 'student'
                          ? '1px solid var(--tab-active-text)'
                          : '1px solid var(--border-color)',
                      }}
                    >
                      <GraduationCap size={22} color={selectedRole === 'student' ? 'var(--tab-active-text)' : 'var(--text-muted)'} />
                    </div>
                    <span>STUDENT</span>
                  </button>

                  {/* Sales Button */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setSelectedRole('sales')}
                    style={{
                      flex: 1,
                      padding: '16px 8px',
                      background: selectedRole === 'sales'
                        ? 'var(--item-selected-bg)'
                        : 'transparent',
                      border: selectedRole === 'sales'
                        ? '1px solid var(--tab-active-text)'
                        : '1px solid var(--border-color)',
                      borderRadius: '14px',
                      color: selectedRole === 'sales'
                        ? 'var(--tab-active-text)'
                        : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: '600',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: selectedRole === 'sales'
                          ? 'var(--app-wireframe-glow)'
                          : 'var(--tabs-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: selectedRole === 'sales'
                          ? '1px solid var(--tab-active-text)'
                          : '1px solid var(--border-color)',
                      }}
                    >
                      <Headphones size={22} color={selectedRole === 'sales' ? 'var(--tab-active-text)' : 'var(--text-muted)'} />
                    </div>
                    <span>SALES</span>
                  </button>

                  {/* Manager Button */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setSelectedRole('manager')}
                    style={{
                      flex: 1,
                      padding: '16px 8px',
                      background: selectedRole === 'manager'
                        ? 'var(--item-selected-bg)'
                        : 'transparent',
                      border: selectedRole === 'manager'
                        ? '1px solid var(--tab-active-text)'
                        : '1px solid var(--border-color)',
                      borderRadius: '14px',
                      color: selectedRole === 'manager'
                        ? 'var(--tab-active-text)'
                        : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: '600',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: selectedRole === 'manager'
                          ? 'var(--app-wireframe-glow)'
                          : 'var(--tabs-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: selectedRole === 'manager'
                          ? '1px solid var(--tab-active-text)'
                          : '1px solid var(--border-color)',
                      }}
                    >
                      <ShieldCheck size={22} color={selectedRole === 'manager' ? 'var(--tab-active-text)' : 'var(--text-muted)'} />
                    </div>
                    <span>MANAGER</span>
                  </button>
                </div>
              </div>
            )}

            {/* Full Name field (signup only) */}
            {mode === 'signup' && (
              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="fullName"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--label-color)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    display: 'block',
                    textAlign: 'left',
                  }}
                >
                  Full Name
                </label>
                <GlassInput
                  id="fullName"
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={setFullName}
                  disabled={isLoading}
                  icon={<User size={16} />}
                  isDark={isDark}
                />
              </div>
            )}

            {/* Email Address */}
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="email"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--label-color)',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  display: 'block',
                  textAlign: 'left',
                }}
              >
                Email Address
              </label>
              <GlassInput
                id="email"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={setEmail}
                disabled={isLoading}
                icon={<Mail size={16} />}
                isDark={isDark}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '0px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label
                  htmlFor="password"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--label-color)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    display: 'block',
                    textAlign: 'left',
                  }}
                >
                  Password
                </label>
                {mode === 'signin' && (
                  <span
                    onClick={() => {
                      /* Reset password placeholder */
                    }}
                    onMouseEnter={() => setForgotHovered(true)}
                    onMouseLeave={() => setForgotHovered(false)}
                    style={{
                      fontSize: '12px',
                      color: forgotHovered
                        ? 'var(--tab-active-text)'
                        : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                    }}
                  >
                    Forgot password?
                  </span>
                )}
              </div>

              <GlassInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={setPassword}
                disabled={isLoading}
                icon={<Lock size={16} />}
                isDark={isDark}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    onMouseEnter={() => setEyeHovered(true)}
                    onMouseLeave={() => setEyeHovered(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: eyeHovered
                        ? 'var(--text-secondary)'
                        : 'var(--text-muted)',
                      transition: 'color 0.2s',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              style={{
                width: '100%',
                height: '48px',
                marginTop: '36px',
                background: 'var(--btn-primary-bg)',
                border: 'none',
                borderRadius: '24px',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: btnHovered && !isLoading ? 'var(--btn-primary-hover-shadow)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                letterSpacing: '0.2px',
                fontFamily: 'inherit',
                ...(btnHovered && !isLoading
                  ? {
                      transform: 'translateY(-2px)',
                    }
                  : {}),
              }}
            >
              {isLoading ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Toggle mode bottom label */}
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '24px',
            }}
          >
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setFormError(null)
                setSuccessMsg(null)
              }}
              onMouseEnter={() => setBottomHovered(true)}
              onMouseLeave={() => setBottomHovered(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '13px',
                color: bottomHovered
                  ? 'var(--text-heading)'
                  : 'var(--tab-active-text)',
                fontWeight: 500,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'color 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
