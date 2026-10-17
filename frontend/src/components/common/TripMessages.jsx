import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { apiFetch } from '../../api'
import { useSocketEvent } from '../../hooks/useSocket'

const CHAT_OPEN_STATUSES = ['accepted', 'arrived', 'picked_up', 'arrived_at_school']

const formatMessageTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const formatThreadTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? formatMessageTime(value)
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` })

export default function TripMessages({
  role,
  token,
  socket,
  activeRequestId = null,
  activeRequest = null,
  onUnreadCount,
}) {
  const [threads, setThreads] = useState([])
  const [selectedRequestId, setSelectedRequestId] = useState(activeRequestId || '')
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [draft, setDraft] = useState('')
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const composerRef = useRef(null)
  const activeLoadRef = useRef(0)
  const shouldScrollToBottomRef = useRef(false)
  const olderScrollPositionRef = useRef(null)

  const fetchThreads = useCallback(async () => {
    const response = await apiFetch('/api/messages/threads', {
      headers: authHeaders(token),
    })
    setThreads(response.threads || [])
    return response.threads || []
  }, [token])

  useEffect(() => {
    let current = true
    setLoadingThreads(true)
    apiFetch('/api/messages/threads', { headers: authHeaders(token) })
      .then((response) => {
        if (current) setThreads(response.threads || [])
      })
      .catch((requestError) => {
        if (current) setError(requestError.message || 'Unable to load conversations.')
      })
      .finally(() => {
        if (current) setLoadingThreads(false)
      })
    return () => {
      current = false
    }
  }, [token])

  useEffect(() => {
    if (activeRequestId) setSelectedRequestId(String(activeRequestId))
  }, [activeRequestId])

  const activeThread = useMemo(() => {
    if (!activeRequest?._id || !activeRequestId) return null
    const requestId = String(activeRequest._id)
    if (requestId !== String(activeRequestId)) return null
    const otherParty = role === 'parent'
      ? activeRequest.driverProfile?.name || activeRequest.driver?.fullName
      : activeRequest.parent?.fullName
    return {
      requestId,
      status: activeRequest.status,
      studentName: activeRequest.studentName || activeRequest.students?.map((student) => student.studentName).filter(Boolean).join(', '),
      schoolName: activeRequest.schoolName,
      otherParty: {
        name: otherParty || (role === 'parent' ? 'Driver' : 'Parent'),
        role: role === 'parent' ? 'driver' : 'parent',
      },
      lastMessage: null,
      unreadCount: 0,
    }
  }, [activeRequest, activeRequestId, role])

  const visibleThreads = useMemo(() => {
    if (!activeThread) return threads
    if (threads.some((thread) => String(thread.requestId) === activeThread.requestId)) {
      return threads.map((thread) => String(thread.requestId) === activeThread.requestId
        ? { ...thread, ...activeThread, lastMessage: thread.lastMessage, unreadCount: thread.unreadCount }
        : thread)
    }
    return [activeThread, ...threads]
  }, [activeThread, threads])

  const unreadCount = useMemo(
    () => threads.reduce((count, thread) => count + (Number(thread.unreadCount) || 0), 0),
    [threads]
  )

  useEffect(() => {
    onUnreadCount?.(unreadCount)
  }, [onUnreadCount, unreadCount])

  const selectedThread = visibleThreads.find(
    (thread) => String(thread.requestId) === String(selectedRequestId)
  )
  const canSend = Boolean(selectedThread && CHAT_OPEN_STATUSES.includes(selectedThread.status))

  useEffect(() => {
    if (!selectedRequestId) {
      setMessages([])
      setHasMore(false)
      return undefined
    }

    const loadId = ++activeLoadRef.current
    let current = true
    setLoadingMessages(true)
    setLoadingOlder(false)
    setError('')
    setMessages([])
    shouldScrollToBottomRef.current = true

    Promise.allSettled([
      apiFetch(`/api/messages/threads/${selectedRequestId}/messages`, {
        headers: authHeaders(token),
      }),
      apiFetch(`/api/messages/threads/${selectedRequestId}/read`, {
        method: 'PATCH',
        headers: authHeaders(token),
      }),
    ])
      .then(([messagesResult, readResult]) => {
        if (!current || activeLoadRef.current !== loadId) return
        if (messagesResult.status === 'rejected') throw messagesResult.reason
        const response = messagesResult.value
        setMessages(response.messages || [])
        setHasMore(Boolean(response.hasMore))
        if (readResult.status === 'rejected') throw readResult.reason
        setThreads((currentThreads) => currentThreads.map((thread) =>
          String(thread.requestId) === String(selectedRequestId)
            ? { ...thread, unreadCount: 0 }
            : thread
        ))
      })
      .catch((requestError) => {
        if (current && activeLoadRef.current === loadId) {
          setError(requestError.message || 'Unable to load this conversation.')
        }
      })
      .finally(() => {
        if (current && activeLoadRef.current === loadId) setLoadingMessages(false)
      })

    return () => {
      current = false
    }
  }, [selectedRequestId, token])

  useLayoutEffect(() => {
    const messageList = listRef.current
    if (!messageList) return
    if (olderScrollPositionRef.current !== null) {
      messageList.scrollTop = olderScrollPositionRef.current.scrollTop +
        (messageList.scrollHeight - olderScrollPositionRef.current.scrollHeight)
      olderScrollPositionRef.current = null
    } else if (shouldScrollToBottomRef.current) {
      messageList.scrollTop = messageList.scrollHeight
      shouldScrollToBottomRef.current = false
    }
  }, [messages])

  useLayoutEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    composer.style.height = 'auto'
    composer.style.height = `${Math.min(composer.scrollHeight, 120)}px`
  }, [draft])

  const markSelectedThreadRead = useCallback(async (requestId) => {
    try {
      await apiFetch(`/api/messages/threads/${requestId}/read`, {
        method: 'PATCH',
        headers: authHeaders(token),
      })
      setThreads((currentThreads) => currentThreads.map((thread) =>
        String(thread.requestId) === String(requestId)
          ? { ...thread, unreadCount: 0 }
          : thread
      ))
    } catch (requestError) {
      setError(requestError.message || 'Unable to mark this conversation as read.')
    }
  }, [token])

  const handleIncomingMessage = useCallback((event) => {
    const message = event?.message
    const requestId = String(event?.requestId || message?.requestId || '')
    if (!message?._id || !requestId) return

    if (requestId === String(selectedRequestId)) {
      shouldScrollToBottomRef.current = true
      setMessages((currentMessages) => (
        currentMessages.some((item) => String(item._id) === String(message._id))
          ? currentMessages
          : [...currentMessages, message]
      ))
      if (message.senderRole !== role) markSelectedThreadRead(requestId)
      return
    }

    fetchThreads().catch((requestError) => {
      setError(requestError.message || 'Unable to refresh conversations.')
    })
  }, [fetchThreads, markSelectedThreadRead, role, selectedRequestId])

  useSocketEvent(socket, 'trip:message', handleIncomingMessage, [handleIncomingMessage])

  const handleTripRequestUpdated = useCallback((event) => {
    const request = event?.request
    if (!request?._id || !request.status) return
    setThreads((currentThreads) => currentThreads.map((thread) =>
      String(thread.requestId) === String(request._id)
        ? { ...thread, status: request.status }
        : thread
    ))
  }, [])

  useSocketEvent(socket, 'trip:request-updated', handleTripRequestUpdated, [handleTripRequestUpdated])

  const loadOlderMessages = async () => {
    if (!hasMore || loadingOlder || !messages.length || !selectedRequestId) return
    setLoadingOlder(true)
    setError('')
    const messageList = listRef.current
    if (messageList) {
      olderScrollPositionRef.current = {
        scrollTop: messageList.scrollTop,
        scrollHeight: messageList.scrollHeight,
      }
    }
    try {
      const response = await apiFetch(
        `/api/messages/threads/${selectedRequestId}/messages?before=${encodeURIComponent(messages[0]._id)}`,
        { headers: authHeaders(token) }
      )
      setMessages((currentMessages) => {
        const existingIds = new Set(currentMessages.map((message) => String(message._id)))
        const older = (response.messages || []).filter((message) => !existingIds.has(String(message._id)))
        return [...older, ...currentMessages]
      })
      setHasMore(Boolean(response.hasMore))
    } catch (requestError) {
      olderScrollPositionRef.current = null
      setError(requestError.message || 'Unable to load older messages.')
    } finally {
      setLoadingOlder(false)
    }
  }

  const sendMessage = async () => {
    const text = draft.trim()
    if (!text || text.length > 500 || !canSend || sending || !selectedRequestId) return

    setSending(true)
    setError('')
    try {
      const response = await apiFetch(`/api/messages/threads/${selectedRequestId}/messages`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ text }),
      })
      setMessages((currentMessages) => (
        currentMessages.some((message) => String(message._id) === String(response.message._id))
          ? currentMessages
          : [...currentMessages, response.message]
      ))
      shouldScrollToBottomRef.current = true
      setDraft('')
      await fetchThreads()
    } catch (requestError) {
      setError(requestError.message || 'Unable to send this message.')
    } finally {
      setSending(false)
    }
  }

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <section className="grid h-[min(68vh,680px)] min-h-[400px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.6fr)] md:grid-rows-1">
      <aside className="flex max-h-[140px] min-h-0 flex-col border-b border-gray-200 bg-gray-50 md:max-h-none md:border-b-0 md:border-r">
        <div className="border-b border-gray-200 px-4 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <MessageCircle size={19} aria-hidden="true" />
            Conversations
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingThreads && !visibleThreads.length ? (
            <p className="p-4 text-sm text-gray-600">Loading conversations...</p>
          ) : visibleThreads.length ? (
            visibleThreads.map((thread) => {
              const isSelected = String(thread.requestId) === String(selectedRequestId)
              return (
                <button
                  key={thread.requestId}
                  type="button"
                  onClick={() => setSelectedRequestId(String(thread.requestId))}
                  className={`w-full border-b border-gray-200 px-4 py-3 text-left transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {thread.otherParty?.name || (role === 'parent' ? 'Driver' : 'Parent')}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {thread.lastMessage?.createdAt ? formatThreadTime(thread.lastMessage.createdAt) : ''}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-600">
                    {[thread.studentName, thread.schoolName].filter(Boolean).join(' · ') || 'Trip conversation'}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-gray-600">
                      {thread.lastMessage?.text || 'No messages yet'}
                    </p>
                    {thread.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                        {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          ) : (
            <p className="p-4 text-sm text-gray-600">
              {role === 'parent'
                ? 'No conversations yet. You can chat with your driver after they accept your trip.'
                : 'No conversations yet. You can chat with a parent after you accept their request.'}
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        {selectedThread ? (
          <>
            <header className="border-b border-gray-200 px-4 py-3">
              <h3 className="font-semibold text-gray-900">{selectedThread.otherParty?.name || (role === 'parent' ? 'Driver' : 'Parent')}</h3>
              <p className="mt-0.5 text-xs text-gray-600">
                {[selectedThread.studentName, selectedThread.schoolName].filter(Boolean).join(' · ')}
              </p>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
              {hasMore && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={loadOlderMessages}
                    disabled={loadingOlder}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {loadingOlder ? 'Loading...' : 'Load older'}
                  </button>
                </div>
              )}
              {loadingMessages ? (
                <p className="py-4 text-center text-sm text-gray-600">Loading messages...</p>
              ) : messages.length ? (
                messages.map((message) => {
                  const mine = message.senderRole === role
                  return (
                    <div key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                        mine ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-gray-200 bg-white text-gray-900'
                      }`}>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                        <time className={`mt-1 block text-right text-[11px] ${mine ? 'text-blue-100' : 'text-gray-500'}`}>
                          {formatMessageTime(message.createdAt)}
                        </time>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="py-8 text-center text-sm text-gray-600">No messages yet. Say hello to start the conversation.</p>
              )}
            </div>

            {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
            {canSend ? (
              <form
                className="border-t border-gray-200 bg-white p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  sendMessage()
                }}
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <label className="sr-only" htmlFor="trip-message-composer">Write a message</label>
                  <textarea
                    ref={composerRef}
                    id="trip-message-composer"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, 500))}
                    onKeyDown={handleComposerKeyDown}
                    rows={2}
                    maxLength={500}
                    placeholder="Write a message..."
                    className="min-h-12 w-full min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs text-gray-500">{draft.length}/500</span>
                    <p
                      className="min-w-0 flex-1 truncate text-xs text-gray-500"
                      title="Enter to send, Shift+Enter for a new line"
                    >
                      Enter to send, Shift+Enter for a new line
                    </p>
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={16} aria-hidden="true" />
                      <span>{sending ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                This trip has ended. You can still read the conversation.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-600">
            <MessageCircle size={36} aria-hidden="true" className="mb-3 text-gray-400" />
            <p className="text-sm">Select a conversation to view messages.</p>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
