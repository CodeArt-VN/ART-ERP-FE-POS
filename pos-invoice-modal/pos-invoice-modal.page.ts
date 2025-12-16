import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { ModalController, NavController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_PartnerTaxInfoProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';
import { el } from '@fullcalendar/core/internal-common';
import { TranslateService } from '@ngx-translate/core';

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
	optionalTax = 'hasTax';
	taxInfoGroup: FormGroup;
	_isDefaultBP = false;
	_IdDefaultBusinessPartner = 0;
	_IsCreateCustomer = false;
	_canAddEInvoiceInfo = false;
	idTaxInfo = 0;

	textDefault = 'Guest customer';
	textNewTaxInfo = 'New tax info';
	TaxCodeDataSource = [];
	isShowInfo = false;
	isAddNew = false;
	constructor(
		public pageProvider: CRM_ContactProvider,
		public partnerTaxInfoProvider: CRM_PartnerTaxInfoProvider,
		public env: EnvService,
		public navCtrl: NavController,

		public modalController: ModalController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,
		public translate: TranslateService
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.taxInfoGroup = formBuilder.group({
			IDPartner: [''],
			Id: [''],
			TaxCode: ['', Validators.required],
			CompanyName: new FormControl({ value: '', disabled: true }, Validators.required),
			Email: ['', Validators.required],
			BillingAddress: new FormControl({ value: '', disabled: true }, Validators.required),
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
			_OptionCode: [''],
		});
	}

	preLoadData(event) {
		Promise.all([this.translate.get(['Guest customer', 'New tax info']).toPromise()]).then((value: any) => {
			this.textDefault = value[0]['Guest customer'];
			this.textNewTaxInfo = value[0]['New tax info'];
			super.preLoadData(event);
		});
	}

	loadedData(event) {
		super.loadedData(event);
		if (this.item) {
			this.taxInfoGroup.controls.IDPartner.setValue(this.item.Id);
			this.taxInfoGroup.controls.IDPartner.markAsDirty();
		}
		this.LoadTaxCodeDataSource(this.item);
		if (this.id == this._IdDefaultBusinessPartner) {
			this._isDefaultBP = true;
			this.formGroup.controls._OptionCode.setValue('AddNew');
			this.taxInfoGroup.controls.Id.setValue(0);
			this.taxInfoGroup.controls.Id.markAsDirty();
			this.formGroup.controls.Name.setValue(null);
			this.formGroup.controls.WorkPhone.setValue(null);
		} else {
			this.taxInfoGroup.disable();
			this.formGroup.controls._OptionCode.enable();
		}

		if (this._canAddEInvoiceInfo) {
			this.TaxCodeDataSource.push({
				Id: 'AddNew',
				CompanyName: this.textNewTaxInfo,
			});
		}
	}

	LoadTaxCodeDataSource(i) {
		this.TaxCodeDataSource = [];
		if (i?.TaxInfos) {
			this.TaxCodeDataSource = i.TaxInfos;
			let taxDefault = this.TaxCodeDataSource.find((d) => d.Id == this.idTaxInfo);
			if (taxDefault) {
				this.formGroup.controls._OptionCode.setValue(taxDefault.Id);
				this.changeSelectTaxCode(taxDefault);
			}
		}
		if (i?.TaxInfos?.length) {
			this.TaxCodeDataSource.unshift({
				CompanyName: '----------',
				disabled: true,
			});
		}
		this.TaxCodeDataSource.unshift({
			Id: '',
			CompanyName: this.textDefault,
		});
	}

	async saveChange() {
		super.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider);
		this.IsShowSave = false;
		this.IsShowApply = true;
	}
	Apply(apply = false) {
		if (apply) {
			if (this.formGroup.controls._OptionCode.value == '') {
				let submitItem = {
					Id: this.id,
					Address: this.item.Address,
					IDTaxInfo: null,
					TaxCode: null,
				};
				this.modalController.dismiss(submitItem);
			} else if (this._isDefaultBP) {
				if (this.taxInfoGroup.controls.IsDefault) {
					this.formGroup.controls.TaxCode.setValue(this.taxInfoGroup.controls.TaxCode.value);
					this.formGroup.controls.TaxCode.markAsDirty();
				}
				this.formGroup.controls.Id.setValue(0);
				this.formGroup.controls.Id.markAsDirty();
				this.formGroup.addControl('IsPersonal', new FormControl({ value: true, disabled: false }));
				this.formGroup.controls.IsPersonal.markAsDirty();
				let WorkPhone = this.formGroup.controls.WorkPhone.value;
				let Name = this.formGroup.controls.Name.value;
				this.formGroup.controls.Address['controls'].Id.setValue(0);
				this.formGroup.controls.Address['controls'].Phone1.patchValue(WorkPhone);
				this.formGroup.controls.Address['controls'].Contact.patchValue(Name);
				this.formGroup.controls.Address['controls'].Phone1.markAsDirty();
				this.formGroup.controls.Address['controls'].Contact.markAsDirty();
				this.formGroup.controls.Address['controls'].Id.markAsDirty();

				this.saveChange2().then((savedItem: any) => {
					this.taxInfoGroup.controls.IDPartner.setValue(savedItem.Id);
					this.taxInfoGroup.controls.IDPartner.markAsDirty();
					this.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider).then((taxInfo: any) => {
						let submitItem = {
							Id: savedItem.Id,
							Address: savedItem.Address,
							IDTaxInfo: taxInfo.Id,
							TaxCode: taxInfo.TaxCode,
						};
						this.modalController.dismiss(submitItem);
					});
				});
			} else {
				this.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider).then((taxInfo: any) => {
					let submitItem = {
						Id: this.id,
						Address: this.item.Address,
						IDTaxInfo: taxInfo.Id,
						TaxCode: taxInfo.TaxCode,
					};
					this.modalController.dismiss(submitItem);
				});
				// this.modalController.dismiss(undefined);
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

	changeSelectTaxCode(i) {
		console.log('Selected tax code: ', i);
		switch (i.Id) {
			case '':
				this.isShowInfo = false;
				break;
			case 'AddNew':
				this.resetTaxInfoGroup();
				this.isShowInfo = true;
				this.taxInfoGroup.enable();
				this.taxInfoGroup.controls.Id.setValue(0);
				this.taxInfoGroup.controls.Id.markAsDirty();
				this.checkRuleHasTax(this.optionalTax, false);
				break;
			default:
				this.isShowInfo = true;
				this.taxInfoGroup.disable();
				this.formGroup.controls._OptionCode.enable();
				this.taxInfoGroup.patchValue(i);
				if (!i.TaxCode) {
					this.checkRuleHasTax('noTax', false);
					this.optionalTax = 'noTax';
				} else {
					this.checkRuleHasTax('hasTax', false);
					this.optionalTax = 'hasTax';
				}
				break;
		}
	}

	resetTaxInfoGroup() {
		this.taxInfoGroup.reset();
		this.taxInfoGroup.controls.IDPartner.setValue(this.item.Id);
		this.taxInfoGroup.controls.IDPartner.markAsDirty();
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
		// this.formGroup.reset();
		this.optionalTax = e.target.value;
		this.checkRuleHasTax(e.target.value);
		if (this.optionalTax == 'noTax' && this.taxInfoGroup.controls.TaxCode.value != '') {
			this.taxInfoGroup.controls.TaxCode.setValue(null);
			this.taxInfoGroup.controls.TaxCode.markAsDirty();
		}
	}

	checkRuleHasTax(e, isEnable = true) {
		if (e == 'noTax') {
			this.taxInfoGroup.controls.TaxCode.clearValidators();
			if (isEnable) {
				this.taxInfoGroup.controls.CompanyName.enable();
				this.taxInfoGroup.controls.BillingAddress.enable();
			}
			this.taxInfoGroup.controls.TaxCode.updateValueAndValidity();
			this.taxInfoGroup.controls.BillingAddress.clearValidators();
			this.taxInfoGroup.controls.BillingAddress.updateValueAndValidity();
		} else {
			this.taxInfoGroup.controls.TaxCode.setValidators([Validators.required]);
			this.taxInfoGroup.controls.TaxCode.updateValueAndValidity();
			this.taxInfoGroup.controls.IdentityCardNumber.clearValidators();
			this.taxInfoGroup.controls.IdentityCardNumber.updateValueAndValidity();
			this.taxInfoGroup.controls.CompanyName.disable();
			this.taxInfoGroup.controls.BillingAddress.disable();
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
