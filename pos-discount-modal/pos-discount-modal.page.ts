import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BANK_PaymentTermProvider, CRM_ContactProvider, CRM_VoucherProvider, POS_CashProvider, POS_TableProvider, SALE_OrderDeductionProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { CRM_BusinessPartnerProvider } from 'src/app/services/custom.service';



@Component({
    selector: 'app-pos-discount-modal',
    templateUrl: './pos-discount-modal.page.html',
    styleUrls: ['./pos-discount-modal.page.scss'],
})
export class POSDiscountModalPage extends PageBase {
    @Input() selectedOrder;

    OrderAdditionTypeList = [];
    OrderDeductionTypeList = [];
    DiscountList = [];
    
    memberRewards = [
        {
            CGRP_Code: 1,
            CGRP_Name: 'REWARD-1',
            Food_DiscPer: 0,
            Wine_DiscPer: 10,
            Birthday_DiscPer: 10,
            Over20Person: 5,
            Other_DiscPer: 0,
            CardLevel: 1,
            GemLounge_DiscPer: 5,
        },
        {
            CGRP_Code: 2,
            CGRP_Name: 'REWARD-2',
            Food_DiscPer: 5,
            Wine_DiscPer: 15,
            Birthday_DiscPer: 10,
            Over20Person: 5,
            Other_DiscPer: 5,
            CardLevel: 2,
            GemLounge_DiscPer: 10,
        },
        {
            CGRP_Code: 3,
            CGRP_Name: 'PRIVILEGE',
            Food_DiscPer: 10,
            Wine_DiscPer: 20,
            Birthday_DiscPer: 15,
            Over20Person: 5,
            Other_DiscPer: 5,
            CardLevel: 3,
            GemLounge_DiscPer: 15,
        },
        {
            CGRP_Code: 4,
            CGRP_Name: 'PLATINUM',
            Food_DiscPer: 15,
            Wine_DiscPer: 25,
            Birthday_DiscPer: 20,
            Over20Person: 5,
            Other_DiscPer: 5,
            CardLevel: 4,
            GemLounge_DiscPer: 20,
        },
    ]
    voucherList: any = [];

    selectedVoucher: any;

    InternalOptions = false;

    discountInfo:any = {};

    constructor(
        public pageProvider: SALE_OrderProvider,
        public contactProvider: CRM_ContactProvider,
        public posContactProvider: CRM_BusinessPartnerProvider,
        public tableProvider: POS_TableProvider,
        public paymentProvider: BANK_PaymentTermProvider,
        public voucherProvider: CRM_VoucherProvider,
        public saleOrderDeduction: SALE_OrderDeductionProvider,

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
        this.pageConfig.pageName = 'POSOrderDiscount';
        this.config.notFoundText = 'Không tìm thấy dữ liệu phù hợp...';
        this.config.clearAllText = 'Xóa hết';
    }

    //TradeDiscount
    //SalesOff
    //Voucher
    //Membership
    //InternalDiscount

    preLoadData(event) {
        Promise.all([
            this.env.getType('OrderDeduction'),
            this.saleOrderDeduction.read({IDOrder: this.selectedOrder.Id})
        ]).then((results:any) => {
            this.OrderDeductionTypeList = results[0];
            this.DiscountList = results[1].data;
            super.preLoadData(event);
        });
    }

    loadData(event) {

        this.item = {
            Id: this.selectedOrder.Id, 
            IDContact: this.selectedOrder.IDContact, 
            IDAddress: this.selectedOrder.IDAddress, 
            IDTable: this.selectedOrder.Tables[0], 
            IDOrder: this.selectedOrder.Id, 
            PercentDiscount: (this.selectedOrder.PercentDiscount || 0),
            DiscountAmount: (this.selectedOrder.DiscountAmount || 0),
            InternalPercentDiscount: (this.selectedOrder.InternalPercentDiscount || 0),
            InternalDiscountAmount: (this.selectedOrder.InternalDiscountAmount || 0),

            TotalDiscount: (this.selectedOrder.TotalDiscount || 0),
            QRC: null
        };

        this.voucherProvider.read().then((results: any) => {
            this.voucherList = results.data;
            this.voucherList.forEach(e => {
                e.AmountText = lib.currencyFormat(e.Amount);
            });

            if (this.DiscountList.length != 0) {
                this.DiscountList.forEach(d => {
                    if (d.Type == 'TradeDiscount') {
                        console.log('TradeDiscount: ' + d.Amount);
                    }
                    else if (d.Type == 'SalesOff') {
                        this.item.DiscountAmount = d.Amount;
                        this.changeAmountDiscount();
                    }
                    else if (d.Type == 'Voucher') {
                        this.item.VoucherCode = d.Code;
                        this.applyVoucher();
                    }
                    else if (d.Type == 'Membership') {
                        this.item.MembershipDiscount = d.Amount;
                        this.changeMembershipDiscount();
                    }
                    else if (d.Type == 'InternalDiscount') {
                        this.item.InternalDiscountAmount = d.Amount;
                        this.changeInternalDiscountAmount();
                    }
                });
            }
            super.loadData(event);
        });
    }

    loadedData(event) {

        this.posContactProvider.SearchContact({ Take: 20, Skip: 0, Term: this.item.IDContact }).subscribe((data: any) => {
            let contact = data.find(d => d.IDAddress == this.item.IDAddress);

            this.contactSelected = contact;

            data.filter(d => d.Id == this.item.IDContact).forEach(i => {
                if (i && this.contactListSelected.findIndex(d => d.IDAddress == i.IDAddress) == -1)
                    this.contactListSelected.push(i);
            });
            this.contactSearch();
            this.cdr.detectChanges();

            this.contactProvider.getAnItem(this.contactSelected.Id).then((data: any) => {
                if (data.IsStaff) {
                    this.InternalOptions = true;
                }
                else {
                    this.InternalOptions = false;
                }
                super.loadedData(event);
            })
        })
    }

    contactList$
    contactListLoading = false;
    contactListInput$ = new Subject<string>();
    contactListSelected = [];
    contactSelected = null;
    contactSearch() {
        this.contactListLoading = false;
        this.contactList$ = concat(
            of(this.contactListSelected),
            this.contactListInput$.pipe(
                distinctUntilChanged(),
                tap(() => this.contactListLoading = true),
                switchMap(term => this.posContactProvider.SearchContact({ Take: 20, Skip: 0, Term: term ? term : this.item.IDContact }).pipe(
                    catchError(() => of([])), // empty list on error
                    tap(() => this.contactListLoading = false)
                ))

            )
        );
    }


    changedIDContact(i) {
        if (i) {
            this.contactSelected = i;
            this.selectedOrder.IDContact = i.Id;

            if (this.contactListSelected.findIndex(d => d.Id == i.Id) == -1) {
                this.contactListSelected.push(i);
                this.contactSearch();
            }

            this.contactProvider.getAnItem(this.contactSelected.Id).then((data: any) => {
                if (data.IsStaff) {
                    this.InternalOptions = true;
                }
                else {
                    this.InternalOptions = false;
                }
            })
        }
    }

    searchVoucherCode(ev) {
        let term = ev.detail.value;
        let query = {
            Take: 20,
            Skip: 0,
            Keyword: term,
        } 
        if (term.length >= 2) { 
            this.voucherProvider.search(query).toPromise().then((values: any) => { 
                this.voucherList = values;

                if (values.length == 1) {
                    this.checkVoucher(values[0], true);
                }
                this.voucherList.forEach(e => {
                    e.AmountText = lib.currencyFormat(e.Amount);
                });
            })
        }
        if (term.length == 0) {
            this.voucherProvider.read().then((results: any) => {
                this.voucherList = results.data;

                this.voucherList.forEach(e => {
                    e.AmountText = lib.currencyFormat(e.Amount);
                });

                if (this.selectedVoucher) {
                    this.voucherList.forEach((element,index)=>{ 
                        if( element.Id == this.selectedVoucher.Id) { 
                            this.voucherList[index].Selected = true;
                        }
                        else {
                            this.voucherList[index].Selected = false;
                        }
                    })
                }
            });
        }
        
    }

    applyVoucher() {
        this.selectedVoucher = this.voucherList.find(v => v.Code == this.item.VoucherCode);
        if (this.selectedVoucher) {
            this.checkVoucher(this.selectedVoucher);
        }
        else {
            if (this.voucherList.length != 0 && this.item.VoucherCode != null && this.item.VoucherCode != '') {
                this.checkVoucher(this.voucherList[0]);
            }
        }
    }

    checkVoucher(i,update = false) {
        this.voucherList.forEach((element,index)=>{
            if(element.Id == i.Id) {
                this.voucherList[index].Selected =!  this.voucherList[index].Selected;
                if (this.voucherList[index].Selected) {
                    this.selectedVoucher = i;
                    this.discountInfo.Type = 'Voucher';
                    this.discountInfo.Name = i.Name;
                    this.discountInfo.Amount = i.Amount;
                    this.discountInfo.Code = i.Code;
                    this.env.showTranslateMessage("Đã chọn voucher!", "success");
                }
                else {
                    this.selectedVoucher = null;
                }
            }
            else {
                this.voucherList[index].Selected = false;
            }
        });
        if (this.selectedVoucher == null ) {
            this.discountInfo.Type = 'Voucher';
            this.discountInfo.Name = null;
            this.discountInfo.Amount = 0;
            this.discountInfo.Code = null;
            this.item.VoucherCode = null;
        }
        
        this.discountCalc(update);
    }

    changePercentDiscount(update = false) { //SalesOff
        this.item.PercentDiscount = (parseFloat(this.item.PercentDiscount) || null);
        this.item.DiscountAmount = this.item.PercentDiscount * this.selectedOrder.TotalBeforeDiscount / 100;
        this.discountInfo.Type = 'SalesOff';
        this.discountInfo.Amount = this.item.DiscountAmount;
        
        this.discountCalc(update);
    }

    changeAmountDiscount(update = false) { //SalesOff
        this.item.DiscountAmount = (parseFloat(this.item.DiscountAmount) || null);
        this.item.PercentDiscount = this.item.DiscountAmount / this.selectedOrder.TotalBeforeDiscount * 100;
        this.discountInfo.Type = 'SalesOff';
        this.discountInfo.Amount = this.item.DiscountAmount;
        
        this.discountCalc(update);
    }

    changeInternalPercentDiscount(update = false) { //InternalDiscount
        this.item.InternalPercentDiscount = (parseFloat(this.item.InternalPercentDiscount) || null);
        this.item.InternalDiscountAmount = this.item.InternalPercentDiscount * this.selectedOrder.TotalBeforeDiscount / 100;
        this.discountInfo.Type = 'InternalDiscount';
        this.discountInfo.Amount = this.item.InternalDiscountAmount;
        
        this.discountCalc(update);
    }

    changeInternalDiscountAmount(update = false) { //InternalDiscount
        this.item.InternalDiscountAmount = (parseFloat(this.item.InternalDiscountAmount) || null);
        this.item.InternalPercentDiscount = this.item.InternalDiscountAmount / this.selectedOrder.TotalBeforeDiscount * 100;
        this.discountInfo.Type = 'InternalDiscount';
        this.discountInfo.Amount = this.item.InternalDiscountAmount;
        
        this.discountCalc(update);
    }

    changeMembershipDiscount(update = false) { //Membership
        this.item.MembershipDiscount = (parseFloat(this.item.MembershipDiscount) || null);
        this.discountInfo.Type = 'Membership';
        this.discountInfo.Amount = this.item.MembershipDiscount;
        
        this.discountCalc(update);
    }
    

    discountCalc(update) {
        let checkCurrentDiscount = this.DiscountList.find(d => d.Type == this.discountInfo.Type);
        if (checkCurrentDiscount) {
            this.discountInfo.Id = checkCurrentDiscount.Id; //Update
        }
        else {
            this.discountInfo.Id = 0; //Create New
        }
        this.discountInfo.IDOrder = this.item.Id;
        

        if (update) {
            this.saleOrderDeduction.save(this.discountInfo).then((savedData:any) => {
                if (checkCurrentDiscount) {
                    checkCurrentDiscount.Code = savedData.Code;
                    checkCurrentDiscount.Name = savedData.Name;
                    checkCurrentDiscount.Amount = savedData.Amount;
                }
                else {
                    this.DiscountList.push(savedData);
                }
                this.discountInfo = {};
                
            }).catch(err => {
                console.log(err);
            })
        }

        this.item.VoucherDiscount = ( parseFloat(this.selectedVoucher?.Amount) || 0);
        this.item.DiscountAmount = ( parseFloat(this.item.DiscountAmount) || 0);
        this.item.InternalDiscountAmount = ( parseFloat(this.item.InternalDiscountAmount) || 0);
        this.item.MembershipDiscount = ( parseFloat(this.item.MembershipDiscount) || 0);

        this.item.TotalDiscount = this.item.VoucherDiscount + this.item.DiscountAmount + this.item.InternalDiscountAmount + this.item.MembershipDiscount; //sum
        console.log('TotalDiscount: ' + this.item.TotalDiscount);
        
    }

    applyDiscount(apply = false) {
        if (apply) {
            this.modalController.dismiss([this.item.TotalDiscount, this.contactSelected, apply, this.item, this.DiscountList]);
        }
        else {
            this.modalController.dismiss([null, this.contactSelected, apply, this.item, this.DiscountList]);
        }
    }

    scanning = false;
    scanQRCode() {
        if (!Capacitor.isPluginAvailable('BarcodeScanner') || Capacitor.platform == 'web'){
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.mobile-only','warning');
            return;
        }
        BarcodeScanner.prepare().then(() => {
            BarcodeScanner.checkPermission({ force: true }).then(status => {
                if (status.granted) {
                    this.scanning = true;
                    document.querySelector('ion-app').style.backgroundColor = "transparent";
                    BarcodeScanner.startScan().then((result) => {
                        console.log(result);
                        let close: any = document.querySelector('#closeCamera');

                        if (!result.hasContent) {
                            close.click();
                        }

                        if (result.content.indexOf('O:') == 0) {
                            //text = text.replace('O:', '');
                            //this.navCtrl.navigateForward('/delivery/' + text);
                            this.query.CustomerName = result.content;
                            setTimeout(() => {
                                if (close) {
                                    close.click();
                                }
                                this.refresh();
                            }, 0);
                        } else {
                            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.scanning-with-value','', result.content);
                            setTimeout(() => this.scanQRCode(), 0);
                        }
                    })
                }
                else {
                    this.alertCtrl.create({
                        header: 'Quét QR code',
                        //subHeader: '---',
                        message: 'Bạn chưa cho phép sử dụng camera, Xin vui lòng cấp quyền cho ứng dụng.',
                        buttons: [
                            {
                                text: 'Không',
                                role: 'cancel',
                                handler: () => {}
                            },
                            {
                                text: 'Đồng ý',
                                cssClass: 'danger-btn',
                                handler: () => {
                                    BarcodeScanner.openAppSettings();
                                }
                            }
                        ]
                    }).then(alert => {
                        alert.present();
                    })
                }
            })
                .catch((e: any) => console.log('Error is', e));
        })

        

    }

    closeCamera() {
        if (!Capacitor.isPluginAvailable('BarcodeScanner') || Capacitor.platform == 'web'){
            return;
        }
        this.scanning = false;
        this.lighting = false;
        this.useFrontCamera = false;
        document.querySelector('ion-app').style.backgroundColor = "";
        BarcodeScanner.showBackground();
        BarcodeScanner.stopScan();
    }

    lighting = false;
    lightCamera() {
        // if (this.lighting) {
        //     this.qrScanner.disableLight().then(() => {
        //         this.lighting = false;
        //     });
        // }
        // else {
        //     this.qrScanner.enableLight().then(() => {
        //         this.lighting = true;
        //     });
        // }
    }

    useFrontCamera = false;
    reversalCamera() {
        // if (this.useFrontCamera) {
        //     this.qrScanner.useBackCamera().then(() => {
        //         this.useFrontCamera = false;
        //     });
        // }
        // else {
        //     this.qrScanner.useFrontCamera().then(() => {
        //         this.useFrontCamera = true;
        //     });
        // }
    }

    ionViewWillLeave() {
        this.closeCamera();
    }

}
