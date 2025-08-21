# POS Discount Service Refactoring

## Tổng quan

Đã tách thành công chức năng discount và voucher từ `pos-order-detail.page.ts` ra thành service riêng (`pos-discount.service.ts`) và tích hợp vào `pos-cart.service.ts` để có kiến trúc tốt hơn.

## Cấu trúc mới

### 1. POSDiscountService (`pos-discount.service.ts`)
Service độc lập chuyên xử lý các chức năng liên quan đến discount và voucher:

#### **Chức năng chính:**
- ✅ Quản lý discount data (Amount, Percent)
- ✅ Xử lý promotion programs
- ✅ Validate discount values
- ✅ Apply discount to order
- ✅ Handle voucher operations
- ✅ Calculate discount amounts/percentages

#### **Public Methods:**
```typescript
// Initialize
initializeDiscount(item: any): void
resetDiscount(): void

// Discount operations
applyDiscount(orderId: number, percent: number): Promise<any>
validateDiscount(discount: any, item: any): { isValid: boolean; message?: string }
validateSalesmanDiscount(line: any, discountAmount: number): boolean

// Calculations
calculateDiscountPercent(discountAmount: number, totalBeforeDiscount: number): number
calculateDiscountAmount(percent: number, totalBeforeDiscount: number): number

// Promotion/Voucher operations
getPromotionProgram(orderId: number): Promise<any[]>
deleteVoucher(program: any, orderId: number): Promise<boolean>

// Utilities
getDiscountSummary(item: any): object
hasDiscounts(item: any): boolean
```

### 2. POSCartService (`pos-cart.service.ts`) - Tích hợp Discount
Cart service hiện có thêm các chức năng discount thông qua POSDiscountService:

#### **Discount Methods đã thêm:**
```typescript
// Discount operations
applyDiscount(percent: number): Promise<any>
applySalesmanDiscount(line: any, discountAmount: number): any
resetDiscounts(): void

// Promotion/Voucher operations
getPromotionPrograms(): Promise<any[]>
deleteVoucher(program: any): Promise<boolean>

// Data access
getCurrentDiscount(): any
getAppliedPromotionPrograms(): any[]
getDiscountSummary(): object
hasDiscounts(): boolean
validateDiscount(discount: any): { isValid: boolean; message?: string }
```

### 3. POSOrderDetailPage - Refactored
Component đã được tối ưu:

#### **Đã loại bỏ:**
- ❌ `Discount` property 
- ❌ `promotionAppliedPrograms` property
- ❌ `OrderAdditionTypeList` property  
- ❌ `OrderDeductionTypeList` property
- ❌ `PR_ProgramProvider` dependency
- ❌ Direct API calls cho discount/voucher operations

#### **Đã thêm getter properties:**
```typescript
get Discount() // Truy cập discount qua cart service
get promotionAppliedPrograms() // Truy cập promotion qua cart service  
get OrderAdditionTypeList() // Truy cập qua discount service
get OrderDeductionTypeList() // Truy cập qua discount service
```

#### **Methods đã cập nhật:**
```typescript
// Sử dụng cart service thay vì xử lý trực tiếp
processDiscounts() // -> cart service
discountFromSalesman() // -> cart service.applySalesmanDiscount()
getPromotionProgram() // -> cart service.getPromotionPrograms()
deleteVoucher() // -> cart service.deleteVoucher()
applyDiscount() // -> cart service.applyDiscount()
```

## Migration Guide

### Trước khi refactor:
```typescript
// Trong component
this.Discount = { Amount: 100, Percent: 10 };
this.promotionAppliedPrograms = [];

// Direct API call
this.pageProvider.commonService.connect('POST', 'SALE/Order/UpdatePosOrderDiscount/', {...})
```

### Sau khi refactor:
```typescript
// Qua cart service
this.cartService.applyDiscount(10); // percent
const discount = this.cartService.getCurrentDiscount();
const programs = this.cartService.getAppliedPromotionPrograms();

// Or qua getter
const discount = this.Discount; // getter property
const programs = this.promotionAppliedPrograms; // getter property
```

## Benefits

### ✅ **Separation of Concerns**
- Discount logic tách riêng khỏi UI component
- Cart service quản lý toàn bộ cart state bao gồm discount
- Component chỉ tập trung vào presentation logic

### ✅ **Reusability**
- POSDiscountService có thể tái sử dụng ở các component khác
- Logic discount được centralized

### ✅ **Maintainability** 
- Code dễ đọc và maintain hơn
- Dễ dàng unit test từng service riêng biệt
- Giảm complexity của main component

### ✅ **Type Safety**
- Đầy đủ TypeScript typing
- Clear interface cho các methods

### ✅ **Error Handling**
- Centralized error handling trong services
- Consistent error messages

## Usage Examples

```typescript
// Trong component khác muốn sử dụng discount
constructor(private cartService: POSCartService) {}

async applyCustomDiscount() {
  try {
    // Validate trước khi apply
    const validation = this.cartService.validateDiscount({ Percent: 15 });
    if (!validation.isValid) {
      this.env.showMessage(validation.message, 'warning');
      return;
    }
    
    // Apply discount
    await this.cartService.applyDiscount(15);
    this.env.showMessage('Discount applied!', 'success');
  } catch (error) {
    this.env.showMessage('Failed to apply discount', 'danger');
  }
}

// Check discount summary
getOrderSummary() {
  const summary = this.cartService.getDiscountSummary();
  console.log('Total discounts:', summary.discountAmount);
  console.log('Applied programs:', summary.appliedPrograms);
}
```

## Testing

Để test các chức năng:

1. **Test POSDiscountService riêng biệt:**
   - Unit test các calculation methods
   - Test validation logic
   - Test API integration

2. **Test POSCartService integration:**
   - Test discount tích hợp với cart calculations
   - Test state management

3. **Test UI integration:**
   - Test modal interactions vẫn hoạt động
   - Test getter properties

## Notes

- ⚠️ Cần kiểm tra các template files (HTML) xem có reference đến old properties không
- ⚠️ Cần test thoroughly các discount flows
- ⚠️ Cần cập nhật other components nếu có sử dụng direct discount logic
- ✅ Backward compatibility được maintain qua getter properties
