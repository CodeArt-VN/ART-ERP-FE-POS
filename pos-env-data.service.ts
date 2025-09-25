import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EnvService } from 'src/app/services/core/env.service';
import { SYS_ConfigService } from 'src/app/services/custom/system-config.service';
import { POS_KitchenProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider } from 'src/app/services/static/services.service';
import { POS_DataSource } from './interface.model';
import { POSConfig } from './interface.config';
import { environment } from 'src/environments/environment.prod';

@Injectable({
	providedIn: 'root',
})
export class POSEnviromentDataService {
	// Reactive state for config and data
	private _systemConfig = new BehaviorSubject<POSConfig>({
		IsAutoSave: true,
		SODefaultBusinessPartner: 123,
		POSSettleAtCheckout: true,
		POSHideSendBarKitButton: false,
		POSEnableTemporaryPayment: true,
		POSEnablePrintTemporaryBill: false,
		POSAutoPrintBillAtSettle: true,
	});
	
	private _dataSource = new BehaviorSubject<POS_DataSource | null>(null);
	private _isLoading = new BehaviorSubject<boolean>(false);

	// Public observables
	public readonly systemConfig$ = this._systemConfig.asObservable();
	public readonly dataSource$ = this._dataSource.asObservable();
	public readonly isLoading$ = this._isLoading.asObservable();

	// Cache management
	private configCache = new Map<number, POSConfig>();
	private dataCache = new Map<number, POS_DataSource>();

	constructor(
		public env: EnvService,
		public sysConfigService: SYS_ConfigService,
		public menuProvider: POS_MenuProvider,
		public kitchenProvider: POS_KitchenProvider,
		public tableGroupProvider: POS_TableGroupProvider,
		public tableProvider: POS_TableProvider
	) {
		console.log('🚀 POSEnviromentDataService: Constructor initialized');
	}

	// ========================
	// System Configuration (Moved from POSService)
	// ========================

	/**
	 * Get system configuration for specific branch
	 */
	public getSystemConfig(IDBranch: number): Promise<POSConfig> {
		console.log('⚙️ POSEnviromentDataService: Getting system config', { IDBranch });
		
		return new Promise((resolve, reject) => {
			// Check cache first
			if (this.configCache.has(IDBranch)) {
				console.log('💾 Using cached config for branch:', IDBranch);
				const config = this.configCache.get(IDBranch)!;
				this._systemConfig.next(config);
				resolve(config);
				return;
			}

			const keys = [
				'IsAutoSave',
				'SODefaultBusinessPartner',
				'POSSettleAtCheckout',
				'POSHideSendBarKitButton',
				'POSEnableTemporaryPayment',
				'POSEnablePrintTemporaryBill',
				'POSAutoPrintBillAtSettle',
			];
			
			this.sysConfigService
				.getConfig(IDBranch, keys)
				.then((config: POSConfig) => {
					// Cache the config
					this.configCache.set(IDBranch, config);
					this._systemConfig.next(config);
					console.log('✅ System config loaded for branch:', IDBranch);
					resolve(config);
				})
				.catch((error) => {
					console.error('❌ Failed to load system config:', error);
					reject(error);
				});
		});
	}

	/**
	 * Get current system config (reactive)
	 */
	public getCurrentConfig(): POSConfig {
		return this._systemConfig.value;
	}

	/**
	 * Update specific config value
	 */
	public updateConfig(key: keyof POSConfig, value: any): void {
		const currentConfig = this._systemConfig.value;
		const updatedConfig = { ...currentConfig, [key]: value };
		this._systemConfig.next(updatedConfig);
		
		// Update cache
		if (this.env.selectedBranch) {
			this.configCache.set(this.env.selectedBranch, updatedConfig);
		}
		
		console.log('✅ Config updated:', key, '=', value);
	}

	// ========================
	// Environment Data Source (Enhanced from POSService)
	// ========================

	/**
	 * Get complete environment data source for POS
	 */
	public getEnviromentDataSource(IDBranch: number, forceReload = false): Promise<POS_DataSource> {
		return new Promise((resolve, reject) => {
			// Check cache first
			if (!forceReload && this.dataCache.has(IDBranch)) {
				const dataSource = this.dataCache.get(IDBranch)!;
				this._dataSource.next(dataSource);
				resolve(dataSource);
				return;
			}

			this._isLoading.next(true);
			console.log('🔄 Loading environment data for branch:', IDBranch);

			Promise.all([
				this.getMenu(forceReload),
				this.kitchenProvider.read({ IDBranch }),
				this.getTable(forceReload),
				this.env.getStatus('PaymentStatus'),
				this.env.getStatus('POSOrder'),
				this.env.getStatus('POSOrderDetail'),
				this.env.getType('PaymentType'),
				this.getDeal(),
				this.getSystemConfig(IDBranch)
			]).then((results: any) => {
				console.log('✅ All environment data loaded:', results.length, 'items');
				
				const dataSource: POS_DataSource = {
					menuList: results[0],
					kitchens: results[1].data,
					tableList: results[2],
					paymentStatusList: results[3],
					orderStatusList: results[4],
					orderDetailStatusList: results[5],
					paymentTypeList: results[6],
					dealList: results[7],
					orders: [], // Will be populated by POSOrderService
					tableGroups: [], // Will be populated from table data
				};

				// Cache the data source
				this.dataCache.set(IDBranch, dataSource);
				this._dataSource.next(dataSource);
				
				console.log('✅ Environment data source ready');
				resolve(dataSource);
			}).catch((error) => {
				console.error('❌ Failed to load environment data:', error);
				reject(error);
			}).finally(() => {
				this._isLoading.next(false);
			});
		});
	}

	/**
	 * Get current data source (reactive)
	 */
	public getCurrentDataSource(): POS_DataSource | null {
		return this._dataSource.value;
	}

	/**
	 * Refresh data source
	 */
	public async refreshDataSource(): Promise<void> {
		if (this.env.selectedBranch) {
			await this.getEnviromentDataSource(this.env.selectedBranch, true);
		}
	}

	// ========================
	// Data Loading Methods
	// ========================

	/**
	 * Get menu data with caching
	 */
	public getMenu(forceReload = false): Promise<any[]> {
		return new Promise((resolve, reject) => {
			const cacheKey = 'menuList' + this.env.selectedBranch;
			
			this.env
				.getStorage(cacheKey)
				.then((data) => {
					if (!forceReload && data) {
						console.log('✅ Menu loaded from cache');
						resolve(data);
					} else {
						this.menuProvider
							.read({ IDBranch: this.env.selectedBranch })
							.then((resp) => {
								let menuList = resp['data'];
								
								// Process menu images
								menuList.forEach((m: any) => {
									m.menuImage = environment.posImagesServer + (m.Image ? m.Image : 'assets/pos-icons/POS-Item-demo.png');
									if (m.Items) {
										m.Items.forEach((i: any) => {
											i.imgPath = environment.posImagesServer + (i.Image ? i.Image : 'assets/pos-icons/POS-Item-demo.png');
										});
									}
								});
								
								// Cache the processed data
								this.env.setStorage(cacheKey, menuList);
								console.log('✅ Menu data loaded and cached:', menuList.length, 'categories');
								resolve(menuList);
							})
							.catch((err) => {
								console.error('❌ Failed to load menu:', err);
								reject(err);
							});
					}
				})
				.catch((err) => {
					console.error('❌ Failed to get cached menu:', err);
					reject(err);
				});
		});
	}

	/**
	 * Get table data with hierarchy
	 */
	public getTable(forceReload = false): Promise<any[]> {
		return new Promise((resolve, reject) => {
			this.getTableGroupTree(forceReload)
				.then((data: any) => {
					let tableList: any[] = [];

					data.forEach((g: any) => {
						tableList.push({
							Id: 0,
							Name: g.Name,
							levels: [],
							disabled: true,
						});
						if (g.TableList) {
							g.TableList.forEach((t: any) => {
								tableList.push({
									Id: t.Id,
									Name: t.Name,
									levels: [{}],
								});
							});
						}
					});

					console.log('✅ Table data processed:', tableList.length, 'items');
					resolve(tableList);
				})
				.catch((err) => {
					console.error('❌ Failed to get table data:', err);
					reject(err);
				});
		});
	}

	/**
	 * Get table group tree with caching
	 */
	private getTableGroupTree(forceReload = false): Promise<any[]> {
		return new Promise((resolve, reject) => {
			const cacheKey = 'tableGroup' + this.env.selectedBranch;
			
			this.env
				.getStorage(cacheKey)
				.then((data) => {
					if (!forceReload && data) {
						console.log('✅ Table groups loaded from cache');
						resolve(data);
					} else {
						let query = { IDBranch: this.env.selectedBranch };
						Promise.all([
							this.tableGroupProvider.read(query), 
							this.tableProvider.read(query)
						])
							.then((values) => {
								let tableGroupList = values[0]['data'];
								let tableList = values[1]['data'];

								// Group tables by table group
								tableGroupList.forEach((g: any) => {
									g.TableList = tableList.filter((d: any) => d.IDTableGroup == g.Id);
								});
								
								// Cache the processed data
								this.env.setStorage(cacheKey, tableGroupList);
								console.log('✅ Table group tree loaded:', tableGroupList.length, 'groups');
								resolve(tableGroupList);
							})
							.catch((err) => {
								console.error('❌ Failed to load table groups:', err);
								reject(err);
							});
					}
				})
				.catch((err) => {
					console.error('❌ Failed to get cached table groups:', err);
					reject(err);
				});
		});
	}

	/**
	 * Get deals/promotions data
	 */
	public getDeal(query: any = null): Promise<any> {
		return new Promise((resolve, reject) => {
			this.menuProvider.commonService
				.connect('GET', 'PR/Deal/ForPOS', query)
				.toPromise()
				.then((result: any) => {
					console.log('✅ Deal data loaded');
					resolve(result);
				})
				.catch((err) => {
					console.error('❌ Failed to load deals:', err);
					reject(err);
				});
		});
	}

	// ========================
	// Cache Management
	// ========================

	/**
	 * Clear all caches
	 */
	public clearCache(): void {
		this.configCache.clear();
		this.dataCache.clear();
		console.log('✅ Environment data cache cleared');
	}

	/**
	 * Clear cache for specific branch
	 */
	public clearBranchCache(branchId: number): void {
		this.configCache.delete(branchId);
		this.dataCache.delete(branchId);
		
		// Clear storage cache as well
		this.env.setStorage('menuList' + branchId, null);
		this.env.setStorage('tableGroup' + branchId, null);
		
		console.log('✅ Cache cleared for branch:', branchId);
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats(): { configEntries: number; dataEntries: number } {
		return {
			configEntries: this.configCache.size,
			dataEntries: this.dataCache.size
		};
	}
}
