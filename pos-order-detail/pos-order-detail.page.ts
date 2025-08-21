import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, HRM_StaffProvider, POS_TerminalProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';

import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';

import { POSMemoModalPage } from '../pos-memo-modal/pos-memo-modal.page';
import { environment } from 'src/environments/environment';
import { POSVoucherModalPage } from '../pos-voucher-modal/pos-voucher-modal.page';
import { POSContactModalPage } from '../pos-contact-modal/pos-contact-modal.page';
import { POSInvoiceModalPage } from '../pos-invoice-modal/pos-invoice-modal.page';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import QRCode from 'qrcode';
import { printData, PrintingService } from 'src/app/services/printing.service';
import { BarcodeScannerService } from 'src/app/services/barcode-scanner.service';
import { POSService } from '../pos.service';
import { PromotionService } from 'src/app/services/promotion.service';
import { CanComponentDeactivate } from './deactivate-guard';
import { POSNotifyService } from '../pos-notify.service';
import { POSConstants } from '../pos.constants';
import { POSCartService } from '../pos-cart.service';
import { POSPrintService } from '../pos-print.service';
import { POSDiscountService } from '../pos-discount.service';
import { POSOrderService } from '../pos-order.service';
import { POSSecurityService } from '../services/pos-security.service';

// Constants
const PAYMENT_CONFIG = {
	WALKIN_CUSTOMER_ID: 922,
	QR_CONFIG: {
		errorCorrectionLevel: 'H',
		version: 10,
		width: 150,
		scale: 1,
		type: 'image/jpeg',
	},
	TIME_TOLERANCE_MINUTES: 1,
	MIN_DEBT_THRESHOLD: 10,
} as const;



@Component({
	selector: 'app-pos-order-detail',
	templateUrl: './pos-order-detail.page.html',
	styleUrls: ['./pos-order-detail.page.scss'],
	standalone: false,
})
export class POSOrderDetailPage extends PageBase implements CanComponentDeactivate {
	@ViewChild('numberOfGuestsInput') numberOfGuestsInput: ElementRef;

	noImage = environment.posImagesServer + 'assets/pos-icons/POS-Item-demo.png'; //No image for menu item
	segmentView = 'all';
	idTable: any; //Default table

	paymentList = [];

	noLockStatusList = POSConstants.NO_LOCK_STATUS_LIST;
	noLockLineStatusList = POSConstants.NO_LOCK_LINE_STATUS_LIST;
	checkDoneLineStatusList = POSConstants.CHECK_DONE_LINE_STATUS_LIST;
	kitchenQuery = POSConstants.KITCHEN_QUERY.ALL;
	itemQuery = POSConstants.KITCHEN_QUERY.ALL;
	defaultPrinter = [];
	printData = {
		undeliveredItems: [], //To track undelivered items to the kitchen
		printDate: null,
		currentBranch: null,
		selectedTables: [],
	};
	Staff;
	notifications = [];

	isWaitingRefresh = false;

	// Discount and promotion getters through discount service
	get promotionAppliedPrograms() {
		return this.posDiscountService.promotionAppliedPrograms;
	}

	constructor(
		public posService: POSService,
		public pageProvider: SALE_OrderProvider,
		public contactProvider: CRM_ContactProvider,
		public staffProvider: HRM_StaffProvider,
		public printerTerminalProvider: POS_TerminalProvider,
		public printingService: PrintingService,
		public scanner: BarcodeScannerService,
		public posNotifyService: POSNotifyService,
		public posPrintService: POSPrintService,
		public cartService: POSCartService,
		public posDiscountService: POSDiscountService,
		public posOrderService: POSOrderService,
		public posSecurityService: POSSecurityService,

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
		this.pageConfig.canChangeBranch = false;
		this.idTable = this.route.snapshot?.paramMap?.get('table');
		this.idTable = typeof this.idTable == 'string' ? parseInt(this.idTable) : this.idTable;

		// Initialize cart service form
		this.formGroup = this.cartService.initializeForm(this.idTable);

		this.formGroup.valueChanges.subscribe(() => {
			const controls = this.formGroup.controls;
			this.canSaveOrder =
				Object.values(controls).some((control) => control.dirty) ||
				this.item?.OrderLines?.some((d) => d.Status == POSConstants.ORDER_LINE_STATUS.NEW || d.Status == POSConstants.ORDER_LINE_STATUS.WAITING);
		});
		console.log('PR List: ', this.promotionService.promotionList);
	}

	preLoadData(event?: any): void {
		let forceReload = event === 'force';
		this.posService
			.getEnviromentDataSource(this.env.selectedBranch, forceReload)
			.then(() => {
				// Initialize cart service with POSService data
				this.cartService.initializeConfig(this.posService.systemConfig, this.posService.dataSource);

				this.getDefaultPrinter();
				console.log(this.posService.dataSource);
			})
			.finally(() => {
				super.preLoadData(event);
			});
	}

	loadData(event?: any): void {
		console.log('loadData');

		if (this.isWaitingRefresh) {
			console.log('load canceled by isWaitingRefresh');
			return;
		}
		if (this.submitAttempt) {
			console.log('Submit attempt detected');
			return;
		}
		if (this.formGroup.controls.OrderLines.dirty || this.formGroup.dirty) {
			this.env.showMessage('Please save your changes before loading data!', 'warning');
			return;
		}

		super.loadData(event);
	}

	private validateBranchAccess(): boolean {
		// Enhanced validation with null safety
		if (!this.item || !this.env?.selectedBranch) {
			console.warn('validateBranchAccess: Missing required data');
			return false;
		}

		if (this.item.IDBranch != this.env.selectedBranch && this.item.Id) {
			this.item = null;
			this.env.showMessage('Không tìm thấy đơn hàng, vui lòng kiểm tra chi nhánh!', 'danger');
			return false;
		}
		return true;
	}

	private handleNewItem() {
		// Input validation
		if (!this.item || !this.formGroup) {
			console.error('handleNewItem: Missing required objects');
			return;
		}

		try {
			Object.assign(this.item, this.formGroup.getRawValue());
			this.setOrderValue(this.item);
		} catch (error) {
			console.error('handleNewItem error:', error);
			this.handleApiError(error, 'Failed to initialize new item');
		}
	}

	private handleExistingItem() {
		// Input validation
		if (!this.item || !this.formGroup || !this.cartService) {
			console.error('handleExistingItem: Missing required objects');
			return;
		}

		try {
			this.formGroup?.patchValue(this.item);

			// Ensure cart service has the item and form before calling patchOrderLinesValue
			this.cartService.item = this.item;
			this.cartService.formGroup = this.formGroup;
			this.cartService.patchOrderLinesValue();

			this.getPayments();
			this.getPromotionProgram();

			// Safe staff info retrieval
			if (this.item._Customer?.IsStaff && this.item._Customer?.Code) {
				this.getStaffInfo(this.item._Customer.Code);
			}
		} catch (error) {
			console.error('handleExistingItem error:', error);
			this.handleApiError(error, 'Failed to handle existing item');
		}
	}

	private initializeContactDataSource() {
		this._contactDataSource.selected = [];
		if (this.posService.systemConfig.SODefaultBusinessPartner) {
			this._contactDataSource.selected.push(this.posService.systemConfig.SODefaultBusinessPartner);
		}
		if (this.item._Customer && !this._contactDataSource.selected?.some((d) => d.Id == this.item._Customer.Id)) {
			this._contactDataSource.selected.push(this.item._Customer);
		}
		this._contactDataSource.initSearch();
	}

	private finalizeDataLoad() {
		this.loadOrder();

		// Sync notifications from service
		this.notifications = this.posNotifyService.notifications;

		this.cdr.detectChanges();
		// Remove manual CheckPOSNewOrderLines call - now handled by service
	}

	async loadedData(event?: any, ignoredFromGroup?: boolean) {
		console.log('loadedData');

		if (!this.validateBranchAccess()) {
			super.loadedData(event, ignoredFromGroup);
			return;
		}

		super.loadedData(event, ignoredFromGroup);

		if (!this.item?.Id) {
			this.handleNewItem();
		} else {
			this.handleExistingItem();
		}

		this.initializeContactDataSource();
		this.finalizeDataLoad();
	}

	////EVENTS
	ngOnInit() {
		this.pageConfig.subscribePOSOrderDetail = this.env.getEvents().subscribe((data) => {
			//Check if form is dirty
			if (this.formGroup.dirty) {
				//TODO: check if user wants to discard changes
				return true;
			}

			// Use POSOrderService to handle SignalR notifications instead of manual refresh
			if (data?.id && data?.type === 'order_update') {
				this.posOrderService.handleOrderUpdateNotification(data);
			} else {
				// Fallback to existing notification handler
				this.posNotifyService.handleEvent(data, this.item, this.idTable, () => this.loadData());
			}
		});

		super.ngOnInit();
	}
	ngOnDestroy() {
		// Enhanced cleanup for memory leak prevention
		try {
			// Clear debounce timer
			if (this.searchDebounceTimer) {
				clearTimeout(this.searchDebounceTimer);
				this.searchDebounceTimer = null;
			}

			// Unsubscribe from POS events
			this.pageConfig?.subscribePOSOrderDetail?.unsubscribe();

			// Clear large arrays to help GC
			if (this.paymentList?.length > 0) {
				this.paymentList.length = 0;
			}

			if (this.notifications?.length > 0) {
				this.notifications.length = 0;
			}

			// Reset references
			this.printData = null;
			this.Staff = null;
			this.VietQRCode = null;

			console.log('POSOrderDetailPage cleanup completed');
		} catch (error) {
			console.error('ngOnDestroy cleanup error:', error);
		}

		super.ngOnDestroy();
	}

	canDeactivate(): Promise<boolean> | boolean {
		// Enhanced validation with null safety
		if (!this.formGroup?.controls) {
			return true; // Allow navigation if form is not properly initialized
		}

		try {
			const hasOrderLinesChanges = this.formGroup.controls.OrderLines?.dirty;
			const hasFormChanges = this.formGroup.dirty && this.item?.Id;

			if (hasOrderLinesChanges || hasFormChanges) {
				return this.env
					.showPrompt('This order has not been saved yet, do you want to save?', '', 'Please save order!')
					.then(() => {
						this.setOrderValue({}, true);
						return false; // Stay on page
					})
					.catch(() => {
						return true; // Allow navigation
					});
			}
		} catch (error) {
			console.error('canDeactivate error:', error);
			// Allow navigation if there's an error
			return true;
		}

		return true; // Allow navigation if no changes
	}

	async getStorageNotifications() {
		await this.posNotifyService.getStorageNotifications();
		this.notifications = this.posNotifyService.notifications; // sync
	}

	/**
	 * Get undelivered items count using cart service
	 */
	private getUndeliveredItemsCount(): number {
		return this.cartService.getUndeliveredItemsCount();
	}

	/**
	 * Check if current order has undelivered items using cart service
	 */
	private hasUndeliveredItems(): boolean {
		return this.cartService.hasUndeliveredItems();
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
			await this.posNotifyService.setNotifications(notification);
			this.notifications = this.posNotifyService.notifications; // sync
		}
	}

	async goToNofication(i, j) {
		return this.posNotifyService.goToNotification(
			i,
			j,
			this.item,
			() => this.loadData(),
			() => this.navBackOrder(),
			(url, direction) => this.nav(url, direction)
		);
	}

	async navBackOrder() {
		// await this.nav('/pos-order', 'back');
		await this.navCtrl.navigateBack('/pos-order');
	}

	removeNotification(j) {
		this.posNotifyService.removeNotification(j);
		this.notifications = this.posNotifyService.notifications; // sync
	}

	async getDefaultPrinter(): Promise<boolean> {
		// Input validation
		if (!this.printerTerminalProvider || !this.env?.selectedBranch) {
			console.warn('getDefaultPrinter: Missing required services or branch');
			return false;
		}

		return this.posSecurityService.executeWithRecovery(async () => {
			const results: any = await this.printerTerminalProvider.read({
				IDBranch: this.env.selectedBranch,
			});

			// Validate results structure
			if (results?.data?.[0]?.Printer) {
				this.defaultPrinter.push(results.data[0].Printer);
				return true;
			}

			console.warn('getDefaultPrinter: No printer found for branch');
			return false;
		}, 'getDefaultPrinter').catch((error) => {
			console.error('getDefaultPrinter final error:', error);
			// Don't show error to user, just log it
			return false;
		});
	}

	// refreshAttemp = false;
	refresh(event?: any): void {
		this.preLoadData('force');
	}

	segmentFilterDishes = 'New';
	changeFilterDishes(event) {
		this.segmentFilterDishes = event.detail.value;
	}

	countDishes(segment) {
		if (segment == 'New') return this.cartService.countUndeliveredItems();

		return this.cartService.countDeliveredItems();
	}

	canSaveOrder = false;
	async addToCart(item, idUoM, quantity = 1, idx = -1, status = '') {
		return await this.cartService.addToCart(item, idUoM, quantity, idx, status, this.pageConfig, this.submitAttempt, (line, qty) => this.openCancellationReason(line, qty));
	}

	async openQuickMemo(line) {
		if (this.submitAttempt) return;
		if (line.Status != 'New') return;
		if (this.item.Status == 'TemporaryBill') {
			this.env.showMessage('The order is locked, you cannot edit or add items!', 'warning');
			return;
		}

		const modal = await this.createModal(POSMemoModalPage, { item: JSON.parse(JSON.stringify(line)) }, 'modal-quick-memo', 'POSMemoModalPage');

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

	// Performance optimization: debounce search
	private searchDebounceTimer: any = null;
	private readonly SEARCH_DEBOUNCE_DELAY = 300; // milliseconds

	search(ev: any) {
		// Input validation
		if (!ev?.target) {
			console.warn('search: Invalid event target');
			return;
		}

		// Clear previous timer
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
		}

		// Debounced search execution
		this.searchDebounceTimer = setTimeout(() => {
			try {
				const val = ev.target.value?.toLowerCase() || '';

				// Only update query if length is valid
				if (val.length > 2 || val === '') {
					this.query.Keyword = val;
				}
			} catch (error) {
				console.error('search error:', error);
			}
		}, this.SEARCH_DEBOUNCE_DELAY);
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
		const discount = this.cartService.getCurrentDiscount() || {
			Amount: this.item.OriginalTotalDiscount,
			Percent: (this.item.OriginalTotalDiscount * 100) / this.item.OriginalTotalBeforeDiscount,
		};

		const modal = await this.modalController.create({
			component: POSDiscountModalPage,
			canDismiss: true,
			backdropDismiss: true,
			cssClass: 'modal-change-table',
			componentProps: {
				Discount: discount,
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
			this.loadData();
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
		if (this.item._Customer.Id == PAYMENT_CONFIG.WALKIN_CUSTOMER_ID) {
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
				// Cancel entire order using POSOrderService
				this.env
					.showPrompt('Bạn có chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng')
					.then(async (_) => {
						try {
							this.submitAttempt = true;
							await this.posOrderService.deleteOrder(this.item.Id);
							
							this.env.publishEvent({ Code: this.pageConfig.pageName });
							this.loadData();
							this.nav('/pos-order', 'back');
						} catch (error) {
							this.handleApiError(error, 'Cannot cancel order');
						} finally {
							this.submitAttempt = false;
						}
					})
					.catch((_) => {});
			} else {
				// Cancel specific line items - keep existing logic for now
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
					.then(async (_) => {
						try {
							this.submitAttempt = true;

							await this.pageProvider.commonService
								.connect('POST', 'SALE/Order/CancelReduceOrderLines/', cancelData)
								.toPromise();

							this.env.publishEvent({ Code: this.pageConfig.pageName });
							this.loadData();
						} catch (error) {
							this.handleApiError(error, 'Cannot cancel item');
						} finally {
							this.submitAttempt = false;
						}
					})
					.catch((_) => {});
			}
		}
	}

	private async sendKitchenWithPrompt() {
		if (!this.item.OrderLines.some((i) => i._undeliveredQuantity > 0)) {
			return; // No items to send
		}

		try {
			await this.env.showPrompt('Do you want to send the print command to the bar/kitchen?', null, null, 'Print', 'Skip');
			await this.sendKitchen();
		} catch (error) {
			// User cancelled or other error
			console.log('Kitchen send cancelled or failed:', error);
		}
	}

	saveOrderData() {
		this.setOrderValue({}, true);
		this.sendKitchenWithPrompt();
	}

	async sendKitchen() {
		try {
			await this.posPrintService.sendKitchen(
				this.item,
				this.item.OrderLines,
				(kitchenId) => this.setKitchenID(kitchenId),
				(itemId) => this.setItemQuery(itemId),
				(data, forceSave, autoSave) => this.setOrderValue(data, forceSave, autoSave)
			);
		} catch (error) {
			console.error('Error in sendKitchen:', error);
			this.env.showMessage('Cannot send to kitchen/bar. Please try again!', 'danger');
		}
	}

	printPrepare(element, printers, jobName = '') {
		let content = document.getElementById(element);
		let optionPrinters = printers.map((printer) => {
			return {
				printer: printer.Code,
				host: printer.Host,
				port: printer.Port,
				isSecure: printer.IsSecure,
				jobName: jobName ? jobName : printer.Code + '-' + this.item.Id,
			};
		});
		let data: printData = {
			content: content?.outerHTML,
			type: 'html',
			options: optionPrinters,
			IDJob: jobName ? jobName : `print-${this.item.Id}-${Date.now()}`,
		};
		return data;
	}

	async sendPrint(Status?, receipt = true, sendEachItem = false) {
		try {
			const result = await this.posPrintService.sendPrint(
				this.item,
				this.defaultPrinter,
				(kitchenId) => this.setKitchenID(kitchenId),
				(itemId) => this.setItemQuery(itemId),
				Status
			);

			if (result) {
				this.checkData(receipt, !receipt, sendEachItem);
			}

			return result;
		} catch (error) {
			console.error('Error in sendPrint:', error);
			this.env.showMessage('Print failed. Please try again!', 'danger');
			return false;
		}
	}

	private async toggleOrderStatus(status: string, isLocked: boolean, shouldCheckKitchen: boolean = false) {
		this.submitLockOrderAttempt = true;

		if (shouldCheckKitchen) {
			this.sendKitchenWithPrompt();
		}

		try {
			// Use POSOrderService for status toggle
			const updatedOrder = await this.posOrderService.updateOrder(this.item.Id, { 
				Status: status
			});

			// Update local state
			this.item.Status = status;
			this.item._Locked = isLocked;
			this.pageConfig.canEdit = !isLocked;
			isLocked ? this.formGroup?.disable() : this.formGroup?.enable();
			this.cdr.detectChanges();

			// Handle specific status actions
			if (status === 'TemporaryBill') {
				this.getQRPayment(updatedOrder);
			}
		} catch (error) {
			console.error('Toggle order status failed:', error);
			this.env.showMessage('Failed to change order status. Please try again.', 'danger');
			this.loadData();
		} finally {
			this.submitLockOrderAttempt = false;
		}
	}

	async unlockOrder() {
		await this.toggleOrderStatus('Scheduled', false);
	}

	submitLockOrderAttempt = false;
	async lockOrder() {
		await this.toggleOrderStatus('TemporaryBill', true, true);
	}

	getQRPayment(payment) {
		if (payment) this.GenQRCode(payment.Code);
	}

	GenQRCode(code: string) {
		// Input validation
		if (!code || typeof code !== 'string') {
			console.warn('GenQRCode: Invalid code provided');
			this.VietQRCode = null;
			return;
		}

		// Reset QR code
		this.VietQRCode = null;

		try {
			QRCode.toDataURL(code, PAYMENT_CONFIG.QR_CONFIG, (err, url) => {
				if (err) {
					console.error('QR Code generation error:', err);
					this.env.showMessage('Failed to generate QR code', 'warning');
					return;
				}

				this.VietQRCode = url;
			});

			// Auto-print if enabled
			if (this.posService.systemConfig?.POSEnableTemporaryPayment && this.posService.systemConfig?.POSEnablePrintTemporaryBill) {
				this.sendPrint('TemporaryBill');
			}
		} catch (error) {
			console.error('GenQRCode error:', error);
			this.env.showMessage('QR Code generation failed', 'danger');
		}
	}

	VietQRCode: string | null = null;

	////PRIVATE METHODS

	private handleApiError(error: any, message: string = 'Operation failed. Please try again!'): void {
		console.error(error);
		this.env.showMessage(message, 'danger');
	}

	private async createModal(component: any, props: any, cssClass: string = '', modalId?: string) {
		return this.modalController.create({
			component,
			componentProps: props,
			cssClass,
			canDismiss: true,
			backdropDismiss: true,
			id: modalId,
		});
	}

	// Group order lines by item for printing bill
	getGroupedOrderLines() {
		return this.cartService.getGroupedOrderLines();
	}

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
		// Use cart service to load order
		this.cartService.loadOrderFromData(this.item);

		// Copy printData from cart service for page-specific access
		this.printData = this.cartService.printData;

		// Page specific data
		if (this.item._Locked) {
			this.pageConfig.canEdit = false;
			this.formGroup?.disable();
		} else {
			this.pageConfig.canEdit = true;
		}

		this.UpdatePrice();
	}

	// State management for save operations
	nextSaveData = null;

	setOrderValue(data, forceSave = false, autoSave = null) {
		// Delegate to cart service for order value management
		return this.cartService.setOrderValue(data, forceSave, autoSave);
	}
	async saveChange() {
		//if(!(this.formGroup.controls.OrderLines.dirty || this.formGroup.dirty)) return;
		this.isWaitingRefresh = true;
		console.log('🔄 POSOrderDetail: Starting save operation via POSOrderService');
		
		try {
			// Use POSOrderService for order operations
			const orderData = this.formGroup.getRawValue();
			if (this.item?.Id) {
				// Update existing order
				const updatedOrder = await this.posOrderService.updateOrder(this.item.Id, orderData);
				this.savedChange(updatedOrder, this.formGroup);
			} else {
				// Create new order
				const newOrder = await this.posOrderService.createOrder(orderData);
				this.savedChange(newOrder, this.formGroup);
			}
		} catch (error) {
			this.handleApiError(error, 'Save operation failed');
			this.isWaitingRefresh = false;
			this.submitAttempt = false;
		}
	}

	savedChange(savedItem?: any, form?: FormGroup<any>): void {
		console.log('saved change');

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
		this.isWaitingRefresh = false;
		this.submitAttempt = false;
		if (this.nextSaveData) {
			console.log('Save next');
			this.setOrderValue(this.nextSaveData, true);
			this.nextSaveData = null;
		} else {
			this.loadedData();
			this.env.showMessage('Saving completed!', 'success');
		}
		// Remove manual CheckPOSNewOrderLines call - now handled by service
	}

	getPromotionProgram() {
		this.cartService
			.getPromotionPrograms()
			.then((data: any) => {
				// Data is automatically set in cart service via discount service
				console.log('Promotion programs loaded:', data);
			})
			.catch((err) => {
				console.log(err);
			});
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

		// Use cart service for discount calculation
		try {
			const orderData = this.cartService.applySalesmanDiscount(line, OriginalDiscountFromSalesman);
			this.setOrderValue(orderData);
		} catch (error) {
			this.env.showMessage(error.message, 'danger');
			return false;
		}
	}

	private async getPayments() {
		try {
			// Use POSSecurityService with error recovery
			const result: any = await this.posSecurityService.executeWithRecovery(
				async () => {
					return await this.commonService
						.connect('GET', 'BANK/IncomingPaymentDetail', {
							IDSaleOrder: this.item.Id,
						})
						.toPromise();
				},
				'Error loading payment information'
			);

			this.paymentList = result;
			this.paymentList.forEach((e) => {
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

			if (this.posService.systemConfig.POSSettleAtCheckout && Math.abs(this.item.Debt) < PAYMENT_CONFIG.MIN_DEBT_THRESHOLD && this.item.Status != 'Done') {
				this.env.showMessage('The order has been paid, the system will automatically close this bill.');
				this.formGroup.enable();
				this.doneOrder();
			}
			return this.paymentList;
		} catch (error) {
			this.handleApiError(error, 'Error loading payment information');
			throw error;
		}
	}

	doneOrder() {
		let changed: any = { OrderLines: [] };
		
		// Use cart service to check undelivered items
		const undeliveredItems = this.cartService.getUndeliveredItems();
		const undeliveredCount = undeliveredItems.length;
		
		if (undeliveredCount > 0) {
			let message = `Bàn số {{value}} có {{value1}} sản phẩm chưa gửi bar/bếp. Bạn hãy gửi bar/bếp và hoàn tất.`;
			if (this.item.Debt > 0) {
				message = `Bàn số {{value}} có {{value1}} sản phẩm chưa gửi bar/bếp và đơn hàng chưa thanh toán xong. Bạn hãy gửi bar/bếp và hoàn tất.`;
			}
			this.env.showPrompt({ code: message, value: this.item.Tables[0], value1: undeliveredCount }, null, 'Thông báo', 'GỬI', null).then((_) => {
				// Mark all items as delivered in cart service
				const itemIds = undeliveredItems.map(item => item.Id).filter(id => id);
				this.cartService.markItemsAsDelivered(itemIds);
				
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

	deleteVoucher(p) {
		this.cartService
			.deleteVoucher(p)
			.then(() => {
				this.env.showMessage('Saving completed!', 'success');
				this.loadData();
			})
			.catch((err) => this.handleApiError(err, 'Cannot save, please try again!'));
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
			resolve(true);
		});
	}

	applyDiscount() {
		const discount = this.cartService.getCurrentDiscount();
		if (!discount) {
			this.env.showMessage('No discount data available', 'warning');
			return;
		}

		this.cartService
			.applyDiscount(discount.Percent)
			.then((result) => {
				this.env.showMessage('Saving completed!', 'success');
				this.loadData();
			})
			.catch((err) => this.handleApiError(err, 'Cannot save, please try again!'));
	}

	async scanQRCode() {
		try {
			// Input validation for scanner service
			if (!this.scanner) {
				this.env.showMessage('QR Scanner not available', 'danger');
				return;
			}

			const code = await this.scanner.scan();

			if (!code || typeof code !== 'string') {
				throw new Error('Invalid QR code data');
			}

			// Check if it's a valid staff VCARD
			if (!code.includes('VCARD;')) {
				throw new Error('Invalid QR code format');
			}

			const tempString = code.substring(code.indexOf('VCARD;') + 6);
			const parts = tempString.split(';');

			if (parts.length < 2) {
				throw new Error('Incomplete QR code data');
			}

			const StaffCode = parts[0];
			const QRGenTime = parts[1];

			// Validate time window
			const currentTime = new Date();
			const tolerance = PAYMENT_CONFIG.TIME_TOLERANCE_MINUTES;
			const fromTime = new Date(currentTime.getTime() - tolerance * 60000);
			const toTime = new Date(currentTime.getTime() + tolerance * 60000);

			const currentTimeFrom = lib.dateFormat(fromTime, 'dd/mm/yyyy') + ' ' + lib.dateFormat(fromTime, 'hh:MM');
			const currentTimeTo = lib.dateFormat(toTime, 'dd/mm/yyyy') + ' ' + lib.dateFormat(toTime, 'hh:MM');

			if (!(currentTimeFrom <= QRGenTime && QRGenTime <= currentTimeTo)) {
				this.env.showMessage('Code has expired, please get a new staff code! QR code generated at: {{value}}', 'danger', QRGenTime);

				// Offer retry
				const retry = await this.env.showPrompt('QR Code expired', 'Would you like to try again?', null, 'Retry', 'Cancel').catch(() => false);

				if (retry) {
					setTimeout(() => this.scanQRCode(), 0);
				}
				return;
			}

			// Fetch staff data with validation
			const resp: any = await this.contactProvider.read({ Code: StaffCode, Take: 20 });

			if (!resp?.data?.[0]?.Addresses?.[0]) {
				throw new Error('Staff not found or invalid data');
			}

			const address = resp.data[0];
			address.IDAddress = address.Addresses[0].Id;
			address.Address = address.Addresses[0];

			// Update UI
			this.env.showMessage('Quét thành công! Họ và Tên: {{value}}', null, address.Name);
			this._contactDataSource.selected.push(address);
			this.changedIDAddress(address);
			this._contactDataSource.initSearch();
			this.cdr.detectChanges();

			// Auto-save
			await this.saveChange();
		} catch (error) {
			console.error('scanQRCode error:', error);

			const retry = await this.env.showPrompt('QR Code Error', 'Please scan a valid QR code. Try again?', null, 'Retry', 'Cancel').catch(() => false);

			if (retry) {
				setTimeout(() => this.scanQRCode(), 0);
			}
		}
	}
}
