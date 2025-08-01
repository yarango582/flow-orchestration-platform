/**
 * Real-time Service
 * Handles WebSocket connections for real-time updates on executions and system status
 */

import { ExecutionStatus, JobStats } from '@/types/api'

export interface ExecutionUpdate {
  executionId: string
  status: ExecutionStatus
  progress?: number
  currentNode?: string
  recordsProcessed?: number
  message?: string
  timestamp: string
}

export interface SystemUpdate {
  type: 'job_stats' | 'system_health' | 'schedule_change'
  data: any
  timestamp: string
}

export type RealtimeEventHandler = (event: ExecutionUpdate | SystemUpdate) => void

export class RealtimeService {
  private ws: WebSocket | null = null
  private listeners: Map<string, RealtimeEventHandler[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(
    private wsUrl: string = import.meta.env.VITE_WS_URL || 'ws://localhost:3002/ws'
  ) {}

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          this.startHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          this.stopHeartbeat()
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`WebSocket closed, attempting reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)
            setTimeout(() => {
              this.reconnectAttempts++
              this.connect()
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts))
          } else {
            console.log('WebSocket connection closed')
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.listeners.clear()
  }

  /**
   * Subscribe to execution updates
   */
  subscribeToExecution(executionId: string, handler: RealtimeEventHandler) {
    this.subscribe(`execution:${executionId}`, handler)
    
    // Send subscription message to server
    this.send({
      type: 'subscribe',
      channel: 'execution',
      executionId
    })
  }

  /**
   * Unsubscribe from execution updates
   */
  unsubscribeFromExecution(executionId: string, handler?: RealtimeEventHandler) {
    this.unsubscribe(`execution:${executionId}`, handler)
    
    // Send unsubscription message to server
    this.send({
      type: 'unsubscribe',
      channel: 'execution',
      executionId
    })
  }

  /**
   * Subscribe to system updates (job stats, health, etc.)
   */
  subscribeToSystemUpdates(handler: RealtimeEventHandler) {
    this.subscribe('system', handler)
    
    this.send({
      type: 'subscribe',
      channel: 'system'
    })
  }

  /**
   * Unsubscribe from system updates
   */
  unsubscribeFromSystemUpdates(handler?: RealtimeEventHandler) {
    this.unsubscribe('system', handler)
    
    this.send({
      type: 'unsubscribe',
      channel: 'system'
    })
  }

  /**
   * Subscribe to all running executions
   */
  subscribeToAllExecutions(handler: RealtimeEventHandler) {
    this.subscribe('executions:all', handler)
    
    this.send({
      type: 'subscribe',
      channel: 'executions'
    })
  }

  /**
   * Unsubscribe from all executions
   */
  unsubscribeFromAllExecutions(handler?: RealtimeEventHandler) {
    this.unsubscribe('executions:all', handler)
    
    this.send({
      type: 'unsubscribe',
      channel: 'executions'
    })
  }

  /**
   * Generic subscribe method
   */
  private subscribe(channel: string, handler: RealtimeEventHandler) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, [])
    }
    this.listeners.get(channel)!.push(handler)
  }

  /**
   * Generic unsubscribe method
   */
  private unsubscribe(channel: string, handler?: RealtimeEventHandler) {
    const channelListeners = this.listeners.get(channel)
    if (!channelListeners) return

    if (handler) {
      const index = channelListeners.indexOf(handler)
      if (index > -1) {
        channelListeners.splice(index, 1)
      }
    } else {
      // Remove all listeners for this channel
      this.listeners.delete(channel)
    }
  }

  /**
   * Send message to WebSocket server
   */
  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any) {
    const { type, channel, executionId, ...payload } = data

    switch (type) {
      case 'execution_update':
        const executionUpdate: ExecutionUpdate = {
          executionId: executionId || payload.executionId,
          status: payload.status,
          progress: payload.progress,
          currentNode: payload.currentNode,
          recordsProcessed: payload.recordsProcessed,
          message: payload.message,
          timestamp: payload.timestamp || new Date().toISOString()
        }
        
        // Notify specific execution listeners
        this.notifyListeners(`execution:${executionUpdate.executionId}`, executionUpdate)
        // Notify all executions listeners
        this.notifyListeners('executions:all', executionUpdate)
        break

      case 'system_update':
        const systemUpdate: SystemUpdate = {
          type: payload.updateType || 'system_health',
          data: payload.data || payload,
          timestamp: payload.timestamp || new Date().toISOString()
        }
        
        this.notifyListeners('system', systemUpdate)
        break

      case 'job_stats':
        const jobStatsUpdate: SystemUpdate = {
          type: 'job_stats',
          data: payload,
          timestamp: new Date().toISOString()
        }
        
        this.notifyListeners('system', jobStatsUpdate)
        break

      case 'pong':
        // Heartbeat response - no action needed
        break

      default:
        console.log('Unknown WebSocket message type:', type)
    }
  }

  /**
   * Notify listeners of a specific channel
   */
  private notifyListeners(channel: string, event: ExecutionUpdate | SystemUpdate) {
    const channelListeners = this.listeners.get(channel)
    if (channelListeners) {
      channelListeners.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error('Error in WebSocket event handler:', error)
        }
      })
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' })
    }, 30000) // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * Get connection state
   */
  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'open'
      case WebSocket.CLOSING: return 'closing'
      case WebSocket.CLOSED: return 'closed'
      default: return 'closed'
    }
  }
}

// Singleton instance
export const realtimeService = new RealtimeService()

// Auto-connect on import in production
if (import.meta.env.PROD) {
  realtimeService.connect().catch(error => {
    console.warn('Failed to establish WebSocket connection:', error)
  })
}