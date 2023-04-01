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
    Discount = {
        Percent:0,
        Amount:0
    };
    constructor(
        public pageProvider: SALE_OrderProvider,  
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
        console.log(this.item); 

    }
    changePercentDiscount() { //SalesOff
        this.Discount.Amount = this.Discount.Percent * this.item.OriginalTotalBeforeDiscount / 100 
    }
    changeAmountDiscount() { //SalesOff
        this.Discount.Percent = this.Discount.Amount *100 / this.item.OriginalTotalBeforeDiscount ;
    }
    applyDiscount(apply = false) {
        let apiPath = {
            method: "POST",
            url: function () { return ApiSetting.apiDomain("SALE/Order/UpdatePosOrderDiscount/") }
        };
        new Promise((resolve, reject) => {
            this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), {Id:this.item.Id,Percent:this.Discount.Percent}).toPromise()
            .then((savedItem: any) => {
                this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');   
                resolve(true);  
                return this.modalController.dismiss(null,apply ? 'confirm' : 'cancel');  
            })
            .catch(err => {
                this.env.showTranslateMessage('erp.app.pages.pos.pos-order.merge.message.can-not-save','danger');
                reject(err);
            });
        });       
    }
}
