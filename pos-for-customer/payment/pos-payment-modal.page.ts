import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BANK_IncomingPaymentDetailProvider, BANK_IncomingPaymentProvider } from 'src/app/services/static/services.service';
import { FormBuilder } from '@angular/forms';
import { lib } from 'src/app/services/static/global-functions';
import { CommonService } from 'src/app/services/core/common.service';
import { environment } from 'src/environments/environment';
import { ApiSetting } from 'src/app/services/static/api-setting';


@Component({
    selector: 'app-posforcustomer-payment-modal',
    templateUrl: './pos-payment-modal.page.html',
    styleUrls: ['./pos-payment-modal.page.scss'],
})
export class POSForCustomerPaymentModalPage extends PageBase {
    DebtAmount = 0;
    PaidAmounted = 0;
    Amount = 0;
    statusList;
    typeList;
    constructor(          
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
    }
    ngOnInit() {
        this.pageConfig.subscribePOSOrderPaymentUpdate = this.env.getEvents().subscribe((data) => {            
			switch (data.Code) {
				case 'app:POSOrderPaymentUpdate':
					this.refresh();
					break;
            }
        })
        super.ngOnInit();
    }
    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrderPaymentUpdate?.unsubscribe(); 
        super.ngOnDestroy();
    }
    refresh(event?: any): void {
        this.preLoadData();
    }
    preLoadData(event?: any): void {
        
        Promise.all([                                        
            this.getPayment(),            
        ]).then((values: any) => {                   
            this.items = values[0];   
            this.calcPayment();                
        }).catch(err => {           
            this.loadedData(event);
        })
    }
    private getPayment() {
        let apiPath = {
            method: "GET",
            url: function(){return ApiSetting.apiDomain("POS/ForCustomer/Payment")}  
        };  
        return new Promise((resolve, reject) => {
            Object.assign(this.query, {SortBy: '[Id_desc]',IDBranch:this.item.IDBranch,IDSaleOrder: this.item.Id, IsDeleted: false});
            this.commonService.connect(apiPath.method, apiPath.url(), this.query).toPromise()
					.then((result: any) => {					
						resolve(result);
					})
					.catch(err => {						
						reject(err);
					});
        });
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
            e.IncomingPayment.TypeText = this.getTypeText(e.IncomingPayment.Type);  
            e.IncomingPayment.StatusText = this.getStatusText(e.IncomingPayment.Status); 
            if(e.IncomingPayment.Status=="Success"){
                PaidAmounted = PaidAmounted + e.IncomingPayment.Amount 
            }
        });    
        this.PaidAmounted = PaidAmounted;
        this.DebtAmount = (this.item.CalcTotalOriginal-this.item.OriginalDiscountFromSalesman)  - this.PaidAmounted;         
    }
    getStatus(i,id){
        this.IncomingPaymentProvider.getAnItem(id).then(data=>{                   
            this.items[i].IncomingPayment.Status= data['Status'];
            switch (data['Status']) {
				case 'Success':
					this.env.showTranslateMessage('Thanh toán thành công', 'success');
					break;
                case 'Fail':
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
            IDStaff: 0,
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
        if(this.DebtAmount > 0) {
            this.alertCtrl.create({
                header: 'Thông báo',             
                message: 'Bạn có chắc chắn kết thúc đơn? Đơn sẽ được ghi nhận là thanh toán sau.',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {                      
                        }
                    },
                    {
                        text: 'Đồng ý',
                        cssClass: 'success-btn',
                        handler: () => {
                            return this.modalController.dismiss(this.DebtAmount,'Done');
                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
        else{
            return this.modalController.dismiss(this.DebtAmount,'Done');
        }
        
    }
    getTypeText(code):  string{
        switch (code) {
            case 'ZalopayApp':
                code = "Ví zalo pay"
                break;
            case 'ATM':
                code = "Thẻ ATM"
                break;
            case 'CC':
                code = "Thẻ Visa,Master"
                break;
            default:
                code = "Tiền mặt"
                break;
        }
        return code;
    }
    getStatusText(code):  string{
        switch (code) {
            case 'Success':
                code = "Thành công"
                break;
            case 'Processing':
                code = "Đang xử lý"
                break;
            default:
                code = "Thất bại"
                break;
        }
        return code;
    }
}
