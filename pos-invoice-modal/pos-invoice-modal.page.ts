import { Component, OnInit, ChangeDetectorRef, Input } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { ModalController, NavController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_PartnerTaxInfoProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormGroup, FormControl, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';
import { TranslateService } from '@ngx-translate/core';
import { TreePageModule } from '../../_template/tree/tree.module';

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
	address: any;
	textDefault = 'Guest customer';
	TaxCodeDataSource = [];
	isShowInfo = false;
	isAddNew = false;
	taxInfoList = [];
	IsPhoneChecked = false;
	IsPhoneValid = true;

	@Input() onUpdateContact: Function;
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
			Name: ['', Validators.required],
			TaxCode: ['', Validators.required],
			CompanyName: new FormControl({ value: '', disabled: true }, Validators.required),
			Email: ['', [Validators.required, multiEmailValidator()]],
			BillingAddress: new FormControl({ value: '', disabled: true }, Validators.required),
			IdentityCardNumber: [''],
			IsDefault: [false],
			Address: this.formBuilder.group({
				Id: [''],
				Phone1: [''],
				Contact: [''],
			}),
			WorkPhone: [''],
			optionalTax: ['hasTax'],
		});
		this.formGroup = formBuilder.group({
			Id: [0],
			WorkPhone: ['', Validators.required],
			Name: ['', Validators.required],
			Email: ['', Validators.email],
			Address: this.formBuilder.group({
				Id: [''],
				Phone1: [''],
				Contact: [''],
			}),
			_OptionCode: [''],
		});
	}

	preLoadData(event) {
		Promise.all([this.translate.get(['Guest customer']).toPromise()]).then((value: any) => {
			this.textDefault = value[0]['Guest customer'];
			super.preLoadData(event);
		});
	}

	loadData(event?: any, forceReload?: boolean): void {
		this.partnerTaxInfoProvider.read({ IDPartner: this.id }).then((data: any) => {
			this.taxInfoList = data['data'];
			this.loadedData(event);
		});
	}

	loadedData(event) {
		super.loadedData(event);
		this.LoadTaxCodeDataSource(this.taxInfoList);
		if (this.id == this._IdDefaultBusinessPartner) {
			this._isDefaultBP = true;
			this.formGroup.controls._OptionCode.setValue('AddNew');
			this.taxInfoGroup.controls.Id.setValue(0);
			this.taxInfoGroup.controls.Id.markAsDirty();
			this.formGroup.controls.Name.setValue(null);
			this.formGroup.controls.WorkPhone.setValue(null);
			this.formGroup.controls.Email.setValue(null);
			this.checkRuleHasTax(this.optionalTax, false);
		} else {
			this._isDefaultBP = false;
			this.taxInfoGroup.disable();
			this.IsPhoneChecked = true;
			// this.formGroup.controls._OptionCode.enable();
		}

		const workPhoneSubscription = this.formGroup.get('WorkPhone')?.valueChanges.subscribe((value) => {
			if (this.IsPhoneChecked) this.IsPhoneChecked = false;
		});
		if (workPhoneSubscription) {
			this.subscriptions.push(workPhoneSubscription);
		}
	}

	addNewTaxInfo() {
		this.formGroup.controls._OptionCode.setValue('AddNew');
		this.resetTaxInfoGroup();
		this.isShowInfo = true;
		this.taxInfoGroup.enable();
		this.taxInfoGroup.controls.Id.setValue(0);
		this.taxInfoGroup.controls.Id.markAsDirty();
		this.checkRuleHasTax(this.optionalTax, false);
	}

	LoadTaxCodeDataSource(i) {
		this.TaxCodeDataSource = [];
		if (i) {
			this.TaxCodeDataSource = i;
			let taxDefault = this.TaxCodeDataSource.find((d) => d.Id == this.idTaxInfo);
			if (taxDefault) {
				this.formGroup.controls._OptionCode.setValue(taxDefault.Id);
				this.changeSelectTaxCode(taxDefault);
			} else {
				this.formGroup.controls._OptionCode.setValue('');
			}
		}
		if (i?.length) {
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
					IDAddress: this.address?.Address?.Id,
					IDTaxInfo: null,
					TaxCode: null,
				};
				this.modalController.dismiss(submitItem);
			} else if (this._isDefaultBP) {
				if (this.taxInfoGroup.controls.IsDefault.value) {
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
							IDAddress: savedItem.Address.Id,
							IDTaxInfo: taxInfo.Id,
							TaxCode: taxInfo.TaxCode,
						};
						this.onUpdateContact(submitItem);
						this.modalController.dismiss(submitItem);
					});
				});
			} else {
				if (this.taxInfoGroup.disabled) {
					let submitItem = {
						Id: this.id,
						IDAddress: this.address?.Address?.Id,
						IDTaxInfo: this.taxInfoGroup.controls.Id.value,
						TaxCode: this.taxInfoGroup.controls.TaxCode.value,
					};
					this.onUpdateContact(submitItem);
					this.modalController.dismiss(submitItem);
				} else {
					this.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider).then((taxInfo: any) => {
						let submitItem = {
							Id: this.id,
							IDAddress: this.address?.Address?.Id,
							IDTaxInfo: taxInfo.Id,
							TaxCode: taxInfo.TaxCode,
						};
						this.onUpdateContact(submitItem);
						this.modalController.dismiss(submitItem);
					});
				}

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
		this.taxInfoGroup.controls.IDPartner.setValue(this.id);
		this.taxInfoGroup.controls.IDPartner.markAsDirty();
		this.taxInfoGroup.controls.optionalTax.setValue('hasTax');
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
					this.IsShowSpinner = false;
					if (result.Success === false || !result.TenChinhThuc) {
						// API trả về lỗi hoặc không tìm thấy thông tin
						const errorMessage = result?.Message || 'INVALID_TAX_CODE';
						this.env.showMessage(errorMessage, 'danger');
						// Enable các field để người dùng nhập thủ công
						this.taxInfoGroup.controls.CompanyName.enable();
						this.taxInfoGroup.controls.BillingAddress.enable();
					} else {
						// API thành công, tự động điền thông tin
						this.patchValue(result);
						// Disable lại các field vì đã có dữ liệu từ API
						this.taxInfoGroup.controls.CompanyName.disable();
						this.taxInfoGroup.controls.BillingAddress.disable();
					}
				})
				.catch((err) => {
					this.IsShowSpinner = false;
					this.env.showMessage('INVALID_TAX_CODE', 'danger');
					// Enable các field để người dùng nhập thủ công khi có lỗi
					this.taxInfoGroup.controls.CompanyName.enable();
					this.taxInfoGroup.controls.BillingAddress.enable();
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
		this.optionalTax = this.taxInfoGroup.controls.optionalTax.value;
		this.checkRuleHasTax(this.optionalTax);
		if (this.optionalTax == 'noTax' && this.taxInfoGroup.controls.TaxCode.value != '') {
			this.taxInfoGroup.controls.TaxCode.setValue(null);
			this.taxInfoGroup.controls.TaxCode.markAsDirty();
		}
	}

	checkRuleHasTax(e, isEnable = true) {
		if (e == 'noTax') {
			this.taxInfoGroup.controls.TaxCode.clearValidators();
			this.taxInfoGroup.controls.CompanyName.clearValidators();

			if (isEnable) {
				this.taxInfoGroup.controls.BillingAddress.enable();
			}
			this.taxInfoGroup.controls.TaxCode.updateValueAndValidity();
			this.taxInfoGroup.controls.CompanyName.updateValueAndValidity();

			this.taxInfoGroup.controls.BillingAddress.clearValidators();
			this.taxInfoGroup.controls.BillingAddress.updateValueAndValidity();
			this.taxInfoGroup.controls.Name.setValidators([Validators.required]);
			this.taxInfoGroup.controls.Name.updateValueAndValidity();
		} else {
			this.taxInfoGroup.controls.Name.clearValidators();
			this.taxInfoGroup.controls.Name.updateValueAndValidity();
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

	checkPhoneNumber() {
		if (this.formGroup.controls.WorkPhone.valid) {
			this.pageProvider
				.search({
					WorkPhone_eq: this.formGroup.controls.WorkPhone.value,
					skipMCP: true,
				})
				.toPromise()
				.then((result: any) => {
					if (result.length == 0 || result.some((e) => e.Id == this.id)) {
						this.formGroup.controls.WorkPhone.setErrors(null);
						this.IsPhoneChecked = true;
						this.IsPhoneValid = true;
					} else {
						this.IsPhoneChecked = true;
						this.IsPhoneValid = false;
						console.log(result);
						let contact = result[0];
						this.env
							.showPrompt(
								
								'Would you like to select this customer?',
								{
									code: 'WORKPHONE_ALREADY_IN_USE',
									Name: contact.Name,
									WorkPhone: contact.WorkPhone,
								}
							)
							.then((_) => {
								this.id = contact.Id;
								this.address = contact;
								this.IsPhoneValid = true;
								this.onUpdateContact(contact);
								this.refresh();
							})
							.catch((e) => {
								this.formGroup.controls.WorkPhone.setValue(null);
							});

						// this.env.showMessage(message.Message, 'danger', message, 5000, true, message.SubHeader, message.Header);
					}
				});
		}
	}
}

export function multiEmailValidator(): ValidatorFn {
	return (control: AbstractControl): ValidationErrors | null => {
		if (!control.value) {
			return null; // cho phép rỗng
		}

		const emails = control.value
			.split(';')
			.map((e: string) => e.trim())
			.filter((e: string) => e.length > 0);

		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

		const invalidEmails = emails.filter((e) => !emailRegex.test(e));

		return invalidEmails.length > 0 ? { multiEmailInvalid: { invalidEmails } } : null;
	};
}
