import { Component, Input } from '@angular/core';
import { ModalController, LoadingController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { SALE_OrderDetailProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';

@Component({
    selector: 'app-pos-discount-modal',
    templateUrl: './pos-discount-modal.page.html',
    styleUrls: ['./pos-discount-modal.page.scss'],
})
export class POSDiscountModalPage extends PageBase {
    Discount;
    constructor(
        public pageProvider: SALE_OrderProvider,  
        public env: EnvService,
        public modalController: ModalController,
        public loadingController: LoadingController,
    ) {
        super();
        this.pageConfig.isDetailPage = false; 
    }
    changePercentDiscount() { //SalesOff
        this.Discount.Amount = this.Discount.Percent * this.item.OriginalTotalBeforeDiscount / 100 
    }
    changeAmountDiscount() { //SalesOff
        this.Discount.Percent = this.Discount.Amount *100 / this.item.OriginalTotalBeforeDiscount ;
    }
    applyDiscount(apply = false) { 
        this.modalController.dismiss(this.Discount,apply ? 'confirm' : 'cancel');
    }
}
