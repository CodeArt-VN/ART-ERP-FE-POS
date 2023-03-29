import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { ModalController, NavController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';


@Component({
	selector: 'app-pos-invoice-modal',
	templateUrl: './pos-invoice-modal.page.html',
	styleUrls: ['./pos-invoice-modal.page.scss'],
})
export class POSInvoiceModalPage extends PageBase {
	IsShowSave = true;
	IsShowApply = false;
	constructor(
		public pageProvider: CRM_ContactProvider,
		public env: EnvService,
		public navCtrl: NavController,

		public modalController: ModalController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,

	) {
		super();	
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			Id: [''],
			Name: ['',Validators.required],
			TaxCode: ['',Validators.required],
			CompanyName: ['',Validators.required],
			Email: ['', Validators.required],
			BillingAddress: ['', Validators.required]
		});
		
	}
	loadedData(event) {
		super.loadedData(event);
		if (!this.formGroup.invalid) {		
			this.IsShowSave = false;
			this.IsShowApply = true;
		}	
	}
	async saveChange() {
		if (this.formGroup.invalid) {		
			return;		
		}	
		super.saveChange2();	
		this.IsShowSave = false;
		this.IsShowApply = true;
	}
	Apply(apply = false) {
        if (apply) {
            this.modalController.dismiss(true);
        }
        else {
            this.modalController.dismiss();
        }
	}
	reset(){	
		this.IsShowSave = true;
		this.IsShowApply = false;
		this.formGroup.reset();
	}
}
