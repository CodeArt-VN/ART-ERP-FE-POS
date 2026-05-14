import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Component({
	selector: 'app-pos-merge-modal',
	templateUrl: './pos-merge-modal.page.html',
	styleUrls: ['./pos-merge-modal.page.scss'],
	standalone: false,
})
export class POSMergeModalPage extends PageBase {
	@Input() selectedOrders;

	initContactsIds = [];
	paymentReceived = 0;
	mergePayableAmount = 0;
	paymentValidationMessage = '';
	isCanMerge = true;

	constructor(
		public pageProvider: SALE_OrderProvider,
		public contactProvider: CRM_ContactProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,

		public modalController: ModalController,
		public alertCtrl: AlertController,
		public navParams: NavParams,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		private config: NgSelectConfig
	) {
		super();
		this.pageConfig.isDetailPage = false;
		this.pageConfig.pageName = 'MergeSaleOrder';
		this.config.notFoundText = 'Không tìm thấy dữ liệu phù hợp...';
		this.config.clearAllText = 'Xóa hết';
	}

	loadData(event) {
		this.item = {
			Ids: [],
			IDContact: null,
			IsSampleOrder: false,
			IsUrgentOrders: false,
			IsWholeSale: false,
		};
		if (this.selectedOrders) {
			this.selectedOrders.forEach((i) => {
				this.item.Ids.push(i.Id);
				this.initContactsIds.push(i.IDContact);
			});
		}
		this.mergePayableAmount = this.getMergePayableAmount();
		this.getPaymentReceivedForOrders(this.item.Ids)
			.then((amount) => {
				this.paymentReceived = amount;
				this.validatePaymentTarget();
			})
			.catch(() => {
				this.paymentReceived = 0;
				this.isCanMerge = false;
				this.paymentValidationMessage = 'Cannot verify payment before merging these bills.';
			});
		this.loadedData(event);
	}

	loadedData(event) {
		if (this.initContactsIds.length) {
			this.contactProvider
				.read({ Id: JSON.stringify(this.initContactsIds) })
				.then((contacts: any) => {
					this.contactSelected = contacts.data[0];
					this.item.IDContact = this.contactSelected.Id;
					contacts.data.forEach((contact) => {
						if (contact && this.contactListSelected.findIndex((d) => d.Id == contact.Id) == -1) {
							this.contactListSelected.push({
								Id: contact.Id,
								Code: contact.Code,
								Name: contact.Name,
								WorkPhone: contact.WorkPhone,
								AddressLine1: contact.AddressLine1,
							});
						}
					});
				})
				.finally(() => {
					this.contactSearch();
					this.cdr.detectChanges();
				});
		} else {
			this.contactSearch();
		}

		super.loadedData(event);
	}

	contactList$;
	contactListLoading = false;
	contactListInput$ = new Subject<string>();
	contactListSelected = [];
	contactSelected = null;
	contactSearch() {
		this.contactListLoading = false;
		this.contactList$ = concat(
			of(this.contactListSelected),
			this.contactListInput$.pipe(
				distinctUntilChanged(),
				tap(() => (this.contactListLoading = true)),
				switchMap((term) =>
					this.contactProvider
						.search({
							Take: 20,
							Skip: 0,
							SkipMCP: true,
							Keyword: term ? term : this.item.IDContact,
						})
						.pipe(
							catchError(() => of([])), // empty list on error
							tap(() => (this.contactListLoading = false))
						)
				)
			)
		);
	}

	mergeSaleOrders() {
		let apiPath = {
			method: 'POST',
			url: function () {
				return ApiSetting.apiDomain('SALE/Order/MergeOrders/');
			},
		};

		return new Promise((resolve, reject) => {
			if (!this.item.Ids.length || !this.item.IDContact) {
				this.env.showMessage('Please check the invoice to combine and select customer', 'warning');
			} else if (!this.validatePaymentTarget(true)) {
				return;
			} else if (this.submitAttempt == false) {
				this.submitAttempt = true;

				if (!this.item.IDBranch) {
					this.item.IDBranch = this.env.selectedBranch;
				}
				this.pageProvider.commonService
					.connect(apiPath.method, apiPath.url(), this.item)
					.toPromise()
					.then((savedItem: any) => {
						this.env.showMessage('Saving completed!', 'success');
						resolve(savedItem.Id);
						this.submitAttempt = false;
						this.closeModalView();
					})
					.catch((err) => {
						this.env.showMessage('Cannot save, please try again!', 'danger');
						this.cdr.detectChanges();
						this.submitAttempt = false;
						reject(err);
					});
			}
		});
	}

	changedIDContact(i) {
		if (i) {
			this.contactSelected = i;
			if (this.contactListSelected.findIndex((d) => d.Id == i.Id) == -1) {
				this.contactListSelected.push(i);
				this.contactSearch();
			}
		}
	}

	validatePaymentTarget(showMessage = false) {
		this.paymentValidationMessage = '';
		this.isCanMerge = true;

		if (this.paymentReceived > 0 && this.mergePayableAmount < this.paymentReceived) {
			this.isCanMerge = false;
			this.paymentValidationMessage = 'Cannot merge these bills because the merged order total cannot cover the paid amount.';
			if (showMessage) this.env.showMessage(this.paymentValidationMessage, 'warning');
			return false;
		}

		return true;
	}

	getMergePayableAmount() {
		if (!Array.isArray(this.selectedOrders)) return 0;
		return Math.round(
			this.selectedOrders.reduce((sum, order) => {
				const total = parseFloat(order?.CalcTotalOriginal) || 0;
				const discountFromSalesman = parseFloat(order?.OriginalDiscountFromSalesman) || 0;
				return sum + Math.max(0, total - discountFromSalesman);
			}, 0)
		);
	}

	private getPaymentReceivedForOrders(ids) {
		if (!ids?.length) return Promise.resolve(0);
		return Promise.all(ids.map((id) => this.getPaymentReceived(id))).then((amounts) => amounts.reduce((sum, amount) => sum + amount, 0));
	}

	private getPaymentReceived(IDSaleOrder) {
		return this.pageProvider.commonService
			.connect('GET', 'BANK/IncomingPaymentDetail', { IDSaleOrder })
			.toPromise()
			.then((result: any) => {
				const paymentList = Array.isArray(result) ? result : [];
				const paidAmount = paymentList
					.filter((x) => x.IncomingPayment?.Status == 'Success' && x.IncomingPayment?.IsRefundTransaction == false)
					.map((x) => parseFloat(x.Amount) || 0)
					.reduce((a, b) => a + b, 0);
				const refundAmount = paymentList
					.filter((x) => (x.IncomingPayment?.Status == 'Success' || x.IncomingPayment?.Status == 'Processing') && x.IncomingPayment?.IsRefundTransaction == true)
					.map((x) => parseFloat(x.Amount) || 0)
					.reduce((a, b) => a + b, 0);

				return Math.max(0, paidAmount - refundAmount);
			});
	}

	closeModalView() {
		this.modalController.dismiss();
	}
}
