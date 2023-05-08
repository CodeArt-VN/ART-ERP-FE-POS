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
})
export class POSCancelModalPage extends PageBase {
	isShow: boolean = false;
	formGroup: FormGroup;
	selectedReason = 'Không còn hàng';
	noteReason     : any;
	cancelReasons: string[] =
		[
			'Sản phẩm đã hết hàng',
			'Khách order nhầm món',
			'Chờ lên món quá lâu',
			'Đơn trùng',
			'Lý do khác',
		];
	modal: any;
	form: any;
	showInput : boolean = false;
	constructor(
		public pageProvider: POS_MemoProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public navParams: NavParams,
		public loadingController: LoadingController,
	) {
		super();
		this.pageConfig.isShowFeature = true;
	} 
	Apply(apply = false) {
		if (apply) {
			this.modalController.dismiss(this.item);
		}
		else {
			this.modalController.dismiss();
		}
	}
	onOtherReasonChange() {
		this.noteReason = this.noteReason.trim();
	}
	onRadioGroupChange() {
		if (this.selectedReason === 'Lý do khác') {
			this.isShow = true;
		} else {
			this.isShow = false;
		}
	}
	async dismissCancelModal() {
		await this.modal.dismiss();
	}

	async confirm(selectedReason: string) {
		await this.modal.dismiss();
		console.log('Lý do hủy đơn hàng:', selectedReason);
		this.isShow ? this.selectedReason = this.noteReason : this.selectedReason = selectedReason;
		console.log("🚀 ~ file: pos-cancel-modal.page.ts:70 ~ POSCancelModalPage ~ confirm ~ this.selectedReason:", this.selectedReason)
		// Xử lý lý do hủy đơn hàng ở đây
		//
	}

} 