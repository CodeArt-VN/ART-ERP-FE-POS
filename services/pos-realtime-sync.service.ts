import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { POSAdvancedSyncService } from './pos-advanced-sync.service';
import { POS_Order } from '../interface.model';

export interface RealtimeSyncEvent {
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_DELETED' | 'SYNC_STATUS_CHANGED';
  orderCode?: string;
  data?: any;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class POSRealtimeSyncService {
  private readonly WEBSOCKET_URL = 'wss://api.example.com/pos-sync';
  private readonly RECONNECT_DELAY = 5000;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  // WebSocket connection
  private webSocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;

  // Observables
  private readonly connectionStatus$ = new BehaviorSubject<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>('DISCONNECTED');
  private readonly realtimeEvents$ = new Subject<RealtimeSyncEvent>();
  private readonly incomingMessages$ = new Subject<WebSocketMessage>();

  // Message queue for when disconnected
  private messageQueue: WebSocketMessage[] = [];

  constructor(
    private advancedSyncService: POSAdvancedSyncService
  ) {
    console.log('🚀 POSRealtimeSyncService: Constructor initialized');
    this.initializeRealtimeSync();
  }

  /**
   * Initialize real-time sync system
   */
  private initializeRealtimeSync(): void {
    console.log('🔧 POSRealtimeSyncService: Initializing realtime sync...');
    this.connect();
    this.setupMessageHandlers();
    this.setupAutoReconnect();

    console.log('🔄 Real-time sync service initialized');
  }

  /**
   * Connect to WebSocket
   */
  private connect(): void {
    console.log('🔌 POSRealtimeSyncService: Attempting to connect to WebSocket', {
      isConnecting: this.isConnecting,
      currentState: this.webSocket?.readyState,
      attempts: this.reconnectAttempts
    });
    
    if (this.isConnecting || this.webSocket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    this.connectionStatus$.next('CONNECTING');

    try {
      // For demo purposes, simulate WebSocket connection
      this.simulateWebSocketConnection();
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Simulate WebSocket connection for demo
   */
  private simulateWebSocketConnection(): void {
    console.log('🔗 Simulating WebSocket connection...');
    
    // Simulate connection delay
    setTimeout(() => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.connectionStatus$.next('CONNECTED');
      
      console.log('✅ WebSocket connected (simulated)');
      
      // Process queued messages
      this.processMessageQueue();
      
      // Start sending periodic heartbeat
      this.startHeartbeat();
      
    }, 1000 + Math.random() * 2000);
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.incomingMessages$.subscribe(message => {
      this.handleIncomingMessage(message);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleIncomingMessage(message: WebSocketMessage): void {
    console.log('📨 Received message:', message.type);

    switch (message.type) {
      case 'ORDER_SYNC_REQUEST':
        this.handleOrderSyncRequest(message.payload);
        break;
        
      case 'CONFLICT_DETECTED':
        this.handleConflictDetected(message.payload);
        break;
        
      case 'SYNC_COMPLETE':
        this.handleSyncComplete(message.payload);
        break;
        
      case 'SERVER_ORDER_UPDATED':
        this.handleServerOrderUpdated(message.payload);
        break;

      default:
        console.log('🤷 Unknown message type:', message.type);
    }
  }

  /**
   * Handle order sync request from server
   */
  private async handleOrderSyncRequest(payload: any): Promise<void> {
    console.log('🔄 Server requesting sync for orders:', payload.orderCodes);
    
    // Emit event để POSOrderService có thể handle
    this.realtimeEvents$.next({
      type: 'SYNC_STATUS_CHANGED',
      data: { 
        status: 'SERVER_SYNC_REQUEST', 
        orderCodes: payload.orderCodes 
      },
      timestamp: new Date()
    });
    
    // Trigger sync via advanced sync service
    this.advancedSyncService.triggerSync('SERVER_REQUEST');
  }

  /**
   * Handle conflict detection from server
   */
  private handleConflictDetected(payload: any): void {
    console.log('⚠️ Conflict detected:', payload);
    
    this.realtimeEvents$.next({
      type: 'SYNC_STATUS_CHANGED',
      data: { status: 'CONFLICT', conflicts: payload.conflicts },
      timestamp: new Date()
    });
  }

  /**
   * Handle sync completion notification
   */
  private handleSyncComplete(payload: any): void {
    console.log('✅ Sync completed:', payload);
    
    this.realtimeEvents$.next({
      type: 'SYNC_STATUS_CHANGED',
      data: { status: 'COMPLETED', result: payload },
      timestamp: new Date()
    });
  }

  /**
   * Handle server order updates
   */
  private async handleServerOrderUpdated(payload: any): Promise<void> {
    console.log('📝 Server order updated:', payload.orderCode);
    
    // Emit event để POSOrderService có thể handle
    this.realtimeEvents$.next({
      type: 'SYNC_STATUS_CHANGED',
      data: { 
        status: 'SERVER_ORDER_UPDATED', 
        orderCode: payload.orderCode 
      },
      timestamp: new Date()
    });
  }

  /**
   * Broadcast order sync to connected clients
   */
  private broadcastOrderSync(): void {
    if (this.connectionStatus$.value === 'CONNECTED') {
      const message: WebSocketMessage = {
        type: 'CLIENT_ORDERS_CHANGED',
        payload: { timestamp: Date.now() },
        timestamp: Date.now()
      };
      
      this.sendMessage(message);
    }
  }

  /**
   * Send message via WebSocket
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.connectionStatus$.value === 'CONNECTED') {
      // In real implementation, this would use this.webSocket.send()
      console.log('📤 Sending message:', message.type);
      
      // Simulate message sending
      this.simulateMessageSent(message);
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      console.log('📝 Message queued:', message.type);
    }
  }

  /**
   * Simulate message sending for demo
   */
  private simulateMessageSent(message: WebSocketMessage): void {
    // Simulate network delay and possible server responses
    setTimeout(() => {
      // Simulate server acknowledgment
      if (Math.random() > 0.1) { // 90% success rate
        console.log('✅ Message sent successfully:', message.type);
      } else {
        console.log('❌ Message send failed:', message.type);
        this.messageQueue.push(message); // Re-queue failed message
      }
    }, 50 + Math.random() * 100);
  }

  /**
   * Process queued messages when connection is restored
   */
  private processMessageQueue(): void {
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => {
      this.sendMessage(message);
    });
  }

  /**
   * Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    setInterval(() => {
      if (this.connectionStatus$.value === 'CONNECTED') {
        this.sendMessage({
          type: 'HEARTBEAT',
          payload: { timestamp: Date.now() },
          timestamp: Date.now()
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup auto-reconnect mechanism
   */
  private setupAutoReconnect(): void {
    // Monitor connection status and auto-reconnect
    this.connectionStatus$.subscribe(status => {
      if (status === 'DISCONNECTED' && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          console.log(`🔄 Attempting reconnection (${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
          this.reconnectAttempts++;
          this.connect();
        }, this.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts)); // Exponential backoff
      }
    });
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(): void {
    this.isConnecting = false;
    this.connectionStatus$.next('DISCONNECTED');
    
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached. Switching to offline mode.');
    }
  }

  /**
   * Manually trigger reconnection
   */
  reconnect(): void {
    this.reconnectAttempts = 0;
    this.connect();
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    this.connectionStatus$.next('DISCONNECTED');
    console.log('🔌 WebSocket disconnected');
  }

  /**
   * Send order update notification
   */
  notifyOrderUpdate(order: POS_Order, operation: 'CREATE' | 'UPDATE' | 'DELETE'): void {
    const message: WebSocketMessage = {
      type: 'ORDER_OPERATION',
      payload: {
        operation,
        orderCode: order.Code,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
    
    this.realtimeEvents$.next({
      type: operation === 'CREATE' ? 'ORDER_CREATED' : 
            operation === 'UPDATE' ? 'ORDER_UPDATED' : 'ORDER_DELETED',
      orderCode: order.Code,
      data: order,
      timestamp: new Date()
    });
  }

  /**
   * Request server sync for specific order
   */
  requestServerSync(orderCode: string): void {
    const message: WebSocketMessage = {
      type: 'REQUEST_ORDER_SYNC',
      payload: { orderCode },
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
  }

  // ========================
  // PUBLIC API
  // ========================

  /**
   * Get connection status observable
   */
  get connectionStatus(): Observable<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Get realtime events observable
   */
  get realtimeEvents(): Observable<RealtimeSyncEvent> {
    return this.realtimeEvents$.asObservable();
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.connectionStatus$.value === 'CONNECTED';
  }

  /**
   * Get queued messages count
   */
  getQueuedMessagesCount(): number {
    return this.messageQueue.length;
  }

  /**
   * Force sync all orders
   */
  forceSyncAll(): void {
    this.sendMessage({
      type: 'FORCE_SYNC_ALL',
      payload: { timestamp: Date.now() },
      timestamp: Date.now()
    });
    
    this.advancedSyncService.triggerSync('FORCE_SYNC_ALL');
  }

  /**
   * Public method to broadcast order sync (called by POSOrderService)
   */
  public triggerOrderSync(): void {
    this.broadcastOrderSync();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    console.log('🛑 Real-time sync service destroyed');
  }
}
