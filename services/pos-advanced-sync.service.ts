import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { POS_Order, POS_OrderDetail } from '../interface.model';
import { POSSecurityService } from './pos-security.service';

export interface SyncConflictResolution {
  field: string;
  strategy: 'SERVER_WINS' | 'LOCAL_WINS' | 'LAST_MODIFIED_WINS' | 'MERGE' | 'USER_CHOICE';
  priority: number;
  mergeFunction?: (local: any, server: any) => any;
}

export interface SyncConflict {
  orderCode: string;
  field: string;
  localValue: any;
  serverValue: any;
  localModified: Date;
  serverModified: Date;
  resolution?: SyncConflictResolution;
  resolved?: boolean;
}

export interface SyncBatch {
  id: string;
  orders: POS_Order[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: Date;
  attempts: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errors?: string[];
}

export interface SyncStats {
  totalSynced: number;
  totalConflicts: number;
  totalErrors: number;
  lastSyncTime: Date;
  avgSyncTime: number;
  successRate: number;
  queueSize: number;
  batchesProcessed: number;
}

export interface SyncQueueItem {
  id: string;
  order: POS_Order;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  priority: number;
  timestamp: Date;
  attempts: number;
  maxAttempts: number;
  retryDelay: number;
}

@Injectable({
  providedIn: 'root'
})
export class POSAdvancedSyncService {
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 100; // ms between batches
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly PRIORITY_WEIGHTS = { HIGH: 100, MEDIUM: 50, LOW: 10 };

  // Conflict resolution rules
  private readonly conflictResolutions: SyncConflictResolution[] = [
    {
      field: 'TotalBeforeVAT',
      strategy: 'LAST_MODIFIED_WINS',
      priority: 100
    },
    {
      field: 'OrderLines',
      strategy: 'MERGE',
      priority: 90,
      mergeFunction: this.mergeOrderLines.bind(this)
    },
    {
      field: 'CustomerName',
      strategy: 'USER_CHOICE',
      priority: 80
    },
    {
      field: 'Remark',
      strategy: 'MERGE',
      priority: 70,
      mergeFunction: this.mergeText.bind(this)
    },
    {
      field: 'DiscountFromSalesman',
      strategy: 'SERVER_WINS',
      priority: 60
    }
  ];

  // State management
  private readonly syncStats$ = new BehaviorSubject<SyncStats>({
    totalSynced: 0,
    totalConflicts: 0,
    totalErrors: 0,
    lastSyncTime: new Date(),
    avgSyncTime: 0,
    successRate: 1,
    queueSize: 0,
    batchesProcessed: 0
  });

  private readonly syncQueue$ = new BehaviorSubject<SyncQueueItem[]>([]);
  private readonly batchQueue$ = new BehaviorSubject<SyncBatch[]>([]);
  private readonly conflicts$ = new BehaviorSubject<SyncConflict[]>([]);
  private readonly isOnline$ = new BehaviorSubject<boolean>(true);
  private readonly isSyncing$ = new BehaviorSubject<boolean>(false);

  // Real-time sync triggers
  private readonly syncTrigger$ = new Subject<string>();
  private readonly conflictResolved$ = new Subject<SyncConflict>();

  // Processing state
  private isProcessingQueue = false;
  private syncTimer: any;

  // WebSocket connection (simulated)
  private webSocketConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  constructor(
    private posSecurityService: POSSecurityService
  ) {
    console.log('🚀 POSAdvancedSyncService: Constructor initialized');
    this.initializeSync();
    this.setupConflictResolution();
    this.startPeriodicSync();
    this.monitorNetworkStatus();
  }

  // ========================
  // INITIALIZATION
  // ========================

  private initializeSync(): void {
    console.log('🔧 POSAdvancedSyncService: Initializing sync service...');
    
    // Setup auto-sync trigger with debouncing
    this.syncTrigger$.pipe(
      debounceTime(1000),
      distinctUntilChanged(),
      switchMap(() => this.processSyncQueue())
    ).subscribe({
      next: (result) => console.log('✅ Auto-sync completed:', result),
      error: (error) => console.error('❌ Auto-sync failed:', error)
    });

    // Process conflict resolutions
    this.conflictResolved$.pipe(
      debounceTime(500)
    ).subscribe(conflict => {
      this.handleResolvedConflict(conflict);
    });

    console.log('🔄 Advanced Sync Service initialized');
  }

  private setupConflictResolution(): void {
    // Sort resolution rules by priority
    this.conflictResolutions.sort((a, b) => b.priority - a.priority);
    
    console.log('⚖️ Conflict resolution rules configured:', this.conflictResolutions.length);
  }

  private startPeriodicSync(): void {
    // Start periodic sync every 30 seconds
    this.syncTimer = setInterval(() => {
      if (this.isOnline$.value && !this.isSyncing$.value) {
        this.triggerSync('PERIODIC');
      }
    }, this.SYNC_INTERVAL);
  }

  private monitorNetworkStatus(): void {
    // Simulate network monitoring
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network online - resuming sync');
        this.isOnline$.next(true);
        this.triggerSync('NETWORK_RESTORED');
      });

      window.addEventListener('offline', () => {
        console.log('📴 Network offline - pausing sync');
        this.isOnline$.next(false);
      });
    }
  }

  // ========================
  // SYNC QUEUE MANAGEMENT
  // ========================

  /**
   * Add order to sync queue with priority
   */
  addToSyncQueue(order: POS_Order, operation: 'CREATE' | 'UPDATE' | 'DELETE', priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'): void {
    console.log('📤 POSAdvancedSyncService: Adding order to sync queue', { 
      orderCode: order.Code, 
      operation, 
      priority,
      queueLength: this.syncQueue$.value.length 
    });
    
    const queueItem: SyncQueueItem = {
      id: `${operation}_${order.Code}_${Date.now()}`,
      order: { ...order },
      operation,
      priority: this.PRIORITY_WEIGHTS[priority],
      timestamp: new Date(),
      attempts: 0,
      maxAttempts: this.MAX_RETRY_ATTEMPTS,
      retryDelay: 1000
    };

    const currentQueue = this.syncQueue$.value;
    
    // Remove existing items for same order to avoid duplicates
    const filteredQueue = currentQueue.filter(item => 
      !(item.order.Code === order.Code && item.operation === operation)
    );

    // Add new item and sort by priority
    const newQueue = [...filteredQueue, queueItem]
      .sort((a, b) => b.priority - a.priority);

    this.syncQueue$.next(newQueue);
    this.updateStats({ queueSize: newQueue.length });

    // Trigger sync if online
    if (this.isOnline$.value) {
      this.triggerSync(`QUEUE_ITEM_${operation}`);
    }

    console.log(`📝 Added ${operation} for order ${order.Code} to sync queue (Priority: ${priority})`);
  }

  /**
   * Process sync queue in batches
   */
  private async processSyncQueue(): Promise<{ processed: number; errors: string[] }> {
    if (this.isProcessingQueue || this.isSyncing$.value || !this.isOnline$.value) {
      return { processed: 0, errors: ['Sync already in progress or offline'] };
    }

    this.isProcessingQueue = true;
    this.isSyncing$.next(true);
    
    try {
      const queue = this.syncQueue$.value;
      if (queue.length === 0) {
        return { processed: 0, errors: [] };
      }

      console.log(`🔄 Processing sync queue: ${queue.length} items`);
      
      // Group items into batches
      const batches = this.createSyncBatches(queue);
      let totalProcessed = 0;
      const allErrors: string[] = [];

      // Process batches with delay
      for (const batch of batches) {
        try {
          const result = await this.processBatch(batch);
          totalProcessed += result.processed;
          allErrors.push(...result.errors);
          
          // Delay between batches
          if (batches.indexOf(batch) < batches.length - 1) {
            await this.delay(this.BATCH_DELAY);
          }
        } catch (error) {
          console.error('❌ Batch processing failed:', error);
          allErrors.push(`Batch ${batch.id} failed: ${error.message}`);
        }
      }

      // Update queue by removing processed items
      const remainingQueue = queue.filter(item => item.attempts >= item.maxAttempts);
      this.syncQueue$.next(remainingQueue);

      this.updateStats({ 
        totalSynced: this.syncStats$.value.totalSynced + totalProcessed,
        queueSize: remainingQueue.length,
        lastSyncTime: new Date()
      });

      console.log(`✅ Sync queue processed: ${totalProcessed} items, ${allErrors.length} errors`);
      
      return { processed: totalProcessed, errors: allErrors };

    } finally {
      this.isProcessingQueue = false;
      this.isSyncing$.next(false);
    }
  }

  /**
   * Create optimized sync batches
   */
  private createSyncBatches(queue: SyncQueueItem[]): SyncBatch[] {
    const batches: SyncBatch[] = [];
    
    // Group by operation type for better batching
    const operations = ['DELETE', 'CREATE', 'UPDATE']; // Process in this order
    
    for (const operation of operations) {
      const operationItems = queue.filter(item => item.operation === operation);
      
      // Create batches of BATCH_SIZE
      for (let i = 0; i < operationItems.length; i += this.BATCH_SIZE) {
        const batchItems = operationItems.slice(i, i + this.BATCH_SIZE);
        
        const batch: SyncBatch = {
          id: `batch_${operation}_${Date.now()}_${i}`,
          orders: batchItems.map(item => item.order),
          priority: this.calculateBatchPriority(batchItems),
          createdAt: new Date(),
          attempts: 0,
          status: 'PENDING'
        };
        
        batches.push(batch);
      }
    }

    return batches.sort((a, b) => this.compareBatchPriority(a, b));
  }

  /**
   * Calculate batch priority based on items
   */
  private calculateBatchPriority(items: SyncQueueItem[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    const avgPriority = items.reduce((sum, item) => sum + item.priority, 0) / items.length;
    
    if (avgPriority >= this.PRIORITY_WEIGHTS.HIGH) return 'HIGH';
    if (avgPriority >= this.PRIORITY_WEIGHTS.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Compare batches for priority sorting
   */
  private compareBatchPriority(a: SyncBatch, b: SyncBatch): number {
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  }

  // ========================
  // BATCH PROCESSING
  // ========================

  /**
   * Process a single sync batch
   */
  private async processBatch(batch: SyncBatch): Promise<{ processed: number; errors: string[] }> {
    console.log(`📦 Processing batch ${batch.id}: ${batch.orders.length} orders (${batch.priority} priority)`);
    
    batch.status = 'PROCESSING';
    batch.attempts++;
    
    const startTime = Date.now();
    let processed = 0;
    const errors: string[] = [];

    try {
      // Use security service for reliable execution
      const result = await this.posSecurityService.executeWithRecovery(
        async () => {
          const syncPromises = batch.orders.map(async (order, index) => {
            try {
              await this.syncSingleOrder(order);
              processed++;
              
              // Log progress for large batches
              if (batch.orders.length > 5 && (index + 1) % 5 === 0) {
                console.log(`📈 Batch ${batch.id} progress: ${index + 1}/${batch.orders.length}`);
              }
              
              return { success: true, orderCode: order.Code };
            } catch (error) {
              const errorMsg = `Order ${order.Code}: ${error.message}`;
              errors.push(errorMsg);
              console.error('❌', errorMsg);
              return { success: false, orderCode: order.Code, error: errorMsg };
            }
          });

          const results = await Promise.all(syncPromises.map(promise => 
            promise.catch(error => ({ success: false, error: error.message }))
          ));
          return results;
        },
        `BATCH_SYNC_${batch.id}`,
        { maxRetries: 2 }
      );

      batch.status = 'COMPLETED';
      
      // Update statistics
      const duration = Date.now() - startTime;
      this.updateStats({
        batchesProcessed: this.syncStats$.value.batchesProcessed + 1,
        avgSyncTime: (this.syncStats$.value.avgSyncTime + duration) / 2,
        totalErrors: this.syncStats$.value.totalErrors + errors.length
      });

      console.log(`✅ Batch ${batch.id} completed: ${processed}/${batch.orders.length} orders synced in ${duration}ms`);
      
    } catch (error) {
      batch.status = 'FAILED';
      batch.errors = [error.message];
      errors.push(`Batch ${batch.id} failed: ${error.message}`);
      
      console.error(`❌ Batch ${batch.id} failed:`, error);
    }

    return { processed, errors };
  }

  /**
   * Sync single order with conflict detection
   */
  private async syncSingleOrder(order: POS_Order): Promise<void> {
    try {
      // Simulate server sync call
      const serverOrder = await this.fetchOrderFromServer(order.Code);
      
      if (serverOrder) {
        // Detect conflicts
        const conflicts = await this.detectConflicts(order, serverOrder);
        
        if (conflicts.length > 0) {
          console.log(`⚠️ Conflicts detected for order ${order.Code}:`, conflicts.length);
          await this.handleConflicts(order, serverOrder, conflicts);
        } else {
          // No conflicts, proceed with sync
          await this.pushOrderToServer(order);
        }
      } else {
        // New order, create on server
        await this.createOrderOnServer(order);
      }
      
    } catch (error) {
      console.error(`❌ Failed to sync order ${order.Code}:`, error);
      throw error;
    }
  }

  // ========================
  // CONFLICT RESOLUTION
  // ========================

  /**
   * Detect conflicts between local and server orders
   */
  private async detectConflicts(localOrder: POS_Order, serverOrder: POS_Order): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];
    
    // Compare key fields for conflicts
    const fieldsToCheck = [
      'TotalBeforeVAT', 'CustomerName', 'Remark', 'DiscountFromSalesman', 
      'OrderLines', 'OrderDate', 'Status'
    ];

    for (const field of fieldsToCheck) {
      const localValue = localOrder[field];
      const serverValue = serverOrder[field];
      
      // Skip if values are the same
      if (this.deepEqual(localValue, serverValue)) {
        continue;
      }

      // Check if it's a real conflict (both modified since last sync)
      const localModified = new Date(localOrder.ModifiedDate || localOrder.OrderDate);
      const serverModified = new Date(serverOrder.ModifiedDate || serverOrder.OrderDate);
      
      // If both are modified, it's a conflict
      if (this.isConflict(localModified, serverModified)) {
        const conflict: SyncConflict = {
          orderCode: localOrder.Code,
          field,
          localValue,
          serverValue,
          localModified,
          serverModified,
          resolved: false
        };

        // Find resolution rule
        const rule = this.conflictResolutions.find(r => r.field === field);
        if (rule) {
          conflict.resolution = rule;
        }

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Handle multiple conflicts for an order
   */
  private async handleConflicts(localOrder: POS_Order, serverOrder: POS_Order, conflicts: SyncConflict[]): Promise<void> {
    const resolvedOrder = { ...localOrder };
    const unresolvedConflicts: SyncConflict[] = [];

    for (const conflict of conflicts) {
      try {
        const resolvedValue = await this.resolveConflict(conflict);
        
        if (resolvedValue !== undefined) {
          resolvedOrder[conflict.field] = resolvedValue;
          conflict.resolved = true;
          
          console.log(`✅ Resolved conflict for ${conflict.orderCode}.${conflict.field}`);
        } else {
          // Needs user input
          unresolvedConflicts.push(conflict);
        }
      } catch (error) {
        console.error(`❌ Failed to resolve conflict for ${conflict.orderCode}.${conflict.field}:`, error);
        unresolvedConflicts.push(conflict);
      }
    }

    // Add unresolved conflicts to conflicts$ for UI handling
    if (unresolvedConflicts.length > 0) {
      const currentConflicts = this.conflicts$.value;
      this.conflicts$.next([...currentConflicts, ...unresolvedConflicts]);
      
      this.updateStats({ 
        totalConflicts: this.syncStats$.value.totalConflicts + unresolvedConflicts.length 
      });
    }

    // Push resolved order if all conflicts are resolved
    if (unresolvedConflicts.length === 0) {
      await this.pushOrderToServer(resolvedOrder);
    }
  }

  /**
   * Resolve a single conflict based on strategy
   */
  private async resolveConflict(conflict: SyncConflict): Promise<any> {
    const rule = conflict.resolution;
    if (!rule) {
      return undefined; // No rule, needs user input
    }

    switch (rule.strategy) {
      case 'SERVER_WINS':
        return conflict.serverValue;
        
      case 'LOCAL_WINS':
        return conflict.localValue;
        
      case 'LAST_MODIFIED_WINS':
        return conflict.localModified > conflict.serverModified 
          ? conflict.localValue 
          : conflict.serverValue;
          
      case 'MERGE':
        if (rule.mergeFunction) {
          return rule.mergeFunction(conflict.localValue, conflict.serverValue);
        }
        return conflict.localValue; // Fallback
        
      case 'USER_CHOICE':
        return undefined; // Needs user input
        
      default:
        return conflict.localValue;
    }
  }

  /**
   * Handle resolved conflict from UI
   */
  private handleResolvedConflict(conflict: SyncConflict): void {
    // Remove from conflicts list
    const currentConflicts = this.conflicts$.value;
    const updatedConflicts = currentConflicts.filter(c => 
      !(c.orderCode === conflict.orderCode && c.field === conflict.field)
    );
    this.conflicts$.next(updatedConflicts);

    console.log(`✅ User resolved conflict for ${conflict.orderCode}.${conflict.field}`);
  }

  // ========================
  // MERGE FUNCTIONS
  // ========================

  /**
   * Merge order lines arrays
   */
  private mergeOrderLines(localLines: POS_OrderDetail[], serverLines: POS_OrderDetail[]): POS_OrderDetail[] {
    const merged = [...localLines];
    const localIds = new Set(localLines.map(line => line.Id));

    // Add server lines that don't exist locally
    for (const serverLine of serverLines) {
      if (!localIds.has(serverLine.Id)) {
        merged.push(serverLine);
      }
    }

    return merged;
  }

  /**
   * Merge text fields
   */
  private mergeText(localText: string, serverText: string): string {
    if (!localText) return serverText || '';
    if (!serverText) return localText;
    
    // Simple merge: combine both with separator
    return `${localText} | ${serverText}`;
  }

  // ========================
  // SERVER SIMULATION
  // ========================

  /**
   * Simulate fetching order from server
   */
  private async fetchOrderFromServer(orderCode: string): Promise<POS_Order | null> {
    // Simulate network delay
    await this.delay(50 + Math.random() * 100);
    
    // Simulate 90% success rate
    if (Math.random() < 0.1) {
      throw new Error(`Server error fetching order ${orderCode}`);
    }

    // For demo, return null (order doesn't exist on server)
    return null;
  }

  /**
   * Simulate pushing order to server
   */
  private async pushOrderToServer(order: POS_Order): Promise<void> {
    // Simulate network delay
    await this.delay(100 + Math.random() * 200);
    
    // Simulate 95% success rate
    if (Math.random() < 0.05) {
      throw new Error(`Server error pushing order ${order.Code}`);
    }

    console.log(`📤 Pushed order ${order.Code} to server`);
  }

  /**
   * Simulate creating order on server
   */
  private async createOrderOnServer(order: POS_Order): Promise<void> {
    // Simulate network delay
    await this.delay(150 + Math.random() * 250);
    
    // Simulate 95% success rate
    if (Math.random() < 0.05) {
      throw new Error(`Server error creating order ${order.Code}`);
    }

    console.log(`📝 Created order ${order.Code} on server`);
  }

  // ========================
  // PUBLIC API
  // ========================

  /**
   * Manually trigger sync
   */
  triggerSync(reason: string = 'MANUAL'): void {
    console.log(`🔄 Sync triggered: ${reason}`);
    this.syncTrigger$.next(reason);
  }

  /**
   * Resolve conflict with user choice
   */
  resolveConflictWithUserChoice(conflict: SyncConflict, chosenValue: any): void {
    conflict.resolved = true;
    this.conflictResolved$.next(conflict);
  }

  /**
   * Get observables for UI binding
   */
  get syncStats(): Observable<SyncStats> {
    return this.syncStats$.asObservable();
  }

  get syncQueue(): Observable<SyncQueueItem[]> {
    return this.syncQueue$.asObservable();
  }

  get conflicts(): Observable<SyncConflict[]> {
    return this.conflicts$.asObservable();
  }

  get isOnline(): Observable<boolean> {
    return this.isOnline$.asObservable();
  }

  get isSyncing(): Observable<boolean> {
    return this.isSyncing$.asObservable();
  }

  /**
   * Get current statistics
   */
  getCurrentStats(): SyncStats {
    return this.syncStats$.value;
  }

  /**
   * Clear sync queue
   */
  clearSyncQueue(): void {
    this.syncQueue$.next([]);
    this.updateStats({ queueSize: 0 });
    console.log('🗑️ Sync queue cleared');
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.syncStats$.next({
      totalSynced: 0,
      totalConflicts: 0,
      totalErrors: 0,
      lastSyncTime: new Date(),
      avgSyncTime: 0,
      successRate: 1,
      queueSize: 0,
      batchesProcessed: 0
    });
    console.log('📊 Statistics reset');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    console.log('🛑 Advanced Sync Service destroyed');
  }

  // ========================
  // UTILITY METHODS
  // ========================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key) || !this.deepEqual(obj1[key], obj2[key])) {
        return false;
      }
    }
    
    return true;
  }

  private isConflict(localModified: Date, serverModified: Date): boolean {
    // Consider it a conflict if both were modified within 1 minute of each other
    const timeDiff = Math.abs(localModified.getTime() - serverModified.getTime());
    return timeDiff < 60000; // 1 minute threshold
  }

  private updateStats(updates: Partial<SyncStats>): void {
    const current = this.syncStats$.value;
    this.syncStats$.next({ ...current, ...updates });
  }
}
