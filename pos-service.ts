import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { POS_Order } from 'src/app/models/custom-model-interface';
import { CommonService } from 'src/app/services/core/common.service';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';

@Injectable({
	providedIn: 'root',
})
export class POSService extends SALE_OrderProvider {
	public dataTracking = new Subject<any>();
	public configTracking = new Subject<any>();
	items: POS_Order[] = [];
	dataTrackingList = [
		// {
		//     Id: Number //Report Id
		//     tracking: Subject
		// }
	];

	SystemConfig = {
		IsAutoSave: true,
		SODefaultBusinessPartner: 123,
		POSSettleAtCheckout: true,
		POSHideSendBarKitButton: false,
		POSEnableTemporaryPayment: true,
		POSEnablePrintTemporaryBill: false,
		POSAutoPrintBillAtSettle: true
	}

	constructor(
		public commonService: CommonService,
		public env: EnvService
	) {
		super(commonService);
		this.env?.ready?.then((_) => {
			console.log('POS service ready');
		});
	}

	
}
