import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { ModalController, NavController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Component({
	selector: 'app-pos-add-contact-modal',
	templateUrl: './pos-add-contact-modal.page.html',
	styleUrls: ['./pos-add-contact-modal.page.scss'],
	standalone: false,
})
export class POSAddContactModalPage extends PageBase {
	formGroup: FormGroup;
	constructor(
		public pageProvider: CRM_ContactProvider,
		public env: EnvService,
		public navCtrl: NavController,

		public modalController: ModalController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
		this.id = 0;

		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			Id: [''],
			Code: [''],
			Name: ['', Validators.required],

			CompanyName: ['', Validators.required],
			BillingAddress: ['', Validators.required],
			TaxCode: ['', Validators.required],

			Remark: [''],
			Address: this.formBuilder.group({
				Id: [''],
				Phone1: ['', Validators.required],
				Contact: ['', Validators.required],
				Province: [''],
				District: [''],
				Ward: [''],
				AddressLine1: ['', Validators.required],
				AddressLine2: [''],
			}),

			IsPersonal: ['', Validators.required],
		});
	}

	loadedData() {
		super.loadedData();
		if (!this.item) {
			this.item = {};
		}
		this.item.IDOwner = this.env.user.StaffID;
		this.pageConfig.pageName = 'add-contact';
	}

	async saveChange() {
		this.formGroup;
		super.saveChange2();
	}

	savedChange(savedItem = null, form = this.formGroup) {
		form.controls.Id.setValue(savedItem.Id);
		form.controls.Address['controls'].Id.setValue(savedItem.IDAddress);
		this.env.publishEvent({
			Code: this.pageConfig.pageName,
			data: form.getRawValue(),
		});
		this.addNewContact(true);
	}

	addNewContact(apply = false) {
		if (apply) {
			this.modalController.dismiss([this.formGroup.value, apply]);
		} else {
			this.modalController.dismiss([null, apply]);
		}
	}
}
