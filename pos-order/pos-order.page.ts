import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import {
	POS_MenuProvider,
	POS_TableGroupProvider,
	POS_TableProvider,
	POS_TerminalProvider,
	SALE_OrderProvider,
	SYS_PrinterProvider,
} from 'src/app/services/static/services.service';
import { POSSplitModalPage } from '../pos-split-modal/pos-split-modal.page';
import { POSMergeModalPage } from '../pos-merge-modal/pos-merge-modal.page';
import { Location } from '@angular/common';
import { POSChangeTableModalPage } from '../pos-change-table-modal/pos-change-table-modal.page';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { dog } from 'src/environments/environment';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import { PromotionService } from 'src/app/services/custom/promotion.service';
import { POSNotifyService } from '../_services/pos-notify.service';
import { POSService } from '../_services/pos.service';
import { POS_ShiftPService } from '../_services/pos-shift-service';

@Component({
	selector: 'app-pos-order',
	templateUrl: 'pos-order.page.html',
	styleUrls: ['pos-order.page.scss'],
	standalone: false,
})
export class POSOrderPage extends PageBase {
	tableGroupList = [];
	soStatusList = [];
	noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered']; //NewConfirmedScheduledPickingDeliveredSplittedMergedDebtDoneCanceled
	segmentView = 'all';
	orderCounter = 0;
	numberOfGuestCounter = 0;
	notifications = [];
	isOpenConfigPOS = false;
	POSconfigDTO: any = {};
	terminalList = [];
	printerList = [];
	lastEventRefreshTime = 0;
	private readonly EVENT_REFRESH_THROTTLE = 5000; // 5 seconds in milliseconds
	constructor(
		public posService: POSService,
		public posShiftService: POS_ShiftPService,
		public posTerminalProvider: POS_TerminalProvider,
		public sysPrinterProvider: SYS_PrinterProvider,
		public pageProvider: SALE_OrderProvider,

		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location,
		public commonService: CommonService,
		public promotionService: PromotionService,
		private notifyService: POSNotifyService
	) {
		super();
		this.pageConfig.isShowFeature = true;

		this.pageConfig.ShowAdd = false;
		this.pageConfig.ShowSearch = false;
		this.pageConfig.ShowImport = false;
		this.pageConfig.ShowExport = false;
		this.pageConfig.ShowArchive = false;
	}

	ngOnInit() {
		this.pageConfig.subscribePOSOrder = this.env.getEvents().subscribe((data) => {
			if (!data.code?.startsWith('signalR:')) return;
			if (data.id == this.env.user.StaffID) return; // Bypass notify to self

			const value = JSON.parse(data.value);
			if (value.IDBranch != this.env.selectedBranch) return;

			switch (data.code) {
				case 'signalR:POSOrderFromCustomer':
				case 'signalR:POSOrderPaymentUpdate':
				case 'signalR:POSSupport':
				case 'signalR:POSCallToPay':
				case 'signalR:POSLockOrderFromStaff':
				case 'signalR:POSLockOrderFromCustomer':
				case 'signalR:POSUnlockOrderFromStaff':
				case 'signalR:POSUnlockOrderFromCustomer':
				case 'signalR:POSOrderSplittedFromStaff':
				case 'signalR:POSOrderMergedFromStaff':
				case 'signalR:POSOrderFromStaff':
				case 'signalR:POSPaymentSuccess':
					this.refreshFromEvent();
					break;
			}
		});
		this.posShiftService.pageConfig = this.pageConfig;
		super.ngOnInit();
	}

	preLoadData(event?: any): void {
		const forceReload = event === 'force';
		if (!this.sort.Id) {
			this.sort.Id = 'Id';
			this.sortToggle('Id', true);
		}

		this.query.Type = 'POSOrder';
		this.query.Status = JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']);
		this.query.IDBranch = this.env.selectedBranch;

		Promise.all([
			this.posService.getEnviromentDataSource(this.env.selectedBranch, forceReload),
			this.sysPrinterProvider.read({ IDBranch: this.env.selectedBranch }),
			this.posTerminalProvider.read({ IDBranch: this.env.selectedBranch }),
			this.env.getStorage('POSTerminalConfig'),
		])
			.then((values: any) => {
				this.tableGroupList = this.posService.dataSource.tableGroups;
				this.soStatusList = this.posService.dataSource.orderStatusList;
				this.printerList = values[1].data || [];
				this.terminalList = values[2].data || [];
				if (this.tableGroupList.length > 0) this.posShiftService.initShift();

				if (values[3]) {
					this.POSconfigDTO = values[3];
				}
				super.preLoadData(event);
			})
			.catch((err) => {
				this.env.showErrorMessage(err);
				this.loadedData(event);
			});
	}

	loadData(event?) {
		this.parseSort();

		if (this.pageProvider && !this.pageConfig.isEndOfData) {
			if (event == 'search') {
				this.commonService
					.connect('GET', 'SALE/Order/POS_Order', this.query)
					.toPromise()
					.then((result: any) => {
						if (result.length == 0) {
							this.pageConfig.isEndOfData = true;
						}
						this.items = result;
						this.loadedData(null);
					});
			} else {
				this.query.Skip = this.items.length;
				this.commonService
					.connect('GET', 'SALE/Order/POS_Order', this.query)
					.toPromise()
					.then((result: any) => {
						if (result.length == 0) {
							this.pageConfig.isEndOfData = true;
						}
						if (result.length > 0) {
							this.items = this.dataManagementService.mergeItems(this.items, result);
						}

						this.loadedData(event);
					})
					.catch((err) => {
						if (err.message != null) {
							this.env.showMessage(err.message, 'danger');
						} else {
							this.env.showMessage('Cannot extract data', 'danger');
						}

						this.loadedData(event);
					});
			}
		} else {
			this.loadedData(event);
		}
		// this.commonService
		// 	.connect('GET', 'SALE/Order/POS_Order', this.query)
		// 	.toPromise()
		// 	.then((result: any) => {
		// 		this.items = result;
		// 		this.loadedData();
		// 	});
	}

	loadedData(event?: any): void {
		this.orderCounter = 0;
		this.numberOfGuestCounter = 0;
		this.checkTable(null, 0); //reset table status
		this.items.forEach((o) => {
			o._Locked = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'].indexOf(o.Status) == -1;
			o._Status = this.soStatusList.find((d) => d.Code == o.Status);
			o._Tables = [];
			if (!o._Locked) {
				this.orderCounter++;
				this.numberOfGuestCounter = this.numberOfGuestCounter + o.NumberOfGuests;
			}

			if (!o.Tables) o.Tables = [];
			o.Tables.forEach((tid) => {
				this.checkTable(o, tid);
			});
		});

		super.loadedData(event);
		this.env.getStorage('Notifications').then((result) => {
			if (result?.length > 0) {
				this.notifications = result.filter((n) => !n.Watched && n.IDBranch == this.env.selectedBranch);
			}
		});
		// this.CheckPOSNewOrderLines();
		// this.promotionService.getPromotions();
	}

	onTerminalChange(e) {
		this.POSconfigDTO.IDTerminal = this.POSconfigDTO.IDTerminal || 0;
		this.env.setStorage('POSTerminalConfig', this.POSconfigDTO, { enable: true, timeToLive: 365 * 24 * 60 });
	}
	onPrinterChange(e) {
		this.POSconfigDTO.IDPrinter = this.POSconfigDTO.IDPrinter || 0;
		this.POSconfigDTO.defaultPrinter = this.printerList.find((p) => p.Id == this.POSconfigDTO.IDPrinter);
		this.env.setStorage('POSTerminalConfig', this.POSconfigDTO, { enable: true, timeToLive: 365 * 24 * 60 });
	}

	private CheckPOSNewOrderLines() {
		this.pageProvider.commonService
			.connect('GET', 'SALE/Order/CheckPOSNewOrderLines/', this.query)
			.toPromise()
			.then(async (results: any) => {
				if (results) {
					let orderNotification = this.notifications.filter(
						(d) => !results.map((s) => s.Id).includes(d.IDSaleOrder) && (d.Type == 'Remind order' || d.Type == 'Order') && d.Code == 'pos-order'
					);
					orderNotification.forEach((o) => {
						let index = this.notifications.indexOf(o);
						this.notifications.splice(index, 1);
					});
					await results.forEach(async (r) => {
						// kiểm tra noti cũ có số order line chưa gửi bếp khác với DB thì update
						let oldNotis = this.notifications.filter((n) => n.IDSaleOrder == r.Id && n.Type == 'Remind order' && n.Code == 'pos-order');
						await oldNotis.forEach(async (oldNoti) => {
							if (oldNoti.NewOrderLineCount != r.NewOrderLineCount) {
								let index = this.notifications.indexOf(oldNoti);
								this.notifications.splice(index, 1);
							}
						});
					});
					this.setNotifiOrder(results);
				}
			})
			.catch((err) => {
				if (err.message != null) {
					this.env.showMessage(err.message, 'danger');
				}
			});
	}
	openShift() {
		this.posShiftService.openShiftModal();
	}

	checkTable(o, tid) {
		for (let g of this.tableGroupList) {
			for (let t of g.TableList) {
				if (!o && !tid) t._Orders = [];

				if (t.Id == tid) {
					o._Tables.push(t);

					if (!o._Locked) {
						let order = {
							_Status: o._Status,
							Id: o.Id,
							OrderDate: o.OrderDate,
							NumberOfGuests: o.NumberOfGuests,
							CalcTotalOriginal: o.CalcTotalOriginal,
							Debt: o.Debt,
							Order: o,
						};
						t._Orders.push(order);
					}
				}
			}
		}
	}

	filter(type = null) {
		if (type == 'search') {
			this.selectedItems = [];
			if (this.query.Id?.length > 2 || !this.query.Id) {
				this.query.Skip = 0;
				this.pageConfig.isEndOfData = false;
				this.loadData(type);
			}
		} else {
			this.query.Status = this.query.Status == '' ? JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']) : '';
			this.loadData();
			// super.refresh();
		}
	}

	refresh(event?: any): void {
		dog && console.log('POSOrderPage: refresh called with event:', event);
		if (event === true) {
			this.preLoadData('force');
		} else {
			super.refresh();
		}
	}

	refreshFromEvent(): void {
		const now = Date.now();
		const timeSinceLastRefresh = now - this.lastEventRefreshTime;

		if (timeSinceLastRefresh >= this.EVENT_REFRESH_THROTTLE) {
			dog && console.log('POSOrderPage: refreshFromEvent - refreshing');
			this.lastEventRefreshTime = now;
			this.refresh();
		} else {
			dog && console.log(`POSOrderPage: refreshFromEvent - throttled (${timeSinceLastRefresh}ms < ${this.EVENT_REFRESH_THROTTLE}ms)`);
		}
	}

	archiveItems(publishEventCode?: string): void {
		this.pageProvider.disable(this.selectedItems, !this.query.IsDisabled).then(() => {
			if (this.query.IsDisabled) {
				this.env.showMessage('Reopened {{value}} lines!', 'success', this.selectedItems.length);
			} else {
				this.env.showMessage('Archived {{value}} lines!', 'success', this.selectedItems.length);
			}
			this.removeSelectedItems();
			this.refresh();
		});
	}

	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	async splitPOSBill() {
		if (this.selectedItems.length > 0) {
			if (this.noLockStatusList.indexOf(this.selectedItems[0].Status) == -1) {
				this.env.showMessage('Your selected order cannot be split. Please choose draft, new, pending for approval or disaaproved order', 'warning');
				return;
			}
		}

		const modal = await this.modalController.create({
			component: POSSplitModalPage,
			backdropDismiss: false,
			cssClass: 'modal90',
			componentProps: {
				selectedOrder: this.selectedItems[0],
				orders: this.items,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();

		this.selectedItems = [];
		this.refresh();
	}

	async mergePOSBills() {
		let itemsCanNotProcess = this.selectedItems.filter((i) => this.noLockStatusList.indexOf(i.Status) == -1);
		if (itemsCanNotProcess.length) {
			this.env.showMessage('Your selected invoices cannot be combined. Please select new or disapproved invoice', 'warning');
			return;
		}

		const modal = await this.modalController.create({
			component: POSMergeModalPage,

			backdropDismiss: false,
			cssClass: 'modal-merge-orders',
			componentProps: {
				selectedOrders: this.selectedItems,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();

		this.selectedItems = [];
		this.refresh();
	}

	async changeTable(i) {
		dog && console.log('changeTable');

		if (i && i.Id) {
			this.selectedItems.push(i);
		}
		let itemsCanNotProcess = this.selectedItems.filter((i) => this.noLockStatusList.indexOf(i.Status) == -1);
		if (itemsCanNotProcess.length) {
			this.env.showMessage('Your selected invoices cannot be combined. Please select new or disapproved invoice', 'warning');
			return;
		}

		const modal = await this.modalController.create({
			component: POSChangeTableModalPage,
			backdropDismiss: false,
			cssClass: 'modal-change-table',
			componentProps: {
				selectedOrder: this.selectedItems[0],
				orders: this.items,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();

		this.selectedItems = [];
		this.refresh();
	}

	async openCancellationReason(order = null) {
		if (this.submitAttempt) return;

		if (order) {
			this.selectedItems = [order];
		}

		const modal = await this.modalController.create({
			component: POSCancelModalPage,
			id: 'POSCancelModalPage',
			backdropDismiss: true,
			cssClass: 'modal-cancellation-reason',
			componentProps: { item: {} },
		});
		modal.present();

		const { data, role } = await modal.onWillDismiss();

		if (role == 'confirm') {
			let cancelData: any = { Code: data.Code };
			if (cancelData.Code == 'Other') {
				cancelData.Remark = data.CancelNote;
			}

			this.env
				.showPrompt('Bạn có chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng')
				.then((_) => {
					let publishEventCode = this.pageConfig.pageName;
					if (this.submitAttempt == false) {
						this.submitAttempt = true;
						cancelData.Type = 'POSOrder';
						cancelData.Ids = this.selectedItems.map((m) => m.Id);
						this.pageProvider.commonService
							.connect('POST', 'SALE/Order/CancelOrders/', cancelData)
							.toPromise()
							.then(() => {
								if (publishEventCode) {
									this.env.publishEvent({
										Code: publishEventCode,
									});
								}
								this.loadData();
								this.submitAttempt = false;
								this.nav('/pos-order', 'forward');
							})
							.catch((err) => {
								this.submitAttempt = false;
							});
					}
				})
				.catch((_) => {});
		}
	}

	interval = null;
	ionViewDidEnter() {
		if (!this.interval) {
			this.interval = setInterval(() => {
				//this.refresh();
			}, 15000);
		}
	}

	ionViewWillLeave() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	async setNotifiOrder(items) {
		for (let item of items) {
			let url = 'pos-order/' + item.Id + '/' + item.Tables[0].IDTable;
			let message = 'Bàn ' + item.Tables[0]?.TableName + ' có ' + item.NewOrderLineCount + ' món chưa gửi bếp';

			let notification = {
				Id: item.Id,
				IDBranch: item.IDBranch,
				IDSaleOrder: item.Id,
				Type: 'Remind order',
				Name: 'Đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
				NewOrderLineCount: item.NewOrderLineCount,
				Watched: false,
			};
			await this.setNotifications(notification);
		}
	}

	async setNotifications(item, lasted = false) {
		let isExistedNoti = this.notifications.some(
			(d) =>
				d.Id == item.Id &&
				d.IDBranch == item.IDBranch &&
				d.IDSaleOrder == item.IDSaleOrder &&
				d.Type == item.Type &&
				d.Name == item.Name &&
				d.Code == item.Code &&
				d.Message == item.Message &&
				d.Url == item.Url &&
				!d.Watched
		);
		if (isExistedNoti) {
			if (lasted) {
				let index = this.notifications.findIndex(
					(d) =>
						d.Id == item.Id &&
						d.IDBranch == item.IDBranch &&
						d.IDSaleOrder == item.IDSaleOrder &&
						d.Type == item.Type &&
						d.Name == item.Name &&
						d.Code == item.Code &&
						d.Message == item.Message &&
						d.Url == item.Url &&
						!d.Watched
				);
				if (index != -1) {
					this.notifications.splice(index, 1);
					this.notifications.unshift(item);
					await this.env.setStorage('Notifications', this.notifications);
				}
			}
		} else {
			this.notifications.unshift(item);
			await this.env.setStorage('Notifications', this.notifications);
		}
	}

	goToNofication(i, j) {
		this.notifications[j].Watched = true;
		this.env.setStorage('Notifications', this.notifications);
		if (i.Url != null) {
			this.nav(i.Url, 'forward');
		}
		this.removeNotification(j);
	}

	removeNotification(j) {
		this.notifications.splice(j, 1);
		this.env.setStorage('Notifications', this.notifications);
	}

	exportPOSData() {
		this.query.SortBy = 'IDOrder_desc';

		if (this.query.Keyword.indexOf('-') != -1) {
			let dateParts = this.query.Keyword.split('-');
			let fromDate = new Date(dateParts[0].slice(2, 4) + '/' + dateParts[0].slice(0, 2) + '/' + dateParts[0].slice(4, 6));
			let toDate = new Date(dateParts[1].slice(2, 4) + '/' + dateParts[1].slice(0, 2) + '/' + dateParts[1].slice(4, 6));
			let fromDateText = lib.dateFormat(fromDate);
			let toDateText = lib.dateFormat(toDate);

			let maxToDate = new Date(fromDate.setMonth(fromDate.getMonth() + 3));
			let maxToDateText = lib.dateFormat(maxToDate);

			if (toDateText > maxToDateText) {
				this.env.showMessage('Giới hạn tải xuống dữ liệu tối đa trong vòng 3 tháng!', 'danger', 5000);
				return;
			}
		}

		this.loadingController
			.create({
				cssClass: 'my-custom-class',
				message: 'Please wait for a few moments',
			})
			.then((loading) => {
				loading.present();
				this.commonService
					.connect('GET', 'SALE/Order/ExportPOSOrderList', this.query)
					.toPromise()
					.then((response: any) => {
						this.submitAttempt = false;
						if (loading) loading.dismiss();
						this.downloadURLContent(response);
					})
					.catch((err) => {
						if (err.message != null) {
							this.env.showMessage(err.error.ExceptionMessage, 'danger');
						} else {
							this.env.showMessage('Cannot extract data', 'danger');
						}
						this.submitAttempt = false;
						if (loading) loading.dismiss();
						this.refresh();
					});
			});
	}
}
