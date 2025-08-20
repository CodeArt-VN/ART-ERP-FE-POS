import { Injectable } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, map, distinctUntilChanged, tap, takeUntil, Subject } from 'rxjs';
import { POS_Order, POS_OrderDetail } from './interface.model';
import { EnvService } from 'src/app/services/core/env.service';
import { POSOrderService } from './pos-order.service';
import { POSDiscountService } from './pos-discount.service';
import { lib } from 'src/app/services/static/global-functions';

@Injectable({
	providedIn: 'root',
})
export class POSCartService {
	// Form management
	formGroup: FormGroup;
	
	// UI State
	private _selectedTable = new BehaviorSubject<number | null>(null);
	private _isFormDirty = new BehaviorSubject<boolean>(false);
	private _canSaveOrder = new BehaviorSubject<boolean>(false);
	private destroy$ = new Subject<void>();
	
	// Public observables for UI
	public readonly selectedTable$ = this._selectedTable.asObservable();
	public readonly isFormDirty$ = this._isFormDirty.asObservable();
	public readonly canSaveOrder$ = this._canSaveOrder.asObservable();
	
	// Cart data streams from POSOrderService
	public readonly currentCart$: Observable<POS_Order | null>;
	public readonly cartLines$: Observable<POS_OrderDetail[]>;
	public readonly cartTotal$: Observable<number>;
	public readonly cartQuantity$: Observable<number>;
	public readonly isDirty$: Observable<boolean>;
	
	// Callback for save operations
	saveChangeCallback: (() => void) | null = null;

	constructor(
		private formBuilder: FormBuilder,
		private env: EnvService,
		private orderService: POSOrderService,
		public discountService: POSDiscountService
	) {
		// Setup data streams from OrderService
		this.currentCart$ = this.orderService.currentOrder$;
		this.isDirty$ = this.orderService.isDirty$;
		
		this.cartLines$ = this.currentCart$.pipe(
			map(order => order?.OrderLines || []),
			distinctUntilChanged()
		);
		
		this.cartTotal$ = this.currentCart$.pipe(
			map(order => order?.TotalAfterTax || 0),
			distinctUntilChanged()
		);
		
		this.cartQuantity$ = this.cartLines$.pipe(
			map(lines => lines.reduce((sum, line) => sum + (line.Quantity || 0), 0)),
			distinctUntilChanged()
		);
		
		// Subscribe to form changes
		this.setupFormSubscriptions();
	}

	// ========================
	// Form Management
	// ========================

	/**
	 * Initialize form for specific table
	 */
	initializeForm(tableId: number): FormGroup {
		this._selectedTable.next(tableId);
		
		this.formGroup = this.formBuilder.group({
			Id: [0],
			Code: [''],
			Status: ['New'],
			IDTable: [tableId],
			IDContact: [null],
			IDAddress: [null],
			NumberOfGuests: [1, Validators.min(1)],
			Remark: [''],
			OrderLines: this.formBuilder.array([]),
			Tables: [[]],
			OriginalDiscountFromSalesman: [0],
			IsInvoiceRequired: [false],
			TotalBeforeDiscount: [0],
			TotalDiscount: [0],
			TotalAfterDiscount: [0],
			Tax: [0],
			TotalAfterTax: [0],
			IDBranch: [this.env.selectedBranch],
			OrderDate: [new Date()],
			ModifiedDate: [new Date()],
			CreatedDate: [new Date()]
		});

		this.setupFormSubscriptions();
		
		console.log('✅ Cart form initialized for table:', tableId);
		return this.formGroup;
	}

	private setupFormSubscriptions(): void {
		if (!this.formGroup) return;
		
		// Track form dirty state
		this.formGroup.valueChanges.pipe(
			takeUntil(this.destroy$),
			map(() => this.formGroup.dirty),
			distinctUntilChanged()
		).subscribe(isDirty => {
			this._isFormDirty.next(isDirty);
		});

		// Track if order can be saved
		combineLatest([
			this.isFormDirty$,
			this.cartLines$
		]).pipe(
			takeUntil(this.destroy$),
			map(([isDirty, lines]) => {
				return isDirty || lines.some(line => 
					line.Status === 'New' || line.Status === 'Waiting'
				);
			}),
			distinctUntilChanged()
		).subscribe(canSave => {
			this._canSaveOrder.next(canSave);
		});
	}

	// ========================
	// Cart Operations (UI Layer)
	// ========================

	/**
	 * Add item to cart through OrderService
	 */
	async addToCart(
		item: any, 
		idUoM: number, 
		quantity: number = 1, 
		idx?: number, 
		status: string = 'New',
		pageConfig?: any,
		submitAttempt?: boolean,
		cancellationCallback?: (line: any, qty: number) => void
	): Promise<any> {
		try {
			if (submitAttempt) {
				console.log('⏳ Skipping add to cart - submit in progress');
				return;
			}

			const currentOrder = await this.getCurrentCartData();
			if (!currentOrder) {
				// Create new order if none exists
				const newOrder = await this.orderService.createOrder({
					IDTable: this._selectedTable.value,
					NumberOfGuests: 1,
					IDBranch: this.env.selectedBranch
				});
				await this.syncFormWithOrder(newOrder);
			}

			// Create order line
			const orderLine: Partial<POS_OrderDetail> = {
				Code: lib.generateUID(),
				IDItem: item.Id,
				IDUoM: idUoM,
				Quantity: quantity,
				UoMPrice: item.Price || 0,
				Status: status,
				Remark: '',
				IsDeleted: false
			};

			// Add line through OrderService
			const order = await this.getCurrentCartData();
			const updatedLines = [...(order?.OrderLines || []), orderLine as POS_OrderDetail];
			
			const updatedOrder = await this.orderService.updateOrder(order!.Code, {
				OrderLines: updatedLines
			});

			// Sync form with updated order
			await this.syncFormWithOrder(updatedOrder);
			
			// Trigger save callback if set
			if (this.saveChangeCallback) {
				this.saveChangeCallback();
			}

			console.log('✅ Item added to cart:', item.Name);
			return orderLine;

		} catch (error) {
			console.error('❌ Failed to add item to cart:', error);
			this.env.showMessage('Failed to add item to cart', 'danger');
			throw error;
		}
	}

	/**
	 * Update cart line quantity
	 */
	async updateLineQuantity(lineIndex: number, quantity: number): Promise<void> {
		try {
			const currentOrder = await this.getCurrentCartData();
			if (!currentOrder?.OrderLines?.[lineIndex]) return;

			const updatedLines = [...currentOrder.OrderLines];
			updatedLines[lineIndex] = {
				...updatedLines[lineIndex],
				Quantity: quantity
			};

			const updatedOrder = await this.orderService.updateOrder(currentOrder.Code, {
				OrderLines: updatedLines
			});

			await this.syncFormWithOrder(updatedOrder);

			if (this.saveChangeCallback) {
				this.saveChangeCallback();
			}

		} catch (error) {
			console.error('❌ Failed to update line quantity:', error);
			this.env.showMessage('Failed to update quantity', 'danger');
		}
	}

	/**
	 * Remove line from cart
	 */
	async removeLine(lineIndex: number): Promise<void> {
		try {
			const currentOrder = await this.getCurrentCartData();
			if (!currentOrder?.OrderLines?.[lineIndex]) return;

			const updatedLines = currentOrder.OrderLines.filter((_, index) => index !== lineIndex);

			const updatedOrder = await this.orderService.updateOrder(currentOrder.Code, {
				OrderLines: updatedLines
			});

			await this.syncFormWithOrder(updatedOrder);

			if (this.saveChangeCallback) {
				this.saveChangeCallback();
			}

		} catch (error) {
			console.error('❌ Failed to remove line:', error);
			this.env.showMessage('Failed to remove item', 'danger');
		}
	}

	/**
	 * Clear entire cart
	 */
	async clearCart(): Promise<void> {
		try {
			const currentOrder = await this.getCurrentCartData();
			if (!currentOrder) return;

			const clearedOrder = await this.orderService.updateOrder(currentOrder.Code, {
				OrderLines: [],
				TotalBeforeDiscount: 0,
				TotalDiscount: 0,
				TotalAfterDiscount: 0,
				Tax: 0,
				TotalAfterTax: 0
			});

			await this.syncFormWithOrder(clearedOrder);

			if (this.saveChangeCallback) {
				this.saveChangeCallback();
			}

			console.log('✅ Cart cleared');

		} catch (error) {
			console.error('❌ Failed to clear cart:', error);
			this.env.showMessage('Failed to clear cart', 'danger');
		}
	}

	// ========================
	// Form-Order Synchronization
	// ========================

	/**
	 * Sync form with order data
	 */
	private async syncFormWithOrder(order: POS_Order): Promise<void> {
		if (!this.formGroup || !order) return;

		try {
			// Update form values without triggering valueChanges
			this.formGroup.patchValue({
				Id: order.Id,
				Code: order.Code,
				Status: order.Status,
				IDContact: order.IDContact,
				IDAddress: order.IDAddress,
				NumberOfGuests: order.NumberOfGuests || 1,
				Remark: order.Remark,
				TotalBeforeDiscount: order.TotalBeforeDiscount,
				TotalDiscount: order.TotalDiscount,
				TotalAfterDiscount: order.TotalAfterDiscount,
				Tax: order.Tax,
				TotalAfterTax: order.TotalAfterTax
			}, { emitEvent: false });

			// Update OrderLines FormArray
			const orderLinesArray = this.formGroup.get('OrderLines') as FormArray;
			orderLinesArray.clear();

			(order.OrderLines || []).forEach(line => {
				const lineFormGroup = this.formBuilder.group({
					Id: [line.Id],
					Code: [line.Code],
					IDItem: [line.IDItem],
					IDUoM: [line.IDUoM],
					Quantity: [line.Quantity, [Validators.required, Validators.min(0)]],
					UoMPrice: [line.UoMPrice],
					TotalBeforeDiscount: [line.TotalBeforeDiscount],
					TotalDiscount: [line.TotalDiscount],
					TotalAfterDiscount: [line.TotalAfterDiscount],
					Status: [line.Status],
					Remark: [line.Remark],
					IsDeleted: [line.IsDeleted]
				});

				orderLinesArray.push(lineFormGroup);
			});

			// Mark form as pristine after sync
			this.formGroup.markAsPristine();

		} catch (error) {
			console.error('❌ Failed to sync form with order:', error);
		}
	}

	/**
	 * Get current cart data from OrderService
	 */
	private async getCurrentCartData(): Promise<POS_Order | null> {
		return new Promise((resolve) => {
			this.currentCart$.pipe(
				take(1)
			).subscribe(order => {
				resolve(order);
			});
		});
	}

	// ========================
	// Discount Integration
	// ========================

	/**
	 * Get current discount from discount service
	 */
	getCurrentDiscount(): any {
		return this.discountService.discount;
	}

	/**
	 * Get applied promotion programs
	 */
	getAppliedPromotionPrograms(): any[] {
		return this.discountService.promotionAppliedPrograms;
	}

	// ========================
	// Utility Methods
	// ========================

	/**
	 * Reset cart to initial state
	 */
	resetCart(): void {
		this._selectedTable.next(null);
		this._isFormDirty.next(false);
		this._canSaveOrder.next(false);
		
		if (this.formGroup) {
			this.formGroup.reset();
		}
		
		console.log('✅ Cart reset');
	}

	/**
	 * Get current selected table
	 */
	getCurrentTable(): number | null {
		return this._selectedTable.value;
	}

	/**
	 * Set selected table
	 */
	setSelectedTable(tableId: number): void {
		this._selectedTable.next(tableId);
	}

	/**
	 * Check if form is valid
	 */
	isFormValid(): boolean {
		return this.formGroup?.valid || false;
	}

	/**
	 * Get form validation errors
	 */
	getFormErrors(): any {
		if (!this.formGroup) return {};

		const formErrors: any = {};
		Object.keys(this.formGroup.controls).forEach(field => {
			const control = this.formGroup.get(field);
			if (control && !control.valid && control.touched) {
				formErrors[field] = control.errors;
			}
		});

		return formErrors;
	}

	// ========================
	// Missing Methods for Compatibility
	// ========================

	/**
	 * Initialize configuration (compatibility method)
	 */
	initializeConfig(systemConfig: any, dataSource: any): void {
		// Store config for later use
		this.systemConfig = systemConfig;
		this.dataSource = dataSource;
	}

	/**
	 * Patch order lines value (compatibility method)
	 */
	patchOrderLinesValue(): void {
		if (this.formGroup) {
			// Update form with current cart data - use observable
			this.orderService.currentOrder$.pipe(take(1)).subscribe(currentOrder => {
				if (currentOrder && currentOrder.OrderLines) {
					// Update formGroup with OrderLines if needed
					const orderLinesArray = this.formGroup.get('OrderLines') as FormArray;
					if (orderLinesArray) {
						// Clear and rebuild FormArray
						while (orderLinesArray.length !== 0) {
							orderLinesArray.removeAt(0);
						}
						currentOrder.OrderLines.forEach(line => {
							orderLinesArray.push(this.createOrderLineFormGroup(line));
						});
					}
				}
			});
		}
	}

	/**
	 * Count undelivered items (compatibility method)
	 */
	countUndeliveredItems(): number {
		let count = 0;
		this.orderService.currentOrder$.pipe(take(1)).subscribe(currentOrder => {
			if (currentOrder?.OrderLines) {
				count = currentOrder.OrderLines.filter(line => 
					!line.IsDeleted && (!line.ProductStatus || line.ProductStatus === 'New')
				).length;
			}
		});
		return count;
	}

	/**
	 * Count delivered items (compatibility method)
	 */
	countDeliveredItems(): number {
		let count = 0;
		this.orderService.currentOrder$.pipe(take(1)).subscribe(currentOrder => {
			if (currentOrder?.OrderLines) {
				count = currentOrder.OrderLines.filter(line => 
					!line.IsDeleted && line.ProductStatus === 'Delivered'
				).length;
			}
		});
		return count;
	}

	/**
	 * Create FormGroup for order line
	 */
	private createOrderLineFormGroup(line: POS_OrderDetail): FormGroup {
		return this.formBuilder.group({
			Id: [line.Id || 0],
			IDItem: [line.IDItem || 0],
			Quantity: [line.Quantity || 0, [Validators.required, Validators.min(1)]],
			UoMPrice: [line.UoMPrice || 0],
			TotalAfterDiscount: [line.TotalAfterDiscount || 0],
			IsDeleted: [line.IsDeleted || false],
			ProductStatus: [line.ProductStatus || 'New']
		});
	}

	// Store config and dataSource for compatibility
	private systemConfig: any;
	private dataSource: any;
	
	// Additional properties for compatibility
	item: any;
	numberOfGuestsInput: any;
	isWaitingRefresh: boolean = false;
	nextSaveData: any;
	printData: any = {
		undeliveredItems: [], //To track undelivered items to the kitchen
		printDate: null,
		currentBranch: null,
		selectedTables: [],
	};

	/**
	 * Get grouped order lines (compatibility method)
	 */
	getGroupedOrderLines(): any[] {
		let grouped: any[] = [];
		this.orderService.currentOrder$.pipe(take(1)).subscribe(currentOrder => {
			if (currentOrder?.OrderLines) {
				// Group by IDItem
				const groups = new Map();
				currentOrder.OrderLines.forEach(line => {
					if (!line.IsDeleted) {
						const key = line.IDItem?.toString() || '0';
						if (!groups.has(key)) {
							groups.set(key, {
								...line,
								totalQuantity: 0,
								lines: []
							});
						}
						const group = groups.get(key);
						group.totalQuantity += line.Quantity || 0;
						group.lines.push(line);
					}
				});
				grouped = Array.from(groups.values());
			}
		});
		return grouped;
	}

	/**
	 * Load order from data (compatibility method)
	 */
	loadOrderFromData(orderData: any): void {
		if (orderData) {
			this.item = orderData;
			// Set current order if it has a Code
			if (orderData.Code) {
				this.orderService.setCurrentOrder(orderData.Code);
			}
			// Update print data
			this.printData = orderData;
		}
	}

	/**
	 * Set order value (compatibility method)
	 */
	setOrderValue(data: any, forceSave: boolean = false, autoSave: boolean = true): Promise<any> {
		return new Promise((resolve, reject) => {
			try {
				if (data && data.Code) {
					// Update order via OrderService
					this.orderService.updateOrder(data.Code, data).then(updatedOrder => {
						this.item = updatedOrder;
						resolve(updatedOrder);
					}).catch(error => {
						console.error('Error updating order:', error);
						reject(error);
					});
				} else {
					// Create new order
					this.orderService.createOrder(data).then(newOrder => {
						this.item = newOrder;
						resolve(newOrder);
					}).catch(error => {
						console.error('Error creating order:', error);
						reject(error);
					});
				}
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Get promotion programs (compatibility method)
	 */
	getPromotionPrograms(): Promise<any[]> {
		return Promise.resolve(this.discountService.promotionAppliedPrograms);
	}

	/**
	 * Apply salesman discount (compatibility method)
	 */
	applySalesmanDiscount(line: any, discount: number): any {
		// Apply discount to line and return updated order data
		if (line && discount) {
			line.OriginalDiscountFromSalesman = discount;
			// Recalculate line totals
			const subtotal = (line.Quantity || 0) * (line.UoMPrice || 0);
			line.TotalAfterDiscount = subtotal - discount;
		}
		return this.item; // Return current order data
	}

	/**
	 * Delete voucher (compatibility method)
	 */
	deleteVoucher(voucher: any): Promise<boolean> {
		// Remove voucher and return success
		return Promise.resolve(true);
	}

	/**
	 * Apply discount (compatibility method)
	 */
	applyDiscount(discountPercent: number): Promise<any> {
		return new Promise((resolve) => {
			// Apply discount to current order
			if (this.item) {
				this.item.DiscountFromSalesman = discountPercent;
				// Update via order service if needed
				if (this.item.Code) {
					this.orderService.updateOrder(this.item.Code, {
						DiscountFromSalesman: discountPercent
					}).then(resolve).catch(resolve);
				} else {
					resolve(this.item);
				}
			} else {
				resolve(null);
			}
		});
	}

	// ========================
	// Cleanup
	// ========================

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}

// Helper function for take operator
function take<T>(count: number) {
	return (source: Observable<T>) => new Observable<T>(subscriber => {
		let taken = 0;
		const subscription = source.subscribe({
			next: value => {
				subscriber.next(value);
				taken++;
				if (taken >= count) {
					subscriber.complete();
				}
			},
			error: err => subscriber.error(err),
			complete: () => subscriber.complete()
		});

		return () => subscription.unsubscribe();
	});
}
