import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EnvService } from '../../services/core/env.service';
import { POS_Order, POS_OrderDetail } from './interface.model';
import { lib } from '../../services/static/global-functions';
import { POSAdvancedSyncService } from './services/pos-advanced-sync.service';
import { POSRealtimeSyncService } from './services/pos-realtime-sync.service';
import { SALE_OrderProvider } from '../../services/static/services.service';
import { dog } from '../../../environments/environment';

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
  
  // Add missing property
  private env: any;
  
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
    private envService: EnvService,
    private advancedSyncService: POSAdvancedSyncService,
    private realtimeSyncService: POSRealtimeSyncService,
    private saleOrderProvider: SALE_OrderProvider
  ) {
    console.log('🚀 POSOrderService: Constructor initialized');
    this.env = this.envService;
    this.initializeService();
  }

  private initializeService(): void {
    console.log('🔧 POSOrderService: Initializing service...');
    this.setupRealtimeEventHandlers();
    console.log('✅ POSOrderService: Service initialized successfully');
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
   * Update order status - specific method for status changes
   */
  async updateOrderStatus(code: string, status: string, additionalData?: any): Promise<POS_Order> {
    console.log('🔄 POSOrderService: Updating order status', { code, status });
    
    const updateData: Partial<POS_Order> = {
      Status: status,
      ModifiedDate: new Date(),
      ...additionalData
    };
    
    return await this.updateOrder(code, updateData);
  }

  /**
   * Create order - overloaded to match SALE_OrderProvider pattern
   */
  async createOrder(orderData: Partial<POS_Order>): Promise<POS_Order>;
  async createOrder(orderData: POS_Order): Promise<POS_Order>;
  async createOrder(orderData: Partial<POS_Order> | POS_Order): Promise<POS_Order> {
    console.log('📝 POSOrderService: Creating new order', { orderData });
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
      
      // Auto-sync to database if online
      try {
        const syncedOrder = await this.syncOrderToDatabase(calculatedOrder);
        console.log('✅ Order created and synced to database:', syncedOrder.Code);
        return syncedOrder;
      } catch (syncError) {
        console.warn('⚠️ Order created locally but database sync failed:', syncError.message);
        // Mark for later sync
        this.markOrderForSync(calculatedOrder.Code);
        return calculatedOrder;
      }
      
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
    console.log('🔄 POSOrderService: Updating order', { code, changes });
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
      
      // Auto-sync to database if online
      try {
        const syncedOrder = await this.syncOrderToDatabase(calculatedOrder);
        console.log('✅ Order updated and synced to database:', code);
        return syncedOrder;
      } catch (syncError) {
        console.warn('⚠️ Order updated locally but database sync failed:', syncError.message);
        // Mark for later sync
        this.markOrderForSync(code);
        return calculatedOrder;
      }
      
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
    console.log('🔍 POSOrderService: Getting order', { code });
    
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

    const cacheEntries = Array.from(this.orderCache.entries());
    for (const [key, value] of cacheEntries) {
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
   * Delete order by Code
   */
  async deleteOrder(code: string): Promise<boolean> {
    console.log('🗑️ POSOrderService: Deleting order', { code });
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
        
        // Try to sync deletion to database immediately
        try {
          await this.deleteOrderFromDatabase(orderToDelete);
          console.log('✅ Order deleted from both local and database:', code);
        } catch (syncError) {
          console.warn('⚠️ Order deleted locally but database deletion failed:', syncError.message);
          // Note: Order is already deleted locally, database cleanup will be handled by sync service
        }
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
  // AUTO SYNC & FETCH MANAGEMENT
  // ========================

  private readonly LAST_FETCH_KEY = 'pos_orders_last_fetch';
  private readonly FETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Ensure data is up to date - called automatically by service
   */
  async ensureDataIsUpToDate(forceRefresh: boolean = false): Promise<void> {
    console.log('🔄 POSOrderService: Ensuring data is up to date', { forceRefresh });
    
    try {
      const shouldFetch = await this.shouldFetchFromServer(forceRefresh);
      
      if (shouldFetch) {
        console.log('📥 Fetching fresh data from server...');
        await this.fetchAndSyncFromServer();
      } else {
        console.log('ℹ️ Local data is up to date');
      }
    } catch (error) {
      console.error('❌ Failed to ensure data is up to date:', error);
    }
  }

  /**
   * Check if we should fetch from server
   */
  private async shouldFetchFromServer(forceRefresh: boolean): Promise<boolean> {
    if (forceRefresh) return true;
    
    try {
      const lastFetchTime = await this.env.getStorage(this.LAST_FETCH_KEY);
      
      if (!lastFetchTime) {
        console.log('🔄 No previous fetch time, need to fetch');
        return true;
      }
      
      const timeSinceLastFetch = Date.now() - parseInt(lastFetchTime);
      const shouldFetch = timeSinceLastFetch > this.FETCH_INTERVAL_MS;
      
      console.log('⏰ Fetch check:', {
        lastFetch: new Date(parseInt(lastFetchTime)),
        timeSince: Math.round(timeSinceLastFetch / 60000) + ' minutes',
        shouldFetch
      });
      
      return shouldFetch;
    } catch (error) {
      console.error('❌ Error checking fetch timing:', error);
      return true; // Fetch on error to be safe
    }
  }

  /**
   * Fetch orders from server with smart query
   */
  private async fetchAndSyncFromServer(): Promise<void> {
    try {
      // Get last fetch time for incremental sync
      const lastFetchTime = await this.env.getStorage(this.LAST_FETCH_KEY);
      
      // Build server query
      const serverQuery: any = {
        Type: 'POSOrder',
        Status: JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']),
        IDBranch: this.env.selectedBranch,
        Take: 1000, // Large batch for initial sync
        Skip: 0
      };

      // Add date range for incremental sync
      if (lastFetchTime) {
        // Incremental: fetch orders modified since last fetch
        const lastFetch = new Date(parseInt(lastFetchTime));
        // Add some buffer time (5 minutes) to avoid missing updates
        lastFetch.setMinutes(lastFetch.getMinutes() - 5);
        serverQuery.ModifiedDateFrom = lastFetch.toISOString();
        console.log('📅 Incremental sync from:', lastFetch);
      } else {
        // Initial: fetch orders from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        serverQuery.ModifiedDateFrom = sevenDaysAgo.toISOString();
        console.log('📅 Initial sync from 7 days ago:', sevenDaysAgo);
      }

      // Fetch from server
      const serverResult: any = await this.saleOrderProvider.read(serverQuery, true);
      
      if (serverResult && serverResult.data && serverResult.data.length > 0) {
        console.log('✅ Fetched from server:', serverResult.data.length, 'orders');
        
        // Process and merge each order
        for (const serverOrder of serverResult.data) {
          await this.mergeServerOrder(serverOrder);
        }
        
        console.log('✅ Server orders merged successfully');
      } else {
        console.log('ℹ️ No new orders from server');
      }
      
      // Update last fetch time
      await this.env.setStorage(this.LAST_FETCH_KEY, Date.now().toString());
      
    } catch (error) {
      console.error('❌ Failed to fetch from server:', error);
      throw error;
    }
  }

  /**
   * Merge server order with local data
   */
  private async mergeServerOrder(serverOrder: any): Promise<void> {
    try {
      // Transform server order to POS_Order format
      const posOrder: POS_Order = {
        ...serverOrder,
        Code: serverOrder.Code || `ORD-${serverOrder.Id}`,
        OrderDate: serverOrder.OrderDate || serverOrder.CreatedDate,
        ModifiedDate: serverOrder.ModifiedDate || new Date(),
        OrderLines: serverOrder.OrderLines || [],
        TotalBeforeDiscount: serverOrder.TotalBeforeDiscount || 0,
        TotalDiscount: serverOrder.TotalDiscount || 0,
        TotalAfterDiscount: serverOrder.TotalAfterDiscount || serverOrder.CalcTotalOriginal || 0,
        Tax: serverOrder.Tax || 0,
        TotalAfterTax: serverOrder.TotalAfterTax || serverOrder.CalcTotalOriginal || 0
      };

      // Check if order already exists locally
      const existingOrder = await this.getOrder(posOrder.Code);
      
      if (existingOrder) {
        // Compare modification times
        const serverModified = new Date(posOrder.ModifiedDate);
        const localModified = new Date(existingOrder.ModifiedDate);
        
        if (serverModified > localModified) {
          console.log('🔄 Updating order from server:', posOrder.Code);
          await this.updateOrder(posOrder.Code, posOrder);
        } else {
          console.log('ℹ️ Local order is newer, keeping local:', posOrder.Code);
        }
      } else {
        // New order from server
        console.log('📝 Creating new order from server:', posOrder.Code);
        await this.createOrder(posOrder);
      }
    } catch (error) {
      console.warn('⚠️ Failed to merge server order:', error);
    }
  }

  /**
   * Handle SignalR notification of order updates
   */
  async handleOrderUpdateNotification(orderData: any): Promise<void> {
    console.log('🔔 Received order update notification:', orderData);
    
    try {
      if (orderData.IDBranch !== this.env.selectedBranch) {
        console.log('ℹ️ Order update not for current branch, ignoring');
        return;
      }

      // Fetch the specific updated order from server
      if (orderData.Id) {
        const updatedOrder = await this.fetchOrderFromDatabase(orderData.Id);
        if (updatedOrder) {
          await this.mergeServerOrder(updatedOrder);
          console.log('✅ Order updated from SignalR notification:', updatedOrder.Code);
        }

        // Trigger CheckPOSNewOrderLines after processing notification
        const query = this.env?.query; // Use current query from environment
        if (query) {
          await this.checkPOSNewOrderLines(query);
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle order update notification:', error);
    }
  }

  /**
   * Override getAllOrders to ensure data freshness
   */
  async getAllOrders(): Promise<POS_Order[]> {
    console.log('📋 POSOrderService: Getting all orders with auto-sync check');
    
    // Ensure data is up to date before returning
    await this.ensureDataIsUpToDate();
    
    try {
      const storageData = await this.env.getStorage(this.STORAGE_KEY);
      if (!storageData) {
        console.log('ℹ️ No local orders found');
        return [];
      }

      const data: StorageOrderData = JSON.parse(storageData);
      return data.orders || [];
      
    } catch (error) {
      console.error('❌ Failed to get all orders:', error);
      return [];
    }
  }

  // ========================
  // DATABASE SYNC METHODS
  // ========================

  /**
   * Sync order to database using SALE_OrderProvider
   */
  async syncOrderToDatabase(order: POS_Order): Promise<POS_Order> {
    console.log('🔄 POSOrderService: Syncing order to database', { code: order.Code });
    
    try {
      // Use SALE_OrderProvider save method (handles both create and update based on Id)
      const savedOrder = null;// await this.saleOrderProvider.save(order) as POS_Order;
      
      console.log('✅ Order synced to database successfully', { code: savedOrder.Code, id: savedOrder.Id });
      
      // Update local storage with server response (includes Id for new orders)
      if (savedOrder.Id !== order.Id) {
        await this.saveOrderToStorage(savedOrder);
        
        // Update reactive state
        const currentOrders = this._orders.value;
        const orderIndex = currentOrders.findIndex(o => o.Code === order.Code);
        if (orderIndex >= 0) {
          currentOrders[orderIndex] = savedOrder;
          this._orders.next([...currentOrders]);
        }
      }
      
      return savedOrder;
      
    } catch (error) {
      console.error('❌ Failed to sync order to database:', error);
      throw new Error(`Database sync failed: ${error.message || error}`);
    }
  }

  /**
   * Fetch order from database by server Id
   */
  async fetchOrderFromDatabase(serverId: number): Promise<POS_Order | null> {
    console.log('📥 POSOrderService: Fetching order from database', { serverId });
    
    try {
      // Use SALE_OrderProvider getAnItem method
      const orderData = await this.saleOrderProvider.getAnItem(serverId) as POS_Order;
      
      if (orderData) {
        console.log('✅ Order fetched from database', { code: orderData.Code, id: orderData.Id });
        return orderData;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Failed to fetch order from database:', error);
      return null;
    }
  }

  /**
   * Search orders from database
   */
  async searchOrdersFromDatabase(query: any = {}): Promise<POS_Order[]> {
    console.log('🔍 POSOrderService: Searching orders from database', { query });
    
    try {
      // Use SALE_OrderProvider read method for search
      const result = await this.saleOrderProvider.read(query) as { count: number; data: POS_Order[] };
      
      console.log('✅ Orders searched from database', { count: result.count });
      return result.data || [];
      
    } catch (error) {
      console.error('❌ Failed to search orders from database:', error);
      return [];
    }
  }

  /**
   * Delete order from database
   */
  async deleteOrderFromDatabase(order: POS_Order): Promise<boolean> {
    console.log('🗑️ POSOrderService: Deleting order from database', { code: order.Code, id: order.Id });
    
    try {
      if (!order.Id || order.Id === 0) {
        console.log('⚠️ Order has no server Id, skipping database deletion');
        return true; // Local-only order, no need to delete from database
      }
      
      // Use SALE_OrderProvider delete method
      await this.saleOrderProvider.delete(order);
      
      console.log('✅ Order deleted from database successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to delete order from database:', error);
      throw new Error(`Database deletion failed: ${error.message || error}`);
    }
  }

  /**
   * Bulk sync multiple orders to database
   */
  async bulkSyncToDatabase(orders: POS_Order[]): Promise<POS_Order[]> {
    console.log('📦 POSOrderService: Bulk syncing orders to database', { count: orders.length });
    
    const results: POS_Order[] = [];
    const errors: string[] = [];
    
    for (const order of orders) {
      try {
        const syncedOrder = await this.syncOrderToDatabase(order);
        results.push(syncedOrder);
      } catch (error) {
        const errorMsg = `Order ${order.Code}: ${error.message}`;
        errors.push(errorMsg);
        console.error('❌ Bulk sync error for order:', order.Code, error);
      }
    }
    
    if (errors.length > 0) {
      console.warn('⚠️ Some orders failed to sync:', errors);
      // Still return successful syncs, let caller handle partial failures
    }
    
    console.log('✅ Bulk sync completed', { successful: results.length, failed: errors.length });
    return results;
  }

  /**
   * Sync orders from database to local storage
   */
  async syncFromDatabase(query: any = {}): Promise<void> {
    console.log('📥 POSOrderService: Syncing orders from database to local');
    this._isLoading.next(true);
    this._syncStatus.next('syncing');
    
    try {
      // Fetch orders from database
      const serverOrders = await this.searchOrdersFromDatabase(query);
      
      if (serverOrders.length === 0) {
        console.log('ℹ️ No orders found on server');
        this._syncStatus.next('idle');
        return;
      }
      
      // Get current local orders
      const localOrders = this._orders.value;
      
      // Merge server data with local data (server takes precedence)
      const mergedOrders = this.mergeOrderData(localOrders, serverOrders);
      
      // Save merged data to storage
      await this.saveOrdersToMainStorage(mergedOrders);
      
      // Update reactive state
      this._orders.next(mergedOrders);
      
      // Rebuild indexes
      this.rebuildIndexes(mergedOrders);
      
      console.log('✅ Database sync completed', { 
        serverOrders: serverOrders.length, 
        localOrders: localOrders.length,
        merged: mergedOrders.length 
      });
      
      this._syncStatus.next('idle');
      
    } catch (error) {
      console.error('❌ Failed to sync from database:', error);
      this._syncStatus.next('error');
      throw error;
    } finally {
      this._isLoading.next(false);
    }
  }

  /**
   * Merge local and server order data
   */
  private mergeOrderData(localOrders: POS_Order[], serverOrders: POS_Order[]): POS_Order[] {
    const mergedMap = new Map<string, POS_Order>();
    
    // Add local orders first
    localOrders.forEach(order => {
      mergedMap.set(order.Code, order);
    });
    
    // Override with server orders (server data takes precedence)
    serverOrders.forEach(serverOrder => {
      const existingOrder = mergedMap.get(serverOrder.Code);
      
      if (existingOrder) {
        // Merge: keep local modifications but prefer server data for synced fields
        const mergedOrder: POS_Order = {
          ...existingOrder,
          ...serverOrder,
          // Preserve local-only fields that might not exist on server
          ModifiedDate: new Date(Math.max(
            new Date(existingOrder.ModifiedDate).getTime(),
            new Date(serverOrder.ModifiedDate).getTime()
          ))
        };
        mergedMap.set(serverOrder.Code, mergedOrder);
      } else {
        // New order from server
        mergedMap.set(serverOrder.Code, serverOrder);
      }
    });
    
    return Array.from(mergedMap.values());
  }

  /**
   * Check if order needs database sync
   */
  isOrderSyncPending(order: POS_Order): boolean {
    // Order needs sync if:
    // 1. No Id (new order)
    // 2. Local ModifiedDate is newer than server sync timestamp
    // 3. Has pending changes flag
    
    return !order.Id || 
           order.Id === 0 || 
           (order as any)._needsSync === true ||
           (order as any)._localChanges === true;
  }

  /**
   * Mark order as needing sync
   */
  markOrderForSync(code: string): void {
    const orders = this._orders.value;
    const orderIndex = orders.findIndex(o => o.Code === code);
    
    if (orderIndex >= 0) {
      const updatedOrder = { 
        ...orders[orderIndex], 
        _needsSync: true,
        _localChanges: true 
      } as any;
      
      orders[orderIndex] = updatedOrder;
      this._orders.next([...orders]);
      this._isDirty.next(true);
    }
  }

  /**
   * Get orders pending database sync
   */
  getOrdersPendingSync(): POS_Order[] {
    return this._orders.value.filter(order => this.isOrderSyncPending(order));
  }

  /**
   * Auto-sync pending orders to database
   */
  async autoSyncPendingOrders(): Promise<void> {
    const pendingOrders = this.getOrdersPendingSync();
    
    if (pendingOrders.length === 0) {
      console.log('ℹ️ No orders pending sync');
      return;
    }
    
    console.log(`🔄 Auto-syncing ${pendingOrders.length} pending orders`);
    
    try {
      await this.bulkSyncToDatabase(pendingOrders);
      console.log('✅ Auto-sync completed');
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
    }
  }

  // ========================
  // Business Logic Methods
  // ========================

  /**
   * Calculate order totals and taxes
   */
  private calcOrder(order: POS_Order): POS_Order {
    console.log('🧮 POSOrderService: Calculating order totals', { orderCode: order.Code, linesCount: order.OrderLines?.length || 0 });
    
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
    const dateEntries = Array.from(this.dateIndex.entries());
    for (const [date, orders] of dateEntries) {
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
    return this.securityService.executeWithRecovery(
      async () => {
        // Encrypt sensitive data
        const encryptedOrder = await this.securityService.encryptSensitiveData(order);
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
    return this.securityService.executeWithRecovery(
      async () => {
        const encryptedOrder = await this.securityService.encryptSensitiveData(order);
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
    return this.securityService.executeWithRecovery(
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
    
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      await this.securityService.executeWithRecovery(
        async () => {
          console.log(`📦 Processing batch ${index + 1}/${batches.length} (${batch.length} orders)`);
          
          const encryptedBatch = await Promise.all(
            batch.map(order => this.securityService.encryptSensitiveData(order))
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
      circuitBreakers: this.securityService.getCircuitBreakerStatus(),
      operationStats: this.securityService.getAllOperationStats(),
      recentErrors: this.securityService.getRecentErrors(20),
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
    await this.securityService.executeWithRecovery(
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
    return this.securityService;
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
   * Check for new order lines that need kitchen delivery (Service-based CheckPOSNewOrderLines)
   * Only called from service load and SignalR notifications
   */
  async checkPOSNewOrderLines(query: any): Promise<any[]> {
    return this.securityService.executeWithRecovery(async () => {
      console.log('🔍 POSOrderService: Checking new order lines from server...');
      
      const results = await this.saleOrderProvider.commonService
        .connect('GET', 'SALE/Order/CheckPOSNewOrderLines/', query)
        .toPromise();

      if (!results || !Array.isArray(results)) {
        console.warn('⚠️ CheckPOSNewOrderLines: Invalid server response');
        return [];
      }

      console.log(`📋 CheckPOSNewOrderLines: Found ${results.length} orders with new items`);
      return results;
      
    }, 'Failed to check new order lines').catch(error => {
      console.error('❌ CheckPOSNewOrderLines error:', error);
      throw error;
    });
  }

  /**
   * Check if local order needs kitchen delivery without server call
   */
  hasUndeliveredItems(orderCode: string): boolean {
    const order = this.orderCache.get(orderCode)?.order;
    if (!order?.OrderLines) return false;

    const undeliveredCount = order.OrderLines.filter(line => 
      line.Status === 'New' || 
      line.Status === 'Waiting' ||
      (line.Quantity > (line.ShippedQuantity || 0))
    ).length;

    return undeliveredCount > 0;
  }

  /**
   * Get undelivered items count for local order
   */
  getUndeliveredItemsCount(orderCode: string): number {
    const order = this.orderCache.get(orderCode)?.order;
    if (!order?.OrderLines) return 0;

    return order.OrderLines.filter(line => 
      line.Status === 'New' || 
      line.Status === 'Waiting' ||
      (line.Quantity > (line.ShippedQuantity || 0))
    ).length;
  }

  /**
   * Refresh specific order from server
   */
  private async refreshOrderFromServer(orderId: number): Promise<void> {
    try {
      const orderData: any = await this.saleOrderProvider.read({ Id: orderId });
      if (orderData?.data?.[0]) {
        const refreshedOrder = orderData.data[0];
        this.updateLocalOrder(refreshedOrder);
      }
    } catch (error) {
      console.error('❌ Error refreshing order from server:', error);
    }
  }

  /**
   * Update local order cache
   */
  private updateLocalOrder(order: POS_Order): void {
    const existingCache = this.orderCache.get(order.Code);
    if (existingCache) {
      existingCache.order = order;
      existingCache.timestamp = Date.now();
      existingCache.hits++;
    } else {
      this.orderCache.set(order.Code, {
        order,
        timestamp: Date.now(),
        hits: 1
      });
    }

    // Update current orders array
    const orders = this._orders.value;
    const index = orders.findIndex(o => o.Code === order.Code);
    if (index >= 0) {
      orders[index] = order;
      this._orders.next([...orders]);
    }
  }

  /**
   * Emergency cleanup and reset
   */
  async emergencyCleanup(): Promise<void> {
    try {
      console.log('🚨 Starting emergency cleanup...');
      
      // Clear circuit breaker states
      this.securityService.clearStats();
      
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

  /**
   * Cancel or reduce order lines
   */
  async cancelReduceOrderLines(cancelData: any): Promise<any> {
    try {
      dog && console.log('🔄 POSOrderService: Canceling/reducing order lines:', cancelData);
      
      // Use saleOrderProvider to call API
      const result = await this.saleOrderProvider.commonService
        .connect('POST', 'SALE/Order/CancelReduceOrderLines/', cancelData)
        .toPromise();
      
      dog && console.log('✅ POSOrderService: Order lines canceled/reduced successfully');
      return result;
    } catch (summary: any) {
      dog && console.error('❌ POSOrderService: Error canceling/reducing order lines:', summary);
      throw summary;
    }
  }
}
