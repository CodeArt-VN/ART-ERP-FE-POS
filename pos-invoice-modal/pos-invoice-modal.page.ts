import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { ModalController, NavController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_PartnerTaxInfoProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';
import { el } from '@fullcalendar/core/internal-common';

@Component({
	selector: 'app-pos-invoice-modal',
	templateUrl: './pos-invoice-modal.page.html',
	styleUrls: ['./pos-invoice-modal.page.scss'],
	standalone: false,
})
export class POSInvoiceModalPage extends PageBase {
	IsShowSave = true;
	IsShowApply = false;
	IsShowSpinner = false;
	isNoTax = false;
	optionalTax = '';
	taxInfoGroup: FormGroup;
	_isDefaultBP = false;
	_IsCreateCustomer = false;
	_canEditEInvoiceInfo = false;
	constructor(
		public pageProvider: CRM_ContactProvider,
		public partnerTaxInfoProvider: CRM_PartnerTaxInfoProvider,
		public env: EnvService,
		public navCtrl: NavController,

		public modalController: ModalController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.taxInfoGroup = formBuilder.group({
			IDPartner: [''],
			Id: [''],
			Name: ['', Validators.required],
			TaxCode: ['', Validators.required],
			CompanyName: new FormControl({ value: '', disabled: true }, Validators.required),
			Email: ['', Validators.required],
			BillingAddress: new FormControl({ value: '', disabled: true }, Validators.required),
			WorkPhone: ['', Validators.required],
			IdentityCardNumber: [''],
			IsDefault: [''],
			Address: this.formBuilder.group({
				Id: [''],
				Phone1: [''],
				Contact: [''],
			}),
		});
		this.formGroup = formBuilder.group({
			Id: [0],
			WorkPhone: ['', Validators.required],
			Name: ['', Validators.required],
			TaxCode: [''],
			Address: this.formBuilder.group({
				Id: [''],
				Phone1: [''],
				Contact: [''],
			}),
		});
	}

	loadedData(event) {
		super.loadedData(event);
		if (this.item) {
			this.taxInfoGroup.controls.IDPartner.setValue(this.item.Id);
			this.taxInfoGroup.controls.IDPartner.markAsDirty();
		}
		if (this.item?.TaxInfos.length > 0) {
			let taxInfos = this.item.TaxInfos.sort((a, b) => Number(b.IsDefault) - Number(a.IsDefault));
			if (taxInfos.length > 0) {
				let taxInfo = taxInfos[0];
				this.taxInfoGroup.patchValue(taxInfo);
				// this.formGroup.controls.TaxCode.setValue(taxInfo.TaxCode);
				// this.formGroup.controls.CompanyName.setValue(taxInfo.CompanyName);
				// this.formGroup.controls.Email.setValue(taxInfo.Email);
				// this.formGroup.controls.BillingAddress.setValue(taxInfo.BillingAddress);
				// this.formGroup.controls.IdentityCardNumber.setValue(taxInfo.IdentityCardNumber);
				// this.formGroup.controls.Id.setValue(taxInfo.Id);

				// this.formGroup.controls.CompanyName.enable();
				// this.formGroup.controls.BillingAddress.enable();
				// this.formGroup.controls.TaxCode.clearValidators();
				// this.formGroup.controls.TaxCode.updateValueAndValidity();
			}
		}

		if (!this._canEditEInvoiceInfo) {
			this.taxInfoGroup.disable();
		}

		if (!this.formGroup.invalid) {
			this.IsShowSave = false;
			this.IsShowApply = true;
		}
	}
	async saveChange() {
		super.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider);
		this.IsShowSave = false;
		this.IsShowApply = true;
	}
	Apply(apply = false) {
		if (apply) {
			if (this._isDefaultBP) {
				if (this.taxInfoGroup.controls.IsDefault) {
					this.formGroup.controls.TaxCode.setValue(this.taxInfoGroup.controls.TaxCode.value);
					this.formGroup.controls.TaxCode.markAsDirty();
				}
				this.formGroup.controls.Id.setValue(0);
				this.formGroup.controls.Id.markAsDirty();
				this.formGroup.addControl('IsPersonal', new FormControl({ value: true, disabled: false }));
				this.formGroup.controls.IsPersonal.markAsDirty();
				let WorkPhone = this.taxInfoGroup.controls.WorkPhone.value;
				let Name = this.taxInfoGroup.controls.Name.value;
				this.formGroup.controls.Name.setValue(Name);
				this.formGroup.controls.Name.markAsDirty();
				this.formGroup.controls.Address['controls'].Id.setValue(0);
				this.formGroup.controls.Address['controls'].Phone1.patchValue(WorkPhone);
				this.formGroup.controls.Address['controls'].Contact.patchValue(Name);
				this.formGroup.controls.Address['controls'].Phone1.markAsDirty();
				this.formGroup.controls.Address['controls'].Contact.markAsDirty();
				this.formGroup.controls.Address['controls'].Id.markAsDirty();

				this.saveChange2().then((savedItem: any) => {
					this.taxInfoGroup.controls.IDPartner.setValue(savedItem.Id);
					this.taxInfoGroup.controls.IDPartner.markAsDirty();
					this.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider);
					this.modalController.dismiss(savedItem);
				});
			} else {
				this.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider);
				this.modalController.dismiss(undefined);
			}
		} else {
			this.modalController.dismiss(undefined);
		}
	}
	reset() {
		this.IsShowSave = true;
		this.IsShowApply = false;
		this.formGroup.reset();
	}
	changeTaxCode(event) {
		let value = event.target.value;
		this.IsShowSave = true;
		this.IsShowApply = false;
		this.taxInfoGroup.controls.CompanyName.patchValue('');
		this.taxInfoGroup.controls.BillingAddress.patchValue('');
		if (value.length > 9) {
			this.IsShowSpinner = true;
			Object.assign(this.query, { TaxCode: value });
			let apiPath = {
				method: 'GET',
				url: function () {
					return ApiSetting.apiDomain('CRM/Contact/SearchUnitInforByTaxCode');
				},
			};
			this.commonService
				.connect(apiPath.method, apiPath.url(), this.query)
				.toPromise()
				.then((result: any) => {
					this.patchValue(result);
					this.IsShowSpinner = false;
				})
				.catch((err) => {
					this.env.showMessage('Mã số thuế không hợp lệ!', 'danger');
					this.IsShowSpinner = false;
				});
		}
	}
	patchValue(data) {
		this.taxInfoGroup.controls.CompanyName.patchValue(data.TenChinhThuc);
		this.taxInfoGroup.controls.BillingAddress.patchValue(data.DiaChiGiaoDichChinh);
		this.taxInfoGroup.controls.CompanyName.markAsDirty();
		this.taxInfoGroup.controls.BillingAddress.markAsDirty();
	}

	hasTaxChange(e) {
		this.formGroup.reset();
		this.optionalTax = e.target.value;
		if (e.target.value == 'noTax') {
			this.isNoTax = true;
			this.formGroup.controls.TaxCode.clearValidators();
			this.formGroup.controls.CompanyName.enable();
			this.formGroup.controls.BillingAddress.enable();
			this.formGroup.controls.TaxCode.updateValueAndValidity();
		} else {
			this.isNoTax = false;
			this.formGroup.controls.CompanyName.disable();
			this.formGroup.controls.BillingAddress.disable();
		}
	}

	changeContactInfo() {
		this.taxInfoGroup.controls.Name.setValue(this.formGroup.controls.Name.value);
		this.taxInfoGroup.controls.WorkPhone.setValue(this.formGroup.controls.WorkPhone.value);
		this.taxInfoGroup.controls.Name.markAsDirty();
		this.taxInfoGroup.controls.WorkPhone.markAsDirty();
		this.IsShowApply = true;
		this.IsShowSave = false;
	}
}
