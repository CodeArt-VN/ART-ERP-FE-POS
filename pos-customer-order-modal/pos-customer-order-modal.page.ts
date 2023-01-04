import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { lib } from 'src/app/services/static/global-functions';



@Component({
    selector: 'app-pos-customer-order-modal',
    templateUrl: './pos-customer-order-modal.page.html',
    styleUrls: ['./pos-customer-order-modal.page.scss'],
})
export class POSCustomerOrderModalPage extends PageBase {
    @Input() selectedItem;
    @Input() itemRemark;
    
    PriceText = "";
    Quantity = 1;
    checkQty = 0;
    newQty = 0;
    TotalText = "";
    
    constructor(
        public pageProvider: SALE_OrderProvider,

        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,

        public modalController: ModalController,
        public alertCtrl: AlertController,
        public navParams: NavParams,
        public formBuilder: FormBuilder,
        public cdr: ChangeDetectorRef,
        public loadingController: LoadingController,
        private config: NgSelectConfig
    ) {
        super();
        this.pageConfig.isDetailPage = false;
        this.pageConfig.isShowFeature = true;
        this.pageConfig.pageName = 'POSCustomerOrderModal';
        this.config.notFoundText = 'Không tìm thấy dữ liệu phù hợp...';
        this.config.clearAllText = 'Xóa hết';
    }

    loadData(event) {
        this.loadedData(event);
    }

    loadedData(event) {
        console.log(this.selectedItem);
        
        this.PriceText = lib.currencyFormat(this.selectedItem.UoMs[0].PriceList[0].Price);
        this.Quantity = this.selectedItem.Quantity ? this.selectedItem.Quantity : 1;
        this.TotalText = lib.currencyFormat(this.selectedItem.UoMs[0].PriceList[0].Price * this.Quantity);
        this.selectedItem.Remark = this.itemRemark;

        super.loadedData(event);
    }

    changeQuantity(n){
        this.checkQty = this.Quantity + n;

        if(this.checkQty > 0) {
            this.Quantity += n;
            this.TotalText = lib.currencyFormat(this.selectedItem.UoMs[0].PriceList[0].Price * this.Quantity);
        }
    }

    saveValue(apply = false){

        if (apply) {
            this.newQty = this.Quantity - (this.selectedItem.Quantity ? this.selectedItem.Quantity : 0);

            this.modalController.dismiss([this.selectedItem, this.newQty, apply]);
        }
        else {
            this.modalController.dismiss([null, this.newQty, apply]);
        }
    }
}
