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
import { concat, of } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap, mergeMap } from 'rxjs/operators';
import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';

import { POSMemoModalPage } from '../pos-memo-modal/pos-memo-modal.page';
import { dog, environment } from 'src/environments/environment';
import { POSVoucherModalPage } from '../pos-voucher-modal/pos-voucher-modal.page';
import { POSContactModalPage } from '../pos-contact-modal/pos-contact-modal.page';
import { POSInvoiceModalPage } from '../pos-invoice-modal/pos-invoice-modal.page';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import QRCode from 'qrcode';
import { printData, PrintingService } from 'src/app/services/util/printing.service';
import { BarcodeScannerService } from 'src/app/services/util/barcode-scanner.service';
import { POSService } from '../_services/pos.service';
import { InputControlComponent } from 'src/app/components/controls/input-control.component';
import { PromotionService } from 'src/app/services/custom/promotion.service';
import { CanComponentDeactivate } from './deactivate-guard';
import { PaymentModalComponent } from 'src/app/modals/payment-modal/payment-modal.component';
import { ComboModalPage } from './combo-modal/combo-modal.page';

@Component({
	selector: 'app-pos-order-detail',
	templateUrl: './pos-order-detail.page.html',
	styleUrls: ['./pos-order-detail.page.scss'],
	standalone: false,
})
export class POSOrderDetailPage extends PageBase implements CanComponentDeactivate {
	@ViewChild('numberOfGuestsInput') numberOfGuestsInput: ElementRef;
	@ViewChild('bill', { static: false }) billRef: ElementRef;
	isOpenMemoModal = false;
	AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
	noImage = environment.posImagesServer + 'assets/pos-icons/POS-Item-demo.png'; //No image for menu item
	segmentView = '0';
	idTable: any; //Default table
	paymentList = [];
	subPromotion: any;
	private _filteredItemsCache: Map<string, any[]> = new Map();
	private _lastCacheKey: string = '';
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

	_contactDataSource = this.buildSelectDataSource((term) => {
		return this.contactProvider.search({
			Take: 20,
			Skip: 0,
			SkipMCP: true,
			Keyword: term,
		});
	});

	isEnter = false;

	@ViewChild('contactInput') contactInput: InputControlComponent;
	paymentSuccessTriggered = false; // check signalr payment success
	lastEventRefreshTime = 0;
	private readonly EVENT_REFRESH_THROTTLE = 5000; // 5 seconds in milliseconds
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
			IDTaxInfo: [],
			TaxCode: [],
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
					this.refreshFromEvent();
					break;
				case 'signalR:POSPaymentSuccess':
					this.paymentSuccessTriggered = true;
					this.refreshFromEvent();
					break;

				case 'networkStatusChange':
					this.checkNetworkChange(data);
					break;
			}
		});
		this.subPromotion = this.promotionService.voucherBySOObs$.subscribe((map) => {
			this.promotionAppliedPrograms = map[this.id] || [];
		});
		// if(!this.item.Id) this.formGroup.get('NumberOfGuests')?.markAsDirty();
		super.ngOnInit();
	}

	ngOnDestroy() {
		this.pageConfig?.subscribePOSOrderDetail?.unsubscribe();
		this.subPromotion.unsubscribe();
		this.promotionService.clearMemory(this.id);

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
		this._contactDataSource.initSearch = () => {
			this._contactDataSource.loading = false;
			this._contactDataSource.items$ = concat(
				of(this._contactDataSource.selected),
				this._contactDataSource.input$.pipe(
					distinctUntilChanged(),
					tap(() => (this._contactDataSource.loading = true)),
					switchMap((term) => {
						console.log('search term:', term);
						return this._contactDataSource.searchFunction(term).pipe(
							catchError(() => of([])), // empty list on error
							tap(() => (this._contactDataSource.loading = false)),
							mergeMap((e: any) => {
								return new Promise((resolve) => {
									if (e && e.length === 1 && this.isEnter) {
										const valueToSet = e[0]['IDAddress'];
										this.formGroup.get('IDAddress').setValue(valueToSet);
										this.formGroup.get('IDAddress').markAsDirty();
										this.changedIDAddress(e[0]);
										this.contactInput?.closeDropdown();
										this._contactDataSource.loading = false;
										// onAutoSelect(e[0]);
									}
									this.isEnter = false;
									resolve(e);
								});
							})
						);
					})
				)
			);
		};

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

	onContactKeyDown(obj) {
		this.isEnter = obj.isEnter;
		this._contactDataSource.input$.next(obj.term);
	}

	async loadedData(event?: any, ignoredFromGroup?: boolean) {
		if (!this.item) {
			super.loadedData(event);
			return;
		}

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
		for (let m of this.posService.dataSource.menuList)
			for (let mi of m.Items) {
				if (mi.BOMs && mi.BOMs.length > 0) {
					// mi.BOMs.sort((a, b) => {
					// 	if (a.Sort !== b.Sort) return a.Sort - b.Sort;
					// 	return a.Id - b.Id;
					// });

					let groups = [];
					let currentGroup: any = {};
					currentGroup.Items = [];
					for (let g of mi.BOMs) {
						if (g.Type == 'Group') {
							currentGroup = g;
							currentGroup.Items = [];
							groups.push(currentGroup);
						} else {
							currentGroup.Items.push(g);
						}
					}
					mi.Groups = groups;
				}
			}

		// this.contactInput?.isFromBarcodeScan$.subscribe((obj) => {
		// 	this.isEnter = obj.isEnter;
		// 	this._contactDataSource.input$.next(obj.term);
		// });
		if (this.item.IDBranch != this.env.selectedBranch && this.item.Id) {
			this.env.showMessage('Không tìm thấy đơn hàng, vui lòng kiểm tra chi nhánh!', 'danger');
			return;
		}

		if (!this.item?.Id) {
			Object.assign(this.item, this.formGroup.getRawValue());
			this.setOrderValue(this.item);
			this.formGroup.get('NumberOfGuests').markAsDirty();
		} else {
			this.patchOrderValue();
			this.promotionService.getPromotionProgram(this.item.Id);
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
			if (this.item._Customer.IsStaff == true) {
				this.getStaffInfo(this.item._Customer.Code);
			}
		}

		this.getBillPrinter();
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
		this.isCompleteLoaded = true;
		// setTimeout(() => {
		// 	this.segmentChanged('all');
		// }, 100);
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

	getBillPrinter() {
		this.env.getStorage('POSTerminalConfig').then((data) => {
			if (data && data.defaultPrinter) {
				this.defaultPrinter = [data.defaultPrinter];
			}
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

	refreshFromEvent(): void {
		const now = Date.now();
		const timeSinceLastRefresh = now - this.lastEventRefreshTime;

		if (timeSinceLastRefresh >= this.EVENT_REFRESH_THROTTLE) {
			dog && console.log('POSOrderDetailPage: refreshFromEvent - refreshing');
			this.lastEventRefreshTime = now;
			this.refresh();
		} else {
			dog && console.log(`POSOrderDetailPage: refreshFromEvent - throttled (${timeSinceLastRefresh}ms < ${this.EVENT_REFRESH_THROTTLE}ms)`);
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

	async FoC(line) {
		dog && console.log('FoC', line);
		if (!this.pageConfig.canEdit || this.item.Status == 'TemporaryBill') {
			this.env.showMessage('The order is locked, you cannot edit or add items!', 'warning');
			return;
		}
		line.UoMPrice = 0;
		this.setOrderValue({
			OrderLines: [
				{
					Id: line.Id,
					Code: line.Code,
					IDUoM: line.IDUoM,
					UoMPrice: line.UoMPrice,
				},
			],
		});
		if (line.Status != 'New') {
			await this.saveChange();
		}
	}

	async addToCart(item, idUoM, quantity = 1, idx = -1, status = '', code = '') {
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
			if (code) line = this.item.OrderLines.find((d) => d.IDUoM == idUoM && d.Status == 'New' && d.Code == code); //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
		} else {
			line = this.item.OrderLines[idx]; //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
		}

		if (!line || (item.BOMs?.length > 0 && status == '')) {
			line = {
				// IDOrder: this.item.Id,
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
				Name: item.Name,
				Remark: null,
				IsPromotionItem: false,
				IDPromotion: null,
				Groups: item.Groups,
				OriginalDiscountFromSalesman: 0,
				SubOrders: [],
				CreatedDate: new Date(),
				_item: item,
			};
			if (item.Groups?.length > 0) {
				let rs = await this.openComboModal(line);
				if (!rs) return;
			}
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
				let subOrders = [];
				if (line.SubOrders && line.SubOrders.length > 0) {
					line.SubOrders.forEach((so) => {
						let orginalQty = so.Quantity / (line.Quantity - quantity);
						so.Quantity = orginalQty * line.Quantity;
					});
					subOrders = line.SubOrders;
					if (line.Id) {
						subOrders = [
							...line.SubOrders?.map((so) => {
								return { Code: so.Code, Quantity: so.Quantity, Id: so.Id };
							}),
						];
					}
				}
				this.setOrderValue({
					OrderLines: [
						{
							Id: line.Id,
							Code: line.Code,
							IDUoM: line.IDUoM,
							Quantity: line.Quantity,
							SubOrders: subOrders,
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
							let subOrders = [];
							if (line.SubOrders && line.SubOrders.length > 0) {
								line.SubOrders.forEach((so) => {
									let orginalQty = so.Quantity / (line.Quantity - quantity);
									so.Quantity = orginalQty * line.Quantity;
								});
								subOrders = line.SubOrders;
								if (line.Id) {
									subOrders = [
										...line.SubOrders?.map((so) => {
											return { Code: so.Code, Quantity: so.Quantity, Id: so.Id };
										}),
									];
								}
							}
							this.setOrderValue({
								OrderLines: [
									{
										Id: line.Id,
										Code: line.Code,
										IDUoM: line.IDUoM,
										Quantity: line.Quantity,
										SubOrders: subOrders,
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
								let subOrders = [];
								if (line.SubOrders && line.SubOrders.length > 0) {
									line.SubOrders.forEach((so) => {
										let orginalQty = so.Quantity / (line.Quantity - quantity);
										so.Quantity = orginalQty * line.Quantity;
									});
									subOrders = line.SubOrders;
									if (line.Id) {
										subOrders = [
											...line.SubOrders?.map((so) => {
												return { Code: so.Code, Quantity: so.Quantity, Id: so.Id };
											}),
										];
									}
								}
								this.setOrderValue({
									OrderLines: [
										{
											Id: line.Id,
											Code: line.Code,
											IDUoM: line.IDUoM,
											Quantity: line.Quantity,
											SubOrders: subOrders,
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
	async openComboModal(line, markAsDirty = false) {
		let item = line._item;

		if (item.Groups == null || item.Groups.length == 0) return null;
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
		if (item.Groups?.length > 0) {
			const modal = await this.modalController.create({
				component: ComboModalPage,
				backdropDismiss: true,
				cssClass: 'modal-combo',
				componentProps: {
					item: line,
					canEdit: this.pageConfig.canEdit && !['TemporaryBill', 'Cancelled', 'Done'].includes(this.item.Status) && line.Status == 'New',
				},
			});
			await modal.present();
			const { data, role } = await modal.onWillDismiss();
			console.log(data);
			if (data) {
				let uom = item.UoMs.find((d) => d.Id == line.IDUoM);
				let price = uom.PriceList.find((d) => d.Type == 'SalePriceList');
				let UoMPrice = price.NewPrice ? price.NewPrice : price.Price;
				line.UoMPrice = UoMPrice;
				let oldSubOrder = line.SubOrders;
				line.SubOrders = [];
				line._item.Groups.forEach((subOrder) => {
					Object.keys(data).forEach((key) => {
						if (subOrder.Id == key) {
							Object.keys(data[key]).forEach((i) => {
								let bom = subOrder.Items.find((b) => b.IDUoM == i);
								if (bom) {
									let oldBOM = oldSubOrder.find((b) => b.IDUoM == i);
									if (oldBOM) {
										oldBOM.Quantity = data[key][i] * line.Quantity;
									} else
										oldSubOrder.push({
											Id: 0,
											IDItem: bom.IDItem,
											Quantity: data[key][i] * line.Quantity,
											IDUoM: bom.IDUoM,
											UoMPrice: bom.ExtraPrice ? bom.ExtraPrice * data[key][i] * line.Quantity : 0,
											_UoM: bom._UoM,
											_Item: bom._Item,
											Status: 'New',
											IDTax: item.IDSalesTaxDefinition,
											TaxRate: item.SaleVAT,
											Code: lib.generateUID(this.env.user.StaffID),
										});
									if (bom.ExtraPrice > 0) {
										line.UoMPrice += bom.ExtraPrice * data[key][i];
									}
								}
							});
						}
					});
				});
				const selected = [];
				Object.keys(data).forEach((gId) => {
					Object.keys(data[gId]).forEach((uId) => {
						selected.push({
							GroupId: +gId,
							IDUoM: +uId,
							Quantity: data[gId][uId],
						});
					});
				});
				const removed = oldSubOrder.filter((so) => !selected.some((s) => s.IDUoM === so.IDUoM));
				oldSubOrder = oldSubOrder.filter((so) => selected.some((s) => s.IDUoM === so.IDUoM));
				let deletedLines = this.formGroup.get('DeletedLines').value || [];

				removed.forEach((r) => {
					if (r.Id > 0) {
						deletedLines.push(r.Id);
					}
				});

				this.formGroup.get('DeletedLines').setValue(deletedLines);
				this.formGroup.get('DeletedLines').markAsDirty();
				line.SubOrders = oldSubOrder;
				if (markAsDirty) {
					this.setOrderValue({ OrderLines: [line] });
				}
				return line;
			} else return null;
		}
		return null;
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
		this._filteredItemsCache.clear(); // Clear cache when segment changes
	}

	trackByItemId(index: number, item: any): any {
		return item?.Id || index;
	}

	getFilteredItemsWithLimit(items: any[], groupId?: any): any[] {
		if (!items?.length) return [];
		
		// Create cache key based on group, keyword, and segment
		const cacheKey = `${groupId || 'all'}_${this.segmentView}_${this.query?.Keyword || ''}`;
		
		// Return cached result if available
		if (this._filteredItemsCache.has(cacheKey)) {
			return this._filteredItemsCache.get(cacheKey);
		}
		
		// Filter items
		const filtered = items.filter((i) => {
			if (!this.query?.Keyword || this.query.Keyword === '' || this.query.Keyword === 'all') {
				return true;
			}
			const keyword = this.query.Keyword.toLowerCase();
			const name = (i.Name || '').toLowerCase();
			const foreignName = (i.ForeignName || '').toLowerCase();
			const searchText = name + ' ' + foreignName;
			// Simple accent removal
			const normalizedText = searchText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
			const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
			return normalizedText.includes(normalizedKeyword);
		});

		// Limit to 50 items when searching (only when keyword exists)
		let result = filtered;
		if (this.query?.Keyword && this.query.Keyword !== '' && this.query.Keyword !== 'all' && filtered.length > 50) {
			result = filtered.slice(0, 50);
		}

		// Cache the result
		this._filteredItemsCache.set(cacheKey, result);
		
		return result;
	}

	search(ev) {
		var val = ev.target.value.toLowerCase();
		if (val == undefined) {
			val = '';
		}
		if (val.length > 2 || val == '') {
			this.query.Keyword = val;
			this._filteredItemsCache.clear(); // Clear cache when keyword changes
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
				onUpdateItem: (updated) => this.updateRefundPayment(updated.RefundAmount, updated.IDTransaction),
			},
		});
		await modal.present();
		// const { data, role } = await modal.onWillDismiss();
		// if (role == 'confirm') {
		// 	let changed: any = { OrderLines: [] };
		// 	if (data.SetShippedQuantity)
		// 		this.item.OrderLines.forEach((line) => {
		// 			if (line.Quantity > line.ShippedQuantity) {
		// 				line.ShippedQuantity = line.Quantity;
		// 				line.ReturnedQuantity = 0;
		// 				changed.OrderLines.push({
		// 					Id: line.Id,
		// 					Code: line.Code,
		// 					IDUoM: line.IDUoM,
		// 					ShippedQuantity: line.ShippedQuantity,
		// 					ReturnedQuantity: 0,
		// 				});
		// 			}
		// 		});

		// 	if (data.SetDone) {
		// 		changed.Status = 'Done';
		// 	}

		// 	this.setOrderValue(changed, true);
		// }
	}

	async goToPayment(amount = null, isRefund = false, idTransaction = null) {
		await this.setKitchenID('all');
		await this.setItemQuery('all');

		let payment = {
			IDBranch: this.item.IDBranch,
			IDStaff: this.env.user.StaffID,
			IDCustomer: this.item.IDContact,
			IDTable: this.idTable,
			IDSaleOrder: this.item.Id,
			DebtAmount: Math.round(this.item.Debt),
			IsActiveInputAmount: true,
			ReturnUrl: window.location.href,
			Timestamp: Date.now(),
			CreatedBy: this.env.user.Email,
			SaleOrder: this.item,
			IsRefundTransaction: isRefund,
			RefundAmount: amount ?? 0,
			IDOriginalTransaction: idTransaction,
		};
		const modal = await this.modalController.create({
			component: PaymentModalComponent,
			id: 'POSPaymentModalPage',
			canDismiss: true,
			backdropDismiss: true,
			cssClass: 'modal90vh',
			componentProps: {
				item: payment,
				paymentStatusList: this.posService.dataSource.paymentStatusList,
				canEditVoucher: this.item.Status != 'Done',
				ZPIsActive: this.posService.systemConfig.ZPIsActive,
				EDCCVCB_IsActive: this.posService.systemConfig.EDCCVCB_IsActive,
				billElement: this.billRef,
				calcFunction: this.recalculateOrder,
				onUpdateItem: (updated) => this.updateItemFromPayment(updated),
				cssStyle:
					`body{font-size:${this.posService.systemConfig.POSPrintingFontSize}px}` +
					`.bold{font-weight: bold}.bill,.sheet{color: #000;font-size: 1rem}.sheet table tr{page-break-inside: avoid}.bill{display: block;overflow: hidden !important}.bill .sheet{box-shadow: none !important}.bill .header,.bill .message,.text-center{text-align: center}.bill .header span{display: inline-block;width: 100%}.bill .header .logo img{max-width: 8.33rem;max-height: 4.17rem}.bill .header .brand,.bill .items .quantity{font-weight: 700}.bill .header .address{font-size: 80%;font-style: italic}.bill .table-info,.bill .table-info-top{border-top: solid;margin: 5px 0;padding: 5px 8px;border-width: 1px 0}.bill .items{margin: 5px 0;padding-left: 8px;padding-right: 8px}.bill .items tr td{border-bottom: 1px dashed #ccc;padding-bottom: 5px}.bill .items .name{font-size: 1rem;width: 100%;padding-top: 5px;padding-bottom: 2px !important;border: none !important}.bill .items tr.subOrder td{border-bottom: none !important}.bill .items tr.subOrder.isLast td{border-bottom: 1px dashed #ccc !important;padding-bottom: 5px}.bill .items tr:last-child td{border: none !important}.bill .items tr.subOrder.isLast:last-child td{border: none !important}.bill .items .total,.text-right{text-align: right}.bill .message{padding-left: 8px;padding-right: 8px}.page-footer-space{margin-top: 10px}.table-info-top td{padding-top: 5px}.sheet{margin: 0;overflow: hidden;position: relative;box-sizing: border-box;page-break-after: always;font-family: "Times New Roman", Times, serif;font-size: 0.72rem;background: #fff}.sheet .page-footer,.sheet .page-footer-space{height: 10mm}.sheet table{page-break-inside: auto;width: 100%;border-collapse: collapse}.sheet table tr{page-break-after: auto}`,
			},
		});
		await modal.present();
		// const { data} = await modal.onWillDismiss();
	}
	recalculateOrder() {
		// xử lý voucher ở đây
		// tính lại order
		// update bill DOM
		this.calcOrder();
		return this.billRef.nativeElement; // trả bill mới
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

	async updateItemFromPayment(updatedItem) {
		this.item = updatedItem;
		await this.loadedData();
		return this.item;
	}

	async updateRefundPayment(amount, idTransaction) {
		this.goToPayment(amount, true, idTransaction);
	}

	InvoiceRequired() {
		if (this.pageConfig.canEdit == false) {
			this.env.showMessage('The order is locked and cannot be edited', 'warning');
			return false;
		}
		this.processInvoice();
	}

	async processInvoice() {
		const modal = await this.modalController.create({
			component: POSInvoiceModalPage,
			canDismiss: true,
			cssClass: 'modal90vh',
			componentProps: {
				id: this.formGroup.controls.IDContact.value ?? this.posService.systemConfig.SODefaultBusinessPartner.Id,
				defaultBusinessPartnerId: this.posService.systemConfig.SODefaultBusinessPartner.Id,
				canAddEInvoiceInfo: this.pageConfig.canAddEInvoiceInfo,
				currentTaxInfoId: this.formGroup.controls.IDTaxInfo.value,
				onUpdateContact: (address) => this.changedIDAddress(address),
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();
		console.log('Dismiss : ', data);
		if (data !== undefined) {
			this.item.IsInvoiceRequired = true;
			this.formGroup.controls.IsInvoiceRequired.patchValue(true);
			this.formGroup.controls.IsInvoiceRequired.markAsDirty();
			this.formGroup.controls.IDTaxInfo.setValue(data.IDTaxInfo);
			this.formGroup.controls.IDTaxInfo.markAsDirty();
			this.formGroup.controls.TaxCode.setValue(data.TaxCode);
			this.formGroup.controls.TaxCode.markAsDirty();

			// this.changedIDAddress({ Id: data.Id, IDAddress: data.Address?.Id });
			this.saveChange();
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
			this.env
				.showPrompt('Bạn có muốn in đơn gửi bar/bếp ?', null, 'Thông báo')
				.then(() => this.sendKitchen())
				.catch(() => {});
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

	// Hàm hỏi user về items thất bại và trả về danh sách cuối cùng cần update
	async askUserAboutFailedItems(failedItems, successItems) {
		return new Promise(async (resolve, reject) => {
			// Build message
			let itemsDetails = failedItems
				.map((item) => {
					let successKitchens = item.SuccessKitchens.map((k) => {
						const kitchen = this.posService.dataSource.kitchens.find((kt) => kt.Id === k);
						const printerName = kitchen?._Printer?.Name || 'N/A';
						return `${kitchen?.Name || k} (${printerName})`;
					}).join(', ');

					let failedKitchens = item.Errors.map((err) => {
						const kitchen = this.posService.dataSource.kitchens.find((kt) => kt.Id === parseInt(err.kitchen));
						const printerName = kitchen?._Printer?.Name || 'N/A';
						return `${kitchen?.Name || err.kitchen} - ${printerName} (${err.error})`;
					}).join(', ');

					let msg = `<b>${item.ItemName}</b>`;
					if (successKitchens) msg += `<br>- Đã gửi: ${successKitchens}`;
					if (failedKitchens) msg += `<br>- Thất bại: ${failedKitchens}`;
					return msg;
				})
				.join('<br><br>');

			const hasPartialSuccess = failedItems.some((item) => item.SuccessKitchens.length > 0);

			this.env
				.showPrompt(
					{
						code: hasPartialSuccess ? 'POS_PARTIAL_PRINT_SUCCESS' : 'POS_ITEMS_PRINT_FAILED',
						value: itemsDetails,
					},
					null,
					'POS_PRINT_WARNING',
					'Chuyển sang Đang phục vụ',
					'Giữ nguyên (Không lưu)'
				)
				.then(() => {
					dog && console.log('✅ User agreed to move failed items to Serving');

					// User đồng ý → Tất cả items (success + failed) đều chuyển Serving
					const allItems = [...successItems, ...failedItems];
					const finalItems = allItems.map((item) => ({
						Code: item.Code,
						ShippedQuantity: item.Quantity,
						Status: 'Serving',
					}));

					resolve(finalItems);
				})
				.catch(() => {
					dog && console.log('❌ User cancelled - only update success items');

					// User không đồng ý → Chỉ update items thành công
					const finalItems = successItems.map((item) => ({
						Code: item.Code,
						ShippedQuantity: item.Quantity,
						Status: 'Serving',
					}));

					resolve(finalItems);
				});
		});
	}

	// Hàm save kết quả print - CHỈ GỌI 1 LẦN DUY NHẤT
	async savePrintResults(itemsToUpdate) {
		return new Promise(async (resolve, reject) => {
			if (itemsToUpdate.length === 0) {
				dog && console.log('⚠️ No items to update');
				resolve(true);
				return;
			}

			dog && console.log('💾 Saving print results:', itemsToUpdate);
			let postItem: any = {
				OrderLines: itemsToUpdate,
			};
			if (this.item.Status == 'New') postItem.Status = 'Scheduled';

			// Reset submitAttempt to ensure save can proceed (may be stuck from previous operation)
			if (this.submitAttempt) {
				dog && console.warn('⚠️ submitAttempt was true, resetting before save');
				this.submitAttempt = false;
			}

			// Retry logic if submitAttempt error occurs
			const saveWithRetry = async (retryCount = 0): Promise<any> => {
				try {
					await this.setOrderValue(postItem, true, false);
					dog && console.log('✅ Print results saved successfully');
					dog && console.log(this.item.OrderLines, postItem);
					return true;
				} catch (err) {
					if (err === 'submitAttempt' && retryCount < 2) {
						dog && console.warn(`⚠️ submitAttempt error, retrying... (${retryCount + 1}/2)`);
						this.submitAttempt = false;
						await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms before retry
						return saveWithRetry(retryCount + 1);
					}
					throw err;
				}
			};

			saveWithRetry()
				.then(() => {
					resolve(true);
				})
				.catch((err) => {
					dog && console.error('❌ Failed to save print results:', err);
					reject(err);
				});
		});
	}

	async sendKitchen() {
		return new Promise(async (resolve, reject) => {
			// Update printData with current date
			this.printData.printDate = new Date();
			this.printData.undeliveredItems = [];

			this.item.OrderLines.forEach((e) => {
				e._undeliveredQuantity = e.Quantity - e.ShippedQuantity;
				if (e.Remark) {
					e.Remark = e.Remark.toString();
				}
				if (e._undeliveredQuantity > 0) {
					this.printData.undeliveredItems.push(e);
				}
			});

			if (this.printData.undeliveredItems.length == 0) {
				if (this.posService.systemConfig.IsAutoSave) this.env.showMessage('No new product needs to be sent!', 'success');
				resolve(true);
				return;
			}
			if (this.sendKitchenAttempt) {
				this.env.showMessage('Printers were busy, please try again!', 'warning');
				resolve(false);
				return;
			}
			this.sendKitchenAttempt = true;
			let printItems = this.printData.undeliveredItems;

			// Validate items before processing
			let itemsWithoutMenu = printItems.filter((i) => !i._item);
			let itemsWithoutKitchen = printItems.filter((i) => i._item && (!i._IDKitchens || i._IDKitchens.length === 0));

			// Show error for items without menu
			if (itemsWithoutMenu.length > 0) {
				this.sendKitchenAttempt = false;
				let itemIds = itemsWithoutMenu.map((i) => i.IDItem + ';').join('<br>');
				this.env.showAlert(
					{
						code: 'POS_ITEM_NOT_IN_MENU',
						value: itemIds,
					},
					null,
					'POS_PRINT_ERROR'
				);
				dog && console.error('❌ Items not found in menu:', itemsWithoutMenu);
				resolve(false);
				return;
			}

			// Show error for items without kitchen
			if (itemsWithoutKitchen.length > 0) {
				this.sendKitchenAttempt = false;
				let itemNames = itemsWithoutKitchen.map((i) => i._item?.Name + ';').join('<br>');
				this.env.showAlert(
					{
						code: 'POS_ITEM_NO_KITCHEN_ASSIGNMENT',
						value: itemNames,
					},
					null,
					'POS_PRINT_ERROR'
				);
				dog && console.error('❌ Items without kitchen assignment:', itemsWithoutKitchen);
				resolve(false);
				return;
			}

			// Lấy tất cả ID của kitchen từ nhiều dạng khác nhau
			let newKitchenIDList = [
				...new Set(
					printItems.reduce((acc, g) => {
						dog && console.log('🔍 Processing item IDKitchens:', g._IDKitchens, 'Type:', typeof g._IDKitchens, 'IsArray:', Array.isArray(g._IDKitchens));

						if (!g._IDKitchens || (Array.isArray(g._IDKitchens) && g._IDKitchens.length === 0)) {
							dog && console.warn('⚠️ Item has no _IDKitchens:', g._item?.Name);
							return acc;
						}

						if (Array.isArray(g._IDKitchens)) {
							dog && console.log('✅ Adding array:', g._IDKitchens);
							return acc.concat(g._IDKitchens); // nếu là array
						}
						dog && console.log('✅ Adding single value:', g._IDKitchens);
						return acc.concat([g._IDKitchens]); // nếu là số
					}, [])
				),
			];

			const newKitchenList = this.posService.dataSource.kitchens.filter((d) => newKitchenIDList.includes(d.Id));

			let itemNotPrint = [];
			let printJobs: printData[] = [];
			// Store original printItems snapshot for each kitchen
			const printItemsSnapshot = [...printItems];
			// Track items that have kitchens without printer
			const noPrinterKitchenResults = [];

			try {
				for (let kitchen of newKitchenList.filter((d) => d.Id)) {
					dog && console.log('🔄 Processing kitchen:', kitchen.Name, 'ID:', kitchen.Id);
					await this.setKitchenID(kitchen.Id);
					if (!kitchen._Printer) {
						dog && console.warn('⚠️ Kitchen has no printer:', kitchen.Name);
						// Track all items for this kitchen (not just single-kitchen items)
						let noPrinterItems = printItemsSnapshot.filter((d) => d._IDKitchens.includes(kitchen.Id));

						// Add to results for tracking
						noPrinterKitchenResults.push({
							isSuccess: false,
							items: noPrinterItems,
							idKitchen: kitchen.Id.toString(),
							error: 'Kitchen has no printer',
							kitchenName: kitchen.Name,
						});

						// Only add to itemNotPrint if this is the ONLY kitchen for the item
						let singleKitchenItems = noPrinterItems
							.filter((d) => d._IDKitchens.length == 1)
							.map((e) => ({
								Id: e.Id,
								Code: e.Code,
								ShippedQuantity: e.Quantity,
								IDUoM: e.IDUoM,
								Status: e.Status,
								ItemName: e._item.Name,
								Error: `${kitchen.Name} - N/A (Kitchen has no printer)`,
							}));
						itemNotPrint.push(...singleKitchenItems);
						continue;
					}
					if (kitchen.IsPrintList) {
						dog && console.log('📋 Creating print list job for kitchen:', kitchen.Name);
						let jobName = `${kitchen.Id}_${this.item?.Id} | ${new Date().toISOString()}`;
						let data = this.printPrepare('bill', [kitchen._Printer], jobName);
						if (data) {
							printJobs.push(data);
							dog && console.log('✅ Added print list job:', jobName);
						}
					}
					if (kitchen.IsPrintOneByOne) {
						dog && console.log('📄 Creating individual print jobs for kitchen:', kitchen.Name);
						for (let i of printItemsSnapshot.filter((d) => d._IDKitchens.includes(kitchen.Id))) {
							await this.setItemQuery(i.IDItem);
							let idJob = `${kitchen.Id}_${this.item?.Id}_${i.Code} | ${new Date().toISOString()}`;
							let data = this.printPrepare('bill-item-each-' + i.Id, [kitchen._Printer], idJob);
							if (data) {
								printJobs.push(data);
								dog && console.log('✅ Added individual print job:', idJob);
							}
						}
					}
				}

				dog && console.log('🖨️ Total print jobs created:', printJobs.length);
				dog && console.log('⚠️ Items without printer:', itemNotPrint.length);
				let doneCount = 0;
				const checkItemNotPrint = () => {
					if (itemNotPrint.length == 0) {
						this.submitAttempt = false;
						resolve(true);
						return;
					}

					// Tạo message với tên món và lỗi
					let itemsWithErrors = itemNotPrint
						.map((i) => {
							let msg = i.ItemName;
							if (i.Error) {
								msg += ` (${i.Error})`;
							}
							return msg;
						})
						.join('<br>');

					this.env
						.showPrompt({ code: 'POS_ITEMS_PRINT_FAILED', value: itemsWithErrors }, '', 'POS_PRINT_ERROR', 'Ok', "Don't send")
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
							this.setOrderValue({ OrderLines: saveList }, false, true)
								.then(() => resolve(true))
								.catch((err) => reject(err));
						});
				};

				if (printJobs.length > 0) {
					dog && console.log('🚀 Starting to execute print jobs...');
					// Collect all lines to update after printing
					const allSuccessLines = [];

					// Track print status for each item by ID
					const itemPrintStatus = new Map(); // Key: item.Id, Value: { successKitchens: [], failedKitchens: [] }

					// Execute all print jobs and collect results
					// Merge noPrinterKitchenResults with actual print results
					const printResults = await Promise.all(
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

								// Collect items based on print result - use snapshot
								if (idKitchen && !code) {
									// Print list for kitchen - chỉ lấy items CÓ kitchen này
									const kitchenItems = printItemsSnapshot.filter((d) => d._IDKitchens.includes(parseInt(idKitchen)));
									dog && console.log(`📦 Items for kitchen ${idKitchen}:`, kitchenItems.length, 'items');
									return { isSuccess, items: kitchenItems, idKitchen };
								} else {
									// Print one by one
									const item = printItemsSnapshot.find((d) => d._IDKitchens.includes(parseInt(idKitchen)) && d.Code == code);
									return { isSuccess, items: item ? [item] : [], idKitchen, code };
								}
							} catch (error) {
								dog && console.error('Print job failed:', error);
								const [idsPart] = job.options[0].jobName.split('|').map((s: string) => s.trim());
								const [idKitchen, IDSO, code] = idsPart.split('_');

								// Get items that failed - use snapshot
								let failedItems = [];
								if (idKitchen && !code) {
									failedItems = printItemsSnapshot.filter((d) => d._IDKitchens.includes(parseInt(idKitchen)));
								} else {
									const item = printItemsSnapshot.find((d) => d._IDKitchens.includes(parseInt(idKitchen)) && d.Code == code);
									if (item) failedItems = [item];
								}

								return { isSuccess: false, items: failedItems, error: error?.message || error, idKitchen, code };
							}
						})
					);

					// Merge with noPrinterKitchenResults
					const results = [...printResults, ...noPrinterKitchenResults];
					dog && console.log('📊 Total results (print + no-printer):', printResults.length, '+', noPrinterKitchenResults.length, '=', results.length);

					// Process results and track print status for each item
					results.forEach(({ isSuccess, items, idKitchen, code, error }) => {
						dog && console.log(`🔄 Processing result for kitchen ${idKitchen}:`, isSuccess ? '✅ SUCCESS' : '❌ FAILED', '- Items:', items.length);
						if (error) {
							dog && console.error(`  ❌ Error:`, error);
						}

						items.forEach((e) => {
							// Initialize tracking for this item if not exists
							if (!itemPrintStatus.has(e.Id)) {
								itemPrintStatus.set(e.Id, {
									item: e,
									totalKitchens: e._IDKitchens.length,
									successKitchens: [],
									failedKitchens: [],
									errors: [],
								});
							}

							const status = itemPrintStatus.get(e.Id);

							// Track which kitchen succeeded/failed
							if (isSuccess) {
								status.successKitchens.push(parseInt(idKitchen));
								dog && console.log(`  ✅ Item ${e._item?.Name} printed successfully at kitchen ${idKitchen}`);
							} else {
								status.failedKitchens.push(parseInt(idKitchen));
								status.errors.push({ kitchen: idKitchen, error: error });
								dog && console.log(`  ❌ Item ${e._item?.Name} failed to print at kitchen ${idKitchen} - Error: ${error}`);
							}
						});
					});

					// Now process each item based on complete print status
					const fullSuccessItems = []; // Món in thành công 100%
					const partialSuccessItems = []; // Món in thành công 1 phần
					const fullFailedItems = []; // Món in thất bại 100%

					itemPrintStatus.forEach((status, itemId) => {
						const e = status.item;
						dog && console.log(`📊 Final status for ${e._item?.Name}: ${status.successKitchens.length}/${status.totalKitchens} kitchens success`);

						const itemInfo = {
							Id: e.Id,
							Code: e.Code,
							Quantity: e.Quantity,
							IDUoM: e.IDUoM,
							ItemName: e._item?.Name,
							SuccessKitchens: status.successKitchens,
							FailedKitchens: status.failedKitchens,
							Errors: status.errors,
							TotalKitchens: status.totalKitchens,
						};

						if (new Set(status.successKitchens).size === status.totalKitchens) {
							// TẤT CẢ kitchen in thành công
							fullSuccessItems.push(itemInfo);
							dog && console.log(`  ✅✅ ${e._item?.Name} - ALL kitchens printed successfully`);
						} else if (status.successKitchens.length > 0) {
							// Có ít nhất 1 kitchen in thành công
							partialSuccessItems.push(itemInfo);
							dog && console.log(`  ⚠️ ${e._item?.Name} - Partial success (${status.successKitchens.length}/${status.totalKitchens})`);
						} else {
							// Tất cả kitchen đều in thất bại
							fullFailedItems.push(itemInfo);
							dog && console.log(`  ❌❌ ${e._item?.Name} - All kitchens failed`);
						}
					});

					// Reset flag after processing
					this.sendKitchenAttempt = false;

					// KHÔNG LÀM GÌ CẢ - Chỉ hỏi user về items thất bại
					dog && console.log('📊 Print summary:');
					dog && console.log('  ✅ Full success:', fullSuccessItems.length);
					dog && console.log('  ⚠️ Partial success:', partialSuccessItems.length);
					dog && console.log('  ❌ Full failed:', fullFailedItems.length);

					// Hỏi user về items thất bại (partial + full failed)
					const itemsNeedUserDecision = [...partialSuccessItems, ...fullFailedItems];

					if (itemsNeedUserDecision.length > 0) {
						dog && console.log('⚠️ Asking user about failed items...');
						this.askUserAboutFailedItems(itemsNeedUserDecision, fullSuccessItems)
							.then((finalItemsToUpdate: any[]) => {
								// User đã quyết định → Save 1 lần duy nhất
								dog && console.log('💾 Saving all items at once:', finalItemsToUpdate.length, 'items');
								this.savePrintResults(finalItemsToUpdate)
									.then(() => {
										this.env.showMessage('Sent to kitchen successfully!', 'success');
										resolve(true);
									})
									.catch((err) => reject(err));
							})
							.catch(() => {
								// User cancel
								reject(false);
							});
					} else {
						// Tất cả thành công → Save luôn
						dog && console.log('✅ All items printed successfully! Saving...');
						const finalItemsToUpdate = fullSuccessItems.map((item) => ({
							Code: item.Code,
							ShippedQuantity: item.Quantity,
							Status: 'Serving',
						}));

						this.savePrintResults(finalItemsToUpdate)
							.then(() => {
								this.env.showMessage('Sent to kitchen successfully!', 'success');
								resolve(true);
							})
							.catch((err) => reject(err));
					}
				} else {
					dog && console.log('⚠️ No print jobs to execute');
					this.sendKitchenAttempt = false;
					checkItemNotPrint();
				}
			} catch (e) {
				dog && console.error('❌ Print error:', e);
				this.sendKitchenAttempt = false;
				this.env.showMessage('Print error occurred!', 'danger');
				reject(e);
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
				cssStyle:
					`body{font-size:${this.posService.systemConfig.POSPrintingFontSize}px}` +
					`.bold{font-weight: bold}.bill,.sheet{color: #000;font-size: 1rem}.sheet table tr{page-break-inside: avoid}.bill{display: block;overflow: hidden !important}.bill .sheet{box-shadow: none !important}.bill .header,.bill .message,.text-center{text-align: center}.bill .header span{display: inline-block;width: 100%}.bill .header .logo img{max-width: 8.33rem;max-height: 4.17rem}.bill .header .brand,.bill .items .quantity{font-weight: 700}.bill .header .address{font-size: 80%;font-style: italic}.bill .table-info,.bill .table-info-top{border-top: solid;margin: 5px 0;padding: 5px 8px;border-width: 1px 0}.bill .items{margin: 5px 0;padding-left: 8px;padding-right: 8px}.bill .items tr td{border-bottom: 1px dashed #ccc;padding-bottom: 5px}.bill .items .name{font-size: 1rem;width: 100%;padding-top: 5px;padding-bottom: 2px !important;border: none !important}.bill .items tr.subOrder td{border-bottom: none !important}.bill .items tr.subOrder.isLast td{border-bottom: 1px dashed #ccc !important;padding-bottom: 5px}.bill .items tr:last-child td{border: none !important}.bill .items tr.subOrder.isLast:last-child td{border: none !important}.bill .items .total,.text-right{text-align: right}.bill .message{padding-left: 8px;padding-right: 8px}.page-footer-space{margin-top: 10px}.table-info-top td{padding-top: 5px}.sheet{margin: 0;overflow: hidden;position: relative;box-sizing: border-box;page-break-after: always;font-family: "Times New Roman", Times, serif;font-size: 0.72rem;background: #fff}.sheet .page-footer,.sheet .page-footer-space{height: 10mm}.sheet table{page-break-inside: auto;width: 100%;border-collapse: collapse}.sheet table tr{page-break-after: auto}`,
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
			this.printData.printDate = new Date();

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
				this.env.showMessage('POS_NO_BILL_PRINTER_MESSAGE', 'warning', null, null, true);
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

				try {
					const printResults = await this.printingService.print([printing]);

					// Check print results for errors
					if (printResults && printResults.length > 0) {
						const failedResults = printResults.filter((r) => r.status === 'error');
						if (failedResults.length > 0) {
							const errorMessages = failedResults
								.map((r) => {
									const printerName = r.printer || printerInfo.Name || printerInfo.Code || 'N/A';
									const errorMsg = r.error || 'Unknown error';
									return `${printerName}: ${errorMsg}`;
								})
								.join('<br>');

							this.env.showAlert(
								{
									code: 'POS_RECEIPT_ERROR_MESSAGE',
									value: errorMessages,
								},
								null,
								'POS_PRINT_ERROR_HEADER'
							);
						}
					}

					this.checkData(receipt, !receipt, sendEachItem);
					resolve(true);
				} catch (error) {
					dog && console.error('Print error in sendPrint:', error);
					const printerName = printerInfo.Name || printerInfo.Code || 'N/A';
					this.env.showAlert(
						{
							code: 'POS_RECEIPT_ERROR_DETAIL',
							printerName: printerName,
							error: error.message || error,
						},
						null,
						'POS_PRINT_ERROR_HEADER'
					);
					this.submitAttempt = false;
					reject(error);
				}
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
				this.item.Status = 'TemporaryBill';
				this.formGroup.controls.Status.setValue('TemporaryBill');
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
		this.printData.printDate = new Date();

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
		this.item.VATSummary = [];
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
			// line.AdditionsAmount = line.CalcOriginalTotalAdditions;
			this.item.AdditionsAmount += line.AdditionsAmount;
			this.item.AdditionsTax += line.CalcOriginalTotalAdditions - line.AdditionsAmount;
			this.item.CalcOriginalTotalAdditions += line.CalcOriginalTotalAdditions;

			line.CalcTotalOriginal = line.OriginalTotalAfterTax + line.CalcOriginalTotalAdditions;
			this.item.CalcTotalOriginal += line.CalcTotalOriginal;
			line.OriginalDiscountFromSalesman = parseFloat(line.OriginalDiscountFromSalesman) || 0;
			line._OriginalTotalAfterDiscountFromSalesman = line.CalcTotalOriginal - line.OriginalDiscountFromSalesman;

			this.item.OriginalDiscountFromSalesman += line.OriginalDiscountFromSalesman;
			const rate = line.TaxRate;
			this.item.VATSummary = this.item.VATSummary || [];
			let vatItem = this.item.VATSummary.find((x) => x.Rate === rate);

			if (!vatItem) {
				vatItem = {
					Rate: rate,
					Tax: 0,
					AdditionsTax: 0,
				};
				this.item.VATSummary.push(vatItem);
			}
			vatItem.Tax += line.OriginalTax;
			vatItem.AdditionsTax += line.CalcOriginalTotalAdditions - line.AdditionsAmount;
			//Lấy hình & hiển thị thông tin số lượng đặt hàng lên menu
			let foundItem = false;
			for (let m of this.posService.dataSource.menuList)
				for (let mi of m.Items) {
					if (mi.Id == line.IDItem) {
						foundItem = true;
						mi.BookedQuantity = this.item.OrderLines.filter((x) => x.IDItem == line.IDItem)
							.map((x) => x.Quantity)
							.reduce((a, b) => +a + +b, 0);
						line._item = mi;
						line._IDKitchens = mi.IDKitchens ? [].concat(JSON.parse(mi.IDKitchens)) : [];
					}
				}

			if (!foundItem) {
				dog && console.warn('⚠️ Item NOT found in menuList! IDItem:', line.IDItem, 'Status:', line.Status);
			}

			line._background = {
				'background-image':
					'url("' +
					environment.posImagesServer +
					(line._item && line._item.Image ? line._item.Image : 'assets/pos-icons/POS-Item-demo.png') +
					'"), url("' +
					environment.posImagesServer +
					'assets/pos-icons/POS-Item-demo.png' +
					'")',
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
			// IDOrder: [line.IDOrder],
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
			SubOrders: [line?.SubOrders || []],
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
						idx = this.item[c].findIndex((d) => d.Code == line.Code);
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
						// Update this.item.OrderLines directly to keep status and other values in sync
						if (idx >= 0 && idx < this.item.OrderLines.length) {
							Object.assign(this.item.OrderLines[idx], line);
						}
					}

					// let numberOfGuests = this.formGroup.get('NumberOfGuests');
					// numberOfGuests.setValue(this.item.OrderLines?.map((x) => x.Quantity).reduce((a, b) => +a + +b, 0));
					// numberOfGuests.markAsDirty();

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
				// Update this.item directly for fields like Status to keep UI in sync
				if (c === 'Status' && data[c]) {
					this.item.Status = data[c];
					// Update _Locked and other status-dependent properties (but don't disable form yet to allow save)
					this.item._Locked = this.noLockStatusList.indexOf(this.item.Status) == -1;
					this.pageConfig.canEdit = !this.item._Locked;
					// Form disable/enable will be handled after save in savedChange() or loadOrder()
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
		if (this.item.Id < 1) {
			this.id = savedItem.Id;
			let newURL = '#pos-order/' + savedItem.Id + '/' + this.idTable;
			history.pushState({}, null, newURL);
			this.formGroup.controls.Id.setValue(savedItem.Id);
			this.item = savedItem;
			this.loadedData();
			return;
		} else {
			this.updateLineIDs(savedItem);
			// Update form disable/enable state based on status after save
			this.item._Locked = this.noLockStatusList.indexOf(this.item.Status) == -1;
			if (this.item._Locked) {
				this.pageConfig.canEdit = false;
				this.formGroup?.disable();
			} else {
				this.pageConfig.canEdit = true;
				this.formGroup?.enable();
			}
		}
		this.submitAttempt = false;
		this.env.showMessage('Saving completed!', 'success');
	}

	private updateLineIDs(savedItem: any) {
		if (savedItem) {
			//Update lines
			for (let savedLine of savedItem) {
				let idx = this.item.OrderLines.findIndex((d) => d.Code == savedLine.Code);
				if (idx == -1) continue;

				const line = this.item.OrderLines[idx];
				const formLine = this.formGroup.controls.OrderLines['controls'][idx];

				if (line.Id < 1 && savedLine.Id > 0) {
					line.Id = savedLine.Id;
					formLine.controls['Id'].setValue(savedLine.Id);
				}

				// if (line.SubOrders && savedLine.SubOrders) {
				// 	for (let beSub of savedLine.SubOrders) {
				// 		const idxSub = line.SubOrders.findIndex((x) => x.Code === beSub.Code);
				// 		if (idxSub === -1) continue;

				// 		const feSub = line.SubOrders[idxSub];

				// 		if (feSub.Id < 1 && beSub.Id > 0) {
				// 			feSub.Id = beSub.Id;

				// 			// Nếu có FormArray cho SubOrders → update luôn
				// 			const subOrders = [...formLine.controls.SubOrders.value]; // clone array

				// 			subOrders[idxSub] = {
				// 				...subOrders[idxSub],
				// 				Id: beSub.Id,
				// 			};
				// 			formLine.controls.SubOrders.setValue(subOrders);
				// 		}
				// 	}
				// }
			}
			this.formGroup.markAsPristine();
		}
	}

	changeTable() {
		this.saveSO();
	}

	async addContact() {
		const modal = await this.modalController.create({
			component: POSContactModalPage,
			cssClass: 'modal90vh',
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
			if (!this._contactDataSource.selected.some((s) => s.Id == address.Id)) {
				this._contactDataSource.selected.push(address);
			}
			this._contactDataSource.selected = [...this._contactDataSource.selected];
			this._contactDataSource.initSearch();
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

	getSelectedTaxInfo() {
		if (!this.item?.IDTaxInfo || !this.item?._Customer?.TaxAddresses) {
			return null;
		}
		return this.item._Customer.TaxAddresses.find((tax) => tax.Id === this.item.IDTaxInfo) || null;
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

					if (this.posService.systemConfig.POSSettleAtCheckout && Math.abs(this.item.Debt) < 10 && this.item.Status != 'Done' && this.paymentSuccessTriggered) {
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
		this.paymentSuccessTriggered = false; // reset flag
	}

	deleteVoucher(p) {
		this.promotionService
			.deleteVoucher(this.item, [p.VoucherCode])
			.then(() => {
				this.refresh();
			})
			.catch((err) => {
				this.env.showErrorMessage(err);
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

	groupedOrderLines = [];
	private _lastGroupedKey: string = null;
	isCompleteLoaded = false;
	// Group and sum identical OrderLines (same IDItem + IDUoM) to make bill printing more concise
	// Only applies to TemporaryBill and Done to avoid affecting other printing purposes
	getGroupedOrderLinesForPrint() {
		if (!this.isCompleteLoaded) return;
		if (!this.item?.OrderLines?.length) return [];

		// For non-bill printing keep original list
		if (this.item.Status !== 'TemporaryBill' && this.item.Status !== 'Done') {
			return this.item.OrderLines;
		}

		// Build a lightweight key to detect meaningful changes (status + line code/qty/price)
		const key =
			this.item.Status + '|' + (this.item.OrderLines || []).map((l) => `${l.Code || l.Id || l.IDItem}_${l.Quantity || 0}_${Math.round((l.UoMPrice || 0) * 100)}`).join('|');

		if (this._lastGroupedKey === key && this.groupedOrderLines && this.groupedOrderLines.length) {
			return this.groupedOrderLines;
		}

		this._lastGroupedKey = key;
		const groupedMap = new Map<string, any>();

		for (const line of this.item.OrderLines) {
			const mapKey = `${line.IDItem}_${line.IDUoM}`;

			if (groupedMap.has(mapKey)) {
				const existing = groupedMap.get(mapKey);
				existing.Quantity += line.Quantity || 0;
				existing.OriginalTotalDiscount += line.OriginalTotalDiscount || 0;
				existing.OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount || 0;
				existing.OriginalTotalAfterDiscount += line.OriginalTotalAfterDiscount || 0;
				existing.OriginalTax += line.OriginalTax || 0;

				if (existing.Quantity > 0) {
					existing.UoMPrice = existing.OriginalTotalBeforeDiscount / existing.Quantity;
				}

				if (line.SubOrders && line.SubOrders.length) {
					existing.SubOrders = existing.SubOrders || [];
					for (const sub of line.SubOrders) {
						const subKey = `${sub.IDItem}_${sub.IDUoM}`;
						const existingSub = existing.SubOrders.find((s) => `${s.IDItem}_${s.IDUoM}` === subKey);
						if (existingSub) {
							existingSub.Quantity += sub.Quantity || 0;
							if (existingSub.Quantity > 0 && sub.UoMPrice) {
								const oldTotal = (existingSub._origQuantity || 0) * (existingSub.UoMPrice || 0);
								const newTotal = (sub.Quantity || 0) * sub.UoMPrice;
								existingSub.UoMPrice = (oldTotal + newTotal) / existingSub.Quantity;
							}
							existingSub._origQuantity = existingSub.Quantity;
						} else {
							existing.SubOrders.push({ ...sub, _origQuantity: sub.Quantity || 0 });
						}
					}
				}
			} else {
				groupedMap.set(mapKey, { ...line, SubOrders: line.SubOrders ? [...line.SubOrders] : [] });
			}
		}

		this.groupedOrderLines = Array.from(groupedMap.values());
		return this.groupedOrderLines;
	}
}
