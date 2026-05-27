import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiClient } from '../lib/apiClient'
import {
  MessageSquare,
  LogOut,
  Send,
  Sun,
  Moon,
  X,
  Loader2,
  AlertCircle,
  Search,
  Users,
  CornerDownRight,
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  role: 'student' | 'sales' | 'manager'
  full_name: string
}

interface Thread {
  id: string
  student_id: string
  assigned_to: string | null
  status: 'open' | 'pending' | 'closed'
  subject: string
  last_message_at: string
  created_at: string
  updated_at: string
  student?: {
    full_name: string
  }
  assignee?: {
    full_name: string
  }
  conversation_messages?: {
    body: string
    sender_type: string
    created_at: string
  }[]
}

interface Message {
  id: string
  thread_id: string
  sender_id: string
  sender_type: 'student' | 'team'
  body: string
  created_at: string
}

export default function ManagerQueuePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'pending' | 'closed'>('all')
  const [replyText, setReplyText] = useState('')
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [selectedSalesUserId, setSelectedSalesUserId] = useState('')

  // Theme states
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  // Button hover states
  const [logoutHovered, setLogoutHovered] = useState(false)
  const [themeHovered, setThemeHovered] = useState(false)
  const [sendHovered, setSendHovered] = useState(false)
  const [closeHovered, setCloseHovered] = useState(false)
  const [reassignBtnHovered, setReassignBtnHovered] = useState(false)

  const isDark = theme === 'dark'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Toggle theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
  }

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  // 1. Fetch current user profile for role protection
  const {
    data: currentUser,
    isLoading: isUserLoading,
    error: userError,
  } = useQuery<UserProfile>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await apiClient('/api/me')
      if (!res.ok) {
        throw new Error('Failed to load user profile')
      }
      return res.json()
    },
  })

  // Role Protection redirection logic
  useEffect(() => {
    if (userError) {
      navigate('/')
      return
    }
    if (currentUser) {
      if (currentUser.role !== 'manager') {
        if (currentUser.role === 'student') {
          navigate('/student')
        } else if (currentUser.role === 'sales') {
          navigate('/sales')
        } else {
          navigate('/')
        }
      }
    }
  }, [currentUser, userError, navigate])

  // 2. Fetch all conversations with filters
  const {
    data: threads = [],
    isLoading: isThreadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useQuery<Thread[]>({
    queryKey: ['conversations', statusFilter, searchQuery],
    queryFn: async () => {
      let path = '/api/conversations'
      const params: string[] = []
      if (statusFilter !== 'all') {
        params.push(`status=${statusFilter}`)
      }
      if (searchQuery.trim()) {
        params.push(`q=${encodeURIComponent(searchQuery.trim())}`)
      }
      if (params.length > 0) {
        path += `?${params.join('&')}`
      }
      const res = await apiClient(path)
      if (!res.ok) {
        const errText = await res.text()
        console.error('Fetch threads error:', res.status, errText)
        throw new Error(`Failed to load list: ${errText}`)
      }
      return res.json()
    },
    enabled: !!currentUser && currentUser.role === 'manager',
  })

  // 3. Fetch messages for active thread
  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    error: messagesError,
  } = useQuery<{ thread: Thread; messages: Message[] }>({
    queryKey: ['thread', activeThreadId],
    queryFn: async () => {
      const res = await apiClient(`/api/conversations/${activeThreadId}`)
      if (!res.ok) {
        const errText = await res.text()
        console.error('Fetch thread details error:', res.status, errText)
        throw new Error(`Failed to load thread details: ${errText}`)
      }
      return res.json()
    },
    enabled: !!activeThreadId,
  })

  const messages = messagesData?.messages || []
  const activeThread = messagesData?.thread

  // Initialize selectedSalesUserId when active thread changes or modal opens
  useEffect(() => {
    if (activeThread) {
      setSelectedSalesUserId(activeThread.assigned_to || '')
    }
  }, [activeThread, isReassignOpen])

  // 4. Fetch sales users list
  const {
    data: salesUsers = [],
    isLoading: isSalesUsersLoading,
  } = useQuery<UserProfile[]>({
    queryKey: ['salesUsers'],
    queryFn: async () => {
      const res = await apiClient('/api/users/sales')
      if (!res.ok) {
        throw new Error('Failed to load sales users')
      }
      return res.json()
    },
    enabled: !!currentUser && currentUser.role === 'manager',
  })

  // 5. Reassign conversation mutation
  const reassignMutation = useMutation({
    mutationFn: async (assignedTo: string | null) => {
      const res = await apiClient(`/api/conversations/${activeThreadId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedTo }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Failed to reassign: ${errText}`)
      }
      return res.json()
    },
    onSuccess: () => {
      setIsReassignOpen(false)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['thread', activeThreadId] })
    },
  })

  // 6. Update thread status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: 'open' | 'pending' | 'closed') => {
      const res = await apiClient(`/api/conversations/${activeThreadId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Failed to update status: ${errText}`)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['thread', activeThreadId] })
    },
  })

  // 7. Send message mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiClient(`/api/conversations/${activeThreadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Failed to send reply: ${errText}`)
      }
      return res.json()
    },
    onSuccess: (newMessage: Message) => {
      setReplyText('')
      // Append in cache
      queryClient.setQueryData(
        ['thread', activeThreadId],
        (oldData: any) => {
          if (!oldData) return { thread: activeThread, messages: [newMessage] }
          return {
            ...oldData,
            messages: [...oldData.messages, newMessage],
          }
        }
      )
      refetchThreads()
    },
  })

  // Realtime subscription binding
  useEffect(() => {
    if (!activeThreadId) return

    const channel = supabase
      .channel(`manager-thread-${activeThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `thread_id=eq.${activeThreadId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          queryClient.setQueryData(
            ['thread', activeThreadId],
            (oldData: any) => {
              if (!oldData) return { thread: activeThread, messages: [newMessage] }
              if (oldData.messages.some((msg: Message) => msg.id === newMessage.id)) {
                return oldData
              }
              return {
                ...oldData,
                messages: [...oldData.messages, newMessage],
              }
            }
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId, activeThread, queryClient])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Key press reply listener (Enter to send, Shift+Enter for newline)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (replyText.trim() && activeThreadId && !sendReplyMutation.isPending) {
        sendReplyMutation.mutate(replyText.trim())
      }
    }
  }

  // Format date
  const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Role protect loading spinner
  if (isUserLoading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'var(--app-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
        }}
      >
        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
      </div>
    )
  }

  if (userError || !currentUser || currentUser.role !== 'manager') {
    return null // Redirection handled in useEffect
  }

  // Visual Theme Mappings
  const sidebarBg = 'var(--sidebar-bg)'
  const borderRightStyle = 'var(--sidebar-border)'
  const borderBottomStyle = 'var(--border-color)'

  const headingColor = 'var(--text-heading)'
  const textColor = 'var(--text-primary)'
  const previewTextColor = 'var(--text-muted)'
  const chatHeaderBg = 'var(--chat-header-bg)'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        background: 'var(--app-bg)',
        backgroundImage: 'var(--app-bg)',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
      className={`theme-transition ${theme}`}
    >
      <style>{`
        .theme-transition, .theme-transition * {
          transition: background 0.3s ease, background-color 0.3s ease, border 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--scrollbar-thumb-hover);
        }
        input::placeholder, textarea::placeholder {
          color: var(--input-placeholder) !important;
        }
      `}</style>

      {/* ── LEFT PANEL (Sidebar) ── */}
      <div
        style={{
          width: '320px',
          height: '100%',
          flexShrink: 0,
          background: sidebarBg,
          borderRight: borderRightStyle,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 16px',
            borderBottom: borderBottomStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} color="#6366f1" />
            <span style={{ fontSize: '16px', fontWeight: 700, color: headingColor }}>
              Manager Queue
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              onMouseEnter={() => setThemeHovered(true)}
              onMouseLeave={() => setThemeHovered(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: themeHovered
                  ? isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.05)'
                  : 'transparent',
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              onMouseEnter={() => setLogoutHovered(true)}
              onMouseLeave={() => setLogoutHovered(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                color: isDark ? '#fca5a5' : '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: logoutHovered
                  ? isDark
                    ? 'rgba(239,68,68,0.1)'
                    : 'rgba(239,68,68,0.05)'
                  : 'transparent',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div style={{ padding: '16px 16px 12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.4)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search by subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: 'var(--input-border)',
                borderRadius: '8px',
                color: 'var(--input-text)',
                padding: '8px 12px 8px 30px',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: previewTextColor,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: 'var(--input-border)',
                borderRadius: '8px',
                color: 'var(--input-text)',
                padding: '8px 24px 8px 12px',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: 'var(--select-arrow)',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                backgroundSize: '12px',
              }}
            >
              <option value="all" style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>All Statuses</option>
              <option value="open" style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>Open</option>
              <option value="pending" style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>Pending</option>
              <option value="closed" style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>Closed</option>
            </select>
          </div>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px 8px' }}>
          {isThreadsLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                  marginBottom: '8px',
                  border: isDark ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(0,0,0,0.03)',
                  opacity: 0.5,
                }}
              >
                <div
                  style={{
                    height: '14px',
                    width: '60%',
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    marginBottom: '8px',
                  }}
                />
                <div
                  style={{
                    height: '11px',
                    width: '80%',
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    borderRadius: '4px',
                  }}
                />
              </div>
            ))
          ) : threadsError ? (
            <div style={{ padding: '16px', color: '#fca5a5', fontSize: '13px', textAlign: 'center' }}>
              <AlertCircle size={16} style={{ marginBottom: '4px', display: 'inline' }} />
              <p>Failed to load conversations.</p>
            </div>
          ) : threads.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.4)',
                fontSize: '13px',
              }}
            >
              No conversations found
            </div>
          ) : (
            threads.map((thread) => {
              const isSelected = activeThreadId === thread.id
              let badgeBg = 'var(--badge-closed-bg)'
              let badgeColor = 'var(--badge-closed-text)'
              if (thread.status === 'open') {
                badgeBg = 'var(--badge-open-bg)'
                badgeColor = 'var(--badge-open-text)'
              } else if (thread.status === 'pending') {
                badgeBg = 'var(--badge-pending-bg)'
                badgeColor = 'var(--badge-pending-text)'
              }

              const studentName = thread.student?.full_name || 'Anonymous Student'
              const assigneeName = thread.assignee?.full_name

              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className="thread-item"
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isSelected
                      ? 'var(--item-selected-bg)'
                      : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--tab-active-text)' : '3px solid transparent',
                    marginBottom: '8px',
                    boxShadow: isSelected
                      ? 'var(--card-shadow)'
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isSelected ? headingColor : textColor,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {thread.subject}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: previewTextColor,
                        flexShrink: 0,
                      }}
                    >
                      {formatTimeAgo(thread.last_message_at)}
                    </span>
                  </div>

                  {/* Student details */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: previewTextColor,
                      marginTop: '3px',
                    }}
                  >
                    Student: {studentName}
                  </div>

                  {/* Assignee details */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: previewTextColor,
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <CornerDownRight size={10} style={{ opacity: 0.5 }} />
                    {assigneeName ? (
                      <span>Assigned to: <strong style={{ color: headingColor }}>{assigneeName}</strong></span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--badge-danger-text)',
                          background: 'var(--badge-danger-bg)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 500,
                        }}
                      >
                        Unassigned
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {thread.status}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL (Chat Window) ── */}
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {activeThreadId ? (
          isMessagesLoading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
            </div>
          ) : messagesError ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fca5a5',
                fontSize: '14px',
                padding: '16px',
              }}
            >
              <AlertCircle size={32} style={{ marginBottom: '8px' }} />
              <p>Failed to load thread conversations.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div
                style={{
                  padding: '16px 24px',
                  background: chatHeaderBg,
                  borderBottom: borderBottomStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  zIndex: 2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: headingColor }}>
                    {activeThread?.subject}
                  </span>
                  {activeThread && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background:
                          activeThread.status === 'open'
                            ? 'var(--badge-open-bg)'
                            : activeThread.status === 'pending'
                              ? 'var(--badge-pending-bg)'
                              : 'var(--badge-closed-bg)',
                        color:
                          activeThread.status === 'open'
                            ? 'var(--badge-open-text)'
                            : activeThread.status === 'pending'
                              ? 'var(--badge-pending-text)'
                              : 'var(--badge-closed-text)',
                      }}
                    >
                      {activeThread.status}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Reassign Button */}
                  <button
                    onClick={() => setIsReassignOpen(true)}
                    onMouseEnter={() => setReassignBtnHovered(true)}
                    onMouseLeave={() => setReassignBtnHovered(false)}
                    style={{
                      background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      color: isDark ? '#a5b4fc' : '#4f46e5',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: reassignBtnHovered
                        ? '0 4px 12px rgba(99,102,241,0.2)'
                        : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Users size={12} />
                    <span>Reassign</span>
                  </button>

                  {/* Status Dropdown */}
                  {activeThread && (
                    <select
                      value={activeThread.status}
                      disabled={updateStatusMutation.isPending}
                      onChange={(e) =>
                        updateStatusMutation.mutate(e.target.value as any)
                      }
                      style={{
                        background: 'var(--input-bg)',
                        border: 'var(--input-border)',
                        borderRadius: '8px',
                        color: 'var(--input-text)',
                        padding: '6px 24px 6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                        appearance: 'none',
                        backgroundImage: 'var(--select-arrow)',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                        backgroundSize: '12px',
                      }}
                    >
                      <option value="open" style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>Open (Reopen)</option>
                      <option value="pending" style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>Pending</option>
                      <option value="closed" style={{ background: 'var(--input-bg)', color: 'var(--input-text)' }}>Closed</option>
                    </select>
                  )}

                  {/* Close panel X button */}
                  <button
                    onClick={() => setActiveThreadId(null)}
                    onMouseEnter={() => setCloseHovered(true)}
                    onMouseLeave={() => setCloseHovered(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '8px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: closeHovered
                        ? 'var(--item-hover-bg)'
                        : 'transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {messages.length === 0 ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: previewTextColor,
                      fontSize: '14px',
                    }}
                  >
                    No messages in this thread.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isTeam = msg.sender_type === 'team'
                    const senderLabel = isTeam ? 'Support Team' : activeThread?.student?.full_name || 'Student'
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isTeam ? 'flex-end' : 'flex-start',
                          maxWidth: '70%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isTeam ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {/* Sender Label */}
                        <span
                          style={{
                            fontSize: '11px',
                            color: previewTextColor,
                            marginBottom: '4px',
                            padding: '0 4px',
                          }}
                        >
                          {senderLabel}
                        </span>

                        {/* Bubble */}
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            lineHeight: '1.45',
                            wordBreak: 'break-word',
                            color: isTeam ? 'var(--msg-team-text)' : 'var(--msg-student-text)',
                            background: isTeam ? 'var(--msg-team-bg)' : 'var(--msg-student-bg)',
                            border: isTeam ? 'var(--msg-team-border)' : '1px solid var(--msg-student-bg)',
                            borderTopRightRadius: isTeam ? '2px' : '12px',
                            borderTopLeftRadius: isTeam ? '12px' : '2px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                          }}
                        >
                          {msg.body}
                        </div>

                        {/* Date Label */}
                        <span
                          style={{
                            fontSize: '10px',
                            color: previewTextColor,
                            marginTop: '4px',
                            padding: '0 4px',
                          }}
                        >
                          {formatTimeAgo(msg.created_at)}
                        </span>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: borderBottomStyle,
                  background: isDark ? 'rgba(10,10,25,0.2)' : 'rgba(255,255,255,0.25)',
                  zIndex: 2,
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={sendReplyMutation.isPending}
                    placeholder="Type a message... (Press Enter to send)"
                    style={{
                      flex: 1,
                      height: '52px',
                      background: 'var(--input-bg)',
                      border: 'var(--input-border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: 'var(--input-text)',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: '1.4',
                      transition: 'all 0.2s',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (replyText.trim()) {
                        sendReplyMutation.mutate(replyText.trim())
                      }
                    }}
                    disabled={sendReplyMutation.isPending || !replyText.trim()}
                    onMouseEnter={() => setSendHovered(true)}
                    onMouseLeave={() => setSendHovered(false)}
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      border: 'none',
                      color: 'white',
                      cursor: (sendReplyMutation.isPending || !replyText.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.25s',
                      opacity: (sendReplyMutation.isPending || !replyText.trim()) ? 0.5 : 1,
                      boxShadow: sendHovered && replyText.trim()
                        ? '0 6px 16px rgba(99,102,241,0.45)'
                        : '0 4px 10px rgba(99,102,241,0.25)',
                      transform: sendHovered && replyText.trim() ? 'translateY(-1px)' : 'translateY(0)',
                    }}
                  >
                    {sendReplyMutation.isPending ? (
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>
              </div>
            </>
          )
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: previewTextColor,
              fontSize: '14px',
            }}
          >
            <MessageSquare size={48} style={{ opacity: 0.15, marginBottom: '12px' }} />
            <span>Select a conversation to manage routing & replies</span>
          </div>
        )}
      </div>

      {/* ── REASSIGN DIALOG (Modal overlay) ── */}
      {isReassignOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--card-bg)',
              border: 'var(--card-border)',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: 'var(--card-shadow)',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: headingColor, margin: '0 0 8px 0' }}>
              Reassign Conversation
            </h3>
            <p style={{ fontSize: '13px', color: previewTextColor, margin: '0 0 20px 0' }}>
              Currently assigned to:{' '}
              <strong style={{ color: headingColor }}>
                {activeThread?.assignee?.full_name || 'Unassigned'}
              </strong>
            </p>

            <label
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: previewTextColor,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Assignee
            </label>

            <select
              value={selectedSalesUserId}
              onChange={(e) => setSelectedSalesUserId(e.target.value)}
              disabled={isSalesUsersLoading}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: 'var(--input-border)',
                borderRadius: '10px',
                color: headingColor,
                padding: '12px 16px',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '28px',
                cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: 'var(--input-bg)', color: previewTextColor }}>
                {isSalesUsersLoading ? 'Loading users...' : 'Select a sales representative...'}
              </option>
              {salesUsers.map((user) => (
                <option key={user.id} value={user.id} style={{ background: 'var(--input-bg)', color: headingColor }}>
                  {user.full_name}
                </option>
              ))}
              <option value="unassigned" style={{ background: 'var(--input-bg)', color: headingColor }}>
                Unassigned (Remove Assignee)
              </option>
            </select>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsReassignOpen(false)}
                style={{
                  background: 'var(--btn-secondary-bg)',
                  border: 'var(--btn-secondary-border)',
                  borderRadius: '10px',
                  color: 'var(--btn-secondary-text)',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const val = selectedSalesUserId === 'unassigned' ? null : (selectedSalesUserId || null);
                  reassignMutation.mutate(val);
                }}
                disabled={reassignMutation.isPending}
                style={{
                  background: 'var(--btn-primary-bg)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: reassignMutation.isPending ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--btn-primary-hover-shadow)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {reassignMutation.isPending && (
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                )}
                <span>Reassign</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
