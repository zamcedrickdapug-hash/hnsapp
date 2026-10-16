import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { API_SERVER_URL } from '../api'

// Global singleton socket instance to prevent multiple connections
let globalSocket = null
let handlersRegistered = false
let socketInitialized = false
let socketToken = null
let socketScope = null

/**
 * Get or create a global socket instance
 * Ensures only ONE socket connection exists
 */
function getGlobalSocket(token, options = {}) {
  const requestedScope = options.auth?.scope || null
  const needsAdminScope = requestedScope === 'admin' && socketScope !== 'admin'

  // An admin-scoped connection is never downgraded by another shared hook.
  if (globalSocket && socketToken === token && !needsAdminScope) {
    return globalSocket
  }

  if (globalSocket && (socketToken !== token || needsAdminScope)) {
    console.log('[Socket] Replacing socket to apply updated authentication scope')
    globalSocket.off()
    globalSocket.disconnect()
    globalSocket = null
    socketToken = null
    socketScope = null
    socketInitialized = false
  }

  // Create new socket if needed
  if (!globalSocket) {
    const socketUrl = API_SERVER_URL
    const { auth: customAuth = {}, ...otherOptions } = options
    const socketOptions = {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 20000,
      autoConnect: true,
      // Prevent excessive reconnection loops
      randomizationFactor: 0.5,
      ...otherOptions,
      auth: { ...customAuth, token },
    }

    console.log('[Socket] Creating new socket instance at', socketUrl)
    globalSocket = io(socketUrl, socketOptions)
    socketToken = token
    socketScope = requestedScope
    socketInitialized = true

    // Add global error handlers to prevent crashes
    globalSocket.on('error', (err) => {
      console.error('[Socket] Global error handler:', err)
    })

    globalSocket.on('connect_error', (err) => {
      console.warn('[Socket] Global connect_error:', err?.message)
    })
  }

  return globalSocket
}

/**
 * Custom hook for managing Socket.IO connections
 * Handles connection, disconnection, errors, and automatic reconnection
 * Ensures only ONE socket instance exists globally
 */
export function useSocket(token, options = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const reconnectAttemptRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setIsConnected(false)
      return
    }

    const socket = getGlobalSocket(token, options)

    // Only register handlers once per socket instance
    if (!handlersRegistered || !socketInitialized) {
      handlersRegistered = true

      const handleConnect = () => {
        if (!mountedRef.current) return
        console.log('[Socket] Connected successfully', { socketId: socket.id })
        setIsConnected(true)
        setError(null)
        reconnectAttemptRef.current = 0
        setConnectionAttempt((prev) => prev + 1)
      }

      const handleDisconnect = (reason) => {
        if (!mountedRef.current) return
        console.log('[Socket] Disconnected:', reason)
        setIsConnected(false)

        // Only show error for abnormal disconnections
        if (reason !== 'io client namespace disconnect' && reason !== 'io server namespace disconnect') {
          setError(`Disconnected: ${reason}`)
        }
      }

      const handleConnectError = (err) => {
        if (!mountedRef.current) return
        console.error('[Socket] Connection error:', err?.message)
        setError(err?.message || 'Connection error')
        setIsConnected(false)
      }

      const handleReconnectAttempt = () => {
        reconnectAttemptRef.current += 1
        console.log(`[Socket] Reconnection attempt ${reconnectAttemptRef.current}`)
      }

      const handleReconnectFailed = () => {
        if (!mountedRef.current) return
        console.error('[Socket] Reconnection failed after maximum attempts')
        setError('Unable to reconnect to server')
      }

      const handleSocketError = (err) => {
        if (!mountedRef.current) return
        console.error('[Socket] Error event:', err)
        setError(err?.message || err || 'Socket error occurred')
      }

      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)
      socket.on('connect_error', handleConnectError)
      socket.on('reconnect_attempt', handleReconnectAttempt)
      socket.on('reconnect_failed', handleReconnectFailed)
      socket.on('error', handleSocketError)
    }

    // Update connection state immediately if already connected
    if (socket.connected && mountedRef.current) {
      setIsConnected(true)
      setError(null)
    }

    // Return cleanup function (but don't disconnect global socket)
    return () => {
      // Component cleanup - don't disconnect global socket
      // It will be reused by other components
    }
  }, [token, options])

  return {
    socket: globalSocket,
    isConnected,
    error,
    connectionAttempt,
  }
}

/**
 * Hook for subscribing to socket events
 * Automatically handles event listener cleanup
 */
export function useSocketEvent(socket, eventName, handler, dependencies = []) {
  useEffect(() => {
    if (!socket || !handler) {
      return
    }

    socket.on(eventName, handler)

    return () => {
      socket.off(eventName, handler)
    }
  }, [socket, eventName, handler, ...dependencies])
}

/**
 * Globally disconnect socket (use with caution)
 * Only call this when user logs out
 */
export function disconnectGlobalSocket() {
  if (globalSocket) {
    console.log('[Socket] Disconnecting global socket')
    globalSocket.off()
    globalSocket.disconnect()
    globalSocket = null
    socketToken = null
    socketScope = null
    socketInitialized = false
    handlersRegistered = false
  }
}
