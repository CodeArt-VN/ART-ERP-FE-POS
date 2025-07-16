import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_AttendanceProvider, POS_TableProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';

@Component({
	selector: 'app-pos-booking-detail',
	templateUrl: './pos-booking-detail.page.html',
	styleUrls: ['./pos-booking-detail.page.scss'],
	standalone: false,
})
export class PosBookingDetailPage extends PageBase {
	tableList: any = [];

	constructor(
		public pageProvider: CRM_AttendanceProvider,
		public POSTableProvider: POS_TableProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService
	) {
		super();
		this.pageConfig.isDetailPage = true;
		let today = lib.dateFormat(new Date(), 'yyyy-mm-dd') + 'T18:00:00';

		this.formGroup = formBuilder.group({
			IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: '', disabled: true }),

			CustomerName: ['', Validators.required],
			PartyDate: [today, Validators.required],
			Phone: [''],
			Email: [''],

			DinnerPax: ['0', Validators.required],
			RealField: ['0', Validators.required],
			Kids: ['0', Validators.required],
			ForeignerNo: ['0', Validators.required],

			_RegisteredTable: [''],
			RegisteredTable: [''],
			Status: ['WAITING'],
			CustomerGroup: ['COUPLE'],
			TypeOfParty: ['A LA CARTE'],
			CustomerType: ['BOOKING'],
			Remark: [''],

			Arrivaled: ['0'],
			LunchPax: ['0'],

			DiningCard: [''],

			NoRecords: ['0'],
			BillingInformation: [''],

			TableOfLunch: [''],
			TimeOfParty: [''],
			DOB: [''],
		});
	}

	statusList = [];
	PartyMenuList = [];
	AttendanceGroup = [];
	AttendanceType = [];

	preLoadData(event) {
		Promise.all([
			this.env.getStatus('AttendanceBooking'),
			this.env.getType('PartyMenu'),
			this.env.getType('AttendanceGroup'),
			this.env.getType('AttendanceType'),
			this.POSTableProvider.read({ IDBranch: this.env.selectedBranch }),
		]).then((values: any) => {
			if (values.length) {
				this.statusList = values[0].filter((d) => d.Code != 'AttendanceBooking');
				this.PartyMenuList = values[1].filter((d) => d.Code != 'PartyMenu');
				this.AttendanceGroup = values[2].filter((d) => d.Code != 'AttendanceGroup');
				this.AttendanceType = values[3].filter((d) => d.Code != 'AttendanceType');
				this.tableList = values[4].data;
				console.log(values[4]);
			}
			super.preLoadData(event);
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData(event);
		if (this.item?.RegisteredTable) {
			this.formGroup.controls._RegisteredTable.setValue(JSON.parse(this.formGroup.controls.RegisteredTable.value));
		}
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	async saveChange() {
		if (this.formGroup.controls._RegisteredTable.value) {
			this.formGroup.controls.RegisteredTable.setValue(JSON.stringify(this.formGroup.controls._RegisteredTable.value));
			this.formGroup.controls.RegisteredTable.markAsDirty();
		}
		if (!this.id) {
			this.formGroup.controls.PartyDate.markAsDirty();
			this.formGroup.controls.Status.markAsDirty();
			this.formGroup.controls.CustomerGroup.markAsDirty();
			this.formGroup.controls.TypeOfParty.markAsDirty();
			this.formGroup.controls.CustomerType.markAsDirty();
			this.formGroup.controls.DinnerPax.markAsDirty();
			this.formGroup.controls.RealField.markAsDirty();
			this.formGroup.controls.Kids.markAsDirty();
			this.formGroup.controls.ForeignerNo.markAsDirty();
		}
		super.saveChange2();
	}
}
