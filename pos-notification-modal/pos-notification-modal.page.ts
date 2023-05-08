import { Component} from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController} from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_MemoProvider } from 'src/app/services/static/services.service';
import { FormGroup, FormControl } from '@angular/forms';

@Component({
	selector: 'app-pos-notification-modal',
	templateUrl: './pos-notification-modal.page.html',
	styleUrls: ['./pos-notification-modal.page.scss'],
})
export class POSNotificationModalPage extends PageBase {
	modal			: any;
	title 			: any;
	sdt   			: any;
	currentBranch	: any;
    constructor(
        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,
        public modalController: ModalController,
        public navParams: NavParams,
        public loadingController: LoadingController,
    ) {
        super();
        this.pageConfig.isShowFeature = true;
		this.title          = this.navParams.get('title');
		this.currentBranch  = this.navParams.get('dataInfo');
    }
	  async dismiss() {
		await this.modal.dismiss();
	  }
}