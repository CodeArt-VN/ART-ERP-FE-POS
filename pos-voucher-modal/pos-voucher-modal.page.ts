import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { PromotionService } from 'src/app/services/custom/promotion.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { PR_ProgramItemProvider, PR_ProgramPartnerProvider, PR_ProgramProvider, SALE_OrderDeductionProvider } from 'src/app/services/static/services.service';

@Component({
	selector: 'app-pos-voucher-modal',
	templateUrl: './pos-voucher-modal.page.html',
	styleUrls: ['./pos-voucher-modal.page.scss'],
	standalone: false,
})
export class POSVoucherModalPage extends PageBase {
	Code = '';
	Voucher;
	SaleOrder;
	constructor(
		public pageProvider: PR_ProgramProvider,
		public programPartnerProvider: PR_ProgramPartnerProvider,
		public programItemProvider: PR_ProgramItemProvider,
		public deductionProvider: SALE_OrderDeductionProvider,
		public env: EnvService,
		public modalController: ModalController,
		public loadingController: LoadingController,
		public promotionService: PromotionService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef
	) {
		super();
	}
	loadData(event?: any): void {
		// let date = new Date();
		// date.setHours(0, 0, 0, 0);
		// Object.assign(this.query, {
		// 	IsPublic: true,
		// 	IsDeleted: false,
		// 	BetweenDate: date,
		// 	Type: 'Voucher',
		// 	CanUse: true,
		// 	Status: 'Approved',
		// });
		// super.loadData();
		// this.items = this.promotionService.promotionList.filter((p) => p.IsPublic && !p.IsAutoApply).map(p => ({ ...p })); // clone
		let voucherCodes = this.promotionService.promotionList.filter((p) => p.IsPublic && !p.IsAutoApply).map((p) => p.VoucherCode);
		let postDTO = {
			VoucherCodeList: voucherCodes,
			SaleOrder: this.SaleOrder,
		};
		this.pageProvider.commonService
			.connect('POST', 'PR/Program/CheckVoucher', postDTO)
			.toPromise()
			.then((result: any) => {
				this.items = result;
			})
			.catch((err) => this.env.showErrorMessage(err))
			.finally(() => this.loadedData());
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		super.loadedData();
		this.loadProgram();
	}
	loadProgram() {
		this.items.forEach((item) => {
			let i = item.Program;
			// let find = this.SaleOrder.Deductions.filter((p) => p.IDProgram == i.Id);
			// if (find && find.length > 0) {
			// 	if (i.MaxUsagePerCustomer < find.length) i.Used = true;
			// }
			if (i.IsByPercent == true) {
				i.PerCentValue = i.Value;
				i.Value = (i.Value * this.SaleOrder.OriginalTotalBeforeDiscount) / 100;
				if (i.Value > i.MaxValue) {
					i.Value = i.MaxValue;
				}
			}
		});
		this.items = this.items.sort((a, b) => {
			// Ưu tiên CanUse = true lên trước
			if (a.CanUse !== b.CanUse) {
				return a.CanUse ? -1 : 1;
			}

			// Tiếp theo sort theo trường Sort (tăng dần)
			return (a.Sort ?? 0) - (b.Sort ?? 0);
		});
	}

	changeCode() {
		if (this.Code != '') {
			let postDTO = {
				VoucherCodeList: [this.Code],
				SaleOrder: this.SaleOrder,
			};
			this.pageProvider.commonService
				.connect('POST', 'PR/Program/CheckVoucher', postDTO)
				.toPromise()
				.then((voucher: any) => {
					if (voucher.length > 0) {
						this.Voucher = voucher[0];
						if (this.Voucher.Program.IsByPercent == true) {
							this.Voucher.Program.PerCentValue = this.Voucher.Program.Value;
							this.Voucher.Program.Value = (this.Voucher.Program.Value * this.SaleOrder.OriginalTotalBeforeDiscount) / 100;
							if (this.Voucher.Program.Value > this.Voucher.Program.MaxValue) {
								this.Voucher.Program.Value = this.Voucher.Program.MaxValue;
							}
						}
					} else {
						this.env.showMessage('Mã Voucher không hợp lệ', 'danger');
					}
				})
				.catch((err) => this.env.showErrorMessage(err))
				.finally(() => this.loadedData());
		}
	}

	async applyVoucher(line) {
		// let count = this.item.Deductions.filter((d) => d.Type == 'Voucher').length;
		// if (count < 2) {
		// let program= {IDProgram:line.Id,VoucherCode: line.VoucherCode}
		let apiPath = {
			method: 'POST',
			url: function () {
				return ApiSetting.apiDomain('PR/Program/UseVoucher/');
			},
		};
		new Promise((resolve, reject) => {
			this.pageProvider.commonService
				.connect(apiPath.method, apiPath.url(), {
					// IDSaleOrder: this.SaleOrder.Id,
					// Date: new Date(),
					// VoucherCodeList: [line.VoucherCode],
					VoucherCodeList: [line.VoucherCode],
					SaleOrder: this.SaleOrder,
					IsCheckOnly: false,
				})
				.toPromise()
				.then((savedItem: any) => {
					this.env.showMessage('Saving completed!', 'success');
					resolve(true);
					this.modalController.dismiss(savedItem);
				})
				.catch((err) => {
					this.env.showErrorMessage(err);
					resolve(false);
				});
		});
		// } else {
		// 	this.env.showMessage('Chỉ được áp dụng 2 mã voucher trên 1 đơn hàng', 'warning');
		// }
	}
}
