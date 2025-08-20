import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { POSAdvancedSyncService, SyncStats, SyncConflict, SyncQueueItem } from '../services/pos-advanced-sync.service';

@Component({
  selector: 'app-pos-sync-dashboard',
  templateUrl: './pos-sync-dashboard.component.html',
  styleUrls: ['./pos-sync-dashboard.component.scss']
})
export class POSSyncDashboardComponent implements OnInit, OnDestroy {
  
  // Observables
  syncStats$: Observable<SyncStats>;
  syncQueue$: Observable<SyncQueueItem[]>;
  conflicts$: Observable<SyncConflict[]>;
  isOnline$: Observable<boolean>;
  isSyncing$: Observable<boolean>;

  // Component state
  private subscriptions: Subscription = new Subscription();
  
  // Dashboard data
  currentStats: SyncStats = {
    totalSynced: 0,
    totalConflicts: 0,
    totalErrors: 0,
    lastSyncTime: new Date(),
    avgSyncTime: 0,
    successRate: 1,
    queueSize: 0,
    batchesProcessed: 0
  };

  queueItems: SyncQueueItem[] = [];
  conflicts: SyncConflict[] = [];
  isOnline = true;
  isSyncing = false;

  // UI state
  showAdvanced = false;
  selectedConflict: SyncConflict | null = null;
  resolveDialogOpen = false;

  constructor(
    private syncService: POSAdvancedSyncService
  ) {
    this.syncStats$ = this.syncService.syncStats;
    this.syncQueue$ = this.syncService.syncQueue;
    this.conflicts$ = this.syncService.conflicts;
    this.isOnline$ = this.syncService.isOnline;
    this.isSyncing$ = this.syncService.isSyncing;
  }

  ngOnInit(): void {
    this.subscribeToSyncData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private subscribeToSyncData(): void {
    // Subscribe to sync statistics
    this.subscriptions.add(
      this.syncStats$.subscribe(stats => {
        this.currentStats = stats;
      })
    );

    // Subscribe to queue items
    this.subscriptions.add(
      this.syncQueue$.subscribe(items => {
        this.queueItems = items;
      })
    );

    // Subscribe to conflicts
    this.subscriptions.add(
      this.conflicts$.subscribe(conflicts => {
        this.conflicts = conflicts;
      })
    );

    // Subscribe to online status
    this.subscriptions.add(
      this.isOnline$.subscribe(online => {
        this.isOnline = online;
      })
    );

    // Subscribe to syncing status
    this.subscriptions.add(
      this.isSyncing$.subscribe(syncing => {
        this.isSyncing = syncing;
      })
    );
  }

  // ========================
  // SYNC ACTIONS
  // ========================

  triggerManualSync(): void {
    this.syncService.triggerSync('MANUAL_DASHBOARD');
  }

  clearSyncQueue(): void {
    this.syncService.clearSyncQueue();
  }

  resetStatistics(): void {
    this.syncService.resetStats();
  }

  // ========================
  // CONFLICT RESOLUTION
  // ========================

  openConflictResolver(conflict: SyncConflict): void {
    this.selectedConflict = conflict;
    this.resolveDialogOpen = true;
  }

  resolveConflict(conflict: SyncConflict, strategy: 'LOCAL' | 'SERVER'): void {
    const resolvedValue = strategy === 'LOCAL' ? conflict.localValue : conflict.serverValue;
    this.syncService.resolveConflictWithUserChoice(conflict, resolvedValue);
    this.closeConflictDialog();
  }

  closeConflictDialog(): void {
    this.selectedConflict = null;
    this.resolveDialogOpen = false;
  }

  // ========================
  // UTILITY METHODS
  // ========================

  getSuccessRateColor(rate: number): string {
    if (rate >= 0.9) return 'success';
    if (rate >= 0.7) return 'warning';
    return 'danger';
  }

  getQueueSizeColor(size: number): string {
    if (size === 0) return 'success';
    if (size <= 10) return 'warning';
    return 'danger';
  }

  getConflictCountColor(count: number): string {
    if (count === 0) return 'success';
    if (count <= 5) return 'warning';
    return 'danger';
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getPriorityIcon(priority: number): string {
    if (priority >= 100) return 'alert-circle';
    if (priority >= 50) return 'alert';
    return 'information-circle';
  }

  getPriorityColor(priority: number): string {
    if (priority >= 100) return 'danger';
    if (priority >= 50) return 'warning';
    return 'primary';
  }

  getOperationIcon(operation: string): string {
    switch (operation) {
      case 'CREATE': return 'add-circle';
      case 'UPDATE': return 'create';
      case 'DELETE': return 'trash';
      default: return 'document';
    }
  }

  getOperationColor(operation: string): string {
    switch (operation) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'warning';
      case 'DELETE': return 'danger';
      default: return 'medium';
    }
  }

  getConflictResolutionIcon(strategy: string): string {
    switch (strategy) {
      case 'SERVER_WINS': return 'cloud-download';
      case 'LOCAL_WINS': return 'phone-portrait';
      case 'LAST_MODIFIED_WINS': return 'time';
      case 'MERGE': return 'git-merge';
      case 'USER_CHOICE': return 'person';
      default: return 'help';
    }
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  toggleAdvancedView(): void {
    this.showAdvanced = !this.showAdvanced;
  }
}
