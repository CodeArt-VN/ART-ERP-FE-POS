import { Component, Input } from '@angular/core';
import { ModalController, LoadingController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';

@Component({
    selector: 'app-pos-discount-modal',
    templateUrl: './pos-discount-modal.page.html',
    styleUrls: ['./pos-discount-modal.page.scss'],
})
export class POSDiscountModalPage extends PageBase {
    @Input() item;
    Discount = {
        Percent:0,
        Amount:0
    };
    constructor(
        public env: EnvService,
        public modalController: ModalController,
        public loadingController: LoadingController,
    ) {
        super();
        this.pageConfig.isDetailPage = false; 
    }
    loadData(event) {
        this.Discount.Amount = this.item.OriginalTotalDiscount;
        this.Discount.Percent =this.Discount.Amount *100 / this.item.OriginalTotalBeforeDiscount; 
        super.loadData(event);
    }
    changePercentDiscount() { //SalesOff
        this.Discount.Amount = this.Discount.Percent * this.item.OriginalTotalBeforeDiscount / 100 
    }
    changeAmountDiscount() { //SalesOff
        this.Discount.Percent = this.Discount.Amount *100 / this.item.OriginalTotalBeforeDiscount ;
    }
    discountCalc() {
        this.item.OriginalTotalDiscount = this.item.OriginalTotalDiscount + this.Discount.Amount;
        this.item.CalcTotalOriginal = this.item.OriginalTotalBeforeDiscount - this.item.OriginalTotalDiscount - this.item.OriginalTax;
    }
    applyDiscount(apply = false) {
        if (apply) {     
            this.discountCalc();    
            this.modalController.dismiss(this.item);         
        }
        else {
            this.modalController.dismiss();
        }
    }
}
