import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import {
	CRM_ContactProvider,
	HRM_StaffProvider,
	POS_MenuProvider,
	POS_TableGroupProvider,
	POS_TableProvider,
	POS_TerminalProvider,
	PR_ProgramProvider,
	SALE_OrderDeductionProvider,
	SALE_OrderProvider,
	SYS_ConfigProvider,
	SYS_PrinterProvider,
} from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';

import { POSMemoModalPage } from '../pos-memo-modal/pos-memo-modal.page';
import { environment } from 'src/environments/environment';
import { POSVoucherModalPage } from '../pos-voucher-modal/pos-voucher-modal.page';
import { POSContactModalPage } from '../pos-contact-modal/pos-contact-modal.page';
import { POSInvoiceModalPage } from '../pos-invoice-modal/pos-invoice-modal.page';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import QRCode from 'qrcode';
import { printData, PrintingService } from 'src/app/services/printing.service';
import { BarcodeScannerService } from 'src/app/services/barcode-scanner.service';
import { POSService } from '../pos-service';
import { PromotionService } from 'src/app/services/promotion.service';

@Component({
	selector: 'app-pos-order-detail',
	templateUrl: './pos-order-detail.page.html',
	styleUrls: ['./pos-order-detail.page.scss'],
	standalone: false,
})
export class POSOrderDetailPage extends PageBase {
	@ViewChild('numberOfGuestsInput') numberOfGuestsInput: ElementRef;
	isOpenMemoModal = false;
	AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
	noImage = environment.posImagesServer + 'assets/pos-icons/POS-Item-demo.png'; //No image for menu item
	segmentView = 'all';
	idTable: any; //Default table
	tableList = [];
	menuList = [];
	dealList = [];
	paymentList = [];
	paymentTypeList = [];
	paymentStatusList = [];
	printerList = [];
	soStatusList = []; //Show on bill
	soDetailStatusList = [];
	noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered','TemporaryBill'];
	noLockLineStatusList = ['New', 'Waiting'];
	checkDoneLineStatusList = ['Done', 'Canceled', 'Returned'];
	kitchenQuery = 'all';
	kitchenList = [];
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
		public deductionProvider: SALE_OrderDeductionProvider,
		public menuProvider: POS_MenuProvider,
		public tableGroupProvider: POS_TableGroupProvider,
		public tableProvider: POS_TableProvider,
		public contactProvider: CRM_ContactProvider,
		public staffProvider: HRM_StaffProvider,
		public sysConfigProvider: SYS_ConfigProvider,
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
		this.pageConfig.isDetailPage = true;
		this.pageConfig.isShowFeature = true;
		this.pageConfig.ShowDelete = false;
		this.pageConfig.ShowArchive = false;
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

			// ExpectedDeliveryDate
			// PaymentMethod
			// ProductDimensions
			// ProductWeight
			// TaxRate

			// TotalBeforeDiscount
			// Promotion
			// Discount1
			// Discount2
			// DiscountByItem
			// DiscountByGroup
			// DiscountByOrder
			// DiscountByLine
			// TotalDiscount
			// TotalAfterDiscount
			// Tax
			// TotalAfterTax
			// DiscountFromSalesman

			// OriginalTotalBeforeDiscount
			// OriginalPromotion
			// OriginalDiscount1
			// OriginalDiscount2
			// OriginalDiscountByItem
			// OriginalDiscountByGroup
			// OriginalDiscountByOrder
			// OriginalDiscountByLine
			// OriginalTotalDiscount
			// OriginalTax
			// OriginalTotalAfterTax
			// OriginalTotalAfterDiscount
			// OriginalDiscountFromSalesman
		});

		console.log('PR List: ', this.promotionService.promotionList);
	}

	////EVENTS
	ngOnInit() {
		this.pageConfig.subscribePOSOrderDetail = this.env.getEvents().subscribe((data) => {
			switch (data.code) {
				case 'app:POSOrderPaymentUpdate':
					this.notifyPayment(data);
					break;
				case 'app:POSOrderFromCustomer':
					this.notifyOrder(data);
					break;
				case 'app:POSLockOrderFromStaff':
					this.notifyLockOrder(data);
					break;
				case 'app:POSLockOrderFromCustomer':
					this.notifyLockOrder(data);
					break;
				case 'app:POSUnlockOrderFromStaff':
					this.notifyUnlockOrder(data);
					break;
				case 'app:POSUnlockOrderFromCustomer':
					this.notifyUnlockOrder(data);
					break;
				case 'app:POSSupport':
					this.notifySupport(data);
					break;
				case 'app:POSCallToPay':
					this.notifyCallToPay(data);
					break;
				case 'app:notifySplittedOrderFromStaff':
					this.notifySplittedOrderFromStaff(data);
					break;
				case 'app:POSOrderMergedFromStaff':
					this.notifyMergedOrderFromStaff(data);
					break;
				case 'app:networkStatusChange':
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
	private notifyPayment(data) {
		const value = JSON.parse(data.value);
		if (value.IDSaleOrder == this.item?.Id) {
			this.refresh();
		} else {
			this.getStorageNotifications();
		}
	}
	private async notifyOrder(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' Gọi món';
			this.env.showMessage(message, 'warning');
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Order',
				Name: 'Đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			await this.setNotifications(notification, true);
			// this.refresh();
		}
		if (data.id == this.item?.Id) {
			//this.CheckPOSNewOrderLines();
			this.refresh();
		}
	}
	private notifyLockOrder(data) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(this.idTable);
		if (index != -1) {
			this.env.showMessage('Đơn hàng đã được tạm khóa. Để tiếp tục đơn hàng, xin bấm nút Hủy tạm tính.', 'warning');
			this.refresh();
		} else {
			this.getStorageNotifications();
		}
	}
	private notifyUnlockOrder(data) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(this.idTable);
		if (index != -1) {
			this.env.showMessage('Đơn hàng đã mở khóa. Xin vui lòng tiếp tục đơn hàng.', 'warning');
			this.refresh();
		} else {
			this.getStorageNotifications();
		}
	}

	private notifySupport(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu phục vụ';
			this.env.showMessage('Khách bàn {{value}} yêu cầu phục vụ', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
			let notification = {
				Id: value.Id,
				IDBranch: value.IDBranch,
				IDSaleOrder: value.IDSaleOrder,
				Type: 'Support',
				Name: 'Yêu cầu phục vụ',
				Code: 'pos-order',
				Message: message,
				Url: url,
				Watched: false,
			};

			this.setNotifications(notification, true);
		}
	}

	private notifyCallToPay(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu tính tiền';
			this.env.showMessage('Khách bàn {{value}} yêu cầu tính tiền', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			let notification = {
				Id: value.Id,
				IDBranch: value.IDBranch,
				IDSaleOrder: value.IDSaleOrder,
				Type: 'Support',
				Name: 'Yêu cầu tính tiền',
				Code: 'pos-order',
				Message: message,
				Url: url,
				Watched: false,
			};

			this.setNotifications(notification, true);
		}
	}

	private notifySplittedOrderFromStaff(data) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(this.idTable);
		if (index != -1) {
			this.env.showMessage('Đơn hàng đã được chia.', 'warning');
			this.refresh();
		} else {
			this.getStorageNotifications();
		}
	}

	private notifyMergedOrderFromStaff(data) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(this.idTable);

		if (index != -1) {
			this.env.showMessage('Đơn hàng đã được gộp.', 'warning');
			this.refresh();
		} else {
			this.getStorageNotifications();
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
							this.env.showMessage('Thông tin đơn hàng đã được thay đổi, đơn sẽ được cập nhật lại.', 'danger');
							this.refresh();
						}
					})
					.catch((err) => {
						console.log(err);
					});
			}
		}
	}

	preLoadData(event?: any): void {
		//'IsUseIPWhitelist','IPWhitelistInput', 'IsRequireOTP','POSLockSpamPhoneNumber',
		let sysConfigQuery = [
			'IsAutoSave',
			'SODefaultBusinessPartner',
			'POSSettleAtCheckout',
			'POSHideSendBarKitButton',
			'POSEnableTemporaryPayment',
			'POSEnablePrintTemporaryBill',
			'POSAutoPrintBillAtSettle',
		];

		let forceReload = event === 'force';
		Promise.all([
			this.env.getStatus('POSOrder'),
			this.env.getStatus('POSOrderDetail'),
			this.getTableGroupFlat(forceReload),
			this.getMenu(forceReload),
			this.getDeal(),
			this.sysConfigProvider.read({
				Code_in: sysConfigQuery,
				IDBranch: this.env.selectedBranch,
			}),
			this.env.getType('PaymentType'),
			this.env.getStatus('PaymentStatus'),
			this.printerProvider.read({ IDBranch: this.env.selectedBranch }),
		])
			.then((values: any) => {
				this.pageConfig.systemConfig = {};
				values[5]['data'].forEach((e) => {
					if ((e.Value == null || e.Value == 'null') && e._InheritedConfig) {
						e.Value = e._InheritedConfig.Value;
					}
					this.pageConfig.systemConfig[e.Code] = JSON.parse(e.Value);
				});

				this.soStatusList = values[0];
				this.soDetailStatusList = values[1];
				this.tableList = values[2];
				this.menuList = values[3];

				this.dealList = values[4];

				if (this.pageConfig.systemConfig.SODefaultBusinessPartner) {
					this.contactListSelected.push(this.pageConfig.systemConfig.SODefaultBusinessPartner);
				}

				this.paymentTypeList = values[6];
				this.paymentStatusList = values[7];
				this.printerList = values[8]?.data;
				super.preLoadData(event);
			})
			.catch((err) => {
				this.loadedData();
			});
	}

	async loadedData(event?: any, ignoredFromGroup?: boolean) {
		super.loadedData(event, ignoredFromGroup);
		if (this.item.IDBranch != this.env.selectedBranch && this.item.Id) {
			this.env.showMessage('Không tìm thấy đơn hàng, vui lòng kiểm tra chi nhánh!', 'danger');
			return;
		}

		if (!this.item?.Id) {
			Object.assign(this.item, this.formGroup.getRawValue());
			this.setOrderValue(this.item);
			this.getDefaultPrinter();
		} else {
			this.patchOrderValue();
			this.getPayments().finally(() => {
				this.getDefaultPrinter().finally(() => {
					this.getQRPayment();
				});
			});
			this.getPromotionProgram();
			if (this.item._Customer.IsStaff == true) {
				this.getStaffInfo(this.item._Customer.Code);
			}
		}
		this.loadOrder();
		this.contactSearch();
		this.cdr.detectChanges();
		await this.getStorageNotifications();
		this.CheckPOSNewOrderLines();
		this.canSaveOrder = this.item.OrderLines.filter((d) => d.Status == 'New' || d.Status == 'Waiting').length > 0;
	}

	async getStorageNotifications() {
		await this.env.getStorage('Notifications').then(async (result) => {
			if (result?.length > 0) {
				this.notifications = [...result.filter((n) => !n.Watched && n.IDBranch == this.env.selectedBranch)];
				let a = this.notifications;
				console.log(a);
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
		this.preLoadData('force');
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
			this.env.showMessage('Bạn không có quyền thêm sản phẩm!', 'warning');
			return;
		}

		if (!this.pageConfig.canEdit) {
			this.env.showMessage('Đơn hàng đã khóa, không thể chỉnh sửa hoặc thêm món!', 'warning');
			return;
		}

		if (this.item.Tables == null || this.item.Tables.length == 0) {
			this.env.showMessage('Vui lòng chọn bàn trước khi thêm món!', 'warning');
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
					this.env.showMessage('Item đã chuyển Bar/Bếp');
					return;
				}
			} else if (line.Quantity + quantity > 0) {
				line.Quantity += quantity;
				this.setOrderValue({
					OrderLines: [
						{
							Id: line.Id,
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
											IDUoM: line.IDUoM,
											Quantity: line.Quantity,
										},
									],
								});
							})
							.catch((_) => {});
					} else {
						this.env.showMessage('Tài khoản chưa được cấp quyền xóa sản phẩm!', 'warning');
					}
				}
			}
		}
		this.canSaveOrder = this.item.OrderLines.filter((d) => d.Status == 'New' || d.Status == 'Waiting').length > 0;
	}

	async openQuickMemo(line) {
		if (this.submitAttempt) return;
		if (line.Status != 'New') return;
		if (this.item.Status == 'TemporaryBill') {
			this.env.showMessage('Đơn hàng đã khóa, không thể chỉnh sửa hoặc thêm món!', 'warning');
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
			this.setOrderValue(
				{
					OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Remark: line.Remark }],
				},
				true
			);
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
				item: this.item,
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
			this.env.showMessage('Đơn hàng đã khóa không thể chỉnh sửa', 'warning');
			return false;
		}
		if (!this.item._Customer) {
			this.env.showMessage('Vui lòng chọn khách hàng', 'warning');
			return false;
		}
		if (this.item._Customer.Id == 922) {
			this.env.showMessage('Không thể xuất hóa đơn cho khách lẻ', 'warning');
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
			this.env.showMessage('Đơn hàng đã thanh toán không thể hủy, vui lòng hoàn tiền lại để hủy đơn hàng này!', 'warning');
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

	saveOrderData() {
		let message = 'Bạn có muốn in đơn gửi bar/bếp ?';

		this.env
			.showPrompt(message, null, 'Thông báo')
			.then(async (_) => {
				if (this.item.Id) {
					await this.sendKitchen();
					await this.sendKitchenEachItem();
					if (this.promotionService.promotionList) {
							let query = {
								IDSaleOrder: this.item.Id,
								IDPrograms: this.promotionService.promotionList.filter((d) => d.IsAutoApply).map((o) => o.Id),
							};
							this.pageProvider.commonService
								.connect('POST', 'PR/Program/ApplyVoucher/', query)
								.toPromise()
								.then((result: any) => {
								});
						}
				} else {
					this.saveChange().then(async () => {
						this.submitAttempt = false;
						await this.sendKitchen();
						await this.sendKitchenEachItem();
						if (this.promotionService.promotionList) {
							let query = {
								IDSaleOrder: this.item.Id,
								IDPrograms: this.promotionService.promotionList.filter((d) => d.IsAutoApply).map((o) => o.Id),
							};
							this.pageProvider.commonService
								.connect('POST', 'PR/Program/ApplyVoucher/', query)
								.toPromise()
								.then((result: any) => {
								});
						}
					});
				}
			})
			.catch((_) => {
				this.saveChange();
			});
	}

	async sendKitchen() {
		return new Promise(async (resolve, reject) => {
			this.printData.printDate = lib.dateFormat(new Date(), 'hh:MM dd/mm/yyyy');
			// console.log(lib.dateFormat(new Date(), "hh:MM:ss") + '  ' + new Date().getMilliseconds()); // For Testing
			if (this.submitAttempt) return;
			this.submitAttempt = true;
			let times = 2; // Số lần in phiếu; Nếu là 2, in 2 lần;
			// this.qzPrint('bill')
			this.printData.undeliveredItems = [];

			this.item.OrderLines.forEach((e) => {
				e._undeliveredQuantity = e.Quantity - e.ShippedQuantity;
				e._IDKitchen = e._item?.Kitchen.Id;
				if (e.Remark) {
					e.Remark = e.Remark.toString();
				}
				if (e._undeliveredQuantity > 0) {
					// e.Status = 'Serving';
					this.printData.undeliveredItems.push(e);
				}
			});

			if (this.printData.undeliveredItems.length == 0) {
				this.env.showMessage('Không có sản phẩm mới cần gửi đơn!', 'success');
				this.submitAttempt = false;
				return;
			}
			let t = this.printData.undeliveredItems;
			const newKitchenList = [...new Map(this.printData.undeliveredItems.map((item: any) => [item._item?.Kitchen?.Name, item._item?.Kitchen])).values()];
			this.kitchenList = newKitchenList;
			// let hosts = newKitchenList
			// 	.filter(k => k.Printer && k.Printer.Host) // chỉ lấy printer có host
			// 	.map(k => k.Printer.Host);

			// // Kiểm tra tất cả có host giống nhau
			// let allSameHost = hosts.length > 0 && hosts.every(h => h === hosts[0]);
			for (let kitchen of newKitchenList.filter((d) => d.Id)) {
				await this.setKitchenID(kitchen.Id);
				let printer = this.printerList.find((d) => d.Code == kitchen.Printer?.Code);
				if (printer) {
					await this.printPrepare('bill', [printer], kitchen.Id);
					// else this.printPrepare('bill', [printer])
				}
				// .then((f) => {

				// })
				// .catch((err) => {
				// 	console.log(err);
				// 	this.env.showMessage(err,'danger');
				// })
				// .finally(() => {
				// });
				// if(printer)printers.push(printer);
			}

			// this.qzPrint('bill', printers)
			// 	.then((f) => {

			// 	})
			// 	.catch((err) => {
			// 		console.log(err);
			// 		this.env.showMessage(err + '','danger');
			// 	})
			// 	.finally(() => {
			// 	});
			this.checkData(false, true, false)
				.then((r) => resolve(true))
				.catch((err) => {
					reject(false);
				});
		});
	}

	haveFoodItems = false;
	async sendKitchenEachItem() {
		return new Promise(async (resolve, reject) => {
			if (this.submitAttempt) return;
			this.submitAttempt = true;
			let times = 1; // Số lần in phiếu; Nếu là 2, in 2 lần;
			this.printData.undeliveredItems = [];

			this.item.IDOwner = this.env.user.StaffID;
			this.item.OrderLines.forEach((e) => {
				e._undeliveredQuantity = e.Quantity - e.ShippedQuantity;
				e._IDKitchen = e._item?.Kitchen.Id;
				if (e._undeliveredQuantity > 0) {
					// e.Status = 'Serving';
					this.printData.undeliveredItems.push(e);
				}
				if (e.Remark) {
					e.Remark = e.Remark.toString();
				}
			});

			if (this.printData.undeliveredItems.length == 0) {
				this.env.showMessage('Không có sản phẩm mới cần gửi đơn!', 'success');
				this.submitAttempt = false;
				resolve(true);
				return;
			}

			// Flow để in Type == Food và trường hợp có máy in nhiều chỗ.
			// Lọc ra List A (ItemsForKitchen) : mảng các items là Foods.
			// Lọc ra List B (newKitchenList2) : Các máy in để in cho List A.
			// Vòng lặp qua list A >> thiết lập View (SetKitchenID) và  chọn máy in phù hợp để mapping lại với nhau.
			// >> có được cặp dữ liệu hình ảnh cần thiết, và vị trí máy in tương ứng.

			const IDItemGroupList = [...new Map(this.printData.undeliveredItems.map((item: any) => [item['_item']['IDItemGroup'], item._item.IDItemGroup])).values()];
			for (let index = 0; index < IDItemGroupList.length; index++) {
				const element = IDItemGroupList[index];
				if (element == 193) {
					// Type == Food only (IDItemGroup == 193);
					this.haveFoodItems = true;
					let ItemsForKitchen = this.printData.undeliveredItems.filter((i) => i._item.IDItemGroup == element);

					const newKitchenList2 = [...new Map(ItemsForKitchen.map((item: any) => [item['_item']['Kitchen']['Name'], item._item.Kitchen])).values()];
					this.kitchenList = newKitchenList2;

					for (let index = 0; index < ItemsForKitchen.length; index++) {
						let kitchenPrinter = newKitchenList2.find((p) => p.Id == ItemsForKitchen[index]._IDKitchen);

						await this.setKitchenID(kitchenPrinter.Id);
						let LineID = ItemsForKitchen[index].Id;
						let printerInfo = kitchenPrinter['Printer'];
						let printing = this.printPrepare('bill-item-each-' + LineID, [printerInfo]);
						if (index + 1 == ItemsForKitchen.length && printing) {
							resolve(printing);
						}
					}
					this.checkData(false, true, true);
				}
			}
			if (!this.haveFoodItems) {
				this.submitAttempt = false; // Không có item nào thuộc là food;
				console.log('Không có item nào thuộc là food');
				this.checkData(false, true, true).then((result) => {
					resolve(result);
				});
			}
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

				let printerInfo = newTerminalList[index]['Printer'];
				let printing = this.printPrepare('bill', [printerInfo]);
				if (printing) {
					this.checkData(receipt, !receipt, sendEachItem);
					resolve(true);
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
				// this.refresh();
			});
	}

	async lockOrder() {
		const Debt = this.item.Debt;
		let postDTO = {
			Id: this.item.Id,
			Code: 'TemporaryBill',
			Debt: Debt,
		};
		if (this.printData.undeliveredItems.length > 0) {
			let message = 'Bạn có sản phẩm chưa in gửi bếp. Bạn có muốn tiếp tục gửi bếp và tạm tính?';
			this.env
				.showPrompt(message, null, 'Thông báo')
				.then(async (_) => {
					await this.sendKitchen();
					await this.sendKitchenEachItem();

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
							// this.refresh();
						});
				})
				.catch((_) => {});
		} else {
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
					// this.refresh();
				});
		}
	}

	getQRPayment() {
		if (this.paymentList.length) {
			this.VietQRCode = null;
			let payment = this.paymentList.find((p) => p.IncomingPayment.Remark == 'VietQR-AutoGen' && p.IncomingPayment.Status == 'Processing')?.IncomingPayment;
			if (this.item.Status == 'TemporaryBill' && payment) {
				this.GenQRCode(payment.Code);
			}
		}
	}

	VietQRCode;
	GenQRCode(code) {
		let that = this;
		this.VietQRCode = null;
		if (code != '' && code != null) {
			QRCode.toDataURL(
				code,
				{
					errorCorrectionLevel: 'H',
					version: 10,
					width: 150,
					scale: 1,
					type: 'image/jpeg',
				},
				function (err, url) {
					that.VietQRCode = url;
				}
			);
		}
		if (this.pageConfig.systemConfig.POSEnableTemporaryPayment && this.pageConfig.systemConfig.POSEnablePrintTemporaryBill) {
			this.sendPrint('TemporaryBill');
		}
	}

	printerCodeList = [];
	dataList = [];

	printPrepare(id, printers, kitchen = '') {
		return new Promise((resolve, reject) => {
			let content = document.getElementById(id);
			//let ele = this.printingService.applyAllStyles(content);
			let optionPrinters = printers.map((printer) => {
				return {
					printer: printer.Code,
					host: printer.Host,
					port: printer.Port,
					isSecure: printer.IsSecure,
					// tray: '1',
					jobName: printer.Code + '-' + kitchen + '-' + this.item.Id,
					copies: 1,
					//orientation: 'landscape',
					duplex: 'duplex',
					//  autoStyle:content
				};
			});
			let data: printData = {
				content: content.outerHTML,
				type: 'html',
				options: optionPrinters,
			};
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
	////PRIVATE METHODS
	private UpdatePrice() {
		this.dealList.forEach((d) => {
			this.menuList.forEach((m) => {
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
		this.printData.selectedTables = this.tableList.filter((d) => this.item.Tables.indexOf(d.Id) > -1);
		this.printData.printDate = lib.dateFormat(new Date(), 'hh:MM dd/mm/yyyy');

		this.item._Locked = this.noLockStatusList.indexOf(this.item.Status) == -1;
		this.printData.currentBranch = this.env.branchList.find((d) => d.Id == this.item.IDBranch);

		if (this.item._Locked) {
			this.pageConfig.canEdit = false;
			this.formGroup?.disable();
		} else {
			this.pageConfig.canEdit = true;
		}

		if (this.item._Customer) {
			this.contactListSelected.push(this.item._Customer);
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

		for (let m of this.menuList) for (let mi of m.Items) mi.BookedQuantity = 0;

		for (let line of this.item.OrderLines) {
			line._serviceCharge = 0;
			if (
				this.item.IDBranch == 174 || //W-Cafe
				this.item.IDBranch == 17 || //The Log
				this.item.IDBranch == 416 || //Gem Cafe && set menu  && line._item.IDMenu == 218
				this.item.IDBranch == 864 || //TEST
				this.env.branchList.find((d) => d.Id == this.item.IDBranch)?.Code == '145' //phindily code 145
			) {
				line._serviceCharge = 5;
			}

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
			for (let m of this.menuList)
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
		line.StatusText = lib.getAttrib(line.Status, this.soDetailStatusList, 'Name', '--', 'Code');
		line.StatusColor = lib.getAttrib(line.Status, this.soDetailStatusList, 'Color', '--', 'Code');
	}

	private getMenu(forceReload) {
		return new Promise((resolve, reject) => {
			this.env
				.getStorage('menuList' + this.env.selectedBranch)
				.then((data) => {
					if (!forceReload && data) {
						resolve(data);
					} else {
						this.menuProvider
							.read({ IDBranch: this.env.selectedBranch })
							.then((resp) => {
								let menuList = resp['data'];
								menuList.forEach((m: any) => {
									m.menuImage = environment.posImagesServer + (m.Image ? m.Image : 'assets/pos-icons/POS-Item-demo.png');
									m.Items.forEach((i) => {
										i.imgPath = environment.posImagesServer + (i.Image ? i.Image : 'assets/pos-icons/POS-Item-demo.png');
									});
								});
								this.env.setStorage('menuList' + this.env.selectedBranch, menuList);
								resolve(menuList);
							})
							.catch((err) => {
								reject(err);
							});
					}
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private getTableGroupFlat(forceReload) {
		return new Promise((resolve, reject) => {
			this.getTableGroupTree(forceReload)
				.then((data: any) => {
					let tableList = [];

					data.forEach((g) => {
						tableList.push({
							Id: 0,
							Name: g.Name,
							levels: [],
							disabled: true,
						});
						g.TableList.forEach((t) => {
							tableList.push({
								Id: t.Id,
								Name: t.Name,
								levels: [{}],
							});
						});
					});

					resolve(tableList);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private getTableGroupTree(forceReload) {
		return new Promise((resolve, reject) => {
			this.env
				.getStorage('tableGroup' + this.env.selectedBranch)
				.then((data) => {
					if (!forceReload && data) {
						resolve(data);
					} else {
						let query = { IDBranch: this.env.selectedBranch };
						Promise.all([this.tableGroupProvider.read(query), this.tableProvider.read(query)])
							.then((values) => {
								let tableGroupList = values[0]['data'];
								let tableList = values[1]['data'];

								tableGroupList.forEach((g) => {
									g.TableList = tableList.filter((d) => d.IDTableGroup == g.Id);
								});
								this.env.setStorage('tableGroup' + this.env.selectedBranch, tableGroupList);
								resolve(tableGroupList);
							})
							.catch((err) => {
								reject(err);
							});
					}
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private getDeal() {
		let apiPath = {
			method: 'GET',
			url: function () {
				return ApiSetting.apiDomain('PR/Deal/ForPOS');
			},
		};
		return new Promise((resolve, reject) => {
			this.commonService
				.connect(apiPath.method, apiPath.url(), this.query)
				.toPromise()
				.then((result: any) => {
					resolve(result);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	patchOrderLines() {}

	private addOrderLine(line) {
		let groups = <FormArray>this.formGroup.controls.OrderLines;
		let group = this.formBuilder.group({
			IDOrder: [line.IDOrder],
			Id: new FormControl({ value: line.Id, disabled: true }),

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

	setOrderValue(data, instantly = false, forceSave = false) {
		for (const c in data) {
			if (c == 'OrderLines' || c == 'OrderLines') {
				let fa = <FormArray>this.formGroup.controls.OrderLines;

				for (const line of data[c]) {
					let idx = -1;
					if (c == 'OrderLines') {
						idx = this.item[c].findIndex((d) => d.Id == line.Id && d.IDUoM == line.IDUoM);
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

		if ((this.item.OrderLines.length || this.formGroup.controls.DeletedLines.value.length) && this.pageConfig.systemConfig.IsAutoSave) {
			if (instantly) this.saveChange();
			else
				this.debounce(() => {
					this.saveChange();
				}, 1000);
		}
		if (forceSave) {
			this.saveChange();
		}
	}

	async saveChange() {
		let submitItem = this.getDirtyValues(this.formGroup);
		return this.saveChange2();
	}

	savedChange(savedItem?: any, form?: FormGroup<any>): void {
		if (savedItem) {
			if (form.controls.Id && savedItem.Id && form.controls.Id.value != savedItem.Id) form.controls.Id.setValue(savedItem.Id);

			if (form.controls.IDContact.value != savedItem.IDContact) this.changedIDAddress(savedItem._Customer);

			if (this.pageConfig.isDetailPage && form == this.formGroup && this.id == 0) {
				this.id = savedItem.Id;
				let newURL = '#pos-order/' + savedItem.Id + '/' + this.idTable;
				history.pushState({}, null, newURL);
			}

			this.item = savedItem;
		}

		this.loadedData();

		this.submitAttempt = false;
		this.env.showMessage('Saving completed!', 'success');

		// if (savedItem.Status == 'Done') {
		// 	this.sendPrint(savedItem.Status, true);
		// }
		// if (savedItem.Status == 'TemporaryBill' && this.pageConfig.systemConfig.POSEnableTemporaryPayment && this.pageConfig.systemConfig.POSEnablePrintTemporaryBill) {
		// 	this.sendPrint();
		// }
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
				console.log(err);
			});
	}

	changeTable() {
		this.saveSO();
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
							Term: term ? term : 'BP:' + this.item.IDContact,
						})
						.pipe(
							catchError(() => of([])), // empty list on error
							tap(() => (this.contactListLoading = false))
						)
				)
			)
		);
	}

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
			this.changedIDAddress(data);
			this.contactListSelected.push(data);
			this.contactListSelected = [...this.contactListSelected];
			this.contactSearch();
		}
	}

	changedIDAddress(address) {
		if (address) {
			this.Staff = null;
			this.setOrderValue(
				{
					IDContact: address.Id,
					IDAddress: address.IDAddress,
				},
				true,
				true
			);
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
			this.env.showMessage('Số tiền tặng không lớn hơn trị giá sản phẩm!', 'danger');
			return false;
		}
		this.setOrderValue(
			{
				OrderLines: [
					{
						Id: line.Id,
						IDUoM: line.IDUoM,
						Remark: line.Remark,
						OriginalDiscountFromSalesman: OriginalDiscountFromSalesman,
					},
				],
			},
			true
		);
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
						// console.log(this.paymentStatusList);

						e.IncomingPayment._Status = this.paymentStatusList.find((s) => s.Code == e.IncomingPayment.Status) || {
							Code: e.IncomingPayment.Status,
							Name: e.IncomingPayment.Status,
							Color: 'danger',
						};
						e.IncomingPayment.TypeText = lib.getAttrib(e.IncomingPayment.Type, this.paymentTypeList, 'Name', '--', 'Code');
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

					if (this.pageConfig.systemConfig.POSSettleAtCheckout && Math.abs(this.item.Debt) < 10 && this.item.Status != 'Done') {
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
							IDUoM: line.IDUoM,
							ShippedQuantity: line.ShippedQuantity,
							ReturnedQuantity: 0,
						});
					}
				});
				changed.OrderLines = this.item.OrderLines;
				changed.Status = 'Done';
				this.setOrderValue(changed, true, true);
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
					this.setOrderValue(changed, true, true);
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
			this.setOrderValue(changed, true, true);
		}
	}

	cssStyling = `
    .bill .items .name,.bill .items tr:last-child td{border:none!important}.bill,.bill .title,.sheet{color:#000;font-sized:13px;}.sheet .no-break-page,.sheet .no-break-page *,.sheet table break-guard,.sheet table break-guard *,.sheet table tr{page-break-inside:avoid}.bill{display:block;overflow:hidden!important}.bill .sheet{box-shadow:none!important}.bill .header,.bill .message,.sheet.rpt .cen,.text-center{text-align:center}.bill .header span{display:inline-block;width:100%}.bill .header .logo img{max-width:150px;max-height:75px}.bill .header .bill-no,.bill .header .brand,.bill .items .quantity,.bold,.sheet.rpt .bol{font-weight:700}.bill .header .address{font-size:80%;font-style:italic}.bill .table-info{border:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .table-info-top{border-top:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .table-info-bottom{border-bottom:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .items{margin:5px 0}.bill .items tr td{border-bottom:1px dashed #ccc;padding-bottom:5px}.bill .items .name{width:100%;padding-top:5px;padding-bottom:2px!important}.bill .items .code{font-weight:700;text-transform:uppercase}.bill .items .total,.sheet.rpt .num,.text-right{text-align:right}.bill .header,.bill .items,.bill .message,.bill .table-info,.bill .table-info-bottom,.bill .table-info-top{padding-left:8px;padding-right:8px}.page-footer-space{margin-top:10px}.table-name-bill{font-size:16px}.table-info-top td{padding-top:5px}.table-info-top .small{font-size:smaller!important}.sheet{margin:0;overflow:hidden;position:relative;box-sizing:border-box;page-break-after:always;font-family:'Times New Roman',Times,serif;font-size:13px;background:#fff}.sheet.rpt .top-zone{min-height:940px}.sheet.rpt table,.sheet.rpt tbody table{width:100%;border-collapse:collapse}.sheet.rpt tbody table td{padding:0}.sheet.rpt .rpt-header .ngay-hd{width:100px}.sheet.rpt .rpt-header .title{font-size:18px;font-weight:700;color:#000}.sheet.rpt .rpt-header .head-c1{width:75px}.sheet.rpt .chu-ky,.sheet.rpt .rpt-nvgh-header{margin-top:20px}.sheet.rpt .ds-san-pham{margin:10px 0}.sheet.rpt .ds-san-pham td{padding:2px 5px;border:1px solid #000;white-space:nowrap}.sheet.rpt .ds-san-pham .head{background-color:#f1f1f1;font-weight:700}.sheet.rpt .ds-san-pham .oven{background-color:#f1f1f1}.sheet.rpt .ds-san-pham .ghi-chu{min-width:170px}.sheet.rpt .ds-san-pham .tien{width:200px}.sheet.rpt .thanh-tien .c1{width:95px}.sheet.rpt .chu-ky td{font-weight:700;text-align:center}.sheet.rpt .chu-ky .line2{font-weight:400;height:100px;page-break-inside:avoid}.sheet.rpt .noti{margin-top:-105px}.sheet.rpt .noti td{vertical-align:bottom}.sheet.rpt .noti td .qrc{width:100px;height:100px;border:1px solid;display:block}.sheet.rpt .big{font-size:16px;font-weight:700;color:#b7332b}.sheet .page-footer,.sheet .page-footer-space,.sheet .page-header,.sheet .page-header-space{height:10mm}.sheet table{page-break-inside:auto}.sheet table tr{page-break-after:auto}.float-right{float:right}
    `;
	deleteVoucher(p) {
		let apiPath = {
			method: 'POST',
			url: function () {
				return ApiSetting.apiDomain('PR/Program/DeleteVoucher/');
			},
		};
		new Promise((resolve, reject) => {
			this.pageProvider.commonService
				.connect(apiPath.method, apiPath.url(), {
					IDProgram: p.Id,
					IDSaleOrder: this.item.Id,
					IDDeduction: p.IDDeduction,
				})
				.toPromise()
				.then((savedItem: any) => {
					this.env.showMessage('Saving completed!', 'success');
					resolve(true);
					this.refresh();
				})
				.catch((err) => {
					this.env.showMessage('Cannot save, please try again!', 'danger');
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

	async checkData(receipt = true, saveData = true, sendEachItem = false) {
		return new Promise(async (resolve, reject) => {
			if (!receipt && saveData && sendEachItem) {
				let undelivered = [];
				this.item.OrderLines.forEach((e) => {
					if (e.Quantity != e.ShippedQuantity) {
						undelivered.push({
							Id: e.Id,
							ShippedQuantity: e.Quantity,
							IDUoM: e.IDUoM,
							Status: 'Serving',
						});
					}
				});

				this.submitAttempt = false;
				this.setOrderValue({ Status: 'Scheduled', OrderLines: undelivered }, true, true);
				resolve(true);
			}

			this.env.showMessage('Gửi đơn thành công!', 'success');
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

					this.contactListSelected.push(address);
					this.changedIDAddress(address);
					this.contactSearch();
					this.cdr.detectChanges();
					this.saveChange();
				});
			} else {
				this.env.showMessage('Mã đã hết hạn, vui lòng lấy lại mã nhân viên mới! Thời gian tạo mã QR: {{value}}', 'danger', QRGenTime);
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
}

/*
1201
Mới
New

1202
Tiếp nhận
Confirmed

1203
Đã chuyển bếp/bar
Scheduled

1204
Đang chuẩn bị
Picking

1205
Đã lên món
Delivered

1206
Đơn đã chia
Splitted

1207
Đơn đã gộp
Merged

1208
Còn nợ
Debt

1209
Đã xong
Done

1210
Đã hủy
Canceled





1301
Mới
New

1302
Chờ tiếp nhận
Waiting

1303
Đang thực hiện
Preparing

1304
Đã sẵn sàng
Ready

1305
Đang phục vụ
Serving

1306
Đã xong
Done

1307
Đã hủy
Canceled

1308
Đã đổi trả
Returned



*/
