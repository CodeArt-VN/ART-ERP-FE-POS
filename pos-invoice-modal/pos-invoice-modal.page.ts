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
import { dog } from 'src/environments/environment';

@Component({
	selector: 'app-pos-invoice-modal',
	templateUrl: './pos-invoice-modal.page.html',
	styleUrls: ['./pos-invoice-modal.page.scss'],
	standalone: false,
})
export class POSInvoiceModalPage extends PageBase {
	showSaveButton = true;
	showApplyButton = false;
	showSpinner = false;
	taxInfoGroup: FormGroup;
	isDefaultBusinessPartner = false;
	isCreatingCustomer = false;
	address: any;
	TaxCodeDataSource = [];
	showTaxInfoForm = false;
	taxInfoList = [];
	isPhoneValidated = false;
	isPhoneNumberValid = true;

	@Input() onUpdateContact: Function;
	@Input() defaultBusinessPartnerId: any = 0;
	@Input() canAddEInvoiceInfo: boolean = false;
	@Input() currentTaxInfoId: any = null;
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
			IsCorpTaxInfo: [true],
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
			selectedTaxInfoId: [''],
		});
	}

	loadData(event?: any, forceReload?: boolean): void {
		this.partnerTaxInfoProvider.read({ IDPartner: this.id }).then((data: any) => {
			this.taxInfoList = data['data'];
			this.taxInfoList.forEach((i) => {
				i._label = i.CompanyName || i.Name;
			});
			this.loadedData(event);
		});
	}

	loadedData(event) {
		super.loadedData(event);
		this.loadTaxCodeDataSource(this.taxInfoList);
		if (this.id == this.defaultBusinessPartnerId) {
			this.isDefaultBusinessPartner = true;
			this.taxInfoGroup.controls.Id.setValue(0);
			this.taxInfoGroup.controls.Id.markAsDirty();
			this.taxInfoGroup.enable();
			this.formGroup.controls.Name.setValue(null);
			this.formGroup.controls.WorkPhone.setValue(null);
			this.formGroup.controls.Email.setValue(null);
			this.checkRuleHasTax(this.taxInfoGroup.controls.IsCorpTaxInfo.value, false);
		} else {
			this.isDefaultBusinessPartner = false;
			this.taxInfoGroup.disable();
			this.isPhoneValidated = true;
			// this.formGroup.controls.selectedTaxInfoId.enable();
		}

		const workPhoneSubscription = this.formGroup.get('WorkPhone')?.valueChanges.subscribe((value) => {
			if (this.isPhoneValidated) this.isPhoneValidated = false;
		});
		if (workPhoneSubscription) {
			this.subscriptions.push(workPhoneSubscription);
		}
	}

	addNewTaxInfo() {
		this.resetTaxInfoGroup();
		this.showTaxInfoForm = true;
		this.taxInfoGroup.enable();
		this.taxInfoGroup.controls.Id.setValue(0);
		this.taxInfoGroup.controls.Id.markAsDirty();
		this.checkRuleHasTax(this.taxInfoGroup.controls.IsCorpTaxInfo.value, false);
	}

	loadTaxCodeDataSource(taxInfoList) {
		this.TaxCodeDataSource = [];
		if (taxInfoList) {
			this.TaxCodeDataSource = taxInfoList;
			let taxDefault = this.TaxCodeDataSource.find((d) => d.Id == this.currentTaxInfoId);
			if (taxDefault) {
				this.formGroup.controls.selectedTaxInfoId.setValue(taxDefault.Id);
				this.changeSelectTaxCode(taxDefault);
			} else if (this.currentTaxInfoId === -1) {
				this.formGroup.controls.selectedTaxInfoId.setValue(-1);
				this.changeSelectTaxCode({ Id: -1, CompanyName: 'Walk-in customer' });
			} else if (this.currentTaxInfoId === null || this.currentTaxInfoId === undefined) {
				this.formGroup.controls.selectedTaxInfoId.setValue(null);
				this.changeSelectTaxCode({ Id: null, CompanyName: 'Default tax info' });
			} else {
				this.formGroup.controls.selectedTaxInfoId.setValue(null);
			}
		}
		if (taxInfoList?.length) {
			this.TaxCodeDataSource.unshift({
				CompanyName: '----------',
				_label: '----------',
				disabled: true,
			});
		}
		// Add option for default tax info (null) - only if customer has tax addresses
		if (taxInfoList?.length > 0) {
			this.TaxCodeDataSource.unshift({
				Id: null,
				CompanyName: 'Default tax info',
				_label: 'Default tax info',
			});
		}
		// Add option for walk-in customer (-1) - always available
		this.TaxCodeDataSource.unshift({
			Id: -1,
			CompanyName: 'Walk-in customer',
			_label: 'Walk-in customer',
		});
		// Set _label for all items in datasource
		this.TaxCodeDataSource.forEach((item) => {
			if (!item._label) {
				item._label = item.CompanyName || item.Name;
			}
		});
	}

	async saveChange() {
		super.saveChange2(this.taxInfoGroup, this.pageConfig.pageName, this.partnerTaxInfoProvider);
		this.showSaveButton = false;
		this.showApplyButton = true;
	}

	apply(apply = false) {
		if (apply) {
			let selectedOption = this.formGroup.controls.selectedTaxInfoId.value;
			if (selectedOption === -1) {
				// Walk-in customer - do not get tax info
				let submitItem = {
					Id: this.id,
					IDAddress: this.address?.Address?.Id,
					IDTaxInfo: -1,
					TaxCode: null,
				};
				this.onUpdateContact(submitItem);
				this.modalController.dismiss(submitItem);
			} else if (!this.isDefaultBusinessPartner && (selectedOption === null || selectedOption === '' || selectedOption === undefined)) {
				// Default tax info - get default tax info (IsDefault = 1)
				let submitItem = {
					Id: this.id,
					IDAddress: this.address?.Address?.Id,
					IDTaxInfo: null,
					TaxCode: null,
				};
				this.onUpdateContact(submitItem);
				this.modalController.dismiss(submitItem);
			} else if (this.isDefaultBusinessPartner) {
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
							Name: savedItem.Name,
							IDAddress: savedItem.Address.Id,
							IDTaxInfo: taxInfo.Id,
							TaxCode: taxInfo.TaxCode,
							TaxAddresses: [taxInfo],
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
						TaxAddresses: [this.taxInfoGroup.getRawValue()],
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
							TaxAddresses: [taxInfo],
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
		this.showSaveButton = true;
		this.showApplyButton = false;
		this.formGroup.reset();
	}

	changeSelectTaxCode(selectedTaxInfo) {
		// Skip DOM Event objects (event bubbling)
		if (selectedTaxInfo && selectedTaxInfo.type && selectedTaxInfo.target) {
			// This is a DOM Event, get value from formControl instead
			selectedTaxInfo = this.formGroup.controls.selectedTaxInfoId.value;
		}

		dog && console.log('Selected tax code: ', selectedTaxInfo);

		// Get value from formControl if event is not valid
		let selectedId = null;
		let selectedTaxInfoObj = null;

		// If selectedTaxInfo is still a DOM Event or invalid, get from formControl
		if (!selectedTaxInfo || (typeof selectedTaxInfo === 'object' && 'type' in selectedTaxInfo && 'target' in selectedTaxInfo)) {
			selectedId = this.formGroup.controls.selectedTaxInfoId.value;
		} else if (typeof selectedTaxInfo === 'object' && 'Id' in selectedTaxInfo) {
			// Object with Id property
			selectedId = selectedTaxInfo.Id;
			selectedTaxInfoObj = selectedTaxInfo;
		} else {
			// Primitive value (Id)
			selectedId = selectedTaxInfo;
		}

		// Find the object from datasource if we only have Id
		if (!selectedTaxInfoObj && selectedId !== null && selectedId !== undefined && selectedId !== '' && selectedId !== -1) {
			selectedTaxInfoObj = this.TaxCodeDataSource.find((item) => item.Id === selectedId);
		}

		if (selectedId === -1) {
			// Walk-in customer - do not get tax info
			this.showTaxInfoForm = false;
			this.taxInfoGroup.disable();
		} else if (selectedId === null) {
			// Default tax info - get default tax info (IsDefault = 1)
			this.showTaxInfoForm = false;
			this.taxInfoGroup.disable();
		} else if (selectedId === '' || selectedId === undefined) {
			// Empty - show form to add new tax info
			this.showTaxInfoForm = true;
			this.taxInfoGroup.enable();
		} else {
			// Specific tax info - show selected tax info
			this.showTaxInfoForm = true;
			this.taxInfoGroup.disable();
			this.formGroup.controls.selectedTaxInfoId.enable();
			if (selectedTaxInfoObj) {
				this.taxInfoGroup.patchValue(selectedTaxInfoObj);
				// Check TaxCode after patchValue to set IsCorpTaxInfo correctly
				const taxCode = this.taxInfoGroup.controls.TaxCode.value;
				if (taxCode && taxCode.trim() !== '') {
					// Has TaxCode (MST) -> IsCorpTaxInfo = true
					this.taxInfoGroup.controls.IsCorpTaxInfo.setValue(true);
					this.checkRuleHasTax(true, false);
				} else {
					// No TaxCode -> IsCorpTaxInfo = false
					this.taxInfoGroup.controls.IsCorpTaxInfo.setValue(false);
					this.checkRuleHasTax(false, false);
				}
			}
		}

		// Force change detection after state changes
		setTimeout(() => {
			this.cdr.markForCheck();
			this.cdr.detectChanges();
		}, 0);
	}

	resetTaxInfoGroup() {
		this.taxInfoGroup.reset();
		this.taxInfoGroup.controls.IDPartner.setValue(this.id);
		this.taxInfoGroup.controls.IDPartner.markAsDirty();
		this.taxInfoGroup.controls.IsCorpTaxInfo.setValue(true);
	}

	changeTaxCode(event) {
		let value = event.target.value;
		this.showSaveButton = true;
		this.showApplyButton = false;
		this.taxInfoGroup.controls.CompanyName.patchValue('');
		this.taxInfoGroup.controls.BillingAddress.patchValue('');

		// If TaxCode has value, set IsCorpTaxInfo = true
		if (value && value.trim() !== '') {
			this.taxInfoGroup.controls.IsCorpTaxInfo.setValue(true);
			this.checkRuleHasTax(true, false);
		}

		if (value.length > 9) {
			this.showSpinner = true;
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
					this.showSpinner = false;
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
						// Ensure IsCorpTaxInfo = true when TaxCode is valid
						this.taxInfoGroup.controls.IsCorpTaxInfo.setValue(true);
						this.checkRuleHasTax(true, false);
						// Disable lại các field vì đã có dữ liệu từ API
						this.taxInfoGroup.controls.CompanyName.disable();
						this.taxInfoGroup.controls.BillingAddress.disable();
					}
				})
				.catch((err) => {
					this.showSpinner = false;
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

	hasTaxChange(event) {
		// this.formGroup.reset();
		const isCorpTaxInfo = this.taxInfoGroup.controls.IsCorpTaxInfo.value;
		this.checkRuleHasTax(isCorpTaxInfo);
		if (!isCorpTaxInfo && this.taxInfoGroup.controls.TaxCode.value != '') {
			this.taxInfoGroup.controls.TaxCode.setValue(null);
			this.taxInfoGroup.controls.TaxCode.markAsDirty();
		}
	}

	checkRuleHasTax(hasTaxCode, isEnable = true) {
		if (!hasTaxCode) {
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
		this.showApplyButton = true;
		this.showSaveButton = false;
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
						this.isPhoneValidated = true;
						this.isPhoneNumberValid = true;
					} else {
						this.isPhoneValidated = true;
						this.isPhoneNumberValid = false;
						dog && console.log(result);
						let contact = result[0];
						this.env
							.showPrompt('Would you like to select this customer?', {
								code: 'WORKPHONE_ALREADY_IN_USE',
								Name: contact.Name,
								WorkPhone: contact.WorkPhone,
							})
							.then((_) => {
								this.id = contact.Id;
								this.address = contact;
								this.isPhoneNumberValid = true;
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
