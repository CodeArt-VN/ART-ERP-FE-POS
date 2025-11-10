import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { POSConfig } from 'src/app/pages/POS/_services/interface.model';
import { POSDataSource, POS_Order } from 'src/app/pages/POS/_services/interface.model';
import { CommonService } from 'src/app/services/core/common.service';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';
import { POSEnviromentDataService } from './pos-env-data.service';
import { POSNotifyService } from './pos-notify.service';

@Injectable({
	providedIn: 'root',
})
export class POSService extends SALE_OrderProvider {
	dataSource: POSDataSource;
	systemConfig: POSConfig = null;

	constructor(
		public commonService: CommonService,
		public dataSourceService: POSEnviromentDataService,
		public notifyService: POSNotifyService,
		public env: EnvService
	) {
		console.log('🚀 POSService: Constructor initialized (Facade Pattern)');
		super(commonService);
		this.env?.ready?.then((_) => {
			console.log('✅ POS service ready');
		});
	}

	public getEnviromentDataSource(IDBranch, forceReload = false) {
		return this.dataSourceService.getEnviromentDataSource(IDBranch, forceReload).then((data: any) => {
			this.dataSource = data.DataSources;
			this.systemConfig = data.SystemConfig;
			this.notifyService.systemConfig = this.systemConfig;
			return data;
		});
	}
}
