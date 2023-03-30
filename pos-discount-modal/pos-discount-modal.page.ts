import { Component, Input } from '@angular/core';
import { ModalController, LoadingController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderDetailProvider } from 'src/app/services/static/services.service';

@Component({
    selector: 'app-pos-discount-modal',
    templateUrl: './pos-discount-modal.page.html',
    styleUrls: ['./pos-discount-modal.page.scss'],
})
export class POSDiscountModalPage extends PageBase {
    Discount = {
        Percent:0,
        Amount:0
    };
    constructor(
        public pageProvider: SALE_OrderDetailProvider,  
        public env: EnvService,
        public modalController: ModalController,
        public loadingController: LoadingController,
    ) {
        super();
        this.pageConfig.isDetailPage = false; 
    }
    loadData(event) {
        this.Discount.Amount = this.item.OriginalTotalDiscount;
        this.Discount.Percent = this.Discount.Amount *100 / this.item.OriginalTotalBeforeDiscount;    
        console.log(this.item.OrderLines); 
    }
    changePercentDiscount() { //SalesOff
        this.Discount.Amount = this.Discount.Percent * this.item.OriginalTotalBeforeDiscount / 100 
    }
    changeAmountDiscount() { //SalesOff
        this.Discount.Percent = this.Discount.Amount *100 / this.item.OriginalTotalBeforeDiscount ;
    }
    applyDiscount(apply = false) {
        //this.item.OriginalTotalDiscount = this.Discount.Amount;
        this.item.OrderLines.forEach(e => {
            e.OriginalDiscountByOrder = e.OriginalTotalBeforeDiscount*this.Discount.Percent/100 ;
            e.OriginalTotalDiscount = e.OriginalDiscountByLine + e.OriginalDiscountByOrder;
            this.pageProvider.save(e).then();
        });
        //return this.modalController.dismiss(this.item, (apply ? 'confirm' : 'cancel'));
    }
}
