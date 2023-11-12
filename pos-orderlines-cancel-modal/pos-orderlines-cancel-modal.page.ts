import { Component } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_MemoProvider } from 'src/app/services/static/services.service';
import { FormGroup, FormControl } from '@angular/forms';

@Component({
	selector: 'app-pos-orderlines-cancel-modal',
	templateUrl: './pos-orderlines-cancel-modal.page.html',
	styleUrls: ['./pos-orderlines-cancel-modal.page.scss'],
})
export class POSOrderLinesCancelModalPage extends PageBase {
	typeList = [];
	constructor(
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public navParams: NavParams,
	) {
		super();

	}

	preLoadData(event?: any): void {
		this.env.getType('POSSODetailCancellationReason').then(data => {
			this.typeList = data;
			this.item = this.typeList.find(d=>d.Code == 'Other');
			super.loadedData(event);
		})
	}
	dismiss(role = 'cancel') {
		if (role == 'confirm' && this.item.Code == 'Other' && !this.item.CancelNote ) {
			this.env.showMessage('Xin vui lòng nhập lý do.');
			return;
		}

		return this.modalController.dismiss(this.item, role, 'POSOrderLinesCancelModalPage');
	}

} 