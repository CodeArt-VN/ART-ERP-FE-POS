import { Component } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_MemoProvider } from 'src/app/services/static/services.service';
import { FormGroup, FormControl } from '@angular/forms';

@Component({
	selector: 'app-pos-cancel-modal',
	templateUrl: './pos-cancel-modal.page.html',
	styleUrls: ['./pos-cancel-modal.page.scss'],
	standalone: false,
})
export class POSCancelModalPage extends PageBase {
	typeList = [];
	constructor(
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public navParams: NavParams
	) {
		super();
	}

	preLoadData(event?: any): void {
		this.env.getType('POSSOCancellationReason').then((data) => {
			this.typeList = data;
			this.item = this.typeList.find((d) => d.Code == 'Other');
			super.loadedData(event);
		});
	}
	dismiss(role = 'cancel') {
		if (role == 'confirm' && this.item.Code == 'Other' && !this.item.CancelNote) {
			this.env.showMessage('Xin vui lòng nhập lý do.');
			return;
		}

		return this.modalController.dismiss(this.item, role, 'POSCancelModalPage');
	}
}
