import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { POSConfig } from 'src/app/pages/POS/interface.config';
import { POS_DataSource, POS_Order } from 'src/app/pages/POS/interface.model';
import { CommonService } from 'src/app/services/core/common.service';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_KitchenProvider, POS_TableProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { SYS_ConfigService } from 'src/app/services/system-config.service';
import { POSEnviromentDataService } from './pos-env-data.service';

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
		POSSettleAtCheckout: true,
		POSHideSendBarKitButton: false,
		POSEnableTemporaryPayment: true,
		POSEnablePrintTemporaryBill: false,
		POSAutoPrintBillAtSettle: true,
	};

	constructor(
		public commonService: CommonService,
		public sysConfigService: SYS_ConfigService,
		public dataSourceService: POSEnviromentDataService,
		public env: EnvService
	) {
		super(commonService);
		this.env?.ready?.then((_) => {
			console.log('POS service ready');
		});
	}

	public getSystemConfig(IDBranch) {
		return new Promise((resolve, reject) => {
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
}
