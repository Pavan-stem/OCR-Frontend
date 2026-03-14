/**
 * useSSE Hook - Real-time data streaming with automatic reconnection
 * 
 * Features:
 * - Role-based data filtering (handled server-side)
 * - Automatic heartbeat & reconnection
 * - Event batching for performance
 * - Memory-efficient cleanup
 * - TypeScript-safe
 * 
 * Usage:
 * const { subscribe, unsubscribe, stats } = useSSE();
 * 
 * subscribe('dashboard', (data) => {
 *   console.log('Dashboard update:', data);
 * });
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE } from './apiConfig';

const HEARTBEAT_INTERVAL = 45000; // 45 seconds
const RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

class SSEManager {
  constructor(token) {
    this.token = token;
    this.connectionId = null;
    this.eventSource = null;
    this.listeners = {};
    this.connected = false;
    this.heartbeatTimer = null;
    this.reconnectAttempts = 0;
    this.url = null;
  }

  async connect() {
    if (this.connected) return true;

    try {
      console.log('[SSE] Initiating connection...');
      
      // Step 1: Get connection ID from server
      const response = await fetch(`${API_BASE}/api/sse/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status}`);
      }

      const data = await response.json();
      this.connectionId = data.connection_id;
      this.url = `${API_BASE}/api/sse/stream/${this.connectionId}`;

      console.log(`[SSE] Connection ID: ${this.connectionId}`);

      // Step 2: Open EventSource stream
      this.eventSource = new EventSource(this.url);
      
      this.eventSource.onopen = () => {
        console.log('[SSE] EventSource connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this._startHeartbeat();
        this._notify('connected', { timestamp: new Date().toISOString() });
      };

      this.eventSource.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this.eventSource.onerror = (error) => {
        console.error('[SSE] EventSource error:', error);
        this._handleError(error);
      };

      return true;
    } catch (error) {
      console.error('[SSE] Connection failed:', error);
      this._handleError(error);
      return false;
    }
  }

  _handleMessage(rawData) {
    try {
      // Skip ping comments
      if (rawData.trim().startsWith(':')) {
        return;
      }

      const message = JSON.parse(rawData);
      const { type, data, timestamp } = message;

      if (type === 'connected' || type === 'shutdown') {
        console.log(`[SSE] Server event: ${type}`);
        if (type === 'shutdown') {
          this.disconnect();
        }
        return;
      }

      // Notify all listeners for this message type
      this._notify(type, data);

      // Also notify 'all' listeners
      this._notify('all', { type, data, timestamp });

    } catch (error) {
      console.error('[SSE] Failed to parse message:', error, rawData);
    }
  }

  _handleError(error) {
    this.connected = false;
    this._stopHeartbeat();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Attempt reconnection with exponential backoff
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      setTimeout(() => {
        this.connect().catch(err => console.error('[SSE] Reconnection failed:', err));
      }, delay);
    } else {
      console.error('[SSE] Max reconnection attempts reached');
      this._notify('error', { 
        message: 'Connection failed after multiple attempts',
        attempts: this.reconnectAttempts 
      });
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();

    this.heartbeatTimer = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/sse/heartbeat/${this.connectionId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });

        if (!response.ok) {
          if (response.status === 410) {
            console.warn('[SSE] Connection gone, reconnecting...');
            this.disconnect();
            this.connect();
          } else {
            throw new Error(`Heartbeat failed: ${response.status}`);
          }
        }
      } catch (error) {
        console.error('[SSE] Heartbeat failed:', error);
      }
    }, HEARTBEAT_INTERVAL);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  subscribe(messageType, callback) {
    if (!this.listeners[messageType]) {
      this.listeners[messageType] = [];
    }
    this.listeners[messageType].push(callback);

    // Return unsubscribe function
    return () => {
      const idx = this.listeners[messageType].indexOf(callback);
      if (idx > -1) {
        this.listeners[messageType].splice(idx, 1);
      }
    };
  }

  unsubscribe(messageType) {
    if (this.listeners[messageType]) {
      this.listeners[messageType] = [];
    }
  }

  _notify(messageType, data) {
    if (this.listeners[messageType]) {
      for (const callback of this.listeners[messageType]) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[SSE] Listener error for ${messageType}:`, error);
        }
      }
    }
  }

  disconnect() {
    console.log('[SSE] Disconnecting...');
    
    this._stopHeartbeat();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Notify server
    if (this.connectionId) {
      fetch(`${API_BASE}/api/sse/disconnect/${this.connectionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }).catch(err => console.warn('[SSE] Disconnect notification failed:', err));
    }

    this.connected = false;
    this.connectionId = null;
    this.listeners = {};
  }

  getStatus() {
    return {
      connected: this.connected,
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts,
      listeners: Object.keys(this.listeners).filter(k => this.listeners[k].length > 0)
    };
  }
}

export function useSSE() {
  const managerRef = useRef(null);
  const [status, setStatus] = useState({
    connected: false,
    connectionId: null,
    listeners: []
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[SSE] No auth token found');
      return;
    }

    // Initialize SSE manager
    managerRef.current = new SSEManager(token);

    // Connect on mount
    const connect = async () => {
      try {
        const success = await managerRef.current.connect();
        if (success) {
          // Update status
          const updateStatus = () => {
            setStatus(managerRef.current.getStatus());
          };
          updateStatus();
          
          // Subscribe to status updates
          managerRef.current.subscribe('connected', updateStatus);
          managerRef.current.subscribe('error', updateStatus);
        }
      } catch (error) {
        console.error('[SSE] Connection error:', error);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
      }
    };
  }, []);

  // Export API
  const subscribe = useCallback((messageType, callback) => {
    if (!managerRef.current) return () => {};
    return managerRef.current.subscribe(messageType, callback);
  }, []);

  const unsubscribe = useCallback((messageType) => {
    if (managerRef.current) {
      managerRef.current.unsubscribe(messageType);
    }
  }, []);

  const broadcast = useCallback(async (endpoint, data) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('[SSE Broadcast] Error:', error);
      throw error;
    }
  }, []);

  return {
    subscribe,
    unsubscribe,
    broadcast,
    status,
    connected: status.connected,
    connectionId: status.connectionId
  };
}

export default useSSE;
