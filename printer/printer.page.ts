import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, SYS_ActionProvider, SYS_IntegrationProviderProvider, SYS_PrinterProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { SortConfig } from 'src/app/models/options-interface';
import { SYS_Printer } from 'src/app/models/model-list-interface';

@Component({
	selector: 'app-printer',
	templateUrl: 'printer.page.html',
	styleUrls: ['printer.page.scss'],
	standalone: false,
})
export class PrinterPage extends PageBase {
	constructor(
		public pageProvider: SYS_PrinterProvider,
		public branchProvider: BRA_BranchProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location
	) {
		super();
		this.pageConfig.isShowFeature = true;
		this.pageConfig.isFeatureAsMain = true;
	}

	preLoadData(event?: any): void {
		let sorted: SortConfig[] = [{ Dimension: 'Id', Order: 'DESC' }];
		this.pageConfig.sort = sorted;
		super.preLoadData(event);
	}
	loadedData(event) {
		
		super.loadedData(event);
	}

}
