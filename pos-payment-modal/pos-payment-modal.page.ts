import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BANK_IncomingPaymentDetailProvider, BANK_IncomingPaymentProvider, CRM_ContactProvider, POS_TableProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';
import QRCode from 'qrcode'
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';
import { POSAddContactModalPage } from '../pos-add-contact-modal/pos-add-contact-modal.page';
import { environment } from 'src/environments/environment';


@Component({
    selector: 'app-pos-payment-modal',
    templateUrl: './pos-payment-modal.page.html',
    styleUrls: ['./pos-payment-modal.page.scss'],
})
export class POSPaymentModalPage extends PageBase {
    DebtAmount = 0;
    PaidAmounted = 0;
    Amount = 0;
    statusList;
    typeList;
    constructor(
        public pageProvider: BANK_IncomingPaymentDetailProvider,      
        public IncomingPaymentProvider: BANK_IncomingPaymentProvider,
        public commonService: CommonService,

        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,

        public modalController: ModalController,
        public alertCtrl: AlertController,
        public navParams: NavParams,
        public formBuilder: FormBuilder,
        public cdr: ChangeDetectorRef,
        public loadingController: LoadingController
    ) 
    {
        super();
        this.env.getEvents().subscribe((data) => {
			switch (data.Code) {
				case 'app:POSOrderPaymentUpdate':
					this.pushPayment(data)
					break;
            }
        })
        
    }
    loadData(event){
        Object.assign(this.query, {SortBy: '[Id_desc]',IDSaleOrder: this.item.Id, IsDeleted: false});
        super.loadData(event);
        this.env.getStatus('PAYMENT').then(data => {this.statusList = data});
        this.env.getType('PaymentType').then(data=>{this.typeList = data;});  
    }
    loadedData(event) {
        this.calcPayment();
    }
    private convertUrl(str) {
        return  str.replace("=","").replace("=","").replace("+", "-").replace("_", "/")
    } 
    private calcPayment(){
        let PaidAmounted = 0;
        this.items.forEach(e => {
            e.IncomingPayment.PaymentCode = lib.dateFormat(e.IncomingPayment.CreatedDate, 'yyMMdd')+"_"+e.IncomingPayment.Id;
            e.IncomingPayment.CreatedDateText = lib.dateFormat(e.IncomingPayment.CreatedDate, 'dd/mm/yyyy');
            e.IncomingPayment.CreatedTimeText = lib.dateFormat(e.IncomingPayment.CreatedDate, 'hh:MM:ss');
            e.IncomingPayment.TypeText = lib.getAttrib(e.IncomingPayment.Type, this.typeList, 'Name', '--', 'Code');
            e.IncomingPayment.StatusText = lib.getAttrib(e.IncomingPayment.Status, this.statusList, 'Name', '--', 'Code');
            e.IncomingPayment.StatusColor = lib.getAttrib(e.IncomingPayment.Status, this.statusList, 'Color', 'dark', 'Code');
            if(e.IncomingPayment.Status=="SUCCESS"){
                PaidAmounted = PaidAmounted + e.IncomingPayment.Amount 
            }
        });    
        this.PaidAmounted = PaidAmounted;
        this.DebtAmount = this.item.CalcTotalOriginal - this.PaidAmounted;
    }
    getStatus(i,id){
        this.IncomingPaymentProvider.getAnItem(id).then(data=>{                   
            this.items[i].IncomingPayment.Status= data['Status'];
            switch (data['Status']) {
				case 'SUCCESS':
					this.env.showTranslateMessage('Thanh toán thành công', 'success');
					break;
                case 'FAIL':
					this.env.showTranslateMessage('Giao dịch thất bại', 'danger');
					break;
                default:
					this.env.showTranslateMessage('Đang chờ khách hàng thanh toán', 'warning');
					break;
            }
            this.calcPayment();
        });
    }
    toPayment(){
        let payment = {
            IDBranch: this.item.IDBranch,
            IDStaff: this.env.user.StaffID,
            IDCustomer: this.item.IDContact,
            IDSaleOrder: this.item.Id,
            DebtAmount: this.DebtAmount,
            Timestamp:Date.now()
        };
        let str = window.btoa(JSON.stringify(payment));
        let code =  this.convertUrl(str);
        let url = environment.appDomain + "Payment?Code="+code;
        window.open(url, "_blank");
    }
    toDetail(code){
        let url = environment.appDomain + "Payment?Code="+code;
        window.open(url, "_blank");
    }
    pushPayment(data){
        let query: any = {
            IDIncomingPayment: data.Id,
            IDSaleOrder:this.item.Id
        }  
        this.pageProvider.read(query).then((result: any)=>{                                              
            if(result['count']>0 && result['data'][0].IDSaleOrder == this.item.Id){
                let index = this.items.findIndex((i => i.IncomingPayment.Id == data.Id)); 
                console.log(index);
                if(index == -1){
                    result['data'].forEach(e=>{
                        this.items.unshift(e);
                    })                
                }
                else{
                    this.items[index].IncomingPayment.Status = result['data'][0].IncomingPayment.Status;
                }
                this.calcPayment();  
            }                           
        })
    }
    doneOrder(){
        return this.modalController.dismiss('Done');
    }
}
