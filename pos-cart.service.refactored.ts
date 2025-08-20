import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, Subscription } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { POS_OrderDetail, POS_Order } from './interface.model';
import { POSOrderService } from './pos-order.service';
import { POSDiscountService } from './pos-discount.service';

@Injectable({
  providedIn: 'root'
})
export class POSCartService {
  private _cart$ = new BehaviorSubject<POS_OrderDetail[]>([]);
  private _total$ = new BehaviorSubject<number>(0);
  private _quantity$ = new BehaviorSubject<number>(0);
  private currentOrderSubscription?: Subscription;

  // Public observables
  cart$ = this._cart$.asObservable();
  total$ = this._total$.asObservable();  
  quantity$ = this._quantity$.asObservable();
  
  isEmpty$ = this.cart$.pipe(
    map(cart => cart.length === 0),
    distinctUntilChanged()
  );

  constructor(
    private posOrderService: POSOrderService,
    private posDiscountService: POSDiscountService
  ) {
    this.initializeCart();
  }

  private initializeCart() {
    // Sync with current order
    this.currentOrderSubscription = this.posOrderService.currentOrder$.subscribe(order => {
      if (order) {
        this.syncCartFromOrder(order.OrderLines || []);
      } else {
        this._cart$.next([]);
      }
    });

    // Update totals when cart changes
    combineLatest([
      this.cart$,
      this.posDiscountService.discount$
    ]).subscribe(([cart, discount]) => {
      this.calculateTotals(cart, discount);
    });
  }

  private syncCartFromOrder(orderLines: POS_OrderDetail[]) {
    this._cart$.next([...orderLines]);
  }

  private calculateTotals(cart: POS_OrderDetail[], discount: any = null) {
    let subtotal = 0;
    let quantity = 0;

    cart.forEach(item => {
      const itemTotal = (item.UoMPrice || 0) * (item.Quantity || 0);
      subtotal += itemTotal;
      quantity += item.Quantity || 0;
    });

    // Apply discount
    let total = subtotal;
    if (discount) {
      if (discount.Type === 'Percent') {
        total = subtotal * (1 - (discount.Value || 0) / 100);
      } else if (discount.Type === 'Amount') {
        total = subtotal - (discount.Value || 0);
      }
    }

    this._total$.next(Math.max(0, total));
    this._quantity$.next(quantity);
  }

  // Cart operations - delegate to POSOrderService
  async addToCart(item: any, quantity: number = 1): Promise<boolean> {
    try {
      // Get current order via observable
      const currentOrder = await this.getCurrentOrder();
      if (!currentOrder) {
        console.error('No active order to add items to');
        return false;
      }

      const orderDetail: POS_OrderDetail = {
        Id: 0,
        IDOrder: currentOrder.Id,
        IDItem: item.Id,
        UoMPrice: item.SalePrice || 0,
        Quantity: quantity,
        IDUoM: item.BaseUoM?.Id || 1,
        TotalDiscount: 0,
        TotalAfterDiscount: (item.SalePrice || 0) * quantity,
        IsDeleted: false,
        CreatedBy: currentOrder.CreatedBy || 'system',
        CreatedDate: new Date(),
        ModifiedBy: currentOrder.ModifiedBy || 'system',
        ModifiedDate: new Date(),
        _serviceCharge: 0
      };

      // Check if item already exists in cart
      const existingIndex = currentOrder.OrderLines?.findIndex(
        detail => detail.IDItem === item.Id
      ) ?? -1;

      if (existingIndex >= 0) {
        // Update existing item quantity
        const existingItem = currentOrder.OrderLines![existingIndex];
        existingItem.Quantity = (existingItem.Quantity || 0) + quantity;
        existingItem.TotalAfterDiscount = existingItem.UoMPrice * existingItem.Quantity;
        existingItem.ModifiedDate = new Date();
      } else {
        // Add new item
        if (!currentOrder.OrderLines) {
          currentOrder.OrderLines = [];
        }
        currentOrder.OrderLines.push(orderDetail);
      }

      // Save updated order
      await this.posOrderService.updateOrder(currentOrder.Code, { OrderLines: currentOrder.OrderLines });
      return true;
    } catch (error) {
      console.error('Error adding to cart:', error);
      return false;
    }
  }

  async updateLineQuantity(itemId: number, newQuantity: number): Promise<boolean> {
    try {
      const currentOrder = await this.getCurrentOrder();
      if (!currentOrder?.OrderLines) {
        return false;
      }

      const itemIndex = currentOrder.OrderLines.findIndex(
        detail => detail.IDItem === itemId
      );

      if (itemIndex === -1) {
        return false;
      }

      if (newQuantity <= 0) {
        // Remove item if quantity is 0 or negative
        currentOrder.OrderLines.splice(itemIndex, 1);
      } else {
        // Update quantity
        const item = currentOrder.OrderLines[itemIndex];
        item.Quantity = newQuantity;
        item.TotalAfterDiscount = item.UoMPrice * newQuantity;
        item.ModifiedDate = new Date();
      }

      await this.posOrderService.updateOrder(currentOrder.Code, { OrderLines: currentOrder.OrderLines });
      return true;
    } catch (error) {
      console.error('Error updating line quantity:', error);
      return false;
    }
  }

  async removeFromCart(itemId: number): Promise<boolean> {
    return this.updateLineQuantity(itemId, 0);
  }

  async clearCart(): Promise<boolean> {
    try {
      const currentOrder = await this.getCurrentOrder();
      if (!currentOrder) {
        return false;
      }

      currentOrder.OrderLines = [];
      await this.posOrderService.updateOrder(currentOrder.Code, { OrderLines: [] });
      return true;
    } catch (error) {
      console.error('Error clearing cart:', error);
      return false;
    }
  }

  // Helper to get current order
  private getCurrentOrder(): Promise<POS_Order | null> {
    return new Promise((resolve) => {
      this.posOrderService.currentOrder$.pipe(
        map(order => order),
      ).subscribe(order => {
        resolve(order);
      }).unsubscribe();
    });
  }

  // Utility methods
  getCartItems(): POS_OrderDetail[] {
    return this._cart$.value;
  }

  getCartTotal(): number {
    return this._total$.value;
  }

  getCartQuantity(): number {
    return this._quantity$.value;
  }

  isCartEmpty(): boolean {
    return this._cart$.value.length === 0;
  }

  // Form synchronization methods
  syncFormWithCart(formData: any) {
    // Sync form data with current cart state
    const cart = this.getCartItems();
    if (formData.items) {
      formData.items = cart;
    }
    formData.total = this.getCartTotal();
    formData.quantity = this.getCartQuantity();
  }

  validateCartBeforeCheckout(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const cart = this.getCartItems();

    if (cart.length === 0) {
      errors.push('Giỏ hàng trống');
    }

    cart.forEach((item, index) => {
      if (!item.Quantity || item.Quantity <= 0) {
        errors.push(`Sản phẩm tại vị trí ${index + 1} có số lượng không hợp lệ`);
      }
      if (!item.UoMPrice || item.UoMPrice < 0) {
        errors.push(`Sản phẩm tại vị trí ${index + 1} có giá không hợp lệ`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  ngOnDestroy() {
    if (this.currentOrderSubscription) {
      this.currentOrderSubscription.unsubscribe();
    }
  }
}
