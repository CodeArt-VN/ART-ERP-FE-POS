import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { 
    SALE_OrderProvider, 
    PR_ProgramProvider,
    SALE_OrderDeductionProvider 
} from 'src/app/services/static/services.service';
import { EnvService } from 'src/app/services/core/env.service';
import { CommonService } from 'src/app/services/core/common.service';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Injectable({
    providedIn: 'root'
})
export class POSDiscountService {
    private _discount = new BehaviorSubject<any>(null);
    private _promotionAppliedPrograms = new BehaviorSubject<any[]>([]);
    private _orderAdditionTypeList = new BehaviorSubject<any[]>([]);
    private _orderDeductionTypeList = new BehaviorSubject<any[]>([]);

    public discount$ = this._discount.asObservable();
    public promotionAppliedPrograms$ = this._promotionAppliedPrograms.asObservable();
    public orderAdditionTypeList$ = this._orderAdditionTypeList.asObservable();
    public orderDeductionTypeList$ = this._orderDeductionTypeList.asObservable();

    constructor(
        private orderProvider: SALE_OrderProvider,
        private programProvider: PR_ProgramProvider,
        private orderDeductionProvider: SALE_OrderDeductionProvider,
        private env: EnvService,
        private commonService: CommonService
    ) {}

    // Getters
    get discount() {
        return this._discount.value;
    }

    get promotionAppliedPrograms() {
        return this._promotionAppliedPrograms.value;
    }

    get orderAdditionTypeList() {
        return this._orderAdditionTypeList.value;
    }

    get orderDeductionTypeList() {
        return this._orderDeductionTypeList.value;
    }

    // Setters
    setDiscount(discount: any) {
        this._discount.next(discount);
    }

    setPromotionAppliedPrograms(programs: any[]) {
        this._promotionAppliedPrograms.next(programs);
    }

    setOrderAdditionTypeList(list: any[]) {
        this._orderAdditionTypeList.next(list);
    }

    setOrderDeductionTypeList(list: any[]) {
        this._orderDeductionTypeList.next(list);
    }

    /**
     * Initialize discount data for an order
     */
    initializeDiscount(item: any) {
        const discount = {
            Amount: item.OriginalTotalDiscount,
            Percent: (item.OriginalTotalDiscount * 100) / item.OriginalTotalBeforeDiscount,
        };
        this.setDiscount(discount);
    }

    /**
     * Apply discount to order
     */
    async applyDiscount(orderId: number, percent: number): Promise<any> {
        try {
            const result = await this.orderProvider.commonService
                .connect('POST', 'SALE/Order/UpdatePosOrderDiscount/', {
                    Id: orderId,
                    Percent: percent,
                })
                .toPromise();
            
            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Apply discount from salesman to a specific line
     */
    validateSalesmanDiscount(line: any, discountAmount: number): boolean {
        if (discountAmount > line.CalcTotalOriginal) {
            throw new Error('Gift amount cannot be greater than the product value!');
        }
        return true;
    }

    /**
     * Get promotion programs applied to an order
     */
    async getPromotionProgram(orderId: number): Promise<any[]> {
        try {
            const data: any = await this.programProvider.commonService
                .connect('GET', 'PR/Program/AppliedProgramInSaleOrder', {
                    IDSO: orderId,
                })
                .toPromise();
            
            this.setPromotionAppliedPrograms(data);
            return data;
        } catch (error) {
            console.error('Error getting promotion programs:', error);
            throw error;
        }
    }

    /**
     * Delete voucher from order
     */
    async deleteVoucher(program: any, orderId: number): Promise<boolean> {
        try {
            const apiPath = {
                method: 'POST',
                url: () => ApiSetting.apiDomain('PR/Program/DeleteVoucher/')
            };

            await this.programProvider.commonService
                .connect(apiPath.method, apiPath.url(), {
                    IDProgram: program.Id,
                    IDSaleOrder: orderId,
                    IDDeduction: program.IDDeduction,
                })
                .toPromise();
            
            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Calculate discount percentage
     */
    calculateDiscountPercent(discountAmount: number, totalBeforeDiscount: number): number {
        if (totalBeforeDiscount === 0) return 0;
        return (discountAmount * 100) / totalBeforeDiscount;
    }

    /**
     * Calculate discount amount from percentage
     */
    calculateDiscountAmount(percent: number, totalBeforeDiscount: number): number {
        return (percent * totalBeforeDiscount) / 100;
    }

    /**
     * Validate discount values
     */
    validateDiscount(discount: any, item: any): { isValid: boolean; message?: string } {
        if (!discount || (!discount.Amount && !discount.Percent)) {
            return { isValid: false, message: 'Please enter discount amount or percentage' };
        }

        if (discount.Percent && (discount.Percent < 0 || discount.Percent > 100)) {
            return { isValid: false, message: 'Discount percentage must be between 0 and 100' };
        }

        if (discount.Amount && discount.Amount > item.OriginalTotalBeforeDiscount) {
            return { isValid: false, message: 'Discount amount cannot be greater than order total' };
        }

        return { isValid: true };
    }

    /**
     * Reset discount data
     */
    resetDiscount() {
        this.setDiscount(null);
        this.setPromotionAppliedPrograms([]);
    }

    /**
     * Get discount summary
     */
    getDiscountSummary(item: any) {
        return {
            originalTotal: item.OriginalTotalBeforeDiscount || 0,
            discountAmount: item.OriginalTotalDiscount || 0,
            discountPercent: this.calculateDiscountPercent(
                item.OriginalTotalDiscount || 0, 
                item.OriginalTotalBeforeDiscount || 0
            ),
            finalTotal: (item.OriginalTotalBeforeDiscount || 0) - (item.OriginalTotalDiscount || 0),
            appliedPrograms: this.promotionAppliedPrograms?.length || 0
        };
    }

    /**
     * Check if order has any discounts applied
     */
    hasDiscounts(item: any): boolean {
        return (item.OriginalTotalDiscount && item.OriginalTotalDiscount > 0) || 
               (this.promotionAppliedPrograms && this.promotionAppliedPrograms.length > 0);
    }
}
