import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { POSConfig } from 'src/app/pages/POS/interface.config';
import { POS_DataSource, POS_Order } from 'src/app/pages/POS/interface.model';
import { CommonService } from 'src/app/services/core/common.service';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';
import { SYS_ConfigService } from 'src/app/services/custom/system-config.service';
import { POSEnviromentDataService } from './pos-env-data.service';
import { POSOrderService } from './pos-order.service';

@Injectable({
	providedIn: 'root',
})
export class POSService extends SALE_OrderProvider {
	public dataTracking = new Subject<any>();
	public configTracking = new Subject<any>();
	dataSource: POS_DataSource;

	systemConfig: POSConfig = {
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
	};

	constructor(
		public commonService: CommonService,
		public sysConfigService: SYS_ConfigService,
		public dataSourceService: POSEnviromentDataService,
		public env: EnvService,
		public posOrderService: POSOrderService
	) {
		console.log('🚀 POSService: Constructor initialized (Facade Pattern)');
		super(commonService);
		this.env?.ready?.then((_) => {
			console.log('✅ POS service ready');
		});
	}

	public getSystemConfig(IDBranch) {
		return new Promise((resolve, reject) => {
		const keys = [
			'IsAutoSave',
			'SODefaultBusinessPartner',
			'IsUseIPWhitelist',
			'IPWhitelistInput',
			'IsRequireOTP',
			'POSLockSpamPhoneNumber',
			'LeaderMachineHost',
			'POSSettleAtCheckout',
			'POSHideSendBarKitButton',
			'POSEnableTemporaryPayment',
			'POSEnablePrintTemporaryBill',
			'POSAutoPrintBillAtSettle',
			'POSDefaultPaymentProvider',
			'POSTopItemsMenuIsShow',
			'POSTopItemsMenuNumberOfItems',
			'POSTopItemsMenuNumberOfDays',
			'POSTopItemsMenuNotIncludedItemIds',
			'POSAudioOrderUpdate',
			'POSAudioIncomingPayment',
			'POSAudioCallToPay',
			'POSAudioCallStaff',
		];
			this.sysConfigService
				.getConfig(IDBranch, keys)
				.then((config) => {
					this.systemConfig = config;
					resolve(true);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	public getEnviromentDataSource(IDBranch, forceReload = false) {
		return new Promise((resolve, reject) => {
			Promise.all([
				this.dataSourceService.getMenu(forceReload),
				this.dataSourceService.kitchenProvider.read({ IDBranch: this.env.selectedBranch }),
				this.dataSourceService.getTable(forceReload),
				this.env.getStatus('PaymentStatus'),
				this.env.getStatus('POSOrder'),
				this.env.getStatus('POSOrderDetail'),
				this.env.getType('PaymentType'),
				this.dataSourceService.getDeal(),
				this.getSystemConfig(IDBranch)
			]).then((results: any) => {
				console.log(results);
				
				this.dataSource = {
					menuList: results[0],
					kitchens: results[1].data,
					tableList : results[2],

					paymentStatusList: results[3],
					orderStatusList: results[4],
					orderDetailStatusList: results[5],
					paymentTypeList: results[6],
					dealList: results[7],

					orders: [],
					tableGroups: [],
					
					
				};
				resolve(true);
			}).catch((error) => {
				reject(error);
			});
		});
	}

	// ========================
	// POS Order Management Facade
	// ========================

	/**
	 * Create new POS order
	 */
	async createPOSOrder(order: Partial<POS_Order>): Promise<POS_Order> {
		return this.posOrderService.createOrder(order);
	}

	/**
	 * Update POS order
	 */
	async updatePOSOrder(code: string, changes: Partial<POS_Order>): Promise<POS_Order> {
		return this.posOrderService.updateOrder(code, changes);
	}

	/**
	 * Get POS order by code
	 */
	async getPOSOrder(code: string): Promise<POS_Order | null> {
		return this.posOrderService.getOrder(code);
	}

	/**
	 * Delete POS order
	 */
	async deletePOSOrder(code: string): Promise<boolean> {
		return this.posOrderService.deleteOrder(code);
	}

	/**
	 * Get all POS orders
	 */
	async getAllPOSOrders(): Promise<POS_Order[]> {
		return this.posOrderService.getAllOrders();
	}

	/**
	 * Set current active order
	 */
	setCurrentPOSOrder(code: string): void {
		this.posOrderService.setCurrentOrder(code);
	}

	/**
	 * Get POS orders observables
	 */
	get posOrders$(): Observable<POS_Order[]> {
		return this.posOrderService.orders$;
	}

	get currentPOSOrder$(): Observable<POS_Order | null> {
		return this.posOrderService.currentOrder$;
	}

	get posOrderSyncStatus$(): Observable<'idle' | 'syncing' | 'error'> {
		return this.posOrderService.syncStatus$;
	}
}
