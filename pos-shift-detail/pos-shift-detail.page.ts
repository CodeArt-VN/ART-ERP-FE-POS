import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import {
	BANK_IncomingPaymentProvider,
	HRM_StaffProvider,
	POS_ShiftOrderProvider,
	POS_ShiftProvider,
	POS_TerminalProvider,
	SALE_OrderProvider,
} from 'src/app/services/static/services.service';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { lib } from 'src/app/services/static/global-functions';
import { printData, PrintingService } from 'src/app/services/util/printing.service';
import { POSService } from '../_services/pos.service';

@Component({
	selector: 'app-pos-shift-detail',
	templateUrl: './pos-shift-detail.page.html',
	styleUrls: ['./pos-shift-detail.page.scss'],
	standalone: false,
})
export class POSShiftDetailPage extends PageBase {
	formGroup: FormGroup;
	defaultPrinter;
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
		public posService: POSService,
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
		public loadingController: LoadingController,
		public printingService: PrintingService,
		public printerTerminalProvider: POS_TerminalProvider
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
			// IDToStaff: [''],
			Status: new FormControl({ value: 'Open', disabled: true }),
			ClosingReason: [''],
			Remark: [''],
		});
		this.formGroup.valueChanges.subscribe((values) => {
			const expected = parseFloat(this.formGroup.get('ExpectedCash').value) || 0;
			const closing = parseFloat(values.ClosingCash) || 0;
			const difference = closing - expected; // hoặc expected - closing tuỳ bạn muốn hiển thị dấu âm/dương

			this.formGroup.patchValue(
				{ CashDifference: difference },
				{ emitEvent: false } // tránh loop vô hạn
			);
		});
	}
	preLoadData() {
		this.getDefaultPrinter();
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
					FullName: this.env.user.FullName,
				};
				this.loadedData();
				// Promise.all([this.getPaymentInShift(this.item.StartDate, this.item.EndDate), this.getOrderInShift(this.item.StartDate, this.item.EndDate)]).finally(() => { this.loadedData(); });
			} else this.loadedData();
		} else this.loadedData();
	}
	branch;
	printCss = '';
	loadedData() {
		if (this.item._ClosingStaff) {
			this._staffDataSource.selected.push(this.item._ClosingStaff);
		}
		if(this.posService.systemConfig.POSPrintingFontSize){
			this.printCss = '*{--font-size : '+ this.posService.systemConfig.POSPrintingFontSize + 'px;}';
		}
		this._staffDataSource.selected = [...this._staffDataSource.selected];
		this._staffDataSource.initSearch();
		this._staffReceiveDataSource.initSearch();
		this.branch = this.env.branchList.find((d) => d.Id == this.item.IDBranch);

		super.loadedData();
		switch (this.formGroup.get('Status').value) {
			case 'Unconfirmed': {
				// this.formGroup.get('OpeningCash').enable();
				break;
			}
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
				Promise.all([
					this.getPaymentInShift(this.formGroup.get('StartDate').value, this.formGroup.get('EndDate').value),
					this.getOrderInShift(this.item.StartDate, this.item.EndDate),
				]); //.finally(() => { this.loadedData(); });
				break;
			}
		}

		if (!this.item?.Id) {
			this.formGroup.get('Status').markAsDirty();
			// this.formGroup.get('IDClosingStaff').markAsDirty();
			this.formGroup.get('StartDate').markAsDirty();
		}
	}

	getDefaultPrinter() {
		return new Promise((resolve, reject) => {
			this.printerTerminalProvider
				.read({
					IDBranch: this.env.selectedBranch,
					IsDeleted: false,
					IsDisabled: false,
				})
				.then(async (results: any) => {
					this.defaultPrinter = results['data']?.[0]?.['Printer'];
					resolve(this.defaultPrinter);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}
	confirm() {
		this.saveChange2().then((res) => {
			this.item = res;
			let ids = [this.item.Id];
			this.pageProvider.commonService.post('POS/Shift/Confirm', { Ids: ids }).then((res) => {
				this.item.Status = 'Open';
				this.modalController.dismiss(this.item);
			});
		});
	}
	close() {
		let ids = [this.item.Id];
		this.saveChange2().then((res) => {
			this.item = res;
			this.pageProvider.commonService.post('POS/Shift/Close', { Ids: ids }).then((res) => {
				this.print();
				this.modalController.dismiss(null);
				this.env.publishEvent({ Code: 'Refresh' });
			});
		});
	}
	getPaymentInShift(startDate, endDate) {
		return this.incomingPaymentProvider
			.read({ IDBranch: this.env.selectedBranch, CreatedDateFrom: startDate, CreatedDateTo: endDate, Status: 'Success' })
			.then((orders: any) => {
				if (orders && orders.data && orders.data.length > 0) {
					let obj: any = {};
					let totalCash = orders.data.reduce((sum, order) => sum + (order.Amount || 0), 0);
					this.formGroup.get('ExpectedCash').setValue(totalCash);
					this.formGroup.get('ClosingCash').setValue(totalCash);
					this.shiftData.CashAmount = orders.data.filter((o) => o.Type == 'Cash').reduce((sum, order) => sum + (order.Amount || 0), 0);
					this.shiftData.CardAmount = orders.data.filter((o) => o.Type == 'Card').reduce((sum, order) => sum + (order.Amount || 0), 0);
					this.shiftData.TransferAmount = orders.data.filter((o) => o.Type == 'Transfer').reduce((sum, order) => sum + (order.Amount || 0), 0);
					this.shiftData.ZalopayAppAmount = orders.data.filter((o) => o.Type == 'ZalopayApp').reduce((sum, order) => sum + (order.Amount || 0), 0);
					this.shiftData.ApplyPayAmount = orders.data.filter((o) => o.Type == 'ApplyPay').reduce((sum, order) => sum + (order.Amount || 0), 0);
					this.shiftData.OtherAmount = orders.data
						.filter((o) => !['ApplePay', 'ZalopayApp', 'Cash', 'Card', 'Transfer'].includes(o.Type))
						.reduce((sum, order) => sum + (order.Amount || 0), 0);

					const transferOrders = orders.data.filter((o) => o.Type === 'Transfer');
					const revenueTransfer: RevenueData[] = Object.values(
						transferOrders.reduce((acc: any, cur: any) => {
							if (!acc[cur.SubType]) {
								acc[cur.SubType] = { Code: cur.SubType, Total: 0 };
							}
							acc[cur.SubType].Total += cur.Amount ?? 0;
							return acc;
						}, {})
					);
					const cardOrders = orders.data.filter((o) => o.Type === 'Card');
					const revenue: RevenueData[] = Object.values(
						cardOrders.reduce((acc: any, cur: any) => {
							if (!acc[cur.SubType]) {
								acc[cur.SubType] = { Code: cur.SubType, Total: 0 };
							}
							acc[cur.SubType].Total += cur.Amount ?? 0;
							return acc;
						}, {})
					);
					this.shiftData.TotalRevenueCard = revenue;
					this.shiftData.TotalRevenueTransfer = revenueTransfer;
					this.shiftData.TotalRevenuePartnerOnline = [].concat({ Code: 'ZalopayApp', Total: this.shiftData.ZalopayAppAmount });
				}
				// else {
				// 	this.formGroup.get('ExpectedCash').setValue(0);
				// 	this.formGroup.get('ClosingCash').setValue(0);
				// 	this.formGroup.get('CashAmount').setValue(0);
				// 	this.formGroup.get('CardAmount').setValue(0);
				// 	this.formGroup.get('TransferAmount').setValue(0);
				// 	this.formGroup.get('ZalopayAppAmount').setValue(0);
				// 	this.formGroup.get('ApplyPayAmount').setValue(0);
				// 	this.formGroup.get('OtherAmount').setValue(0);
				// }
			});
	}

	shiftData: ShiftData = {};
	getOrderInShift(startDate, endDate) {
		return this.shiftOrderProvider.read({ IDBranch: this.env.selectedBranch, IDShift: this.item.Id, Take: 5000 }).then((orders: any) => {
			if (orders && orders.data && orders.data.length > 0) {
				this.shiftData.CanceledOrder = orders.data.filter((o) => o.OrderStatus == 'Canceled').length;
				this.shiftData.NewOrder = orders.data.filter((o) => o.OrderStatus == 'New').length;
				this.shiftData.TemporaryBillOrder = orders.data.filter((o) => o.OrderStatus == 'TemporaryBill').length;
				this.shiftData.DebtOrder = orders.data.filter((o) => o.OrderStatus == 'Debt').length;
				this.shiftData.ScheduledOrder = orders.data.filter((o) => o.OrderStatus == 'Scheduled').length;
				this.shiftData.DoneOrder = orders.data.filter((o) => o.OrderStatus == 'Done').length;
				this.shiftData.UnapprovedOrder = orders.data.filter((o) => o.OrderStatus == 'Unapproved').length;
				this.shiftData.ApprovedOrder = orders.data.filter((o) => o.OrderStatus == 'Approved').length;

				this.shiftData.TotalVAT = orders.data.filter((o) => o.OrderStatus == 'Done').reduce((sum, order) => sum + (order._Order?.OriginalTax || 0), 0);
				this.shiftData.OriginalTotalAfterDiscount = orders.data
					.filter((o) => o.OrderStatus == 'Done')
					.reduce((sum, order) => sum + (order._Order?.OriginalTotalAfterDiscount || 0), 0);
				this.shiftData.OriginalTotalAfterDiscount = orders.data
					.filter((o) => o.OrderStatus == 'Done')
					.reduce((sum, order) => sum + (order._Order?.OriginalTotalAfterDiscount || 0), 0);
				this.shiftData.TotalAfterTax = orders.data.filter((o) => o.OrderStatus == 'Done').reduce((sum, order) => sum + (order._Order?.TotalAfterTax || 0), 0);
				this.shiftData.AverageRevenueBill = this.shiftData.TotalAfterTax / orders.data.length;
				this.shiftData.AverageRevenueGuest =
					this.shiftData.TotalAfterTax / orders.data.filter((o) => o.OrderStatus == 'Done').reduce((sum, order) => sum + (order._Order?.NumberOfGuests || 0), 0);
				this.shiftData.TotalBillInit = Math.min(...orders.data.map((o)=>o._Order.DailyBillNo?? 0));
				this.shiftData.TotalBillLastest = Math.max(...orders.data.map((o)=>o._Order.DailyBillNo?? 0));
				this.shiftData.TotalDeduction = orders.data
					.filter((o) => o.OrderStatus == 'Done')
					.reduce((sum, order) => {
						const list = order._Order?.Deductions || [];
						return sum + list.reduce((s, d) => s + (d.Amount || 0), 0);
					}, 0);
				const voucherList = orders.data
					.filter((o) => o.OrderStatus == 'Done')
					.reduce((all, order) => {
						const list = order._Order?.Deductions || [];

						list.filter((d) => d.Type === 'Voucher' && d._Program?.Id).forEach((d) => {
							const programId = d._Program.Id;
							const amount = d.Amount || 0;

							if (!all.has(programId)) {
								all.set(programId, {
									ProgramId: programId,
									Name: d.Name,
									Total: 0,
									Count: 0, // thêm số lượng
								});
							}

							const item = all.get(programId);
							item.Total += amount;
							item.Count += 1; // tăng đếm số lượng voucher
						});

						return all;
					}, new Map());
				this.shiftData.Vouchers = Array.from(voucherList.values());
			}
		});
	}

	changeDate() {
		if (!this.formGroup.get('StartDate').value || !this.formGroup.get('EndDate').value || !this.formGroup.get('IsClosingRequest').value) return;
		Promise.all([
			this.getPaymentInShift(this.formGroup.get('StartDate').value, this.formGroup.get('EndDate').value),
			this.getOrderInShift(this.formGroup.get('StartDate').value, this.formGroup.get('EndDate').value),
		]);
		//.then(() => this.loadedData()).catch(() => { this.loadedData() });
	}
	async saveChange() {
		this.saveChange2().then((res: any) => {
			this.modalController.dismiss(res);
		});
	}
	print() {
		this.shiftData.PrintDate = new Date().toISOString(); //lib.dateFormat(new Date(), 'dd/MM/yyyy hh:mm');

		setTimeout(() => {
			let jobName = `${this.item?.Id} | ${this.shiftData.PrintDate}`;
			let data = this.printPrepare('bill', [this.defaultPrinter], jobName);
			this.printingService.print([data]);
		}, 50);
		
	}
	printPrepare(element, printers, jobName = '') {
		let content = document.getElementById(element);
		//let ele = this.printingService.applyAllStyles(content);
		let optionPrinters = printers.map((printer) => {
			return {
				printer: printer.Code,
				host: printer.Host,
				port: printer.Port,
				isSecure: printer.IsSecure,
				// tray: '1',
				jobName: jobName ? jobName : printer.Code + '-' + this.item.Id,
				copies: 1,
				//orientation: 'landscape',
				duplex: 'duplex',
				cssStyle: this.printCss,
				//  autoStyle:content
			};
		});
		let data: printData = {
			content: content?.outerHTML,
			type: 'html',
			options: optionPrinters,
		};
		return data;
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

export interface ShiftData {
	PrintDate?: string;

	CashAmount?: number;
	CashDifference?: number;
	CardAmount?: number;
	TransferAmount?: number;
	ApplyPayAmount?: number;
	ZalopayAppAmount?: number;
	OtherAmount?: number;

	CanceledOrder?: number;
	NewOrder?: number;
	TemporaryBillOrder?: number;
	DebtOrder?: number;
	ScheduledOrder?: number;
	DoneOrder?: number;
	UnapprovedOrder?: number;
	ApprovedOrder?: number;

	TotalDeduction?: number;
	TotalVAT?: number;
	OriginalTotalAfterDiscount?: number;
	TotalAfterTax?: number;
	TotalRevenueCard?: RevenueData[];
	TotalRevenueTransfer?: RevenueData[];
	TotalRevenuePartnerOnline?: RevenueData[];
	AverageRevenueBill?: number;
	AverageRevenueGuest?: number;
	Vouchers?: any[];
	TotalBillInit?: number;
	TotalBillLastest?: number;
	TotalRevenueItemGroup?: ItemGroupRevenue;
}
export interface RevenueData {
	Total?: number;
	Code?: string;
	// DataDetail?: RevenueData[]
}
export interface ItemGroupRevenue {
	Food?: number;
	Drink?: number;
}
