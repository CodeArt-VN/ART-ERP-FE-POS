import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { CRM_AttendanceProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { lib } from 'src/app/services/static/global-functions';

@Component({
	selector: 'app-pos-booking',
	templateUrl: 'pos-booking.page.html',
	styleUrls: ['pos-booking.page.scss'],
	standalone: false,
})
export class PosBookingPage extends PageBase {
	constructor(
		public pageProvider: CRM_AttendanceProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location
	) {
		super();
		this.pageConfig.ShowFeature = false;
		this.pageConfig.ShowArchive = false;
		this.pageConfig.ShowHelp = false;
	}

	statusList = [];
	PartyMenuList = [];
	AttendanceGroup = [];
	AttendanceType = [];

	numberOfBooking = 0;
	numberOfDinnerPax = 0;
	numberOfReal = 0;
	numberOfKid = 0;
	numberOfForeigner = 0;

	preLoadData(event) {
		let today = lib.dateFormat(new Date(), 'yyyy-mm-dd');
		// if (!this.sort.Id) {
		//     this.sort.Id = 'Id';
		//     this.sortToggle('Id', true);
		// }
		this.query.PartyDate = today;
		this.query.Status = '';
		this.query.TypeOfParty = '';
		this.query.CustomerGroup = '';
		this.query.CustomerType = '';

		Promise.all([this.env.getStatus('AttendanceBooking'), this.env.getType('PartyMenu'), this.env.getType('AttendanceGroup'), this.env.getType('AttendanceType')]).then(
			(values: any) => {
				if (values.length) {
					this.statusList = values[0].filter((d) => d.Code != 'AttendanceBooking');
					this.PartyMenuList = values[1].filter((d) => d.Code != 'PartyMenu');
					this.AttendanceGroup = values[2].filter((d) => d.Code != 'AttendanceGroup');
					this.AttendanceType = values[3].filter((d) => d.Code != 'AttendanceType');
				}

				super.preLoadData(event);
			}
		);
	}

	loadedData(event) {
		this.numberOfBooking = 0;
		this.numberOfDinnerPax = 0;
		this.numberOfReal = 0;
		this.numberOfKid = 0;
		this.numberOfForeigner = 0;

		//this.numberOfBooking = this.items.filter(d=>d.Status != 'CANCELED').length;
		this.numberOfBooking = this.items.length;

		this.items.forEach((i) => {
			// if(i.Status != 'CANCELED'){
			//     this.numberOfDinnerPax+=i.DinnerPax;
			//     this.numberOfReal+=i.RealField;
			//     this.numberOfKid+=i.Kids;
			//     this.numberOfForeigner += i.ForeignerNo;
			// }

			this.numberOfDinnerPax += i.DinnerPax;
			this.numberOfReal += i.RealField;
			this.numberOfKid += i.Kids;
			this.numberOfForeigner += i.ForeignerNo;
			i.StatusText = lib.getAttrib(i.Status, this.statusList, 'Name', '', 'Code');
			i.StatusColor = lib.getAttrib(i.Status, this.statusList, 'Color', '', 'Code');
			i.TypeOfPartyText = lib.getAttrib(i.TypeOfParty, this.PartyMenuList, 'Name', '', 'Code');
		});

		super.loadedData(event);
	}

	// async showModal(i) {
	//     const modal = await this.modalController.create({
	//         component: AttendanceBookingDetailPage,
	//         componentProps: {
	//             item: i,
	//             id: i.Id
	//         },
	//         cssClass: 'my-custom-class'
	//     });
	//     return await modal.present();
	// }

	// add() {
	//     let newItem = {
	//         Id: 0,
	//     };
	//     this.showModal(newItem);
	// }
}
