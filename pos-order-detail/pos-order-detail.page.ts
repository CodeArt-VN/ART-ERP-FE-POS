import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import {
	CRM_ContactProvider,
	HRM_StaffProvider,
	// POS_KitchenProvider, // Replaced by posService.dataSource.kitchens
	// POS_MenuProvider, // Replaced by posService.dataSource.menuList
	// POS_TableGroupProvider, // Replaced by posService.dataSource.tableList
	// POS_TableProvider, // Replaced by posService.dataSource.tableList
	POS_TerminalProvider,
	PR_ProgramProvider,
	SALE_OrderDeductionProvider,
	SALE_OrderProvider,
	// SYS_ConfigProvider, // Replaced by posService.systemConfig
	SYS_PrinterProvider,
} from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { BehaviorSubject, concat, firstValueFrom, lastValueFrom, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, switchMap, take, tap, toArray } from 'rxjs/operators';
import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';

import { POSMemoModalPage } from '../pos-memo-modal/pos-memo-modal.page';
import { dog, environment } from 'src/environments/environment';
import { POSVoucherModalPage } from '../pos-voucher-modal/pos-voucher-modal.page';
import { POSContactModalPage } from '../pos-contact-modal/pos-contact-modal.page';
import { POSInvoiceModalPage } from '../pos-invoice-modal/pos-invoice-modal.page';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import QRCode from 'qrcode';
import { printData, PrintingService } from 'src/app/services/util/printing.service';
import { BarcodeScannerService } from 'src/app/services/util/barcode-scanner.service';
import { POSService } from '../_services/pos.service';
import { PromotionService } from 'src/app/services/custom/promotion.service';
import { CanComponentDeactivate } from './deactivate-guard';

@Component({
	selector: 'app-pos-order-detail',
	templateUrl: './pos-order-detail.page.html',
	styleUrls: ['./pos-order-detail.page.scss'],
	standalone: false,
})
export class POSOrderDetailPage extends PageBase implements CanComponentDeactivate {
	@ViewChild('numberOfGuestsInput') numberOfGuestsInput: ElementRef;
	isOpenMemoModal = false;
	AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
	noImage = environment.posImagesServer + 'assets/pos-icons/POS-Item-demo.png'; //No image for menu item
	segmentView = '0';
	idTable: any; //Default table
	paymentList = [];

	noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'];
	noLockLineStatusList = ['New', 'Waiting'];
	checkDoneLineStatusList = ['Done', 'Canceled', 'Returned'];
	kitchenQuery = 'all';
	itemQuery = 'all';
	OrderAdditionTypeList = [];
	OrderDeductionTypeList = [];
	promotionAppliedPrograms = [];
	defaultPrinter = [];
	printData = {
		undeliveredItems: [], //To track undelivered items to the kitchen
		printDate: null,
		currentBranch: null,
		selectedTables: [],
	};
	Discount;
	Staff;
	notifications = [];

	constructor(
		public posService: POSService,
		public pageProvider: SALE_OrderProvider,
		public programProvider: PR_ProgramProvider,
		// Providers below are replaced by posService.dataSource - kept for backward compatibility
		// public kitchenProvider: POS_KitchenProvider,
		public deductionProvider: SALE_OrderDeductionProvider,
		// public menuProvider: POS_MenuProvider,
		// public tableGroupProvider: POS_TableGroupProvider,
		// public tableProvider: POS_TableProvider,
		public contactProvider: CRM_ContactProvider,
		public staffProvider: HRM_StaffProvider,
		// public sysConfigProvider: SYS_ConfigProvider, // Replaced by posService.systemConfig
		public printerProvider: SYS_PrinterProvider,
		public printerTerminalProvider: POS_TerminalProvider,
		public printingService: PrintingService,
		public scanner: BarcodeScannerService,

		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public popoverCtrl: PopoverController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,
		public promotionService: PromotionService
	) {
		super();
		this.pageConfig.ShowRefresh = false;
		this.pageConfig.isDetailPage = true;
		this.pageConfig.isShowFeature = true;
		this.pageConfig.ShowDelete = false;
		this.pageConfig.ShowArchive = false;
		this.pageConfig.canChangeBranch = false;
		this.idTable = this.route.snapshot?.paramMap?.get('table');
		this.idTable = typeof this.idTable == 'string' ? parseInt(this.idTable) : this.idTable;
		this.formGroup = formBuilder.group({
			Id: new FormControl({ value: 0, disabled: true }),
			Code: [],
			Name: [],
			Remark: [],
			OrderLines: this.formBuilder.array([]),
			DeletedLines: [[]],
			Additions: this.formBuilder.array([]),
			Deductions: this.formBuilder.array([]),
			Tables: [[this.idTable], Validators.required],
			IDBranch: [this.env.selectedBranch],
			IDOwner: [this.env.user.StaffID],
			//OrderDate: [new Date()],
			IDContact: [null],
			IDAddress: [null],
			Type: ['POSOrder'],
			SubType: ['TableService'],
			Status: new FormControl({ value: 'New', disabled: true }),
			IsCOD: [],
			IsInvoiceRequired: [],
			NumberOfGuests: [1, Validators.required],
			InvoicDate: new FormControl({ value: null, disabled: true }),
			InvoiceNumber: new FormControl({ value: null, disabled: true }),

			IsDebt: new FormControl({ value: null, disabled: true }),
			Debt: new FormControl({ value: null, disabled: true }),
			IsPaymentReceived: new FormControl({ value: null, disabled: true }),
			Received: new FormControl({ value: null, disabled: true }),
			ReceivedDiscountFromSalesman: new FormControl({
				value: null,
				disabled: true,
			}),
		});

		dog && console.log('PR List: ', this.promotionService.promotionList);
	}

	ngOnInit() {
		this.pageConfig.subscribePOSOrderDetail = this.env.getEvents().subscribe((data) => {
			if (!data.code?.startsWith('signalR:')) return;
			if (data.id == this.env.user.StaffID) return;

			const value = JSON.parse(data.value);
			if (value.IDSaleOrder != this.item?.Id) return;

			switch (data.code) {
				case 'signalR:POSOrderPaymentUpdate':
				case 'signalR:POSOrderFromCustomer':
				case 'signalR:POSOrderFromStaff':
				case 'signalR:POSLockOrderFromStaff':
				case 'signalR:POSLockOrderFromCustomer':
				case 'signalR:POSUnlockOrderFromStaff':
				case 'signalR:POSUnlockOrderFromCustomer':
				case 'signalR:POSOrderSplittedFromStaff':
				case 'signalR:POSOrderMergedFromStaff':
				case 'signalR:POSSupport':
				case 'signalR:POSCallToPay':
				case 'signalR:POSPaymentSuccess':
					this.refresh();
					break;

				case 'networkStatusChange':
					this.checkNetworkChange(data);
					break;
			}
		});

		super.ngOnInit();
	}
	ngOnDestroy() {
		this.pageConfig?.subscribePOSOrderDetail?.unsubscribe();
		super.ngOnDestroy();
	}

	canDeactivate(): Promise<boolean> {
		if (this.formGroup.controls.OrderLines.dirty || (this.formGroup.dirty && this.item.Id)) {
			return this.env
				.showPrompt('This order has not been saved yet, do you want to save?', '', 'Please save order!')
				.then(() => {
					this.saveOrderData();
					return false;
				})
				.catch(() => {
					return true;
				});
		}
	}

	private checkNetworkChange(data) {
		if (data.status.connected) {
			if (this.item.Id) {
				this.pageProvider.commonService
					.connect('GET', 'SALE/Order/CheckPOSModifiedDate', {
						IDOrder: this.item.Id,
					})
					.toPromise()
					.then((lastModifiedDate) => {
						if (lastModifiedDate > this.item.ModifiedDate) {
							this.env.showMessage('Order information has changed, the order will be updated.', 'danger');
							this.refresh();
						}
					})
					.catch((err) => {
						dog && console.log(err);
					});
			}
		}
	}

	preLoadData(event?: any): void {
		const forceReload = event === 'force';

		this.posService
			.getEnviromentDataSource(this.env.selectedBranch, forceReload)
			.then(() => {
				dog && console.log('POS environment data loaded', this.posService.dataSource, this.posService.systemConfig);
				super.preLoadData(event);
			})
			.catch((err) => {
				this.env.showErrorMessage(err);
				this.loadedData(event);
			});
	}

	async loadedData(event?: any, ignoredFromGroup?: boolean) {
		this.VietQRCode = null;
		this._contactDataSource.selected = [];
		this.formGroup.valueChanges.subscribe(() => {
			const controls = this.formGroup.controls;
			this.canSaveOrder = Object.values(controls).some((control) => control.dirty) || this.item?.OrderLines?.some((d) => d.Status == 'New' || d.Status == 'Waiting');
		});
		// Generate UID if Code is empty
		if (!this.item?.Code) {
			this.item.Code = lib.generateUID(this.env.user.StaffID);
			this.formGroup.get('Code')?.setValue(this.item.Code);
			this.formGroup.get('Code')?.markAsDirty();
		}
		super.loadedData(event, ignoredFromGroup);
		if (this.item.IDBranch != this.env.selectedBranch && this.item.Id) {
			this.env.showMessage('Không tìm thấy đơn hàng, vui lòng kiểm tra chi nhánh!', 'danger');
			return;
		}

		if (!this.item?.Id) {
			Object.assign(this.item, this.formGroup.getRawValue());
			this.setOrderValue(this.item);
		} else {
			this.patchOrderValue();
			this.getPayments().then(() => {
				if (this.posService.systemConfig.POSBillQRPaymentMethod == 'VietQR') {
					this.GenQRCode(null);
				} else if (this.paymentList?.length) {
					const latestPayment = this.paymentList
						.filter((p) => p.IncomingPayment?.Code)
						.sort((a, b) => new Date(b.IncomingPayment.CreatedDate).getTime() - new Date(a.IncomingPayment.CreatedDate).getTime())[0];

					if (latestPayment?.IncomingPayment) {
						this.GenQRCode(latestPayment.IncomingPayment);
					}
				}
			});
			this.getPromotionProgram();
			if (this.item._Customer.IsStaff == true) {
				this.getStaffInfo(this.item._Customer.Code);
			}
		}

		this.getDefaultPrinter();

		if (this.posService.systemConfig.SODefaultBusinessPartner) {
			this._contactDataSource.selected.push(this.posService.systemConfig.SODefaultBusinessPartner);
		}
		if (this.item._Customer && !this._contactDataSource.selected?.some((d) => d.Id == this.item._Customer.Id)) {
			this._contactDataSource.selected.push(this.item._Customer);
		}
		this.loadOrder();
		this._contactDataSource.initSearch();
		this.cdr.detectChanges();
		// await this.getStorageNotifications();
		this.CheckPOSNewOrderLines();

		// this.canSaveOrder = this.item.OrderLines.filter((d) => d.Status == 'New' || d.Status == 'Waiting').length > 0;

		setTimeout(() => {
			this.segmentChanged('all');
		}, 100);
	}

	async getStorageNotifications() {
		await this.env.getStorage('Notifications').then(async (result) => {
			if (result?.length > 0) {
				this.notifications = [...result.filter((n) => !n.Watched && n.IDBranch == this.env.selectedBranch)];
				let a = this.notifications;
				dog && console.log(a);
			}
		});
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

	async setNotifiOrder(items) {
		for (let item of items) {
			let url = 'pos-order/' + item.Id + '/' + item.Tables[0].IDTable;
			let message = 'Bàn ' + item.Tables[0]?.TableName + ' có ' + item.NewOrderLineCount + ' món chưa gửi bếp';

			let notification = {
				Id: item.Id,
				IDBranch: item.IDBranch,
				IDSaleOrder: item.Id,
				Type: 'Remind order',
				Name: 'Đơn hàng',
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

	// async setStorageNotification(Id, IDBranch, IDSaleOrder, Type, Name, Code, Message, Url) {
	//   let notification = {
	//     Id: Id,
	//     IDBranch: IDBranch,
	//     IDSaleOrder: IDSaleOrder,
	//     Type: Type,
	//     Name: Name,
	//     Code: Code,
	//     Message: Message,
	//     Url: Url,
	//     Watched: false,
	//   };
	//   const notifications = await this.env.getStorage('Notifications').then((result) => {
	//     if (result) {
	//       return result;
	//     } else {
	//       return [];
	//     }
	//   });
	//   if(notifications.some(d=> d.Id ==notification.Id && d.IDBranch == notification.IDBranch &&
	//     d.IDSaleOrder == notification.IDSaleOrder && d.Type == notification.Type && d.Name == notification.Name && d.Code == notification.Code && d.Message == notification.Message && d.Url == notification.Url
	//   )){
	//     return;
	//   }
	//   notifications.unshift(notification);
	//   this.env.setStorage('Notifications', notifications);
	//   this.notifications.unshift(notification);
	// }

	async goToNofication(i, j) {
		this.notifications[j].Watched = true;
		this.env.setStorage('Notifications', this.notifications);
		if (i.Url != null) {
			if (i.IDSaleOrder == this.item.Id) {
				this.refresh();
			} else {
				await this.navBackOrder();
				this.nav(i.Url, 'forward');
			}
			this.removeNotification(j);
		}
	}

	async navBackOrder() {
		// await this.nav('/pos-order', 'back');
		await this.navCtrl.navigateBack('/pos-order');
	}

	removeNotification(j) {
		this.notifications.splice(j, 1);
		this.env.setStorage('Notifications', this.notifications);
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
					this.defaultPrinter.push(results['data']?.[0]?.['Printer']);
					this.defaultPrinter = [...new Map(this.defaultPrinter.map((item: any) => [item?.['Id'], item])).values()];
					resolve(this.defaultPrinter);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	refresh(event?: any): void {
		if (event) {
			this.segmentView = '0';
			this.clearData();
			this.preLoadData(event);
		} else {
			super.refresh();
		}
	}

	segmentFilterDishes = 'New';
	changeFilterDishes(event) {
		this.segmentFilterDishes = event.detail.value;
	}

	countDishes(segment) {
		if (segment == 'New')
			return this.item.OrderLines.filter((d) => d.Status == 'New' || d.Status == 'Waiting')
				.map((x) => x.Quantity)
				.reduce((a, b) => +a + +b, 0);

		return this.item.OrderLines.filter((d) => !(d.Status == 'New' || d.Status == 'Waiting'))
			.map((x) => x.Quantity)
			.reduce((a, b) => +a + +b, 0);
	}

	canSaveOrder = false;
	async addToCart(item, idUoM, quantity = 1, idx = -1, status = '') {
		if (item.IsDisabled) {
			return;
		}
		if (this.submitAttempt) {
			let element = document.getElementById('item' + item.Id);
			if (element) {
				element = element.parentElement;
				element.classList.add('shake');
				setTimeout(() => {
					element.classList.remove('shake');
				}, 400);
			}
			return;
		}

		if (!this.pageConfig.canAdd) {
			this.env.showMessage('You do not have permission to add products!', 'warning');
			return;
		}

		if (!this.pageConfig.canEdit || this.item.Status == 'TemporaryBill') {
			this.env.showMessage('The order is locked, you cannot edit or add items!', 'warning');
			return;
		}

		if (this.item.Tables == null || this.item.Tables.length == 0) {
			this.env.showMessage('Please select a table before adding items!', 'warning');
			return;
		}

		if (!item.UoMs.length) {
			this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
			return;
		}

		let uom = item.UoMs.find((d) => d.Id == idUoM);
		let price = uom.PriceList.find((d) => d.Type == 'SalePriceList');

		let line;
		if (quantity == 1) {
			line = this.item.OrderLines.find((d) => d.IDUoM == idUoM && d.Status == 'New'); //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
		} else {
			line = this.item.OrderLines[idx]; //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
		}

		if (!line) {
			line = {
				IDOrder: this.item.Id,
				Id: 0,
				Code: lib.generateUID(this.env.user.StaffID),
				Type: 'TableService',
				Status: 'New',
				IDItem: item.Id,
				IDTax: item.IDSalesTaxDefinition,
				TaxRate: item.SaleVAT,
				IDUoM: idUoM,
				UoMPrice: price.NewPrice ? price.NewPrice : price.Price,
				UoMName: uom.Name,
				Quantity: 1,
				IDBaseUoM: idUoM,
				UoMSwap: 1,
				UoMSwapAlter: 1,
				BaseQuantity: 0,
				ShippedQuantity: 0,

				Remark: null,
				IsPromotionItem: false,
				IDPromotion: null,

				OriginalDiscountFromSalesman: 0,

				CreatedDate: new Date(),
			};

			this.item.OrderLines.push(line);

			this.addOrderLine(line);
			this.setOrderValue({ OrderLines: [line], Status: 'New' });
		} else {
			if (line.Quantity > 0 && line.Quantity + quantity < line.ShippedQuantity) {
				if (this.pageConfig.canDeleteItems) {
					this.env
						.showPrompt('Item này đã chuyển Bar/Bếp, bạn chắc muốn giảm số lượng sản phẩm này?', item.Name, 'Xóa sản phẩm')
						.then((_) => {
							this.openCancellationReason(line, quantity);
						})
						.catch((_) => {});
				} else {
					this.env.showMessage('Item has been sent to Bar/Kitchen');
					return;
				}
			} else if (line.Quantity + quantity > 0) {
				line.Quantity += quantity;
				this.setOrderValue({
					OrderLines: [
						{
							Id: line.Id,
							Code: line.Code,
							IDUoM: line.IDUoM,
							Quantity: line.Quantity,
						},
					],
					Status: 'New',
				});
			} else {
				if (line.Status == 'New') {
					this.env
						.showPrompt('Bạn có chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm')
						.then((_) => {
							line.Quantity += quantity;
							this.setOrderValue({
								OrderLines: [
									{
										Id: line.Id,
										Code: line.Code,
										IDUoM: line.IDUoM,
										Quantity: line.Quantity,
									},
								],
							});
						})
						.catch((_) => {});
				} else {
					if (this.pageConfig.canDeleteItems) {
						this.env
							.showPrompt('Bạn có chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm')
							.then((_) => {
								line.Quantity += quantity;
								this.setOrderValue({
									OrderLines: [
										{
											Id: line.Id,
											Code: line.Code,
											IDUoM: line.IDUoM,
											Quantity: line.Quantity,
										},
									],
								});
							})
							.catch((_) => {});
					} else {
						this.env.showMessage('This account does not have permission to delete products!', 'warning');
					}
				}
			}
		}
	}

	async openQuickMemo(line) {
		if (this.submitAttempt) return;
		if (line.Status != 'New') return;
		if (this.item.Status == 'TemporaryBill') {
			this.env.showMessage('The order is locked, you cannot edit or add items!', 'warning');
			return;
		}

		const modal = await this.modalController.create({
			component: POSMemoModalPage,
			id: 'POSMemoModalPage',
			backdropDismiss: true,
			cssClass: 'modal-quick-memo',
			componentProps: {
				item: JSON.parse(JSON.stringify(line)),
			},
		});
		await modal.present();
		const { data, role } = await modal.onWillDismiss();

		if (role == 'confirm') {
			line.Remark = data ? data.toString() : null;
			this.setOrderValue({
				OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Code: line.Code, Remark: line.Remark }],
			});
		}
	}

	jumpToItem(line) {
		let element = document.getElementById('item' + line.IDItem);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
			element.classList.add('blink');
			setTimeout(() => {
				element.classList.remove('blink');
			}, 2000);
		}
	}

	segmentChanged(ev: any) {
		this.segmentView = ev;
	}

	search(ev) {
		var val = ev.target.value.toLowerCase();
		if (val == undefined) {
			val = '';
		}
		if (val.length > 2 || val == '') {
			this.query.Keyword = val;
		}
	}

	async processPayments() {
		const modal = await this.modalController.create({
			component: POSPaymentModalPage,
			id: 'POSPaymentModalPage',
			canDismiss: true,
			backdropDismiss: true,
			cssClass: 'modal-payments',
			componentProps: {
				item: this.item,
			},
		});
		await modal.present();
		const { data, role } = await modal.onWillDismiss();
		if (role == 'confirm') {
			let changed: any = { OrderLines: [] };
			if (data.SetShippedQuantity)
				this.item.OrderLines.forEach((line) => {
					if (line.Quantity > line.ShippedQuantity) {
						line.ShippedQuantity = line.Quantity;
						line.ReturnedQuantity = 0;
						changed.OrderLines.push({
							Id: line.Id,
							Code: line.Code,
							IDUoM: line.IDUoM,
							ShippedQuantity: line.ShippedQuantity,
							ReturnedQuantity: 0,
						});
					}
				});

			if (data.SetDone) {
				changed.Status = 'Done';
			}

			this.setOrderValue(changed, true);
		}
	}

	goToPayment() {
		let payment = {
			IDBranch: this.item.IDBranch,
			IDStaff: this.env.user.StaffID,
			IDCustomer: this.item.IDContact,
			IDSaleOrder: this.item.Id,
			DebtAmount: Math.round(this.item.Debt),
			IsActiveInputAmount: true,
			IsActiveTypeCash: true,
			ReturnUrl: window.location.href,
			Lang: this.env.language.current,
			Timestamp: Date.now(),
			CreatedBy: this.env.user.Email,
		};
		let str = window.btoa(JSON.stringify(payment));
		let code = this.convertUrl(str);
		let url = environment.appDomain + 'Payment?Code=' + code;
		window.open(url, '_blank');
	}

	private convertUrl(str) {
		return str.replace('=', '').replace('=', '').replace('+', '-').replace('_', '/');
	}

	async processDiscounts() {
		this.Discount = {
			Amount: this.item.OriginalTotalDiscount,
			Percent: (this.item.OriginalTotalDiscount * 100) / this.item.OriginalTotalBeforeDiscount,
		};
		const modal = await this.modalController.create({
			component: POSDiscountModalPage,
			canDismiss: true,
			backdropDismiss: true,
			cssClass: 'modal-change-table',
			componentProps: {
				Discount: this.Discount,
				item: this.item,
			},
		});
		await modal.present();
		const { data, role } = await modal.onWillDismiss();
		if (role == 'confirm') {
			this.applyDiscount();
		}
	}

	async processVouchers() {
		const modal = await this.modalController.create({
			component: POSVoucherModalPage,
			canDismiss: true,
			backdropDismiss: true,
			cssClass: 'modal-change-table',
			componentProps: {
				SaleOrder: this.item,
			},
		});
		await modal.present();
		const { data, role } = await modal.onWillDismiss();
		if (data) {
			this.item = data;
			this.refresh();
		}
	}

	InvoiceRequired() {
		if (this.pageConfig.canEdit == false) {
			this.env.showMessage('The order is locked and cannot be edited', 'warning');
			return false;
		}
		if (!this.item._Customer) {
			this.env.showMessage('Please select a customer', 'warning');
			return false;
		}
		if (this.item._Customer.Id == 922) {
			this.env.showMessage('Cannot issue invoice for walk-in customer', 'warning');
			return false;
		}
		if (this.item.IsInvoiceRequired == false) {
			this.processInvoice();
		} else {
			this.formGroup.controls.IsInvoiceRequired.patchValue(false);
			this.formGroup.controls.IsInvoiceRequired.markAsDirty();
			this.saveChange();
		}
	}

	async processInvoice() {
		const modal = await this.modalController.create({
			component: POSInvoiceModalPage,
			canDismiss: true,
			cssClass: 'my-custom-class',
			componentProps: {
				id: this.item.IDContact,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();
		if (data == true) {
			this.item.IsInvoiceRequired = true;
			this.formGroup.controls.IsInvoiceRequired.patchValue(true);
			this.formGroup.controls.IsInvoiceRequired.markAsDirty();
			this.saveChange();
		} else {
			this.item.IsInvoiceRequired = false;
		}
	}

	async openCancellationReason(line = null, quantity = null) {
		if (this.submitAttempt) return;
		if (this.item.Received > 0) {
			this.env.showMessage('Paid order cannot be canceled, please refund before canceling this order!', 'warning');
			return false;
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

			if (!line) {
				this.env
					.showPrompt('Bạn có chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng')
					.then((_) => {
						let publishEventCode = this.pageConfig.pageName;
						if (this.submitAttempt == false) {
							this.submitAttempt = true;
							cancelData.Type = 'POSOrder';
							cancelData.Ids = [this.item.Id];

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
									this.nav('/pos-order', 'back');
								})
								.catch((err) => {
									this.submitAttempt = false;
								});
						}
					})
					.catch((_) => {});
			} else {
				let cancelData: any = {
					Code: data.Code,
					OrderLine: line,
					RemoveQuantity: quantity,
				};
				if (cancelData.Code == 'Other') {
					cancelData.Remark = data.CancelNote;
				}

				this.env
					.showPrompt('Bạn có chắc muốn xóa / giảm số lượng sản phẩm này?', null, 'Xóa sản phẩm')
					.then((_) => {
						let publishEventCode = this.pageConfig.pageName;
						if (this.submitAttempt == false) {
							this.submitAttempt = true;

							this.pageProvider.commonService
								.connect('POST', 'SALE/Order/CancelReduceOrderLines/', cancelData)
								.toPromise()
								.then(() => {
									if (publishEventCode) {
										this.env.publishEvent({
											Code: publishEventCode,
										});
									}

									this.refresh();
									this.submitAttempt = false;
								})
								.catch((err) => {
									this.submitAttempt = false;
								});
						}
					})
					.catch((_) => {});
			}
		}
	}

	checkItemNotSendKitchen() {
		if (this.item.OrderLines.some((i) => i._undeliveredQuantity > 0)) {
			this.env.showPrompt('Bạn có muốn in đơn gửi bar/bếp ?', null, 'Thông báo').then(() => this.sendKitchen());
		}
	}
	async saveOrderData() {
		// Wait for save to complete before checking print
		if (this.formGroup.dirty || !this.item.Id) {
			// Force save and wait for completion
			await this.saveChange();
			this.checkItemNotSendKitchen();
			return;
		} else {
			// No changes to save
			this.checkItemNotSendKitchen();
		}
	}
	sendKitchenAttempt = false;
	async sendKitchen() {
		return new Promise(async (resolve, reject) => {
			// Update printData with current date
			this.printData.printDate = lib.dateFormat(new Date(), 'hh:MM dd/mm/yyyy');
			this.printData.undeliveredItems = [];

			this.item.OrderLines.forEach((e) => {
				e._undeliveredQuantity = e.Quantity - e.ShippedQuantity;
				e._IDKitchen = e._item?.IDKitchen;
				if (e.Remark) {
					e.Remark = e.Remark.toString();
				}
				if (e._undeliveredQuantity > 0) {
					this.printData.undeliveredItems.push(e);
				}
			});

			if (this.printData.undeliveredItems.length == 0) {
				if (this.posService.systemConfig.IsAutoSave) this.env.showMessage('No new product needs to be sent!', 'success');
				return;
			}
			if (this.sendKitchenAttempt) {
				this.env.showMessage('Printers were busy, please try again!', 'warning');
				return;
			}
			this.sendKitchenAttempt = true;
			let printItems = this.printData.undeliveredItems;
			const newKitchenIDList = [...new Set(printItems.map((g) => g._IDKitchen))];
			const newKitchenList = this.posService.dataSource.kitchens.filter((d) => newKitchenIDList.includes(d.Id));

			let itemNotPrint = [];
			let printJobs: printData[] = [];
			try {
				for (let kitchen of newKitchenList.filter((d) => d.Id)) {
					await this.setKitchenID(kitchen.Id);
					if (!kitchen._Printer) {
						itemNotPrint = printItems
							.filter((d) => d._IDKitchen == kitchen.Id)
							.map((e) => ({
								Id: e.Id,
								Code: e.Code,
								ShippedQuantity: e.Quantity,
								IDUoM: e.IDUoM,
								Status: e.Status,
								ItemName: e._item.Name, // để hiển thị item ko in đc
							}));
						printItems = printItems.filter((d) => d._IDKitchen != kitchen.Id);
						continue;
					}
					if (kitchen.IsPrintList) {
						let jobName = `${kitchen.Id}_${this.item?.Id} | ${new Date().toISOString()}`;
						let data = this.printPrepare('bill', [kitchen._Printer], jobName);
						printJobs.push(data);
					}
					if (kitchen.IsPrintOneByOne) {
						for (let i of printItems.filter((d) => d._IDKitchen == kitchen.Id)) {
							await this.setItemQuery(i.IDItem);
							let idJob = `${kitchen.Id}_${this.item?.Id}_${i.Code} | ${new Date().toISOString()}`;
							let data = this.printPrepare('bill-item-each-' + i.Id, [kitchen._Printer], idJob);
							printJobs.push(data);
						}
					}
				}
				let doneCount = 0;
				const checkItemNotPrint = () => {
					if (itemNotPrint.length == 0) {
						this.submitAttempt = false;
						return;
					}
					this.env
						.showPrompt(
							{ code: 'Items cannot print: {{value}}, do you want to change these items to serving!', value: itemNotPrint.map((i) => i.ItemName) },
							'',
							'Items printing error!',
							'Ok',
							"Don't send"
						)
						.then(() => {
							this.checkData(false, true, true)
								.then((r) => resolve(true))
								.catch((err) => {
									reject(false);
								});
						})
						.catch((err) => {
							let saveList = [];
							itemNotPrint.forEach((e) => {
								let line = {
									Id: e.Id,
									Code: e.Code,
									ShippedQuantity: e.Quantity,
									IDUoM: e.IDUoM,
									Status: e.Status,
								};
								saveList.push(line);
							});
							this.submitAttempt = false;
							this.setOrderValue({ OrderLines: saveList }, false, true);
						});
				};

				if (printJobs.length > 0) {
					// Collect all lines to update after printing
					const allSuccessLines = [];

					// Execute all print jobs and collect results
					const results = await Promise.all(
						printJobs.map(async (job) => {
							try {
								const result = await this.printingService.print([job]);
								doneCount++;

								// Parse job name to get kitchen and item info
								const jobName = job.options[0].jobName;
								const [idsPart, timestamp] = jobName.split('|').map((s: string) => s.trim());
								const [idKitchen, IDSO, code] = idsPart.split('_');

								// Check if print was successful - comprehensive check
								let isSuccess = false;
								if (result && Array.isArray(result) && result.length > 0) {
									const printResult = result[0];
									dog && console.log('🖨️ Print result for job:', jobName, printResult);

									// Check Success/Failed count
									if (typeof printResult?.Success === 'number' && typeof printResult?.Failed === 'number') {
										isSuccess = printResult.Success > 0 && printResult.Failed === 0;
										dog && console.log(`📊 Success: ${printResult.Success}, Failed: ${printResult.Failed}, isSuccess: ${isSuccess}`);
									}
									// Check other success indicators
									else if (printResult?.success === true || printResult?.status === 'success' || printResult?.code === 200) {
										isSuccess = true;
										dog && console.log('✅ Print success by flag/status/code');
									}
									// Default to true if no error indicators
									else if (!printResult?.error && printResult?.status !== 'error' && printResult?.status !== 'failed') {
										isSuccess = true;
										dog && console.log('✅ Print success (no error indicators)');
									}
								}

								if (!isSuccess) {
									dog && console.warn('⚠️ Print marked as FAILED for job:', jobName, 'Result:', result);
								}

								// Collect items based on print result
								if (idKitchen && !code) {
									// Print list for kitchen
									const kitchenItems = printItems.filter((d) => d._IDKitchen == idKitchen);
									return { isSuccess, items: kitchenItems, idKitchen };
								} else {
									// Print one by one
									const item = printItems.find((d) => d._IDKitchen == idKitchen && d.Code == code);
									return { isSuccess, items: item ? [item] : [], idKitchen, code };
								}
							} catch (error) {
								dog && console.error('Print job failed:', error);
								return { isSuccess: false, items: [], error };
							}
						})
					);

					// Process results and prepare update
					results.forEach(({ isSuccess, items, idKitchen, code }) => {
						items.forEach((e) => {
							const line = {
								Id: e.Id,
								Code: e.Code,
								ShippedQuantity: isSuccess ? e.Quantity : e.ShippedQuantity,
								IDUoM: e.IDUoM,
								Status: isSuccess ? 'Serving' : e.Status,
								ItemName: e._item?.Name,
							};

							if (isSuccess) {
								allSuccessLines.push(line);
							} else {
								itemNotPrint.push(line);
							}
						});
					});

					this.sendKitchenAttempt = false;

					// Update all successful lines at once
					if (allSuccessLines.length > 0) {
						dog && console.log('✅ Updating all successful lines at once:', allSuccessLines.length, 'items');

						// Must use forceSave = true to save immediately and await
						await this.setOrderValue({ OrderLines: allSuccessLines, Status: 'Scheduled' }, true, false);

						// After save completes, reload to update UI
						if (this.item.Id) {
							dog && console.log('🔄 Reloading item after print to update UI...');
							await this.loadData();
						}
					}

					// Handle failed items
					if (itemNotPrint.length > 0) {
						checkItemNotPrint();
					}
				} else checkItemNotPrint();
			} catch (e) {
				dog && console.log(e);
				this.sendKitchenAttempt = false;
			}
		});
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
				//  autoStyle:content
				cssStyle: this.cssStyling
			};
		});
		let data: printData = {
			content: content?.outerHTML,
			type: 'html',
			options: optionPrinters,
		};
		return data;
	}
	printContent(data: printData[]) {
		return new Promise((resolve, reject) => {
			this.printingService
				.print(data)
				.then((s) => {
					resolve(s);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}
	async sendPrint(Status?, receipt = true, sendEachItem = false) {
		return new Promise(async (resolve, reject) => {
			this.printData.printDate = lib.dateFormat(new Date(), 'hh:MM dd/mm/yyyy');

			if (this.submitAttempt) return;
			this.submitAttempt = true;
			let times = 1; // Số lần in phiếu; Nếu là 2, in 2 lần;

			// let printerCodeList = [];
			// let dataList = [];
			let newTerminalList = [];

			if (this.defaultPrinter && this.defaultPrinter.length != 0) {
				this.defaultPrinter.forEach((p: any) => {
					let Info = {
						Id: p.Id,
						Name: p.Name,
						Code: p.Code,
						Host: p.Host,
						Port: p.Port,
					};
					newTerminalList.push({ Printer: Info });
				});
			} else {
				this.env.showMessage('Recheck Receipt Printer information!', 'warning');
				this.submitAttempt = false;
				return;
			}

			for (let index = 0; index < newTerminalList.length; index++) {
				if (Status) {
					this.item.Status = Status; // Sử dụng khi in kết bill ( Status = 'Done' )
				}

				await this.setKitchenID('all');
				await this.setItemQuery('all');

				let printerInfo = newTerminalList[index]['Printer'];
				let printing = this.printPrepare('bill', [printerInfo]);
				await this.printingService.print([printing]);
				this.checkData(receipt, !receipt, sendEachItem);
				resolve(true);
			}
		});
	}

	unlockOrder() {
		const Debt = this.item.Debt;
		let postDTO = { Id: this.item.Id, Code: 'Scheduled', Debt: Debt };

		this.pageProvider.commonService
			.connect('POST', 'SALE/Order/toggleBillStatus/', postDTO)
			.toPromise()
			.then((savedItem: any) => {
				this.refresh();
			});
	}

	async lockOrder() {
		this.checkItemNotSendKitchen();
		const Debt = this.item.Debt;
		let postDTO = {
			Id: this.item.Id,
			Code: 'TemporaryBill',
			Debt: Debt,
		};
		this.pageProvider.commonService
			.connect('POST', 'SALE/Order/toggleBillStatus/', postDTO)
			.toPromise()
			.then((savedItem: any) => {
				dog && console.log('getQRPayment', savedItem);

				this.GenQRCode(savedItem)
					.then(() => {
						if (this.posService.systemConfig.POSEnablePrintTemporaryBill) this.sendPrint('TemporaryBill');
					})
					.catch(() => {});
			});
	}

	VietQRCode;
	GenQRCode(payment) {
		let that = this;
		this.VietQRCode = null;
		return new Promise((resolve, reject) => {
			let bankQRContent = '';

			if (this.posService.systemConfig.POSBillQRPaymentMethod === 'VietQR') {
				bankQRContent = lib.genBankTransferQRCode(
					this.posService.systemConfig.BKIncomingDefaultBankName.Code,
					this.posService.systemConfig.BKIncomingDefaultBankAccount,
					this.item.Debt,
					this.posService.systemConfig.BKIncomingQRPrefix + 'SO' + this.item.Id + this.posService.systemConfig.BKIncomingQRSuffix
				);
			} else if (this.posService.systemConfig.POSBillQRPaymentMethod == 'ZaloPay' && payment.Type == 'ZalopayApp' && payment.SubType == 'VietQR') {
				bankQRContent = payment.Code;
			}

			if (bankQRContent != '') {
				QRCode.toDataURL(
					bankQRContent,
					{
						errorCorrectionLevel: 'H',
						version: 10,
						width: 150,
						scale: 1,
						type: 'image/jpeg',
					},
					function (err, url) {
						that.VietQRCode = url;
						resolve(true);
					}
				);
			} else {
				reject(false);
			}
		});
	}

	printerCodeList = [];
	dataList = [];

	////PRIVATE METHODS
	private UpdatePrice() {
		this.posService.dataSource.dealList.forEach((d) => {
			this.posService.dataSource.menuList.forEach((m) => {
				let index = m.Items.findIndex((i) => i.SalesUoM == d.IDItemUoM);
				if (index != -1) {
					let idexUom = m.Items[index].UoMs.findIndex((u) => u.Id == d.IDItemUoM);
					let newPrice = d.Price;
					if (d.IsByPercent == true) {
						newPrice = d.OriginalPrice - (d.OriginalPrice * d.DiscountByPercent) / 100;
					}
					m.Items[index].UoMs[idexUom].PriceList.find((p) => p.Type == 'SalePriceList').NewPrice = newPrice;
					//m.Items[index].UoMs[idexUom].PriceList[0].NewPrice = m.Items[index].UoMs[idexUom].PriceList[0].Price;
				}
			});
		});
	}

	private loadOrder() {
		this.printData.undeliveredItems = [];
		this.printData.selectedTables = this.posService.dataSource.tableList.filter((d) => this.item.Tables.indexOf(d.Id) > -1);
		this.printData.printDate = lib.dateFormat(new Date(), 'hh:MM dd/mm/yyyy');

		this.item._Locked = this.noLockStatusList.indexOf(this.item.Status) == -1;
		this.printData.currentBranch = this.posService.dataSource.branchInfo;

		if (this.item._Locked) {
			this.pageConfig.canEdit = false;
			this.formGroup?.disable();
		} else {
			this.pageConfig.canEdit = true;
		}

		this.UpdatePrice();
		this.calcOrder();
	}

	//Hàm này để tính và show số liệu ra bill ngay tức thời mà ko cần phải chờ response từ server gửi về.
	private calcOrder() {
		this.Discount = {
			Amount: 0, //this.item.OriginalTotalDiscount,
			Percent: 0, // (this.item.OriginalTotalDiscount * 100) / this.item.OriginalTotalBeforeDiscount,
		};

		this.item._TotalQuantity = this.item.OrderLines?.map((x) => x.Quantity).reduce((a, b) => +a + +b, 0);

		this.item.OriginalTotalBeforeDiscount = 0;
		this.item.OriginalDiscountByOrder = 0;
		this.item.OriginalDiscountFromSalesman = 0;
		this.item.OriginalTotalDiscount = 0;
		this.item.AdditionsAmount = 0;
		this.item.AdditionsTax = 0;
		this.item.OriginalTotalAfterDiscount = 0;
		this.item.OriginalTax = 0;
		this.item.OriginalTotalAfterTax = 0;
		this.item.CalcOriginalTotalAdditions = 0;
		this.item.CalcTotalOriginal = 0;

		this.item.OriginalTotalDiscountPercent = 0;
		this.item.OriginalTaxPercent = 0;
		this.item.CalcOriginalTotalAdditionsPercent = 0;
		this.item.AdditionsAmountPercent = 0;
		this.item.OriginalDiscountFromSalesmanPercent = 0;

		for (let m of this.posService.dataSource.menuList) for (let mi of m.Items) mi.BookedQuantity = 0;

		for (let line of this.item.OrderLines) {
			line._serviceCharge = this.posService.systemConfig.POSServiceCharge || 0;

			//Parse data + Tính total
			line.UoMPrice = line.IsPromotionItem ? 0 : parseFloat(line.UoMPrice) || 0;
			line.TaxRate = parseFloat(line.TaxRate) || 0;
			line.Quantity = parseFloat(line.Quantity) || 0;
			line.OriginalTotalBeforeDiscount = line.UoMPrice * line.Quantity;
			this.item.OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount;

			//line.OriginalPromotion
			line.OriginalDiscount1 = line.IsPromotionItem ? 0 : parseFloat(line.OriginalDiscount1) || 0;
			line.OriginalDiscount2 = line.IsPromotionItem ? 0 : parseFloat(line.OriginalDiscount2) || 0;
			line.OriginalDiscountByItem = line.OriginalDiscount1 + line.OriginalDiscount2;
			line.OriginalDiscountByGroup = 0;
			line.OriginalDiscountByLine = line.OriginalDiscountByItem + line.OriginalDiscountByGroup;
			line.OriginalDiscountByOrder = parseFloat(line.OriginalDiscountByOrder) || 0;
			if (this.Discount?.Percent > 0) {
				line.OriginalDiscountByOrder = (this.Discount?.Percent * line.OriginalTotalBeforeDiscount) / 100;
			}
			this.item.OriginalDiscountByOrder += line.OriginalDiscountByOrder;
			line.OriginalTotalDiscount = line.OriginalDiscountByLine + line.OriginalDiscountByOrder;
			this.item.OriginalTotalDiscount += line.OriginalTotalDiscount;

			line.OriginalTotalAfterDiscount = line.OriginalTotalBeforeDiscount - line.OriginalTotalDiscount;
			line.OriginalTax = line.OriginalTotalAfterDiscount * (line.TaxRate / 100.0);
			this.item.OriginalTotalAfterDiscount += line.OriginalTotalAfterDiscount;
			this.item.OriginalTax += line.OriginalTax;
			line.OriginalTotalAfterTax = line.OriginalTotalAfterDiscount + line.OriginalTax;
			this.item.OriginalTotalAfterTax += line.OriginalTotalAfterTax;
			line.CalcOriginalTotalAdditions = line.OriginalTotalAfterDiscount * (line._serviceCharge / 100.0) * (1 + line.TaxRate / 100.0);
			line.AdditionsAmount = line.OriginalTotalAfterDiscount * (line._serviceCharge / 100.0);
			this.item.AdditionsAmount += line.AdditionsAmount;
			this.item.AdditionsTax += line.CalcOriginalTotalAdditions - line.AdditionsAmount;
			this.item.CalcOriginalTotalAdditions += line.CalcOriginalTotalAdditions;

			line.CalcTotalOriginal = line.OriginalTotalAfterTax + line.CalcOriginalTotalAdditions;
			this.item.CalcTotalOriginal += line.CalcTotalOriginal;
			line.OriginalDiscountFromSalesman = parseFloat(line.OriginalDiscountFromSalesman) || 0;
			line._OriginalTotalAfterDiscountFromSalesman = line.CalcTotalOriginal - line.OriginalDiscountFromSalesman;

			this.item.OriginalDiscountFromSalesman += line.OriginalDiscountFromSalesman;

			//Lấy hình & hiển thị thông tin số lượng đặt hàng lên menu
			for (let m of this.posService.dataSource.menuList)
				for (let mi of m.Items) {
					if (mi.Id == line.IDItem) {
						mi.BookedQuantity = this.item.OrderLines.filter((x) => x.IDItem == line.IDItem)
							.map((x) => x.Quantity)
							.reduce((a, b) => +a + +b, 0);
						line._item = mi;
					}
				}

			line._background = {
				'background-image': 'url("' + environment.posImagesServer + (line._item && line._item.Image ? line._item.Image : 'assets/pos-icons/POS-Item-demo.png') + '")',
			};

			//Tính số lượng item chưa gửi bếp
			line._undeliveredQuantity = line.Quantity - line.ShippedQuantity;
			if (line._undeliveredQuantity > 0) {
				this.printData.undeliveredItems.push(line);
				line.Status = 'New';
			}
			// else {
			//     line.Status = 'Serving';
			// }
			this.updateOrderLineStatus(line);

			line._Locked = this.item._Locked ? true : this.noLockLineStatusList.indexOf(line.Status) == -1;
			if (this.pageConfig.canDeleteItems) {
				line._Locked = false;
			}
		}

		this.item.OriginalTotalDiscountPercent = ((this.item.OriginalTotalDiscount / this.item.OriginalTotalBeforeDiscount) * 100.0).toFixed(0);
		this.item.OriginalTaxPercent = (((this.item.OriginalTax + this.item.AdditionsTax) / (this.item.OriginalTotalAfterDiscount + this.item.AdditionsAmount)) * 100.0).toFixed(0);
		this.item.CalcOriginalTotalAdditionsPercent = ((this.item.CalcOriginalTotalAdditions / this.item.OriginalTotalAfterTax) * 100.0).toFixed(0);
		this.item.AdditionsAmountPercent = ((this.item.AdditionsAmount / this.item.OriginalTotalAfterDiscount) * 100.0).toFixed(0);
		this.item.OriginalDiscountFromSalesmanPercent = ((this.item.OriginalDiscountFromSalesman / this.item.CalcTotalOriginal) * 100.0).toFixed(0);
		this.item.Debt = Math.round(this.item.CalcTotalOriginal - this.item.OriginalDiscountFromSalesman - this.item.Received);
	}

	//patch value to form
	private patchOrderValue() {
		this.formGroup?.patchValue(this.item);
		this.patchOrderLinesValue();
	}

	private patchOrderLinesValue() {
		this.formGroup.controls.OrderLines = new FormArray([]);
		if (this.item.OrderLines?.length) {
			for (let i of this.item.OrderLines) {
				this.addOrderLine(i);
			}
		}
	}

	private updateOrderLineStatus(line) {
		line.StatusText = lib.getAttrib(line.Status, this.posService.dataSource.orderDetailStatusList, 'Name', '--', 'Code');
		line.StatusColor = lib.getAttrib(line.Status, this.posService.dataSource.orderDetailStatusList, 'Color', '--', 'Code');
	}

	patchOrderLines() {}

	private addOrderLine(line) {
		let groups = <FormArray>this.formGroup.controls.OrderLines;
		let group = this.formBuilder.group({
			IDOrder: [line.IDOrder],
			Id: new FormControl({ value: line.Id, disabled: true }),
			Code: [line.Code],

			Type: [line.Type],
			Status: new FormControl({ value: line.Status, disabled: true }),
			IDItem: [line.IDItem, Validators.required],
			IDTax: [line.IDTax],
			TaxRate: [line.TaxRate],

			IDUoM: [line.IDUoM, Validators.required],
			UoMPrice: [line.UoMPrice],

			Quantity: [line.Quantity, Validators.required],
			IDBaseUoM: [line.IDBaseUoM],
			UoMSwap: [line.UoMSwap],
			UoMSwapAlter: [line.UoMSwapAlter],
			BaseQuantity: [line.BaseQuantity],

			ShippedQuantity: [line.ShippedQuantity],
			Remark: new FormControl({ value: line.Remark, disabled: true }),

			IsPromotionItem: [line.IsPromotionItem],
			IDPromotion: [line.IDPromotion],

			OriginalDiscountFromSalesman: [line.OriginalDiscountFromSalesman],

			CreatedDate: new FormControl({
				value: line.CreatedDate,
				disabled: true,
			}),

			// OriginalTotalBeforeDiscount
			// OriginalPromotion
			// OriginalDiscount1
			// OriginalDiscount2
			// OriginalDiscountByItem
			// OriginalDiscountByGroup
			// OriginalDiscountByLine
			// OriginalDiscountByOrder
			// OriginalDiscountFromSalesman
			// OriginalTotalDiscount
			// OriginalTotalAfterDiscount
			// OriginalTax
			// OriginalTotalAfterTax
			// CalcOriginalTotalAdditions
			// CalcOriginalTotalDeductions
			// CalcTotalOriginal

			// ShippedQuantity
			// ReturnedQuantity

			// TotalBeforeDiscount
			// Discount1
			// Discount2
			// DiscountByItem
			// Promotion
			// DiscountByGroup
			// DiscountByLine
			// DiscountByOrder
			// DiscountFromSalesman
			// TotalDiscount
			// TotalAfterDiscount
			// Tax
			// TotalAfterTax
			// CalcTotalAdditions
			// CalcTotalDeductions
			// CalcTotal

			// CreatedBy
			// ModifiedBy
			// CreatedDate
			// ModifiedDate
		});
		groups.push(group);
	}
	delay = 1000;
	setOrderValue(data, forceSave = false, autoSave = null) {
		for (const c in data) {
			if (c == 'OrderLines' || c == 'OrderLines') {
				let fa = <FormArray>this.formGroup.controls.OrderLines;

				for (const line of data[c]) {
					let idx = -1;
					if (c == 'OrderLines') {
						idx = this.item[c].findIndex((d) => d.Code == line.Code && d.IDUoM == line.IDUoM);
					}
					//Remove Order line
					if (line.Quantity < 1) {
						if (line.Id) {
							let deletedLines = this.formGroup.get('DeletedLines').value;
							deletedLines.push(line.Id);
							this.formGroup.get('DeletedLines').setValue(deletedLines);
							this.formGroup.get('DeletedLines').markAsDirty();
						}
						this.item.OrderLines.splice(idx, 1);
						fa.removeAt(idx);
					}
					//Update
					else {
						let cfg = <FormGroup>fa.controls[idx];

						for (const lc in line) {
							let fc = <FormControl>cfg.controls[lc];
							if (fc) {
								fc.setValue(line[lc]);
								fc.markAsDirty();
							}
						}
					}

					let numberOfGuests = this.formGroup.get('NumberOfGuests');
					numberOfGuests.setValue(this.item.OrderLines?.map((x) => x.Quantity).reduce((a, b) => +a + +b, 0));
					numberOfGuests.markAsDirty();

					const parentElement = this.numberOfGuestsInput?.nativeElement?.parentElement;
					if (parentElement) {
						parentElement.classList.add('shake');
						setTimeout(() => {
							parentElement.classList.remove('shake');
						}, 2000);
					}
				}
			} else {
				let fc = <FormControl>this.formGroup.controls[c];
				if (fc) {
					fc.setValue(data[c]);
					fc.markAsDirty();
				}
			}
		}
		this.calcOrder();
		this.env.setStorage(`POSOrder_${this.item.Code}`, this.item);

		dog && console.log('setOrderValue', this.item);
		if (forceSave) {
			return this.saveChange();
		} else {
			if (autoSave === null) autoSave = this.posService.systemConfig.IsAutoSave;
			if ((this.item.OrderLines.length || this.formGroup.controls.DeletedLines.value.length) && autoSave) {
				if (this.submitAttempt) {
					this.delay += 1000;
				}
				this.debounce(() => {
					this.delay = 1000; // reset
					this.saveChange();
				}, this.delay);
			}
			return Promise.resolve();
		}
	}

	alwaysReturnProps = ['Id', 'IDBranch', 'Code'];
	async saveChange() {
		let submitItem = this.getDirtyValues(this.formGroup);
		return this.saveChange2();
	}

	savedChange(savedItem?: any, form?: FormGroup<any>): void {
		if (savedItem) {
			if (form.controls.IDContact.value != savedItem.IDContact) this.changedIDAddress(savedItem._Customer);

			if (this.pageConfig.isDetailPage && form == this.formGroup && this.id == 0) {
				this.id = savedItem.Id;
				let newURL = '#pos-order/' + savedItem.Id + '/' + this.idTable;
				history.pushState({}, null, newURL);
			}

			this.updateItem(savedItem);
		}

		this.loadedData();

		this.submitAttempt = false;
		this.env.showMessage('Saving completed!', 'success');

		// if (savedItem.Status == 'Done') {
		// 	this.sendPrint(savedItem.Status, true);
		// }
		// if (savedItem.Status == 'TemporaryBill' && this.posService.systemConfig.POSEnableTemporaryPayment && this.posService.systemConfig.POSEnablePrintTemporaryBill) {
		// 	this.sendPrint();
		// }
	}

	private updateItem(savedItem: any) {
		if (savedItem) {
			if (this.item.Id < 1) {
				this.item.Id = savedItem.Id;
				this.formGroup.controls.Id.setValue(savedItem.Id);
			}

			if (this.item.Status != savedItem.Status) {
				this.item.Status = savedItem.Status;
				this.formGroup.controls.Status.setValue(savedItem.Status);
			}

			//Update lines
			for (let sl of savedItem.OrderLines) {
				let idx = this.item.OrderLines.findIndex((d) => d.Code == sl.Code);
				if (idx != -1) {
					if (this.item.OrderLines[idx].Id < 1) {
						this.item.OrderLines[idx].Id = sl.Id;
						this.formGroup.controls.OrderLines['controls'][idx].controls['Id'].setValue(sl.Id);
					}
					if (this.item.OrderLines[idx].Status != sl.Status) {
						this.item.OrderLines[idx].Status = sl.Status;
						this.formGroup.controls.OrderLines['controls'][idx].controls['Status'].setValue(sl.Status);
					}
				}
			}
		}
	}

	getPromotionProgram() {
		this.programProvider.commonService
			.connect('GET', 'PR/Program/AppliedProgramInSaleOrder', {
				IDSO: this.id,
			})
			.toPromise()
			.then((data: any) => {
				this.promotionAppliedPrograms = data;
			})
			.catch((err) => {
				dog && console.log(err);
			});
	}

	changeTable() {
		this.saveSO();
	}
	_contactDataSource = this.buildSelectDataSource((term) => {
		return this.contactProvider.search({
			Take: 20,
			Skip: 0,
			SkipMCP: true,
			Term: term ? term : 'BP:' + this.item?.IDContact,
		});
	});

	async addContact() {
		const modal = await this.modalController.create({
			component: POSContactModalPage,
			cssClass: 'my-custom-class',
			componentProps: {
				item: null,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();
		if (data) {
			this.setOrderValue({
				// IDContact: data.IDAddress,
				IDAddress: data.IDAddress,
			});
			this.formGroup.get('IDAddress').setValue(data.IDAddress);
			this.changedIDAddress(data);
			this._contactDataSource.selected.push(data);
			this._contactDataSource.selected = [...this._contactDataSource.selected];
			this._contactDataSource.initSearch();
		}
	}
	changedIDAddress(address) {
		if (address) {
			this.Staff = null;
			this.setOrderValue({
				IDContact: address.Id,
				IDAddress: address.IDAddress,
			});
			this.item._Customer = address;
			if (this.item._Customer.IsStaff == true) {
				this.getStaffInfo(this.item._Customer.Code);
			}
		}
	}

	private saveSO() {
		Object.assign(this.item, this.formGroup.value);
		this.saveChange();
	}
	getStaffInfo(Code) {
		if (Code != null) {
			this.staffProvider
				.read({
					Code_eq: Code,
					IDBranch: this.env.branchList.map((b) => b.Id).toString(),
				})
				.then((result: any) => {
					if (result['count'] > 0) {
						this.Staff = result['data'][0];
						this.Staff.DepartmentName = this.env.branchList.find((b) => b.Id == this.Staff.IDDepartment)?.Name;
						this.Staff.JobTitleName = this.env.jobTitleList.find((b) => b.Id == this.Staff.IDJobTitle)?.Name;
						this.Staff.avatarURL = environment.staffAvatarsServer + this.item._Customer.Code + '.jpg?t=' + new Date().getTime();
					}
				});
		}
	}
	discountFromSalesman(line, form) {
		let OriginalDiscountFromSalesman = form.controls.OriginalDiscountFromSalesman.value;
		if (OriginalDiscountFromSalesman == '') {
			OriginalDiscountFromSalesman = 0;
		}

		if (OriginalDiscountFromSalesman > line.CalcTotalOriginal) {
			this.env.showMessage('Gift amount cannot be greater than the product value!', 'danger');
			return false;
		}
		this.setOrderValue({
			OrderLines: [
				{
					Id: line.Id,
					Code: line.Code,
					IDUoM: line.IDUoM,
					Remark: line.Remark,
					OriginalDiscountFromSalesman: OriginalDiscountFromSalesman,
				},
			],
		});
	}

	private getPayments() {
		return new Promise((resolve, reject) => {
			this.commonService
				.connect('GET', 'BANK/IncomingPaymentDetail', {
					IDSaleOrder: this.item.Id,
				})
				.toPromise()
				.then((result: any) => {
					this.paymentList = result; //.filter(p => p.IncomingPayment.Status == "Success" || p.IncomingPayment.Status == "Processing");
					this.paymentList.forEach((e) => {
						// console.log(this.posService.dataSource.paymentStatusList);

						e.IncomingPayment._Status = this.posService.dataSource.paymentStatusList.find((s) => s.Code == e.IncomingPayment.Status) || {
							Code: e.IncomingPayment.Status,
							Name: e.IncomingPayment.Status,
							Color: 'danger',
						};
						e.IncomingPayment.TypeText = lib.getAttrib(e.IncomingPayment.Type, this.posService.dataSource.paymentTypeList, 'Name', '--', 'Code');
					});
					let PaidAmounted = this.paymentList
						?.filter((x) => x.IncomingPayment.Status == 'Success' && x.IncomingPayment.IsRefundTransaction == false)
						.map((x) => x.Amount)
						.reduce((a, b) => +a + +b, 0);
					let RefundAmount = this.paymentList
						?.filter((x) => (x.IncomingPayment.Status == 'Success' || x.IncomingPayment.Status == 'Processing') && x.IncomingPayment.IsRefundTransaction == true)
						.map((x) => x.Amount)
						.reduce((a, b) => +a + +b, 0);

					this.item.Received = PaidAmounted - RefundAmount;
					this.item.Debt = Math.round(this.item.CalcTotalOriginal - this.item.OriginalDiscountFromSalesman - this.item.Received);
					if (this.item.Debt > 0) {
						this.item.IsDebt = true;
					}

					if (this.posService.systemConfig.POSSettleAtCheckout && Math.abs(this.item.Debt) < 10 && this.item.Status != 'Done') {
						this.env.showMessage('The order has been paid, the system will automatically close this bill.');
						this.formGroup.enable();
						this.doneOrder();
					}
					resolve(this.paymentList);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	doneOrder() {
		let changed: any = { OrderLines: [] };
		if (this.printData.undeliveredItems.length > 0) {
			let message = `Bàn số {{value}} có {{value1}} sản phẩm chưa gửi bar/bếp. Bạn hãy gửi bar/bếp và hoàn tất.`;
			if (this.item.Debt > 0) {
				message = `Bàn số {{value}} có {{value1}} sản phẩm chưa gửi bar/bếp và đơn hàng chưa thanh toán xong. Bạn hãy gửi bar/bếp và hoàn tất.`;
			}
			this.env.showPrompt({ code: message, value: this.item.Tables[0], value1: this.printData.undeliveredItems.length }, null, 'Thông báo', 'GỬI', null).then((_) => {
				this.printData.undeliveredItems = []; //<-- clear;
				this.item.OrderLines.forEach((line) => {
					if (this.checkDoneLineStatusList.indexOf(line.Status) == -1) {
						line.Status = 'Done';
					}
					if (line.Quantity > line.ShippedQuantity) {
						line.ShippedQuantity = line.Quantity;
						line.ReturnedQuantity = 0;
						changed.OrderLines.push({
							Id: line.Id,
							Code: line.Code,
							IDUoM: line.IDUoM,
							ShippedQuantity: line.ShippedQuantity,
							ReturnedQuantity: 0,
						});
					}
				});
				changed.OrderLines = this.item.OrderLines;
				changed.Status = 'Done';
				this.setOrderValue(changed, true);
			});
		} else if (this.item.Debt > 0) {
			let message = 'Đơn hàng chưa thanh toán xong. Bạn có muốn tiếp tục hoàn tất?';
			this.env
				.showPrompt(message, null, 'Thông báo')
				.then((_) => {
					this.item.OrderLines.forEach((line) => {
						if (this.checkDoneLineStatusList.indexOf(line.Status) == -1) {
							line.Status = 'Done';
						}
					});
					changed.OrderLines = this.item.OrderLines;
					changed.Status = 'Done';
					this.setOrderValue(changed, true);
				})
				.catch((_) => {});
		} else {
			this.item.OrderLines.forEach((line) => {
				if (this.checkDoneLineStatusList.indexOf(line.Status) == -1) {
					line.Status = 'Done';
				}
			});
			changed.OrderLines = this.item.OrderLines;
			changed.Status = 'Done';
			this.setOrderValue(changed, true);
		}
	}

	cssStyling = `
	.bold{font-weight:bold}.bill .items .name,.bill .items tr:last-child td{border:none!important}.bill,.bill .title,.sheet{color:#000;font-size:18px;}.sheet .no-break-page,.sheet .no-break-page *,.sheet table break-guard,.sheet table break-guard *,.sheet table tr{page-break-inside:avoid}.bill{display:block;overflow:hidden!important}.bill .sheet{box-shadow:none!important}.bill .header,.bill .message,.sheet.rpt .cen,.text-center{text-align:center}.bill .header span{display:inline-block;width:100%}.bill .header .logo img{max-width:150px;max-height:75px}.bill .header .bill-no,.bill .header .brand,.bill .items .quantity,.bold,.sheet.rpt .bol{font-weight:700}.bill .header .address{font-size:80%;font-style:italic}.bill .table-info{border:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .table-info-top{border-top:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .table-info-bottom{border-bottom:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .items{margin:5px 0}.bill .items tr td{border-bottom:1px dashed #ccc;padding-bottom:5px}.bill .items .name{font-size:18px;width:100%;padding-top:5px;padding-bottom:2px!important}.bill .items .code{font-weight:700;text-transform:uppercase}.bill .items .total,.sheet.rpt .num,.text-right{text-align:right}.bill .header,.bill .items,.bill .message,.bill .table-info,.bill .table-info-bottom,.bill .table-info-top{padding-left:8px;padding-right:8px}.page-footer-space{margin-top:10px}.table-name-bill{font-size:16px}.table-info-top td{padding-top:5px}.table-info-top .small{font-size:smaller!important}.sheet{margin:0;overflow:hidden;position:relative;box-sizing:border-box;page-break-after:always;font-family:'Times New Roman',Times,serif;font-size:13px;background:#fff}.sheet.rpt .top-zone{min-height:940px}.sheet.rpt table,.sheet.rpt tbody table{width:100%;border-collapse:collapse}.sheet.rpt tbody table td{padding:0}.sheet.rpt .rpt-header .ngay-hd{width:100px}.sheet.rpt .rpt-header .title{font-size:18px;font-weight:700;color:#000}.sheet.rpt .rpt-header .head-c1{width:75px}.sheet.rpt .chu-ky,.sheet.rpt .rpt-nvgh-header{margin-top:20px}.sheet.rpt .ds-san-pham{margin:10px 0}.sheet.rpt .ds-san-pham td{padding:2px 5px;border:1px solid #000;white-space:nowrap}.sheet.rpt .ds-san-pham .head{background-color:#f1f1f1;font-weight:700}.sheet.rpt .ds-san-pham .oven{background-color:#f1f1f1}.sheet.rpt .ds-san-pham .ghi-chu{min-width:170px}.sheet.rpt .ds-san-pham .tien{width:200px}.sheet.rpt .thanh-tien .c1{width:95px}.sheet.rpt .chu-ky td{font-weight:700;text-align:center}.sheet.rpt .chu-ky .line2{font-weight:400;height:100px;page-break-inside:avoid}.sheet.rpt .noti{margin-top:-105px}.sheet.rpt .noti td{vertical-align:bottom}.sheet.rpt .noti td .qrc{width:100px;height:100px;border:1px solid;display:block}.sheet.rpt .big{font-size:16px;font-weight:700;color:#b7332b}.sheet .page-footer,.sheet .page-footer-space,.sheet .page-header,.sheet .page-header-space{height:10mm}.sheet table{page-break-inside:auto}.sheet table tr{page-break-after:auto}.float-right{float:right}
    `;
	deleteVoucher(p) {
		let apiPath = {
			method: 'POST',
			url: function () {
				return ApiSetting.apiDomain('PR/Program/UnUseVoucher/');
			},
		};
		new Promise((resolve, reject) => {
			this.pageProvider.commonService
				.connect(apiPath.method, apiPath.url(), {
					SaleOrder: this.item,
					VoucherCodeList: [p.VoucherCode]
				})
				.toPromise()
				.then((savedItem: any) => {
					this.env.showMessage('Saving completed!', 'success');
					resolve(true);
					this.refresh();
				})
				.catch((err) => {
					this.env.showErrorMessage(err);
					reject(err);
				});
		});
	}

	async setKitchenID(value, ms = 1) {
		return new Promise((resolve, reject) => {
			this.kitchenQuery = value;
			setTimeout(() => {
				resolve(this.kitchenQuery);
			}, ms);
		});
	}

	async setItemQuery(value, ms = 1) {
		return new Promise((resolve, reject) => {
			this.itemQuery = value;
			setTimeout(() => {
				resolve(this.itemQuery);
			}, ms);
		});
	}

	async checkData(receipt = true, saveData = true, sendEachItem = false) {
		return new Promise(async (resolve, reject) => {
			if (!receipt && saveData && sendEachItem) {
				let undelivered = [];
				this.item.OrderLines.forEach((e) => {
					if (e.Quantity != e.ShippedQuantity) {
						undelivered.push({
							Id: e.Id,
							Code: e.Code,
							ShippedQuantity: e.Quantity,
							IDUoM: e.IDUoM,
							Status: 'Serving',
						});
					}
				});

				this.submitAttempt = false;
				this.setOrderValue({ Status: 'Scheduled', OrderLines: undelivered }, false, true);
				resolve(true);
			}

			this.submitAttempt = false;
			this.printData.undeliveredItems = []; //<-- clear;
			this.printerCodeList = [];
			this.dataList = [];
			resolve(true);
		});
	}

	applyDiscount() {
		this.pageProvider.commonService
			.connect('POST', 'SALE/Order/UpdatePosOrderDiscount/', {
				Id: this.item.Id,
				Percent: this.Discount.Percent,
			})
			.toPromise()
			.then((result) => {
				this.env.showMessage('Saving completed!', 'success');
				this.refresh();
			})
			.catch((err) => {
				this.env.showMessage('Cannot save, please try again!', 'danger');
			});
	}

	async scanQRCode() {
		let code = await this.scanner.scan();
		if (code.indexOf('VCARD;') != -1) {
			var tempString = code.substring(code.indexOf('VCARD;') + 6, code.length);

			var StaffCode = tempString.split(';')[0];
			var QRGenTime = tempString.split(';')[1];

			let toDay = new Date();
			let fromTime = new Date(toDay);
			let toTime = new Date(toDay);
			fromTime.setMinutes(toDay.getMinutes() - 1);
			toTime.setMinutes(toDay.getMinutes() + 1);

			let currentTimeFrom = lib.dateFormat(fromTime, 'dd/mm/yyyy') + ' ' + lib.dateFormat(fromTime, 'hh:MM');
			let currentTimeTo = lib.dateFormat(toTime, 'dd/mm/yyyy') + ' ' + lib.dateFormat(toTime, 'hh:MM');

			if (currentTimeFrom <= QRGenTime && QRGenTime <= currentTimeTo) {
				this.contactProvider.read({ Code: StaffCode, Take: 20 }).then((resp) => {
					let address = resp['data'][0];
					address.IDAddress = address['Addresses'][0]['Id'];
					address.Address = address['Addresses'][0];

					this.env.showMessage('Quét thành công! Họ và Tên: {{value}}', null, address['Name']);
					this._contactDataSource.selected.push(address);
					this.changedIDAddress(address);
					this._contactDataSource.initSearch();
					this.cdr.detectChanges();
					this.saveChange();
				});
			} else {
				this.env.showMessage('Code has expired, please get a new staff code! QR code generated at: {{value}}', 'danger', QRGenTime);
				setTimeout(() => this.scanQRCode(), 0);
			}
		} else {
			this.env
				.showPrompt('Please scan valid QR code', 'Invalid QR code', null, 'Retry', 'Cancel')
				.then(() => {
					setTimeout(() => this.scanQRCode(), 0);
				})
				.catch(() => {});
			return;
		}
	}

	menuItemsPaging(event) {}
}
