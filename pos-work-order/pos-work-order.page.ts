import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { POS_KitchenProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';

@Component({
	selector: 'app-pos-work-order',
	templateUrl: 'pos-work-order.page.html',
	styleUrls: ['pos-work-order.page.scss'],
	standalone: false,
})
export class POSWorkOrderPage extends PageBase {
	constructor(
		public pageProvider: POS_KitchenProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location
	) {
		super();
	}
}
