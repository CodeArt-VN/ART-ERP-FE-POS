import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EnvService } from 'src/app/services/core/env.service';
import { SYS_ConfigService } from 'src/app/services/system-config.service';
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
	) {}

	// ========================
	// System Configuration (Moved from POSService)
	// ========================

	/**
	 * Get system configuration for specific branch
	 */
	public getSystemConfig(IDBranch: number): Promise<POSConfig> {
		return new Promise((resolve, reject) => {
			// Check cache first
			if (this.configCache.has(IDBranch)) {
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
				console.log('✅ Environment data loaded:', results);
				
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
	// Original Methods (Enhanced)
	// ========================

	// ========================
	// Original Methods (Enhanced)
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
		return new Promise((resolve, reject) => {
			this.env
				.getStorage('menuList' + this.env.selectedBranch)
				.then((data) => {
					if (!forceReload && data) {
						resolve(data);
					} else {
						this.menuProvider
							.read({ IDBranch: this.env.selectedBranch })
							.then((resp) => {
								let menuList = resp['data'];
								menuList.forEach((m: any) => {
									m.menuImage = environment.posImagesServer + (m.Image ? m.Image : 'assets/pos-icons/POS-Item-demo.png');
									m.Items.forEach((i) => {
										i.imgPath = environment.posImagesServer + (i.Image ? i.Image : 'assets/pos-icons/POS-Item-demo.png');
									});
								});
								this.env.setStorage('menuList' + this.env.selectedBranch, menuList);
								resolve(menuList);
							})
							.catch((err) => {
								reject(err);
							});
					}
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public getTable(forceReload) {
		return new Promise((resolve, reject) => {
			this.getTableGroupTree(forceReload)
				.then((data: any) => {
					let tableList = [];

					data.forEach((g) => {
						tableList.push({
							Id: 0,
							Name: g.Name,
							levels: [],
							disabled: true,
						});
						g.TableList.forEach((t) => {
							tableList.push({
								Id: t.Id,
								Name: t.Name,
								levels: [{}],
							});
						});
					});

					resolve(tableList);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private getTableGroupTree(forceReload) {
		return new Promise((resolve, reject) => {
			this.env
				.getStorage('tableGroup' + this.env.selectedBranch)
				.then((data) => {
					if (!forceReload && data) {
						resolve(data);
					} else {
						let query = { IDBranch: this.env.selectedBranch };
						Promise.all([this.tableGroupProvider.read(query), this.tableProvider.read(query)])
							.then((values) => {
								let tableGroupList = values[0]['data'];
								let tableList = values[1]['data'];

								tableGroupList.forEach((g) => {
									g.TableList = tableList.filter((d) => d.IDTableGroup == g.Id);
								});
								this.env.setStorage('tableGroup' + this.env.selectedBranch, tableGroupList);
								resolve(tableGroupList);
							})
							.catch((err) => {
								reject(err);
							});
					}
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	public getDeal(query = null) {
			return new Promise((resolve, reject) => {
				this.menuProvider.commonService
					.connect('GET', 'PR/Deal/ForPOS', query)
					.toPromise()
					.then((result: any) => {
						resolve(result);
					})
					.catch((err) => {
						reject(err);
					});
			});
		}
}
