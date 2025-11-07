import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EnvService } from 'src/app/services/core/env.service';
import { SYS_ConfigService } from 'src/app/services/custom/system-config.service';
import { POS_KitchenProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider } from 'src/app/services/static/services.service';
import { POS_DataSource } from '../interface.model';
import { POSConfig } from './interface.config';
import { environment } from 'src/environments/environment';
import { dog } from 'src/environments/environment';

@Injectable({
	providedIn: 'root',
})
export class POSEnviromentDataService {
	// Reactive state for config and data
	defaultPOSConfig: POSConfig = {
		IsAutoSave: true,
		SODefaultBusinessPartner: 123,
		IsUseIPWhitelist: false,
		IPWhitelistInput: '',
		IsRequireOTP: false,
		POSLockSpamPhoneNumber: false,
		LeaderMachineHost: '',
		POSSettleAtCheckout: true,
		POSHideSendBarKitButton: false,
		POSEnableTemporaryPayment: true,
		POSEnablePrintTemporaryBill: false,
		POSAutoPrintBillAtSettle: true,
		POSDefaultPaymentProvider: '',
		POSTopItemsMenuIsShow: false,
		POSTopItemsMenuNumberOfItems: 0,
		POSTopItemsMenuNumberOfDays: 0,
		POSTopItemsMenuNotIncludedItemIds: '',
		POSAudioOrderUpdate: '',
		POSAudioIncomingPayment: '',
		POSAudioCallToPay: '',
		POSAudioCallStaff: '',
		POSServiceCharge: 0,
	};

	constructor(
		public env: EnvService,
		public sysConfigService: SYS_ConfigService,
		public menuProvider: POS_MenuProvider,
		public kitchenProvider: POS_KitchenProvider,
		public tableGroupProvider: POS_TableGroupProvider,
		public tableProvider: POS_TableProvider
	) {
		dog && console.log('🚀 POSEnviromentDataService: Constructor initialized');
	}

	/**
	 * Get system configuration for specific branch
	 */
	public getSystemConfig(IDBranch: number, forceReload = false): Promise<POSConfig> {
		dog && console.log('⚙️ POSEnviromentDataService: Getting system config', { IDBranch });

		if (forceReload) {
			return this.fetchConfig(IDBranch);
		} else {
			return new Promise((resolve, reject) => {
				this.env.getStorage('POSConfig').then((savedConfig: POSConfig) => {
					if (savedConfig) {
						resolve(savedConfig);
					} else {
						this.fetchConfig(IDBranch).then((config: POSConfig) => {
							resolve(config);
						});
					}
				});
			});
		}
	}

	private fetchConfig(IDBranch: number): Promise<POSConfig> {
		return new Promise((resolve, reject) => {
			const keys = Object.keys(this.defaultPOSConfig);
			this.sysConfigService
				.getConfig(IDBranch, keys)
				.then((config: POSConfig) => {
					this.env.setStorage('POSConfig', config);
					resolve(config);
				})
				.catch((error) => {
					dog && console.error('❌ Failed to load system config:', error);
					reject(error);
				});
		});
	}

	/**
	 * Get complete environment data source for POS
	 */
	public getEnviromentDataSource(IDBranch: number, forceReload = false): Promise<POS_DataSource> {
		if (forceReload) {
			return this.fetchDataSource(IDBranch, forceReload);
		} else {
			return new Promise((resolve, reject) => {
				this.env.getStorage('POSDataSource').then((cache: POS_DataSource) => {
					if (cache) {
						resolve(cache);
					} else {
						this.fetchDataSource(IDBranch, forceReload).then((dataSource: POS_DataSource) => {
							resolve(dataSource);
						});
					}
				});
			});
		}
	}

	private fetchDataSource(IDBranch: number, forceReload = false): Promise<POS_DataSource> {
		return new Promise((resolve, reject) => {
			Promise.all([
				this.getMenu(forceReload),
				this.kitchenProvider.read({ IDBranch }),
				this.getTable(forceReload),
				this.env.getStatus('PaymentStatus'),
				this.env.getStatus('POSOrder'),
				this.env.getStatus('POSOrderDetail'),
				this.env.getType('PaymentType'),
				this.getDeal(),
				this.getSystemConfig(IDBranch),
			])
				.then((results: any) => {
					dog && console.log('✅ All environment data loaded:', results.length, 'items');

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

					this.env.setStorage('POSDataSource', dataSource).then(() => {
						dog && console.log('✅ Environment data source ready');
						resolve(dataSource);
					});
				})
				.catch((error) => {
					dog && console.error('❌ Failed to load environment data:', error);
					reject(error);
				});
		});
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
						dog && console.log('✅ Menu loaded from cache');
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
								dog && console.log('✅ Menu data loaded and cached:', menuList.length, 'categories');
								resolve(menuList);
							})
							.catch((err) => {
								dog && console.error('❌ Failed to load menu:', err);
								reject(err);
							});
					}
				})
				.catch((err) => {
					dog && console.error('❌ Failed to get cached menu:', err);
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

					dog && console.log('✅ Table data processed:', tableList.length, 'items');
					resolve(tableList);
				})
				.catch((err) => {
					dog && console.error('❌ Failed to get table data:', err);
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
						dog && console.log('✅ Table groups loaded from cache');
						resolve(data);
					} else {
						let query = { IDBranch: this.env.selectedBranch };
						Promise.all([this.tableGroupProvider.read(query), this.tableProvider.read(query)])
							.then((values) => {
								let tableGroupList = values[0]['data'];
								let tableList = values[1]['data'];

								// Group tables by table group
								tableGroupList.forEach((g: any) => {
									g.TableList = tableList.filter((d: any) => d.IDTableGroup == g.Id);
								});

								// Cache the processed data
								this.env.setStorage(cacheKey, tableGroupList);
								dog && console.log('✅ Table group tree loaded:', tableGroupList.length, 'groups');
								resolve(tableGroupList);
							})
							.catch((err) => {
								dog && console.error('❌ Failed to load table groups:', err);
								reject(err);
							});
					}
				})
				.catch((err) => {
					dog && console.error('❌ Failed to get cached table groups:', err);
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
					dog && console.log('✅ Deal data loaded');
					resolve(result);
				})
				.catch((err) => {
					dog && console.error('❌ Failed to load deals:', err);
					reject(err);
				});
		});
	}
}
