import { Injectable } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { CRM_ContactProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { POS_Order } from './interface.model';
import { EnvService } from 'src/app/services/core/env.service';
import { lib } from 'src/app/services/static/global-functions';
import { POSConstants } from './pos.constants';
import { environment } from 'src/environments/environment';
import { BehaviorSubject } from 'rxjs';
import { POSEnviromentDataService } from './pos-env-data.service';
import { SYS_ConfigService } from 'src/app/services/custom/system-config.service';
import { POSDiscountService } from './pos-discount.service';

@Injectable({
	providedIn: 'root',
})
export class POSCartService {
	menuList: any[];
	item: POS_Order;
	Discount: any;
	formGroup: FormGroup;

	// Emergency Fix: Validation methods
	private validateOrderData(): boolean {
		if (!this.item) {
			console.error('POSCartService: Order item is null or undefined');
			return false;
		}
		
		if (!this.item.OrderLines || !Array.isArray(this.item.OrderLines)) {
			console.error('POSCartService: OrderLines is null or not an array');
			return false;
		}
		
		return true;
	}

	private validateFormGroup(): boolean {
		if (!this.formGroup) {
			console.error('POSCartService: FormGroup is not initialized');
			return false;
		}
		return true;
	}

	// Emergency Fix: Error handling methods
	private async handleApiError(error: any, context: string): Promise<void> {
		console.error(`POSCartService Error in ${context}:`, error);
		
		// Network errors
		if (error.status === 0 || !navigator.onLine) {
			this.env.showMessage('Network connection failed. Please check your connection.', 'danger');
			return;
		}
		
		// Server errors
		if (error.status >= 500) {
			this.env.showMessage('Server error. Please try again later.', 'danger');
			return;
		}
		
		// Client errors
		if (error.status >= 400) {
			this.env.showMessage(error.message || 'Request failed. Please check your data.', 'warning');
			return;
		}
		
		// Generic error
		this.env.showMessage('An unexpected error occurred in cart service.', 'danger');
	}

	private async safeApiCall<T>(
		apiCall: () => Promise<T>, 
		context: string, 
		fallbackValue?: T
	): Promise<T | null> {
		try {
			return await apiCall();
		} catch (error) {
			await this.handleApiError(error, context);
			return fallbackValue || null;
		}
	}
	
	// Properties từ page
	noLockStatusList = POSConstants.NO_LOCK_STATUS_LIST;
	noLockLineStatusList = POSConstants.NO_LOCK_LINE_STATUS_LIST;
	printData = {
		undeliveredItems: [], //To track undelivered items to the kitchen
		printDate: null,
		currentBranch: null,
		selectedTables: [],
	};
	
	// System config and data source
	systemConfig: any = {
		IsAutoSave: true
	};
	dataSource: any = {
		menuList: [],
		orderDetailStatusList: [],
		tableList: []
	};
	
	// State management
	private itemSubject = new BehaviorSubject<POS_Order>(null);
	public item$ = this.itemSubject.asObservable();
	
	// Emergency Fix: Race condition protection
	private isSaving = false;
	private saveQueue: Array<() => Promise<void>> = [];
	private debounceTimer: any = null;
	
	isWaitingRefresh = false;
	nextSaveData = null;
	delay = 1000;
	alwaysReturnProps = ['Id', 'IDBranch', 'Code'];

	constructor(
		public saleOrderProvider: SALE_OrderProvider,
		public contactProvider: CRM_ContactProvider,
		public env: EnvService,
		public formBuilder: FormBuilder,
		public dataSourceService: POSEnviromentDataService,
		public sysConfigService: SYS_ConfigService,
		public discountService: POSDiscountService
	) {}

	// Emergency Fix: Cleanup method để prevent memory leaks
	ngOnDestroy(): void {
		this.cleanup();
	}

	cleanup(): void {
		// Clear timers
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Clear queued operations
		this.saveQueue = [];
		
		// Reset flags
		this.isSaving = false;
		this.isWaitingRefresh = false;
		
		// Complete BehaviorSubject
		if (this.itemSubject) {
			this.itemSubject.complete();
		}
	}

	// Initialize system config and data source
	initializeConfig(systemConfig: any, dataSource: any): void {
		this.systemConfig = systemConfig;
		this.dataSource = dataSource;
		
		// Initialize discount service with data source
		this.discountService.setOrderAdditionTypeList(dataSource.orderAdditionTypeList || []);
		this.discountService.setOrderDeductionTypeList(dataSource.orderDeductionTypeList || []);
	}

	// Initialize form group cho cart service
	initializeForm(idTable: number): FormGroup {
		this.formGroup = this.formBuilder.group({
			Id: new FormControl({ value: 0, disabled: true }),
			Code: [],
			Name: [],
			Remark: [],
			OrderLines: this.formBuilder.array([]),
			DeletedLines: [[]],
			Additions: this.formBuilder.array([]),
			Deductions: this.formBuilder.array([]),
			Tables: [[idTable], Validators.required],
			IDBranch: [this.env.selectedBranch],
			IDOwner: [this.env.user.StaffID],
			IDContact: [null],
			IDAddress: [null],
			Type: [POSConstants.ORDER_TYPES.POS_ORDER],
			SubType: [POSConstants.ORDER_TYPES.TABLE_SERVICE],
			Status: new FormControl({ value: POSConstants.ORDER_STATUS.NEW, disabled: true }),
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

		return this.formGroup;
	}

	loadOrder() {
		this.item = { OrderLines: [] };
	}

	async addToCart(
		item: any, 
		idUoM: number, 
		quantity = 1, 
		idx = -1, 
		status = '',
		pageConfig: any,
		submitAttempt: boolean,
		openCancellationReasonCallback?: Function
	): Promise<boolean> {
		// Emergency Fix: Enhanced validation
		if (!this.validateOrderData()) {
			return false;
		}
		
		if (!item) {
			console.error('POSCartService: Item is null or undefined');
			this.env.showMessage('Invalid item data', 'danger');
			return false;
		}

		if (!pageConfig) {
			console.error('POSCartService: PageConfig is null or undefined');
			this.env.showMessage('Invalid page configuration', 'danger');
			return false;
		}
		
		if (item.IsDisabled) {
			return false;
		}
		
		if (submitAttempt) {
			let element = document.getElementById('item' + item.Id);
			if (element && element.parentElement) { // Emergency Fix: Check parentElement exists
				element = element.parentElement;
				element.classList.add('shake');
				setTimeout(() => {
					element.classList.remove('shake');
				}, 400);
			}
			return false;
		}

		if (!pageConfig.canAdd) {
			this.env.showMessage('You do not have permission to add products!', 'warning');
			return false;
		}

		if (!pageConfig.canEdit || this.item.Status == 'TemporaryBill') {
			this.env.showMessage('The order is locked, you cannot edit or add items!', 'warning');
			return false;
		}

		// Emergency Fix: Enhanced table validation
		const tables = (this.item as any).Tables;
		if (!tables || !Array.isArray(tables) || tables.length === 0) {
			this.env.showMessage('Please select a table before adding items!', 'warning');
			return false;
		}

		// Emergency Fix: Enhanced UoM validation
		if (!item.UoMs || !Array.isArray(item.UoMs) || item.UoMs.length === 0) {
			this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
			return false;
		}

		const uom = item.UoMs.find((d) => d && d.Id == idUoM);
		if (!uom) {
			this.env.showMessage('Invalid unit of measure for this item', 'danger');
			return false;
		}

		if (!uom.PriceList || !Array.isArray(uom.PriceList)) {
			this.env.showMessage('Price information is not available for this item', 'danger');
			return false;
		}

		const price = uom.PriceList.find((d) => d && d.Type == 'SalePriceList');
		if (!price) {
			this.env.showMessage('Sale price is not available for this item', 'danger');
			return false;
		}

		let line;
		if (quantity == 1) {
			line = this.item.OrderLines?.find((d) => d && d.IDUoM == idUoM && d.Status == 'New'); // Emergency Fix: Check line exists
		} else {
			line = this.item.OrderLines?.[idx]; //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
		}

		if (!line) {
			line = {
				IDOrder: this.item.Id,
				Id: 0,
				Code: lib.generateUID(this.env.user.Id),
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

			this.item.OrderLines?.push(line);
			this.addOrderLine(line);
			await this.setOrderValue({ OrderLines: [line], Status: 'New' });
		} else {
			if (line.Quantity > 0 && line.Quantity + quantity < line.ShippedQuantity) {
				if (pageConfig.canDeleteItems) {
					try {
						await this.env.showPrompt('Item này đã chuyển Bar/Bếp, bạn chắc muốn giảm số lượng sản phẩm này?', item.Name, 'Xóa sản phẩm');
						if (openCancellationReasonCallback) {
							openCancellationReasonCallback(line, quantity);
						}
					} catch {
						// User cancelled
						return false;
					}
				} else {
					this.env.showMessage('Item has been sent to Bar/Kitchen');
					return false;
				}
			} else if (line.Quantity + quantity > 0) {
				line.Quantity += quantity;
				await this.setOrderValue({
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
					try {
						await this.env.showPrompt('Bạn có chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm');
						line.Quantity += quantity;
						await this.setOrderValue({
							OrderLines: [
								{
									Id: line.Id,
									Code: line.Code,
									IDUoM: line.IDUoM,
									Quantity: line.Quantity,
								},
							],
						});
					} catch {
						// User cancelled
						return false;
					}
				} else {
					if (pageConfig.canDeleteItems) {
						try {
							await this.env.showPrompt('Bạn có chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm');
							line.Quantity += quantity;
							await this.setOrderValue({
								OrderLines: [
									{
										Id: line.Id,
										Code: line.Code,
										IDUoM: line.IDUoM,
										Quantity: line.Quantity,
									},
								],
							});
						} catch {
							// User cancelled
							return false;
						}
					} else {
						this.env.showMessage('This account does not have permission to delete products!', 'warning');
						return false;
					}
				}
			}
		}
		
		return true;
	}

	// Add order line to FormArray
	private addOrderLine(line: any): void {
		if (!this.formGroup) {
			console.warn('FormGroup is not initialized in cart service');
			return;
		}
		
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
		});
		groups.push(group);
	}

	// Public method to calculate order from outside
	calculateOrder(): void {
		this.calcOrder();
	}

	// Public method to patch order lines to form
	patchOrderLinesValue(): void {
		if (!this.formGroup) {
			console.warn('FormGroup is not initialized in cart service');
			return;
		}
		
		this.formGroup.controls.OrderLines = new FormArray([]);
		if (this.item?.OrderLines?.length) {
			for (let i of this.item.OrderLines) {
				this.addOrderLine(i);
			}
		}
	}

	// Set order value and handle form updates
	async setOrderValue(data: any, forceSave = false, autoSave = null): Promise<void> {
		// Emergency Fix: Add validation
		if (!data) {
			console.warn('POSCartService: setOrderValue called with null/undefined data');
			return;
		}

		if (!this.validateFormGroup()) {
			console.error('POSCartService: Cannot set order value - FormGroup not initialized');
			return;
		}

		if (!this.validateOrderData()) {
			console.error('POSCartService: Cannot set order value - Order data invalid');
			return;
		}

		console.log('Save', data);
		if (this.isWaitingRefresh) {
			if (this.nextSaveData) {
				this.nextSaveData = Object.assign(this.nextSaveData, data);
			} else {
				this.nextSaveData = data;
			}
			console.log('Saving change, move to next round', this.nextSaveData);
			return;
		}
		else if(this.nextSaveData){
			data = Object.assign(data, this.nextSaveData);
			this.nextSaveData = null;
		}

		for (const c in data) {
			if (!data.hasOwnProperty(c)) continue; // Emergency Fix: Check property exists
			
			if (c == 'OrderLines' || c == 'OrderLines') {
				let fa = <FormArray>this.formGroup.controls.OrderLines;
				
				// Emergency Fix: Validate FormArray
				if (!fa) {
					console.error('POSCartService: OrderLines FormArray not found');
					continue;
				}

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
						this.item.OrderLines?.splice(idx, 1);
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

					// Add shake effect if numberOfGuestsInput is available
					if (this.numberOfGuestsInput) {
						const parentElement = this.numberOfGuestsInput.nativeElement?.parentElement;
						if (parentElement) {
							parentElement.classList.add('shake');
							setTimeout(() => {
								parentElement.classList.remove('shake');
							}, 2000);
						}
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
		if (forceSave) {
			await this.saveChange();
		} else {
			if (autoSave === null) autoSave = this.systemConfig?.IsAutoSave;
			if ((this.item?.OrderLines?.length || this.formGroup?.controls?.DeletedLines?.value?.length) && autoSave) {
				this.debounce(() => {
					this.delay = 1000; // reset
					this.saveChange();
				}, this.delay);
			}
		}
	}

	// Callback for save change
	public saveChangeCallback: Function;
	public numberOfGuestsInput: any; // Reference to the input element
	
	// Debounce function for auto-save
	private debounce(func: Function, wait: number): void {
		clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(func, wait);
	}

	// Save changes to server
	// Emergency Fix: Safe save with race condition protection
	async saveChange(): Promise<any> {
		if (!this.validateFormGroup()) {
			return Promise.reject('FormGroup is not initialized');
		}

		if (this.isSaving) {
			// Queue the save operation
			return new Promise((resolve, reject) => {
				this.saveQueue.push(async () => {
					try {
						const result = await this.performSave();
						resolve(result);
					} catch (error) {
						reject(error);
					}
				});
			});
		}
		
		return this.performSave();
	}

	private async performSave(): Promise<any> {
		this.isSaving = true;
		this.isWaitingRefresh = true;
		console.log('isWaitingRefresh from saveChange');
		
		try {
			let result;
			if (this.saveChangeCallback) {
				result = await this.safeApiCall(
					() => this.saveChangeCallback(), 
					'saveChangeCallback'
				);
			} else {
				result = await this.safeApiCall(
					() => this.saveChange2(), 
					'saveChange2'
				);
			}
			
			// Process queued saves
			while (this.saveQueue.length > 0) {
				const queuedSave = this.saveQueue.shift();
				if (queuedSave) {
					await queuedSave();
				}
			}
			
			return result;
		} finally {
			this.isSaving = false;
			this.isWaitingRefresh = false;
		}
	}

	// Internal save method
	private async saveChange2(): Promise<any> {
		try {
			// Implement actual save logic here  
			const result = await this.saleOrderProvider.save(this.formGroup.value);
			this.savedChange(result, this.formGroup);
			return result;
		} catch (error) {
			this.isWaitingRefresh = false;
			throw error;
		}
	}

	// Handle saved changes callback
	savedChange(savedItem?: any, form?: FormGroup<any>): void {
		console.log('saved change');
		
		if (savedItem) {
			if (form.controls.Id && savedItem.Id && form.controls.Id.value != savedItem.Id) {
				form.controls.Id.setValue(savedItem.Id);
			}
			
			// Update item with saved data
			Object.assign(this.item, savedItem);
			this.itemSubject.next(this.item);
		}
		
		this.isWaitingRefresh = false;
		if (this.nextSaveData) {
			this.setOrderValue(this.nextSaveData);
			this.nextSaveData = null;
		} else {
			// Mark form as pristine after save
			form.markAsPristine();
		}
	}


	private calcOrder() {
		if (!this.item) {
			console.warn('Item is not initialized in cart service');
			return;
		}
		
		// Use discount service to get discount data
		this.Discount = this.discountService.discount || {
			Amount: 0,
			Percent: 0,
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

		for (let m of this.dataSource.menuList) 
			for (let mi of m.Items) 
				mi.BookedQuantity = 0;

		for (let line of this.item.OrderLines) {
			line._serviceCharge = 0;
			if (
				this.item.IDBranch == 174 || //W-Cafe
				this.item.IDBranch == 17 || //The Log
				this.item.IDBranch == 765 || //26 Cao Thang
				this.item.IDBranch == 416 || //Gem Cafe && set menu  && line._item.IDMenu == 218
				this.item.IDBranch == 864 || //TEST
				this.env.branchList.find((d) => d.Id == this.item.IDBranch)?.Code == '145' //phindily code 145
			) {
				line._serviceCharge = 5;
			}

			//Parse data + Tính total
			line.UoMPrice = line.IsPromotionItem ? 0 : parseFloat(line.UoMPrice?.toString()) || 0;
			line.TaxRate = parseFloat(line.TaxRate?.toString()) || 0;
			line.Quantity = parseFloat(line.Quantity?.toString()) || 0;
			line.OriginalTotalBeforeDiscount = line.UoMPrice * line.Quantity;
			this.item.OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount;

			//line.OriginalPromotion
			line.OriginalDiscount1 = line.IsPromotionItem ? 0 : parseFloat(line.OriginalDiscount1?.toString()) || 0;
			line.OriginalDiscount2 = line.IsPromotionItem ? 0 : parseFloat(line.OriginalDiscount2?.toString()) || 0;
			line.OriginalDiscountByItem = line.OriginalDiscount1 + line.OriginalDiscount2;
			line.OriginalDiscountByGroup = 0;
			line.OriginalDiscountByLine = line.OriginalDiscountByItem + line.OriginalDiscountByGroup;
			line.OriginalDiscountByOrder = parseFloat(line.OriginalDiscountByOrder?.toString()) || 0;
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
			(line as any).AdditionsAmount = line.OriginalTotalAfterDiscount * (line._serviceCharge / 100.0);
			this.item.AdditionsAmount += (line as any).AdditionsAmount;
			this.item.AdditionsTax += line.CalcOriginalTotalAdditions - (line as any).AdditionsAmount;
			this.item.CalcOriginalTotalAdditions += line.CalcOriginalTotalAdditions;

			line.CalcTotalOriginal = line.OriginalTotalAfterTax + line.CalcOriginalTotalAdditions;
			this.item.CalcTotalOriginal += line.CalcTotalOriginal;
			line.OriginalDiscountFromSalesman = parseFloat(line.OriginalDiscountFromSalesman?.toString()) || 0;
			(line as any)._OriginalTotalAfterDiscountFromSalesman = line.CalcTotalOriginal - line.OriginalDiscountFromSalesman;

			this.item.OriginalDiscountFromSalesman += line.OriginalDiscountFromSalesman;

			//Lấy hình & hiển thị thông tin số lượng đặt hàng lên menu
			for (let m of this.dataSource.menuList)
				for (let mi of m.Items) {
					if (mi.Id == line.IDItem) {
						mi.BookedQuantity = this.item.OrderLines.filter((x) => x.IDItem == line.IDItem)
							.map((x) => x.Quantity)
							.reduce((a, b) => +a + +b, 0);
						(line as any)._item = mi;
					}
				}

			(line as any)._background = {
				'background-image': 'url("' + environment.posImagesServer + ((line as any)._item && (line as any)._item.Image ? (line as any)._item.Image : 'assets/pos-icons/POS-Item-demo.png') + '")',
			};

			//Tính số lượng item chưa gửi bếp
			(line as any)._undeliveredQuantity = line.Quantity - line.ShippedQuantity;
			if ((line as any)._undeliveredQuantity > 0) {
				this.printData.undeliveredItems.push(line);
				line.Status = 'New';
			}
			
			this.updateOrderLineStatus(line);

			(line as any)._Locked = (this.item as any)._Locked ? true : this.noLockLineStatusList.indexOf(line.Status) == -1;
			// Note: pageConfig.canDeleteItems check removed as it's page-specific
		}

		this.item.OriginalTotalDiscountPercent = parseFloat(((this.item.OriginalTotalDiscount / this.item.OriginalTotalBeforeDiscount) * 100.0).toFixed(0));
		this.item.OriginalTaxPercent = parseFloat((((this.item.OriginalTax + this.item.AdditionsTax) / (this.item.OriginalTotalAfterDiscount + this.item.AdditionsAmount)) * 100.0).toFixed(0));
		this.item.CalcOriginalTotalAdditionsPercent = parseFloat(((this.item.CalcOriginalTotalAdditions / this.item.OriginalTotalAfterTax) * 100.0).toFixed(0));
		this.item.AdditionsAmountPercent = parseFloat(((this.item.AdditionsAmount / this.item.OriginalTotalAfterDiscount) * 100.0).toFixed(0));
		this.item.OriginalDiscountFromSalesmanPercent = parseFloat(((this.item.OriginalDiscountFromSalesman / this.item.CalcTotalOriginal) * 100.0).toFixed(0));
		this.item.Debt = Math.round(this.item.CalcTotalOriginal - this.item.OriginalDiscountFromSalesman - this.item.Received);
		
		// Emit updated item
		this.itemSubject.next(this.item);
	}

	// Update order line status
	private updateOrderLineStatus(line: any): void {
		line.StatusText = lib.getAttrib(line.Status, this.dataSource.orderDetailStatusList, 'Name', '--', 'Code');
		line.StatusColor = lib.getAttrib(line.Status, this.dataSource.orderDetailStatusList, 'Color', '--', 'Code');
	}

	// Patch order value to form
	private patchOrderValue(): void {
		this.formGroup?.patchValue(this.item);
		this.patchOrderValue();
	}

	// Group order lines by item for printing bill
	getGroupedOrderLines(): any[] {
		if (!this.item?.OrderLines?.length) return [];

		const grouped = {};

		this.item.OrderLines.forEach((line) => {
			const key = `${line.IDItem}_${line.IDUoM}`;
			if (!grouped[key]) {
				grouped[key] = {
					...line,
					Quantity: 0,
					OriginalTotalBeforeDiscount: 0,
					CalcTotalOriginal: 0,
				};
			}
			
			grouped[key].Quantity += line.Quantity;
			grouped[key].OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount;
			grouped[key].CalcTotalOriginal += line.CalcTotalOriginal;
		});

		return Object.values(grouped);
	}

	// Load order with data and initialize printData
	loadOrderFromData(item: POS_Order): void {
		this.item = item;
		this.printData.undeliveredItems = [];
		this.printData.selectedTables = this.dataSource.tableList.filter((d) => (this.item as any).Tables?.indexOf(d.Id) > -1);
		this.printData.printDate = lib.dateFormat(new Date(), 'hh:MM dd/mm/yyyy');

		(this.item as any)._Locked = this.noLockStatusList.indexOf(this.item.Status) == -1;
		this.printData.currentBranch = this.env.branchList.find((d) => d.Id == this.item.IDBranch);

		// Initialize discount data
		this.discountService.initializeDiscount(this.item);

		this.calcOrder();
		this.itemSubject.next(this.item);
	}

	// =============== DISCOUNT & VOUCHER METHODS ===============

	/**
	 * Apply discount to order
	 */
	async applyDiscount(percent: number): Promise<any> {
		if (!this.item?.Id) {
			throw new Error('Order must be saved before applying discount');
		}

		try {
			const result = await this.discountService.applyDiscount(this.item.Id, percent);
			// Update discount data
			this.discountService.setDiscount({
				Amount: this.discountService.calculateDiscountAmount(percent, this.item.OriginalTotalBeforeDiscount),
				Percent: percent
			});
			this.calcOrder();
			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Apply discount from salesman to order line
	 */
	applySalesmanDiscount(line: any, discountAmount: number): any {
		try {
			// Validate discount amount
			this.discountService.validateSalesmanDiscount(line, discountAmount);
			
			// Return order line update data
			return {
				OrderLines: [{
					Id: line.Id,
					IDUoM: line.IDUoM,
					Code: line.Code,
					Remark: line.Remark,
					OriginalDiscountFromSalesman: discountAmount,
				}],
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get promotion programs for current order
	 */
	async getPromotionPrograms(): Promise<any[]> {
		if (!this.item?.Id) {
			return [];
		}

		try {
			return await this.discountService.getPromotionProgram(this.item.Id);
		} catch (error) {
			console.error('Error getting promotion programs:', error);
			return [];
		}
	}

	/**
	 * Delete voucher from order
	 */
	async deleteVoucher(program: any): Promise<boolean> {
		if (!this.item?.Id) {
			throw new Error('Order must be saved before deleting voucher');
		}

		try {
			const result = await this.discountService.deleteVoucher(program, this.item.Id);
			// Refresh promotion programs after deletion
			await this.getPromotionPrograms();
			return result;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get discount summary for current order
	 */
	getDiscountSummary() {
		return this.discountService.getDiscountSummary(this.item);
	}

	/**
	 * Check if order has any discounts applied
	 */
	hasDiscounts(): boolean {
		return this.discountService.hasDiscounts(this.item);
	}

	/**
	 * Validate discount before applying
	 */
	validateDiscount(discount: any): { isValid: boolean; message?: string } {
		return this.discountService.validateDiscount(discount, this.item);
	}

	/**
	 * Get current discount data
	 */
	getCurrentDiscount() {
		return this.discountService.discount;
	}

	/**
	 * Get applied promotion programs
	 */
	getAppliedPromotionPrograms() {
		return this.discountService.promotionAppliedPrograms;
	}

	/**
	 * Reset all discount data
	 */
	resetDiscounts() {
		this.discountService.resetDiscount();
		this.calcOrder();
	}

	// Get current item
	getCurrentItem(): POS_Order {
		return this.item;
	}

	// Get undelivered items count
	countUndeliveredItems(): number {
		if (!this.item?.OrderLines) return 0;
		return this.item.OrderLines.filter((d) => d.Status == 'New' || d.Status == 'Waiting')
			.map((x) => x.Quantity)
			.reduce((a, b) => +a + +b, 0);
	}

	// Get delivered items count
	countDeliveredItems(): number {
		if (!this.item?.OrderLines) return 0;
		return this.item.OrderLines.filter((d) => !(d.Status == 'New' || d.Status == 'Waiting'))
			.map((x) => x.Quantity)
			.reduce((a, b) => +a + +b, 0);
	}
}
