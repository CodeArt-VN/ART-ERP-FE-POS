import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BANK_IncomingPaymentProvider, HRM_StaffProvider, POS_ShiftOrderProvider, POS_ShiftProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';


@Component({
	selector: 'app-pos-shift-detail',
	templateUrl: './pos-shift-detail.page.html',
	styleUrls: ['./pos-shift-detail.page.scss'],
	standalone: false,
})
export class POSShiftDetailPage extends PageBase {
	formGroup: FormGroup;
	_staffDataSource = this.buildSelectDataSource((term) => {
		return this.staffProvider.search({ Take: 20, Skip: 0, Term: term });
	});
	_staffReceiveDataSource = this.buildSelectDataSource((term) => {
		return this.staffProvider.search({ Take: 20, Skip: 0, Term: term });
	});
	confirmingRequest = false;
	constructor(
		public pageProvider: POS_ShiftProvider,
		public staffProvider: HRM_StaffProvider,
		public incomingPaymentProvider: BANK_IncomingPaymentProvider,
		public shiftOrderProvider: POS_ShiftOrderProvider,
		public saleOrderProvider: SALE_OrderProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public navParams: NavParams,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.id = this.route.snapshot.paramMap.get('id');
		this.buildForm();
	}
	buildForm() {
		this.formGroup = this.formBuilder.group({
			IDBranch: [this.env.selectedBranch.Id],
			CreatedBy: [''],
			IDPreviousShift: [''],
			Id: [''],
			IDTerminal: [''],
			IDClosingStaff: [''],
			StartDate: [this.getFormattedDate(new Date())],
			EndDate: [''],
			OpeningCash: new FormControl({ value: '', disabled: true }),
			ClosingCash: [''],
			ExpectedCash: [''],
			CashDifference: new FormControl({ value: '', disabled: true }),
			CashAmount: new FormControl({ value: '', disabled: true }),
			CardAmount: new FormControl({ value: '', disabled: true }),
			TransferAmount: new FormControl({ value: '', disabled: true }),
			ApplyPayAmount: new FormControl({ value: '', disabled: true }),
			ZalopayAppAmount: new FormControl({ value: '', disabled: true }),
			OtherAmount: new FormControl({ value: '', disabled: true }),

			CanceledOrder: new FormControl({ value: '', disabled: true }),
			ApprovedOrder: new FormControl({ value: '', disabled: true }),
			SplittedOrder: new FormControl({ value: '', disabled: true }),
			NewOrder: new FormControl({ value: '', disabled: true }),
			TemporaryBillOrder: new FormControl({ value: '', disabled: true }),
			DebtOrder: new FormControl({ value: '', disabled: true }),
			ScheduledOrder: new FormControl({ value: '', disabled: true }),
			DoneOrder: new FormControl({ value: '', disabled: true }),
			MergedOrder: new FormControl({ value: '', disabled: true }),
			UnapprovedOrder: new FormControl({ value: '', disabled: true }),
			// IDToStaff: [''],
			Status: new FormControl({ value: 'Open', disabled: true }),
			ClosingReason: [''],
			Remark: [''],
		});
		this.formGroup.valueChanges.subscribe(values => {
			const expected = parseFloat(this.formGroup.get('ExpectedCash').value) || 0;
			const closing = parseFloat(values.ClosingCash) || 0;
			const difference = closing - expected; // hoặc expected - closing tuỳ bạn muốn hiển thị dấu âm/dương

			this.formGroup.patchValue(
				{ CashDifference: difference },
				{ emitEvent: false } // tránh loop vô hạn
			);
		}
		);
	}
	preLoadData() {
		if (this.navParams) {
			this.item = JSON.parse(JSON.stringify(this.navParams.data.item));
			// this.id = this.navParams.data.id;
			if (this.pageConfig.canEdit || this.pageConfig.canEditBranch) {
				this.formGroup.enable();
			}
			if (this.item.Status == 'Open') {
				this.item.EndDate = this.getFormattedDate(new Date());
				this.item.IDClosingStaff = this.env.user.StaffID;
				this.item._ClosingStaff = {
					Id: this.env.user.StaffID,
					Name: this.env.user.FullName,
					FullName: this.env.user.FullName
				};
				this.loadedData();
				// Promise.all([this.getPaymentInShift(this.item.StartDate, this.item.EndDate), this.getOrderInShift(this.item.StartDate, this.item.EndDate)]).finally(() => { this.loadedData(); });
			}
			else this.loadedData();
		}
		else this.loadedData();
	}

	loadedData() {
		if (this.item._ClosingStaff) {
			this._staffDataSource.selected.push(this.item._ClosingStaff);
		}
		this._staffDataSource.selected = [...this._staffDataSource.selected];
		this._staffDataSource.initSearch();
		this._staffReceiveDataSource.initSearch();
		super.loadedData();
		switch (this.formGroup.get('Status').value) {
			case 'Unconfirmed': {
				// this.formGroup.get('OpeningCash').enable();
				break;
			};
			case 'Open': {
				this.formGroup.get('OpeningCash').disable();
				this.formGroup.get('ClosingCash').markAsDirty();
				this.formGroup.get('ClosingCash').markAsDirty();
				// this.formGroup.get('IDToStaff').setValidators([Validators.required]);
				this.formGroup.get('ClosingCash').setValidators([Validators.required]);
				this.formGroup.get('ExpectedCash').markAsDirty();
				this.formGroup.get('ExpectedCash').disable();
				this.formGroup.get('IDClosingStaff').markAsDirty();
				this.formGroup.get('IDClosingStaff').disable();

				this.formGroup.get('EndDate').setValue(this.getFormattedDate(new Date()));
				this.formGroup.get('EndDate').markAsDirty();
				this.formGroup.get('EndDate').disable();
				this.formGroup.get('StartDate').disable();

				// this.formGroup.get('IDToStaff').updateValueAndValidity();
				this.formGroup.get('ClosingCash').updateValueAndValidity();
				Promise.all([this.getPaymentInShift(this.formGroup.get('StartDate').value, this.formGroup.get('EndDate').value), this.getOrderInShift(this.item.StartDate, this.item.EndDate)])//.finally(() => { this.loadedData(); });
				break;
			}

		}

		if (!this.item?.Id) {
			this.formGroup.get('Status').markAsDirty();
			// this.formGroup.get('IDClosingStaff').markAsDirty();
			this.formGroup.get('StartDate').markAsDirty();
		}
	}

	confirm() {
		this.saveChange2().then((res) => {
			this.item = res;
			let ids = [this.item.Id];
			this.pageProvider.commonService.post("POS/Shift/Confirm", { Ids: ids }).then(res => {
				this.item.Status = 'Open';
				this.modalController.dismiss(this.item);
			})
		})
	}
	close() {
		let ids = [this.item.Id];
		this.saveChange2().then((res) => {
			this.item = res;
			this.pageProvider.commonService.post("POS/Shift/Close", { Ids: ids }).then(res => {
				this.modalController.dismiss(null);
				this.env.publishEvent({ Code: 'Refresh' });
			})
		})

	}
	getPaymentInShift(startDate, endDate) {
		return this.incomingPaymentProvider.read({ IDBranch: this.env.selectedBranch, CreatedDateFrom: startDate, CreatedDateTo: endDate, Status: 'Success' }).then((orders: any) => {
			if (orders && orders.data && orders.data.length > 0) {
				let obj: any = {};
				let totalCash = orders.data.reduce((sum, order) => sum + (order.Amount || 0), 0);
				this.formGroup.get('ExpectedCash').setValue(totalCash);
				this.formGroup.get('ClosingCash').setValue(totalCash);
				this.formGroup.get('CashAmount').setValue(orders.data.filter(o => o.Type == 'Cash').reduce((sum, order) => sum + (order.Amount || 0), 0));
				this.formGroup.get('CardAmount').setValue(orders.data.filter(o => o.Type == 'Card').reduce((sum, order) => sum + (order.Amount || 0), 0));
				this.formGroup.get('TransferAmount').setValue(orders.data.filter(o => o.Type == 'Transfer').reduce((sum, order) => sum + (order.Amount || 0), 0));
				this.formGroup.get('ZalopayAppAmount').setValue(orders.data.filter(o => o.Type == 'ZalopayApp').reduce((sum, order) => sum + (order.Amount || 0), 0));
				this.formGroup.get('ApplyPayAmount').setValue(orders.data.filter(o => o.Type == 'ApplyPay').reduce((sum, order) => sum + (order.Amount || 0), 0));
				this.formGroup.get('OtherAmount').setValue(orders.data.filter(o => !['ApplePay', 'ZalopayApp', 'Cash', 'Card', 'Transfer'].includes(o.Type)).reduce((sum, order) => sum + (order.Amount || 0), 0));

			}
			else {
				this.formGroup.get('ExpectedCash').setValue(0);
				this.formGroup.get('ClosingCash').setValue(0);
				this.formGroup.get('CashAmount').setValue(0);
				this.formGroup.get('CardAmount').setValue(0);
				this.formGroup.get('TransferAmount').setValue(0);
				this.formGroup.get('ZalopayAppAmount').setValue(0);
				this.formGroup.get('ApplyPayAmount').setValue(0);
				this.formGroup.get('OtherAmount').setValue(0);
			}
		})
	}

	getOrderInShift(startDate, endDate) {
		return this.shiftOrderProvider.read({ IDBranch: this.env.selectedBranch, IDShift:this.item.Id, Take: 5000 }).then((orders: any) => {
			if (orders && orders.data && orders.data.length > 0) {
				this.formGroup.get('CanceledOrder').setValue(orders.data.filter(o => o.OrderStatus == 'Canceled').length);
				this.formGroup.get('NewOrder').setValue(orders.data.filter(o => o.OrderStatus == 'New').length);
				this.formGroup.get('TemporaryBillOrder').setValue(orders.data.filter(o => o.OrderStatus == 'TemporaryBill').length);
				this.formGroup.get('DebtOrder').setValue(orders.data.filter(o => o.OrderStatus == 'Debt').length);
				this.formGroup.get('ScheduledOrder').setValue(orders.data.filter(o => o.OrderStatus == 'Scheduled').length);
				this.formGroup.get('DoneOrder').setValue(orders.data.filter(o => o.OrderStatus == 'Done').length);
				this.formGroup.get('UnapprovedOrder').setValue(orders.data.filter(o => o.OrderStatus == 'Unapproved').length);
				this.formGroup.get('ApprovedOrder').setValue(orders.data.filter(o => o.OrderStatus == 'Approved').length);
			}
			else {
				this.formGroup.get('CanceledOrder').setValue(0);
				this.formGroup.get('NewOrder').setValue(0);
				this.formGroup.get('TemporaryBillOrder').setValue(0);
				this.formGroup.get('DebtOrder').setValue(0);
				this.formGroup.get('ScheduledOrder').setValue(0);
				this.formGroup.get('DoneOrder').setValue(0);
				this.formGroup.get('UnapprovedOrder').setValue(0);
				this.formGroup.get('ApprovedOrder').setValue(0);
			}
		})
	}

	changeDate() {
		if (!this.formGroup.get('StartDate').value || !this.formGroup.get('EndDate').value || !this.formGroup.get('IsClosingRequest').value) return;
		Promise.all([this.getPaymentInShift(this.formGroup.get('StartDate').value, this.formGroup.get('EndDate').value), this.getOrderInShift(this.formGroup.get('StartDate').value, this.formGroup.get('EndDate').value)])
		//.then(() => this.loadedData()).catch(() => { this.loadedData() });
	}
	async saveChange() {
		this.saveChange2().then((res: any) => {
			this.modalController.dismiss(res);
		});
	}


	getFormattedDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
	}

}
