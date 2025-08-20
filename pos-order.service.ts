import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';
import { EnvService } from '../../services/core/env.service';
import { POS_Order, POS_OrderDetail } from './interface.model';
import { lib } from '../../services/static/global-functions';
import { POSSecurityService } from './services/pos-security.service';
import { POSAdvancedSyncService } from './services/pos-advanced-sync.service';
import { POSRealtimeSyncService } from './services/pos-realtime-sync.service';

export interface StorageOrderData {
  orders: POS_Order[];
  lastUpdated: string;
  version: string;
}

export interface OrderOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  orderCode: string;
  timestamp: number;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class POSOrderService {
  private readonly STORAGE_KEY = 'pos_orders';
  private readonly ORDER_PREFIX = 'pos_order_';
  private readonly VERSION = '1.0';
  
  // Performance constants
  private readonly CHUNK_SIZE = 50; // Orders per chunk
  private readonly MAX_CACHE_SIZE = 200; // LRU cache limit
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  
  // Reactive state management
  private _orders = new BehaviorSubject<POS_Order[]>([]);
  private _currentOrder = new BehaviorSubject<POS_Order | null>(null);
  private _isDirty = new BehaviorSubject<boolean>(false);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _syncStatus = new BehaviorSubject<'idle' | 'syncing' | 'error'>('idle');
  
  // Performance tracking
  private _loadingProgress = new BehaviorSubject<{ loaded: number; total: number; percentage: number }>({ loaded: 0, total: 0, percentage: 0 });
  private _isStreamingLoad = new BehaviorSubject<boolean>(false);

  // Public observables
  public readonly orders$ = this._orders.asObservable();
  public readonly currentOrder$ = this._currentOrder.asObservable();
  public readonly isDirty$ = this._isDirty.asObservable();
  public readonly isLoading$ = this._isLoading.asObservable();
  public readonly syncStatus$ = this._syncStatus.asObservable();
  
  // Performance observables
  public readonly loadingProgress$ = this._loadingProgress.asObservable();
  public readonly isStreamingLoad$ = this._isStreamingLoad.asObservable();

  // LRU Cache for performance
  private orderCache = new Map<string, { order: POS_Order; timestamp: number; hits: number }>();
  private orderIndex = new Map<string, number>(); // Code -> Array index
  private dateIndex = new Map<string, string[]>(); // Date -> Order codes
  
  // Cache statistics
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(
    public env: EnvService,
    private posSecurityService: POSSecurityService,
    private advancedSyncService: POSAdvancedSyncService,
    private realtimeSyncService: POSRealtimeSyncService
  ) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadOrdersFromStorage();
    this.setupAutoCleanup();
    this.setupRealtimeEventHandlers();
  }

  /**
   * Setup realtime event handlers to avoid circular dependency
   */
  private setupRealtimeEventHandlers(): void {
    // Listen to realtime events from sync service
    this.realtimeSyncService.realtimeEvents.subscribe(event => {
      this.handleRealtimeEvent(event);
    });

    // Listen to orders changes and broadcast to realtime sync
    this.orders$.subscribe(orders => {
      this.broadcastOrderChanges();
    });
  }

  /**
   * Handle realtime sync events
   */
  private async handleRealtimeEvent(event: any): Promise<void> {
    if (event.type === 'SYNC_STATUS_CHANGED') {
      const { status, orderCodes, orderCode } = event.data;
      
      if (status === 'SERVER_SYNC_REQUEST' && orderCodes) {
        // Handle server sync request
        for (const code of orderCodes) {
          const order = await this.getOrder(code);
          if (order) {
            this.advancedSyncService.addToSyncQueue(order, 'UPDATE', 'HIGH');
          }
        }
      } else if (status === 'SERVER_ORDER_UPDATED' && orderCode) {
        // Handle server order update
        const order = await this.getOrder(orderCode);
        if (order) {
          this.advancedSyncService.addToSyncQueue(order, 'UPDATE', 'MEDIUM');
        }
      }
    }
  }

  /**
   * Broadcast order changes to realtime sync
   */
  private broadcastOrderChanges(): void {
    // Use a simple method call instead of dependency injection
    if (this.realtimeSyncService && typeof this.realtimeSyncService.triggerOrderSync === 'function') {
      this.realtimeSyncService.triggerOrderSync();
    }
  }

  // ========================
  // CRUD Operations
  // ========================

  /**
   * Create a new order with unique Code tracking
   */
  async createOrder(orderData: Partial<POS_Order>): Promise<POS_Order> {
    this._isLoading.next(true);
    
    try {
      const order: POS_Order = {
        Id: 0, // Will be set by server
        Code: this.generateOrderCode(),
        Status: 'New',
        OrderDate: new Date(),
        ModifiedDate: new Date(),
        CreatedDate: new Date(),
        IDBranch: this.env.selectedBranch,
        IDContact: orderData.IDContact || null,
        IDAddress: orderData.IDAddress || null,
        OrderLines: [],
        TotalBeforeDiscount: 0,
        TotalDiscount: 0,
        TotalAfterDiscount: 0,
        Tax: 0,
        TotalAfterTax: 0,
        IsDeleted: false,
        ...orderData
      };

      // Generate codes for order lines
      if (order.OrderLines) {
        order.OrderLines = order.OrderLines.map(line => ({
          ...line,
          Code: line.Code || this.generateOrderLineCode(),
          IDOrder: order.Id || 0
        }));
      }

      // Calculate totals
      const calculatedOrder = this.calcOrder(order);

      // Save to storage
      await this.saveOrderToStorage(calculatedOrder);
      
      // Update reactive state
      const currentOrders = this._orders.value;
      const updatedOrders = [...currentOrders, calculatedOrder];
      this._orders.next(updatedOrders);
      this._currentOrder.next(calculatedOrder);
      this._isDirty.next(false);

      // Update indexes
      this.updateIndexes(calculatedOrder);
      
      // Add to sync queue with HIGH priority for new orders
      this.advancedSyncService.addToSyncQueue(calculatedOrder, 'CREATE', 'HIGH');
      
      // Notify realtime sync
      this.realtimeSyncService.notifyOrderUpdate(calculatedOrder, 'CREATE');
      
      console.log('✅ Order created:', calculatedOrder.Code);
      return calculatedOrder;
      
    } catch (error) {
      console.error('❌ Failed to create order:', error);
      throw error;
    } finally {
      this._isLoading.next(false);
    }
  }

  /**
   * Update existing order by Code
   */
  async updateOrder(code: string, changes: Partial<POS_Order>): Promise<POS_Order> {
    this._isLoading.next(true);
    
    try {
      const existingOrder = await this.getOrder(code);
      if (!existingOrder) {
        throw new Error(`Order not found: ${code}`);
      }

      // Merge changes
      const updatedOrder: POS_Order = {
        ...existingOrder,
        ...changes,
        Code: existingOrder.Code, // Prevent code changes
        ModifiedDate: new Date()
      };

      // Update order line codes if needed
      if (changes.OrderLines) {
        updatedOrder.OrderLines = changes.OrderLines.map(line => ({
          ...line,
          Code: line.Code || this.generateOrderLineCode(),
          IDOrder: updatedOrder.Id || 0
        }));
      }

      // Recalculate totals
      const calculatedOrder = this.calcOrder(updatedOrder);

      // Save to storage
      await this.saveOrderToStorage(calculatedOrder);
      
      // Update reactive state
      const currentOrders = this._orders.value;
      const orderIndex = currentOrders.findIndex(o => o.Code === code);
      if (orderIndex >= 0) {
        currentOrders[orderIndex] = calculatedOrder;
        this._orders.next([...currentOrders]);
      }
      
      // Update current order if it's the one being edited
      const currentOrder = this._currentOrder.value;
      if (currentOrder?.Code === code) {
        this._currentOrder.next(calculatedOrder);
      }
      
      this._isDirty.next(true);
      
      // Add to sync queue with MEDIUM priority for updates
      this.advancedSyncService.addToSyncQueue(calculatedOrder, 'UPDATE', 'MEDIUM');
      
      // Notify realtime sync
      this.realtimeSyncService.notifyOrderUpdate(calculatedOrder, 'UPDATE');
      
      console.log('✅ Order updated:', code);
      return calculatedOrder;
      
    } catch (error) {
      console.error('❌ Failed to update order:', error);
      throw error;
    } finally {
      this._isLoading.next(false);
    }
  }

  /**
   * Get order by Code
   */
  async getOrder(code: string): Promise<POS_Order | null> {
    try {
      // Check cache first with LRU logic
      if (this.orderCache.has(code)) {
        const cached = this.orderCache.get(code)!;
        // Update access statistics
        cached.hits++;
        cached.timestamp = Date.now();
        this.cacheStats.hits++;
        return cached.order;
      }

      this.cacheStats.misses++;

      // Load from storage
      const orderData = await this.env.getStorage(this.ORDER_PREFIX + code);
      if (orderData) {
        const order = JSON.parse(orderData) as POS_Order;
        // Store in cache with metadata
        this.addToCache(code, order);
        return order;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get order:', error);
      return null;
    }
  }

  /**
   * Add order to LRU cache with eviction
   */
  private addToCache(code: string, order: POS_Order): void {
    // Check cache size and evict if necessary
    if (this.orderCache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }

    this.orderCache.set(code, {
      order,
      timestamp: Date.now(),
      hits: 1
    });
  }

  /**
   * Evict least recently used item from cache
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, value] of this.orderCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.orderCache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
  }

  /**
   * Get all orders from storage
   */
  async getAllOrders(): Promise<POS_Order[]> {
    this._isLoading.next(true);
    
    try {
      const storageData = await this.env.getStorage(this.STORAGE_KEY);
      if (!storageData) {
        return [];
      }

      const data: StorageOrderData = JSON.parse(storageData);
      return data.orders || [];
      
    } catch (error) {
      console.error('❌ Failed to get all orders:', error);
      return [];
    } finally {
      this._isLoading.next(false);
    }
  }

  /**
   * Delete order by Code
   */
  async deleteOrder(code: string): Promise<boolean> {
    this._isLoading.next(true);
    
    try {
      // Remove from storage using setStorage with null
      await this.env.setStorage(this.ORDER_PREFIX + code, null);
      
      // Update reactive state
      const currentOrders = this._orders.value;
      const filteredOrders = currentOrders.filter(o => o.Code !== code);
      this._orders.next(filteredOrders);
      
      // Clear current order if it was deleted
      const currentOrder = this._currentOrder.value;
      if (currentOrder?.Code === code) {
        this._currentOrder.next(null);
      }
      
      // Remove from cache and indexes
      this.orderCache.delete(code);
      this.removeFromIndexes(code);
      
      // Update main storage
      await this.saveOrdersToMainStorage(filteredOrders);
      
      // Add to sync queue with HIGH priority for deletes (need immediate sync)
      const orderToDelete: POS_Order = currentOrders.find(o => o.Code === code) as POS_Order;
      if (orderToDelete) {
        this.advancedSyncService.addToSyncQueue(orderToDelete, 'DELETE', 'HIGH');
        
        // Notify realtime sync
        this.realtimeSyncService.notifyOrderUpdate(orderToDelete, 'DELETE');
      }
      
      console.log('✅ Order deleted:', code);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to delete order:', error);
      return false;
    } finally {
      this._isLoading.next(false);
    }
  }

  // ========================
  // Business Logic Methods
  // ========================

  /**
   * Calculate order totals and taxes
   */
  private calcOrder(order: POS_Order): POS_Order {
    if (!order.OrderLines || order.OrderLines.length === 0) {
      return {
        ...order,
        TotalBeforeDiscount: 0,
        TotalDiscount: 0,
        TotalAfterDiscount: 0,
        Tax: 0,
        TotalAfterTax: 0
      };
    }

    // Calculate line totals
    const calculatedLines = order.OrderLines.map(line => this.calcOrderLine(line));
    
    // Calculate order totals
    const totalBeforeDiscount = calculatedLines.reduce((sum, line) => sum + (line.TotalAfterDiscount || 0), 0);
    const totalLineDiscount = calculatedLines.reduce((sum, line) => sum + (line.TotalDiscount || 0), 0);
    
    // Apply order-level discount
    const orderDiscountAmount = order.DiscountFromSalesman || 0;
    const totalAfterDiscount = totalBeforeDiscount - orderDiscountAmount;
    
    // Calculate tax
    const taxRate = 0.1; // 10% VAT - should be configurable
    const tax = totalAfterDiscount * taxRate;
    const totalAfterTax = totalAfterDiscount + tax;
    
    return {
      ...order,
      OrderLines: calculatedLines,
      TotalBeforeDiscount: totalBeforeDiscount,
      TotalDiscount: totalLineDiscount + orderDiscountAmount,
      TotalAfterDiscount: totalAfterDiscount,
      Tax: tax,
      TotalAfterTax: totalAfterTax
    };
  }

  /**
   * Calculate individual order line totals
   */
  private calcOrderLine(line: POS_OrderDetail): POS_OrderDetail {
    const quantity = line.Quantity || 0;
    const unitPrice = line.UoMPrice || 0; // Use UoMPrice from SALE_OrderDetail
    const subtotal = quantity * unitPrice;
    
    // Apply line discount - using existing discount fields
    const totalDiscount = line.TotalDiscount || 0;
    const totalAfterDiscount = subtotal - totalDiscount;
    
    return {
      ...line,
      TotalBeforeDiscount: subtotal,
      TotalAfterDiscount: Math.max(0, totalAfterDiscount)
    };
  }

  // ========================
  // Utility Methods
  // ========================

  /**
   * Generate unique order code
   */
  private generateOrderCode(): string {
    const prefix = 'ORD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = lib.generateUID().substring(0, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Generate unique order line code
   */
  private generateOrderLineCode(): string {
    const prefix = 'ORL';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = lib.generateUID().substring(0, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // ========================
  // Storage Operations
  // ========================

  private async loadOrdersFromStorage(): Promise<void> {
    try {
      const orders = await this.getAllOrders();
      this._orders.next(orders);
      
      // Build indexes
      orders.forEach(order => this.updateIndexes(order));
      
      console.log('✅ Orders loaded from storage:', orders.length);
    } catch (error) {
      console.error('❌ Failed to load orders:', error);
    }
  }

  private async saveOrderToStorage(order: POS_Order): Promise<void> {
    try {
      // Save individual order
      const orderJson = JSON.stringify(order);
      await this.env.setStorage(this.ORDER_PREFIX + order.Code, orderJson);
      
      // Update cache using proper method
      this.addToCache(order.Code, order);
      
      // Update main storage
      const allOrders = this._orders.value;
      const existingIndex = allOrders.findIndex(o => o.Code === order.Code);
      
      let updatedOrders: POS_Order[];
      if (existingIndex >= 0) {
        updatedOrders = [...allOrders];
        updatedOrders[existingIndex] = order;
      } else {
        updatedOrders = [...allOrders, order];
      }
      
      await this.saveOrdersToMainStorage(updatedOrders);
      
    } catch (error) {
      console.error('❌ Failed to save order:', error);
      throw error;
    }
  }

  private async saveOrdersToMainStorage(orders: POS_Order[]): Promise<void> {
    try {
      const storageData: StorageOrderData = {
        orders,
        lastUpdated: new Date().toISOString(),
        version: this.VERSION
      };
      
      const dataJson = JSON.stringify(storageData);
      await this.env.setStorage(this.STORAGE_KEY, dataJson);
      
    } catch (error) {
      console.error('❌ Failed to save orders to main storage:', error);
      throw error;
    }
  }

  // ========================
  // Indexing & Performance
  // ========================

  private updateIndexes(order: POS_Order): void {
    // Update order index
    const orders = this._orders.value;
    const index = orders.findIndex(o => o.Code === order.Code);
    if (index >= 0) {
      this.orderIndex.set(order.Code, index);
    }
    
    // Update date index
    const orderDate = new Date(order.OrderDate).toDateString();
    if (!this.dateIndex.has(orderDate)) {
      this.dateIndex.set(orderDate, []);
    }
    const dateOrders = this.dateIndex.get(orderDate)!;
    if (!dateOrders.includes(order.Code)) {
      dateOrders.push(order.Code);
    }
  }

  private removeFromIndexes(code: string): void {
    this.orderIndex.delete(code);
    
    // Remove from date index
    for (const [date, orders] of this.dateIndex.entries()) {
      const index = orders.indexOf(code);
      if (index >= 0) {
        orders.splice(index, 1);
        if (orders.length === 0) {
          this.dateIndex.delete(date);
        }
        break;
      }
    }
  }

  // ========================
  // Cleanup & Maintenance
  // ========================

  private setupAutoCleanup(): void {
    // Clean up settled orders older than 1 day
    const cleanupInterval = 4 * 60 * 60 * 1000; // 4 hours
    
    setInterval(() => {
      this.cleanupOldOrders(1); // Clean orders older than 1 day
    }, cleanupInterval);
  }

  // ========================
  // Public Utility Methods
  // ========================

  /**
   * Set current active order
   */
  setCurrentOrder(code: string): void {
    this.getOrder(code).then(order => {
      this._currentOrder.next(order);
    });
  }

  /**
   * Get orders by date range
   */
  async getOrdersByDateRange(from: Date, to: Date): Promise<POS_Order[]> {
    const allOrders = await this.getAllOrders();
    return allOrders.filter(order => {
      const orderDate = new Date(order.OrderDate);
      return orderDate >= from && orderDate <= to;
    });
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: string): Promise<POS_Order[]> {
    const allOrders = await this.getAllOrders();
    return allOrders.filter(order => order.Status === status);
  }

  /**
   * Clear all orders (for testing/reset)
   */
  async clearAllOrders(): Promise<void> {
    try {
      await this.env.setStorage(this.STORAGE_KEY, null);
      
      // Clear individual order storage
      const orders = this._orders.value;
      for (const order of orders) {
        await this.env.setStorage(this.ORDER_PREFIX + order.Code, null);
      }
      
      // Reset state
      this._orders.next([]);
      this._currentOrder.next(null);
      this._isDirty.next(false);
      
      // Clear caches
      this.orderCache.clear();
      this.orderIndex.clear();
      this.dateIndex.clear();
      
      console.log('✅ All orders cleared');
    } catch (error) {
      console.error('❌ Failed to clear orders:', error);
    }
  }

  // ========================
  // PHASE 2: PERFORMANCE OPTIMIZATION
  // ========================

  /**
   * Get order chunk with pagination support
   */
  async getOrderChunk(offset: number, limit: number = this.CHUNK_SIZE): Promise<POS_Order[]> {
    try {
      const allOrders = await this.getAllOrders();
      const chunk = allOrders.slice(offset, offset + limit);
      
      // Update progress
      this._loadingProgress.next({
        loaded: Math.min(offset + limit, allOrders.length),
        total: allOrders.length,
        percentage: Math.min(100, Math.round(((offset + limit) / allOrders.length) * 100))
      });
      
      return chunk;
    } catch (error) {
      console.error('❌ Failed to get order chunk:', error);
      return [];
    }
  }

  /**
   * Load orders with streaming support
   */
  async loadOrdersStreaming(): Promise<void> {
    this._isLoading.next(true);
    this._isStreamingLoad.next(true);
    
    try {
      const allOrders = await this.getAllOrders();
      const totalOrders = allOrders.length;
      
      if (totalOrders === 0) {
        this._orders.next([]);
        return;
      }

      // Reset progress
      this._loadingProgress.next({ loaded: 0, total: totalOrders, percentage: 0 });
      
      const streamedOrders: POS_Order[] = [];
      let offset = 0;

      while (offset < totalOrders) {
        const chunk = await this.getOrderChunk(offset, this.CHUNK_SIZE);
        streamedOrders.push(...chunk);
        
        // Update orders$ incrementally for real-time UI updates
        this._orders.next([...streamedOrders]);
        
        offset += this.CHUNK_SIZE;
        
        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Final progress update
      this._loadingProgress.next({ loaded: totalOrders, total: totalOrders, percentage: 100 });
      
      console.log(`✅ Streamed ${totalOrders} orders successfully`);
      
    } catch (error) {
      console.error('❌ Failed to load orders streaming:', error);
      throw error;
    } finally {
      this._isLoading.next(false);
      this._isStreamingLoad.next(false);
    }
  }

  /**
   * Cancel streaming load operation
   */
  cancelStreamingLoad(): void {
    this._isStreamingLoad.next(false);
    this._isLoading.next(false);
    console.log('⚠️ Streaming load cancelled');
  }

  /**
   * Get loading progress information
   */
  getLoadingProgress(): { loaded: number; total: number; percentage: number } {
    return this._loadingProgress.value;
  }

  // ========================
  // SHARDING & OPTIMIZATION
  // ========================

  /**
   * Generate storage key with date-based sharding
   */
  private getStorageKey(date: Date, type: 'order' | 'index'): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${type}_${dateStr}`;
  }

  /**
   * Background cleanup of old orders
   */
  async cleanupOldOrders(daysToKeep: number = 30): Promise<void> {
    try {
      console.log('🧹 Starting background cleanup...');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const allOrders = this._orders.value;
      const ordersBefore = allOrders.length;
      
      // Filter orders to keep
      const ordersToKeep = allOrders.filter(order => {
        const orderDate = new Date(order.OrderDate);
        return orderDate >= cutoffDate;
      });
      
      // Get orders to remove
      const ordersToRemove = allOrders.filter(order => {
        const orderDate = new Date(order.OrderDate);
        return orderDate < cutoffDate;
      });
      
      // Remove old orders from storage
      for (const order of ordersToRemove) {
        await this.env.setStorage(this.ORDER_PREFIX + order.Code, null);
        this.orderCache.delete(order.Code);
        this.orderIndex.delete(order.Code);
      }
      
      // Update reactive state
      this._orders.next(ordersToKeep);
      
      // Update main storage
      const storageData: StorageOrderData = {
        orders: ordersToKeep,
        lastUpdated: new Date().toISOString(),
        version: this.VERSION
      };
      
      await this.env.setStorage(this.STORAGE_KEY, JSON.stringify(storageData));
      
      const removedCount = ordersBefore - ordersToKeep.length;
      console.log(`✅ Cleanup complete: Removed ${removedCount} old orders (older than ${daysToKeep} days)`);
      
    } catch (error) {
      console.error('❌ Failed to cleanup old orders:', error);
    }
  }

  /**
   * Rebuild indexes for performance
   */
  private rebuildIndexes(orders: POS_Order[]): void {
    this.orderIndex.clear();
    this.dateIndex.clear();
    
    orders.forEach((order, index) => {
      // Code index
      this.orderIndex.set(order.Code, index);
      
      // Date index
      const orderDate = new Date(order.OrderDate).toDateString();
      if (!this.dateIndex.has(orderDate)) {
        this.dateIndex.set(orderDate, []);
      }
      this.dateIndex.get(orderDate)!.push(order.Code);
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { hits: number; misses: number; evictions: number; size: number; hitRate: string } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(1) + '%' : '0%';
    
    return {
      ...this.cacheStats,
      size: this.orderCache.size,
      hitRate
    };
  }

  // ========================
  // ROBUSTNESS FEATURES (PHASE 3)
  // ========================

  /**
   * Create order with retry mechanism and data encryption
   */
  async createOrderWithRecovery(order: POS_Order): Promise<POS_Order> {
    return this.posSecurityService.executeWithRecovery(
      async () => {
        // Encrypt sensitive data
        const encryptedOrder = await this.posSecurityService.encryptSensitiveData(order);
        return await this.createOrder(encryptedOrder);
      },
      'CREATE_ORDER',
      { maxRetries: 3, retryDelays: [1000, 2000, 4000], backoffMultiplier: 2 }
    );
  }

  /**
   * Update order with retry mechanism
   */
  async updateOrderWithRecovery(order: POS_Order): Promise<POS_Order> {
    return this.posSecurityService.executeWithRecovery(
      async () => {
        const encryptedOrder = await this.posSecurityService.encryptSensitiveData(order);
        await this.createOrder(encryptedOrder);
        return encryptedOrder;
      },
      'UPDATE_ORDER'
    );
  }

  /**
   * Get order with retry mechanism
   */
  async getOrderWithRecovery(code: string): Promise<POS_Order | null> {
    return this.posSecurityService.executeWithRecovery(
      async () => {
        let orders: POS_Order[];
        this.orders$.subscribe(data => orders = data).unsubscribe();
        return orders.find(order => order.Code === code) || null;
      },
      'GET_ORDER'
    );
  }

  /**
   * Bulk save operations with retry
   */
  async bulkSaveWithRecovery(orders: POS_Order[]): Promise<void> {
    const batchSize = 10;
    const batches = this.chunkArray(orders, batchSize);
    
    for (const [index, batch] of batches.entries()) {
      await this.posSecurityService.executeWithRecovery(
        async () => {
          console.log(`📦 Processing batch ${index + 1}/${batches.length} (${batch.length} orders)`);
          
          const encryptedBatch = await Promise.all(
            batch.map(order => this.posSecurityService.encryptSensitiveData(order))
          );
          
          // Save each order in batch
          for (const order of encryptedBatch) {
            await this.createOrder(order);
          }
        },
        `BULK_SAVE_BATCH_${index + 1}`,
        { maxRetries: 2 }
      );
    }
  }

  /**
   * Get performance and error statistics
   */
  getSystemHealth(): {
    circuitBreakers: Array<{ operation: string; state: string; failures: number }>;
    operationStats: Array<{ operation: string; stats: any }>;
    recentErrors: Array<{ type: string; error: any; timestamp: number; operation: string }>;
    cacheStats: any;
    storageInfo: { ordersCount: number; lastUpdated: string; cacheHitRate: number };
  } {
    let orders: POS_Order[];
    this.orders$.subscribe(data => orders = data).unsubscribe();
    
    return {
      circuitBreakers: this.posSecurityService.getCircuitBreakerStatus(),
      operationStats: this.posSecurityService.getAllOperationStats(),
      recentErrors: this.posSecurityService.getRecentErrors(20),
      cacheStats: {
        cacheSize: this.orderCache.size,
        maxSize: this.MAX_CACHE_SIZE,
        hitCount: this.cacheStats.hits,
        missCount: this.cacheStats.misses,
        hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
      },
      storageInfo: {
        ordersCount: orders?.length || 0,
        lastUpdated: new Date().toISOString(),
        cacheHitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
      }
    };
  }

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // ========================
  // END ROBUSTNESS FEATURES
  // ========================

  /**
   * Validate and recover corrupted data
   */
  async validateAndRecoverData(): Promise<void> {
    await this.posSecurityService.executeWithRecovery(
      async () => {
        console.log('🔍 Starting data validation and recovery...');
        
        // Check localStorage integrity
        const storageData = await this.env.getStorage(this.STORAGE_KEY);
        if (!storageData) {
          console.log('📦 No storage data found, initializing...');
          await this.env.setStorage(this.STORAGE_KEY, JSON.stringify({ orders: [], lastUpdated: new Date().toISOString(), version: this.VERSION }));
          return;
        }

        let data;
        try {
          data = JSON.parse(storageData);
        } catch (error) {
          console.error('❌ Failed to parse storage data:', error);
          await this.env.setStorage(this.STORAGE_KEY, JSON.stringify({ orders: [], lastUpdated: new Date().toISOString(), version: this.VERSION }));
          return;
        }
        
        if (!data || !Array.isArray(data.orders)) {
          throw new Error('Invalid storage data structure');
        }
        
        // Validate each order
        let corruptedCount = 0;
        let recoveredCount = 0;
        
        for (const order of data.orders) {
          try {
            this.validateOrderStructure(order);
          } catch (error) {
            corruptedCount++;
            console.warn(`⚠️ Corrupted order detected: ${order.Code}`, error);
            
            try {
              const recoveredOrder = await this.recoverOrder(order);
              if (recoveredOrder) {
                recoveredCount++;
                console.log(`✅ Order recovered: ${order.Code}`);
              }
            } catch (recoveryError) {
              console.error(`❌ Failed to recover order ${order.Code}:`, recoveryError);
            }
          }
        }
        
        console.log(`📊 Validation complete: ${corruptedCount} corrupted, ${recoveredCount} recovered`);
      },
      'DATA_VALIDATION',
      { maxRetries: 1 }
    );
  }

  /**
   * Validate order structure
   */
  private validateOrderStructure(order: POS_Order): void {
    const requiredFields = ['Id', 'Code'];
    
    for (const field of requiredFields) {
      if (order[field] === undefined || order[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (order.OrderLines) {
      if (!Array.isArray(order.OrderLines)) {
        throw new Error('OrderLines must be an array');
      }
      
      for (const line of order.OrderLines) {
        if (!line.Id || !line.IDItem || typeof line.Quantity !== 'number') {
          throw new Error('Invalid order line structure');
        }
      }
    }
  }

  /**
   * Attempt to recover a corrupted order
   */
  private async recoverOrder(corruptedOrder: POS_Order): Promise<POS_Order | null> {
    try {
      // Try to fix common issues
      const fixedOrder = { ...corruptedOrder };
      
      // Fix missing required fields
      if (!fixedOrder.Id) fixedOrder.Id = Date.now(); // Use timestamp as ID
      if (!fixedOrder.Code) fixedOrder.Code = `RECOVERED_${Date.now()}`;
      
      // Fix order lines
      if (fixedOrder.OrderLines && Array.isArray(fixedOrder.OrderLines)) {
        fixedOrder.OrderLines = fixedOrder.OrderLines.filter(line => 
          line && line.Id && line.IDItem && typeof line.Quantity === 'number'
        );
      } else {
        fixedOrder.OrderLines = [];
      }
      
      return fixedOrder;
    } catch (error) {
      console.error('Recovery attempt failed:', error);
      return null;
    }
  }

  /**
   * Get security service for monitoring
   */
  getSecurityService(): POSSecurityService {
    return this.posSecurityService;
  }

  /**
   * Get advanced sync service for monitoring
   */
  getAdvancedSyncService(): POSAdvancedSyncService {
    return this.advancedSyncService;
  }

  /**
   * Trigger manual sync for all orders
   */
  triggerManualSync(): void {
    console.log('🔄 Manual sync triggered from POS Order Service');
    this.advancedSyncService.triggerSync('MANUAL_ORDER_SERVICE');
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): Observable<any> {
    return this.advancedSyncService.syncStats;
  }

  /**
   * Check if sync is currently running
   */
  isSyncing(): Observable<boolean> {
    return this.advancedSyncService.isSyncing;
  }

  /**
   * Check network status
   */
  isOnline(): Observable<boolean> {
    return this.advancedSyncService.isOnline;
  }

  /**
   * Get realtime sync service
   */
  getRealtimeSyncService(): POSRealtimeSyncService {
    return this.realtimeSyncService;
  }

  /**
   * Get realtime sync events
   */
  getRealtimeEvents(): Observable<any> {
    return this.realtimeSyncService.realtimeEvents;
  }

  /**
   * Force sync all orders through realtime channel
   */
  forceSyncAll(): void {
    this.realtimeSyncService.forceSyncAll();
  }

  /**
   * Emergency cleanup and reset
   */
  async emergencyCleanup(): Promise<void> {
    try {
      console.log('🚨 Starting emergency cleanup...');
      
      // Clear circuit breaker states
      this.posSecurityService.clearStats();
      
      // Clear all caches
      this.orderCache.clear();
      this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
      
      // Validate and fix storage data
      await this.validateAndRecoverData();
      
      // Trigger data refresh
      this.loadOrdersFromStorage();
      
      console.log('✅ Emergency cleanup completed');
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
      throw error;
    }
  }
}
