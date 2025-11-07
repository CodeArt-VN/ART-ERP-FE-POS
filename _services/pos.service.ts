import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { POSConfig } from 'src/app/pages/POS/_services/interface.config';
import { POS_DataSource, POS_Order } from 'src/app/pages/POS/interface.model';
import { CommonService } from 'src/app/services/core/common.service';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';
import { POSEnviromentDataService } from './pos-env-data.service';

@Injectable({
	providedIn: 'root',
})
export class POSService extends SALE_OrderProvider {
	dataSource: POS_DataSource;
	systemConfig: POSConfig = null;

	constructor(
		public commonService: CommonService,
		public dataSourceService: POSEnviromentDataService,
		public env: EnvService
	) {
		console.log('🚀 POSService: Constructor initialized (Facade Pattern)');
		super(commonService);
		this.env?.ready?.then((_) => {
			console.log('✅ POS service ready');
		});
	}

	public getSystemConfig(IDBranch) {
		return this.dataSourceService.getSystemConfig(IDBranch).then((config: POSConfig) => {
			this.systemConfig = config;
			return config;
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
				this.getSystemConfig(IDBranch),
			])
				.then((results: any) => {
					console.log(results);

					this.dataSource = {
						menuList: results[0],
						kitchens: results[1].data,
						tableList: results[2],

						paymentStatusList: results[3],
						orderStatusList: results[4],
						orderDetailStatusList: results[5],
						paymentTypeList: results[6],
						dealList: results[7],

						orders: [],
						tableGroups: [],
					};
					resolve(true);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}
}
