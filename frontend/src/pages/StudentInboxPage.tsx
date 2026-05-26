import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiClient } from '../lib/apiClient'
import {
  MessageSquare,
  LogOut,
  Plus,
  Send,
  Sun,
  Moon,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'


interface Thread {
  id: string
  student_id: string
  assigned_to: string | null
  status: 'open' | 'pending' | 'closed'
  subject: string
  last_message_at: string
  created_at: string
  updated_at: string
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

export default function StudentInboxPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Selection & filter states
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'closed'>('all')

  // Theme states (persisted in localStorage, defaulting to 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  // Modal Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newMessage, setNewMessage] = useState('')

  // Textarea input for sending message in thread
  const [replyText, setReplyText] = useState('')

  // Hover states for inline styles
  const [newConvHovered, setNewConvHovered] = useState(false)
  const [logoutHovered, setLogoutHovered] = useState(false)
  const [themeHovered, setThemeHovered] = useState(false)
  const [sendHovered, setSendHovered] = useState(false)
  const [closeHovered, setCloseHovered] = useState(false)

  const isDark = theme === 'dark'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Toggle theme helper
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

  // Fetch threads list
  const {
    data: threads = [],
    isLoading: isThreadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useQuery<Thread[]>({
    queryKey: ['threads', activeTab],
    queryFn: async () => {
      let path = '/api/conversations'
      if (activeTab !== 'all') {
        path += `?status=${activeTab}`
      }
      const res = await apiClient(path)
      if (!res.ok) {
        const errText = await res.text()
        console.error('Fetch threads failed:', res.status, errText)
        throw new Error(`Failed to fetch conversations list: ${errText}`)
      }
      return res.json()
    },
  })

  // Fetch current thread messages
  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    error: messagesError,
  } = useQuery<{ thread: Thread; messages: Message[] }>({
    queryKey: ['messages', activeThreadId],
    queryFn: async () => {
      const res = await apiClient(`/api/conversations/${activeThreadId}`)
      if (!res.ok) {
        const errText = await res.text()
        console.error('Fetch messages failed:', res.status, errText)
        throw new Error(`Failed to fetch messages for this thread: ${errText}`)
      }
      return res.json()
    },
    enabled: !!activeThreadId,
  })

  const messages = messagesData?.messages || []
  const activeThread = messagesData?.thread

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      const res = await apiClient('/api/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Create conversation failed:', res.status, errData)
        throw new Error(errData.error || 'Failed to start conversation')
      }
      return res.json()
    },
    onSuccess: (newThread: Thread) => {
      setIsDialogOpen(false)
      setNewSubject('')
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['threads'] })
      setActiveThreadId(newThread.id)
    },
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { threadId: string; body: string }) => {
      const res = await apiClient(`/api/conversations/${data.threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: data.body }),
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('Send message failed:', res.status, errText)
        throw new Error(`Failed to send message: ${errText}`)
      }
      return res.json()
    },
    onSuccess: (newMessage: Message) => {
      setReplyText('')
      // Instantly append in React Query cache
      queryClient.setQueryData(
        ['messages', activeThreadId],
        (oldData: any) => {
          if (!oldData) return { thread: activeThread, messages: [newMessage] }
          return {
            ...oldData,
            messages: [...oldData.messages, newMessage],
          }
        }
      )
      // Refetch threads to update last message preview and active position
      refetchThreads()
    },
  })

  // Supabase Realtime channel setup for active thread
  useEffect(() => {
    if (!activeThreadId) return

    const channel = supabase
      .channel(`thread-${activeThreadId}`)
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
          // Prevent duplicates
          queryClient.setQueryData(
            ['messages', activeThreadId],
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

  // Scroll to bottom when message log changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle Enter to send message
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (replyText.trim() && activeThreadId && !sendMessageMutation.isPending) {
        sendMessageMutation.mutate({ threadId: activeThreadId, body: replyText.trim() })
      }
    }
  }

  // Handle starting a conversation
  const handleCreateConversation = (e: React.FormEvent) => {
    e.preventDefault()
    if (newSubject.trim() && newMessage.trim()) {
      createConversationMutation.mutate({
        subject: newSubject.trim(),
        message: newMessage.trim(),
      })
    }
  }

  // Format date helper
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

  // Visual Theme Mappings

  const sidebarBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'
  const borderRightStyle = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)'
  const borderBottomStyle = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)'

  const headingColor = isDark ? 'white' : '#0f172a'
  const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15, 23, 42, 0.7)'
  const previewTextColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15, 23, 42, 0.45)'

  const chatHeaderBg = isDark ? 'rgba(10, 10, 25, 0.3)' : 'rgba(255, 255, 255, 0.5)'

  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(99,102,241,0.12)'
  const cardShadow = isDark
    ? '0 0 0 1px rgba(255,255,255,0.05), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(99,102,241,0.08)'
    : '0 0 0 1px rgba(99,102,241,0.05), 0 32px 64px rgba(99,102,241,0.07), 0 0 80px rgba(99,102,241,0.04)'
  const labelColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15, 23, 42, 0.55)'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        background: '#060612',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
      className="theme-transition"
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
          background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
        }
        input::placeholder, textarea::placeholder {
          color: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.4)'} !important;
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
              SupportChat
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

        {/* Action Button */}
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => setIsDialogOpen(true)}
            onMouseEnter={() => setNewConvHovered(true)}
            onMouseLeave={() => setNewConvHovered(false)}
            style={{
              width: '100%',
              height: '42px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.25s ease',
              boxShadow: newConvHovered
                ? '0 6px 20px rgba(99,102,241,0.4)'
                : '0 4px 12px rgba(99,102,241,0.25)',
              transform: newConvHovered ? 'translateY(-1px)' : 'translateY(0)',
            }}
          >
            <Plus size={16} />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Filters Tabs */}
        <div style={{ padding: '0 16px 12px 16px', display: 'flex', gap: '4px' }}>
          {(['all', 'open', 'pending', 'closed'] as const).map((tab) => {
            const isTabActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: isTabActive
                    ? isDark
                      ? 'rgba(99,102,241,0.25)'
                      : 'rgba(99,102,241,0.12)'
                    : 'transparent',
                  color: isTabActive
                    ? isDark
                      ? '#a5b4fc'
                      : '#4f46e5'
                    : isDark
                      ? 'rgba(255,255,255,0.4)'
                      : 'rgba(15,23,42,0.5)',
                  borderBottom: isTabActive
                    ? isDark
                      ? '1px solid #6366f1'
                      : '1px solid #4f46e5'
                    : '1px solid transparent',
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px 8px' }}>
          {isThreadsLoading ? (
            // Skeleton loader
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
              <AlertCircle size={16} style={{ marginBottom: '4px' }} />
              <p>Failed to load list.</p>
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
              No conversations yet. Start one!
            </div>
          ) : (
            threads.map((thread) => {
              const isSelected = activeThreadId === thread.id
              let badgeBg = 'rgba(156,163,175,0.15)'
              let badgeColor = '#9ca3af'
              if (thread.status === 'open') {
                badgeBg = isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)'
                badgeColor = isDark ? '#86efac' : '#166534'
              } else if (thread.status === 'pending') {
                badgeBg = isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.12)'
                badgeColor = isDark ? '#fef08a' : '#854d0e'
              }

              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isSelected
                      ? isDark
                        ? 'rgba(99,102,241,0.08)'
                        : 'rgba(99,102,241,0.05)'
                      : 'transparent',
                    borderLeft: isSelected ? '3px solid #6366f1' : '3px solid transparent',
                    marginBottom: '8px',
                    boxShadow: isSelected
                      ? isDark
                        ? '0 4px 12px rgba(0,0,0,0.15)'
                        : '0 4px 12px rgba(99,102,241,0.04)'
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

                  {/* Last message preview */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: previewTextColor,
                      marginTop: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {thread.conversation_messages?.[0]?.body || 'No messages yet'}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '6px',
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
                            ? isDark
                              ? 'rgba(34,197,94,0.15)'
                              : 'rgba(34,197,94,0.12)'
                            : activeThread.status === 'pending'
                              ? isDark
                                ? 'rgba(234,179,8,0.15)'
                                : 'rgba(234,179,8,0.12)'
                              : 'rgba(156,163,175,0.15)',
                        color:
                          activeThread.status === 'open'
                            ? isDark
                              ? '#86efac'
                              : '#166534'
                            : activeThread.status === 'pending'
                              ? isDark
                                ? '#fef08a'
                                : '#854d0e'
                              : '#9ca3af',
                      }}
                    >
                      {activeThread.status}
                    </span>
                  )}
                </div>

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
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: closeHovered
                      ? isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.05)'
                      : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <X size={18} />
                </button>
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
                    No messages yet. Send a message to start!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isStudent = msg.sender_type === 'student'
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isStudent ? 'flex-end' : 'flex-start',
                          maxWidth: '70%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isStudent ? 'flex-end' : 'flex-start',
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
                          {isStudent ? 'You' : 'Support Team'}
                        </span>

                        {/* Bubble */}
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            lineHeight: '1.45',
                            wordBreak: 'break-word',
                            color: isDark ? 'white' : '#0f172a',
                            background: isStudent
                              ? isDark
                                ? 'rgba(99,102,241,0.2)'
                                : 'rgba(99,102,241,0.1)'
                              : isDark
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(15,23,42,0.05)',
                            border: isStudent
                              ? isDark
                                ? '1px solid rgba(99,102,241,0.3)'
                                : '1px solid rgba(99,102,241,0.2)'
                              : isDark
                                ? '1px solid rgba(255,255,255,0.08)'
                                : '1px solid rgba(15,23,42,0.08)',
                            borderTopRightRadius: isStudent ? '2px' : '12px',
                            borderTopLeftRadius: isStudent ? '12px' : '2px',
                            boxShadow: isDark
                              ? '0 2px 8px rgba(0,0,0,0.15)'
                              : '0 2px 8px rgba(99,102,241,0.03)',
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
                    disabled={sendMessageMutation.isPending}
                    placeholder="Type a message... (Press Enter to send)"
                    style={{
                      flex: 1,
                      height: '52px',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.1)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: isDark ? 'white' : '#0f172a',
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
                        sendMessageMutation.mutate({ threadId: activeThreadId, body: replyText.trim() })
                      }
                    }}
                    disabled={sendMessageMutation.isPending || !replyText.trim()}
                    onMouseEnter={() => setSendHovered(true)}
                    onMouseLeave={() => setSendHovered(false)}
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      border: 'none',
                      color: 'white',
                      cursor: (sendMessageMutation.isPending || !replyText.trim()) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.25s',
                      opacity: (sendMessageMutation.isPending || !replyText.trim()) ? 0.5 : 1,
                      boxShadow: sendHovered && replyText.trim()
                        ? '0 6px 16px rgba(99,102,241,0.45)'
                        : '0 4px 10px rgba(99,102,241,0.25)',
                      transform: sendHovered && replyText.trim() ? 'translateY(-1px)' : 'translateY(0)',
                    }}
                  >
                    {sendMessageMutation.isPending ? (
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
            <span>Select a conversation or start a new one</span>
          </div>
        )}
      </div>

      {/* ── NEW CONVERSATION DIALOG (Frosted Glass Modal) ── */}
      {isDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '440px',
              background: isDark ? 'rgba(10, 10, 25, 0.7)' : 'rgba(255, 255, 255, 0.85)',
              border: cardBorder,
              borderRadius: '20px',
              padding: '32px',
              boxShadow: cardShadow,
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: headingColor }}>
                New Conversation
              </span>
              <button
                onClick={() => setIsDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: previewTextColor,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateConversation}>
              {/* Subject */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="dialogSubject"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: labelColor,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    display: 'block',
                    textAlign: 'left',
                  }}
                >
                  Subject
                </label>
                <input
                  id="dialogSubject"
                  type="text"
                  required
                  placeholder="e.g. Account Access issue"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  disabled={createConversationMutation.isPending}
                  style={{
                    width: '100%',
                    height: '46px',
                    boxSizing: 'border-box',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(15,23,42,0.15)',
                    padding: '0 0 0 4px',
                    color: isDark ? 'white' : '#0f172a',
                    fontSize: '15px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Message */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="dialogMessage"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: labelColor,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    display: 'block',
                    textAlign: 'left',
                  }}
                >
                  Message
                </label>
                <textarea
                  id="dialogMessage"
                  required
                  placeholder="Explain your problem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={createConversationMutation.isPending}
                  style={{
                    width: '100%',
                    height: '100px',
                    boxSizing: 'border-box',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(15,23,42,0.15)',
                    padding: '8px 0 0 4px',
                    color: isDark ? 'white' : '#0f172a',
                    fontSize: '15px',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {createConversationMutation.isError && (
                <div
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
                    border: isDark ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(239,68,68,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: isDark ? '#fca5a5' : '#991b1b',
                    fontSize: '12px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{createConversationMutation.error.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={createConversationMutation.isPending}
                  style={{
                    height: '38px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(15,23,42,0.15)',
                    color: isDark ? 'white' : '#0f172a',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createConversationMutation.isPending}
                  style={{
                    height: '38px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    border: 'none',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {createConversationMutation.isPending ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
