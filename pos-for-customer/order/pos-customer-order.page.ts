import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, BANK_IncomingPaymentDetailProvider, BANK_IncomingPaymentProvider, CRM_ContactProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, SALE_OrderDetailProvider, SALE_OrderProvider, POS_ForCustomerProvider, } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { SaleOrderMobileAddContactModalPage } from '../../../SALE/sale-order-mobile-add-contact-modal/sale-order-mobile-add-contact-modal.page';
import { TranslateService } from '@ngx-translate/core';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { POSPaymentModalPage } from '../../pos-payment-modal/pos-payment-modal.page';
import { POSCustomerOrderModalPage } from '../../pos-customer-order-modal/pos-customer-order-modal.page';
import { POSDiscountModalPage } from '../../pos-discount-modal/pos-discount-modal.page';
import { HostListener } from "@angular/core";
import QRCode from 'qrcode';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-pos-customer-order',
    templateUrl: './pos-customer-order.page.html',
    styleUrls: ['./pos-customer-order.page.scss'],
})
export class POSCustomerOrderPage extends PageBase {
    ImagesServer = environment.posImagesServer;
    AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
    segmentView = 'all';
    idTable: any; //Default table
    tableList = [];
    menuList = [];
    statusList; //Show on bill
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered'];
    printData = {
        undeliveredItems: [], //To track undelivered items to the kitchen
        printDate: null,
        currentBranch: null,
        selectedTables: [],
    }
    constructor(
        public pageProvider: POS_ForCustomerProvider,
        //public saleOrderDetailProvider: SALE_OrderDetailProvider,
        //public menuProvider: POS_MenuProvider,
       
    
        //public contactProvider: CRM_ContactProvider,    
       
        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,
        public modalController: ModalController,
        public popoverCtrl: PopoverController,
        public alertCtrl: AlertController,
        public formBuilder: FormBuilder,
        public cdr: ChangeDetectorRef,
        public loadingController: LoadingController,
        public commonService: CommonService,
        public translate: TranslateService
    ) {
        super();
        this.pageConfig.isDetailPage = true;
        this.pageConfig.isShowFeature = true;
        this.idTable = this.route.snapshot?.paramMap?.get('table');
        this.idTable = typeof (this.idTable) == 'string' ? parseInt(this.idTable) : this.idTable;
        this.formGroup = formBuilder.group({
            Id: new FormControl({ value: 0, disabled: true }),
            Code: [],
            Name: [],
            Remark: [],
            OrderLines: this.formBuilder.array([]),
            DeletedLines: [[]],
            Additions: this.formBuilder.array([]),
            Deductions: this.formBuilder.array([]),
            Tables: [[this.idTable]],
            IDBranch: [174],
            OrderDate: [new Date()],
            IDOwner: 4,
            IDContact: [922],
            IDAddress: [902],
            IDType: [293],
            IDStatus: [101],           
            Type: ['POSOrder'],
            SubType: ['TableService'],
            Status: new FormControl({ value: 'New', disabled: true }),
            //IDOwner: [this.env.user.StaffID],

            IsCOD: [],
            IsInvoiceRequired: [],

            InvoicDate: new FormControl({ value: null, disabled: true }),
            InvoiceNumber: new FormControl({ value: null, disabled: true }),

            IsDebt: new FormControl({ value: null, disabled: true }),
            Debt: new FormControl({ value: null, disabled: true }),
            IsPaymentReceived: new FormControl({ value: null, disabled: true }),
            Received: new FormControl({ value: null, disabled: true }),
            ReceivedDiscountFromSalesman: new FormControl({ value: null, disabled: true }),
        })
        Object.assign(this.query, {IDBranch:174});
    }
    segmentChanged(ev: any) {
        this.segmentView = ev;
    }
    preLoadData(event?: any): void {
        let forceReload = event === 'force';
        
        Promise.all([         
            this.env.getStatus('POSOrder'),           
            this.getMenu(forceReload),  

        ]).then((values: any) => { 
            this.statusList = values[0];
            this.menuList = values[1].data;        
            super.preLoadData(event);
        }).catch(err => {           
            this.loadedData(event);
        })
    }
    jumpToItem(line) {
        let element = document.getElementById('item' + line.IDItem);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add('blink');
            setTimeout(() => {
                element.classList.remove('blink');
            }, 2000);
        }
    }
    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        super.loadedData(event, ignoredFromGroup);
        if (!this.item?.Id) {
            Object.assign(this.item, this.formGroup.getRawValue());
            this.setOrderValue(this.item);
        }
        else {
            this.patchOrderValue();
        }       
        this.loadOrder();
       
    }
    private loadOrder() {
        this.printData.undeliveredItems = [];
        this.printData.selectedTables = this.tableList.filter(d => this.item.Tables.indexOf(d.Id) > -1);
        this.printData.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");

        this.item._Locked = !this.pageConfig.canEdit ? false : this.noLockStatusList.indexOf(this.item.Status) == -1;
        this.printData.currentBranch = this.env.branchList.find(d => d.Id == this.item.IDBranch);

        if (this.item._Locked) {
            this.pageConfig.canEdit = false;
            this.formGroup?.disable();
        }
        

        this.calcOrder();

    }
    private patchOrderValue() {
        this.formGroup?.patchValue(this.item);
        this.patchOrderLinesValue();
        console.log(this.getDirtyValues(this.formGroup));
    }
    private patchOrderLinesValue() {
        this.formGroup.controls.OrderLines = new FormArray([]);
        if (this.item.OrderLines?.length) {
            for (let i of this.item.OrderLines) {
                this.addOrderLine(i);
            }
        }
    }
    refresh(event?: any): void {
        this.preLoadData('force');
    }
    private getMenu(forceReload) {
        let apiPath = {
            method: "GET",
            url: function(){return ApiSetting.apiDomain("POS/ForCustomer/Menu")}  
        };  
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(), this.query).toPromise()
					.then((data: any) => {
						var result = { count: data.length, data: data };
						resolve(result);
					})
					.catch(err => {						
						reject(err);
					});
        });
    }
    async addToCart(item, idUoM, quantity = 1) {
        if (this.submitAttempt) {

            let element = document.getElementById('item' + item.Id);
            if (element) {
                element = element.parentElement;
                element.classList.add('shake');
                setTimeout(() => {
                    element.classList.remove('shake');
                }, 400);
            }


            return;
        }       

        // if (this.item.Tables == null || this.item.Tables.length == 0) {
        //     this.env.showTranslateMessage('Vui lòng chọn bàn trước khi thêm món!', 'warning');
        //     return;
        // }

        if (!item.UoMs.length) {
            this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
            return;
        }

        let uom = item.UoMs.find(d => d.Id == idUoM);
        let price = uom.PriceList.find(d => d.Type == 'SalePriceList');

        let line = this.item.OrderLines.find(d => d.IDUoM == idUoM && d.Status == 'New'); //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
        if (!line) {
            line = {

                IDOrder: this.item.Id,
                Id: 0,
                Type: 'TableService',
                Status: 'New',

                IDItem: item.Id,
                IDTax: item.IDSalesTaxDefinition,
                TaxRate: item.SaleVAT,
                IDUoM: idUoM,
                UoMPrice: price.Price,

                Quantity: 1,
                IDBaseUoM: idUoM,
                UoMSwap: 1,
                UoMSwapAlter: 1,
                BaseQuantity: 0,

                ShippedQuantity: 0,

                Remark: null,
                IsPromotionItem: false,
                IDPromotion: null
            };
            this.item.OrderLines.push(line);
            debugger;
            this.addOrderLine(line);
            this.setOrderValue({ OrderLines: [line] });
        }
        else {
            if ((line.Quantity + quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
                this.env.showPrompt('Sản phẩm này đã được chuyển bếp, bạn chắc vẫn muốn thay đổi số lượng?', item.Name, 'Thay đổi số lượng').then(_ => {
                    line.Quantity += quantity;
                    this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                }).catch(_ => { });
            }
            else if ((line.Quantity + quantity) > 0) {
                line.Quantity += quantity;
                this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
            }
            else {
                this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sẩn phẩm').then(_ => {
                    line.Quantity += quantity;
                    this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                }).catch(_ => { });
            }
        }
    }
    private addOrderLine(line) {
        let groups = <FormArray>this.formGroup.controls.OrderLines;
        let group = this.formBuilder.group({
            IDOrder: [line.IDOrder],
            Id: new FormControl({ value: line.Id, disabled: true }),

            Type: [line.Type],
            Status: new FormControl({ value: line.Status, disabled: true }),

            IDItem: [line.IDItem, Validators.required],
            IDTax: [line.IDTax],
            TaxRate: [line.TaxRate],

            IDUoM: [line.IDUoM, Validators.required],
            UoMPrice: [line.UoMPrice],

            Quantity: [line.Quantity, Validators.required],
            IDBaseUoM: [line.IDBaseUoM],
            UoMSwap: [line.UoMSwap],
            UoMSwapAlter: [line.UoMSwapAlter],
            BaseQuantity: [line.BaseQuantity],

            ShippedQuantity: [line.ShippedQuantity],
            Remark: new FormControl({ value: line.Remark, disabled: true }),

            IsPromotionItem: [line.IsPromotionItem],
            IDPromotion: [line.IDPromotion],


        });
        groups.push(group);
    }
    setOrderValue(data) {
        for (const c in data) {
            if (c == 'OrderLines' || c == 'OrderLines') {
                let fa = <FormArray>this.formGroup.controls.OrderLines;

                for (const line of data[c]) {
                    let idx = -1;
                    if (c == 'OrderLines') {
                        idx = this.item[c].findIndex(d => d.Id == line.Id && d.IDUoM == line.IDUoM);
                    }

                    //Remove Order line
                    if (line.Quantity < 1) {
                        if (line.Id) {
                            let deletedLines = this.formGroup.get('DeletedLines').value;
                            deletedLines.push(line.Id);
                            this.formGroup.get('DeletedLines').setValue(deletedLines);
                            this.formGroup.get('DeletedLines').markAsDirty();
                        }
                        this.item.OrderLines.splice(idx, 1);
                        fa.removeAt(idx);
                    }
                    //Update 
                    else {
                        let cfg = <FormGroup>fa.controls[idx];

                        for (const lc in line) {
                            let fc = <FormControl>cfg.controls[lc];
                            if (fc) {
                                fc.setValue(line[lc]);
                                fc.markAsDirty();
                            }
                        }
                    }


                }
            }
            else {
                let fc = <FormControl>this.formGroup.controls[c];
                if (fc) {
                    fc.setValue(data[c]);
                    fc.markAsDirty();
                }
            }

        }
        //this.calcOrder();
        if (this.item.OrderLines.length) {
            //this.debounce(() => { this.saveChange() }, 5000);
            debugger;
            this.saveChange();
        }

    }
    async saveChange() {
        let submitItem = this.getDirtyValues(this.formGroup);
        console.log(submitItem);
        this.saveChange2();
    }
    savedChange(savedItem?: any, form?: FormGroup<any>): void {
        if (savedItem) {
            if (form.controls.Id && savedItem.Id && form.controls.Id.value != savedItem.Id)
                form.controls.Id.setValue(savedItem.Id);

            if (this.pageConfig.isDetailPage && form == this.formGroup && this.id == 0) {
                this.id = savedItem.Id;
                let newURL = '#pos-customer-order/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);
            }

            this.item = savedItem;
        }
        this.loadedData();

        this.submitAttempt = false;
        this.env.showTranslateMessage('erp.app.app-component.page-bage.save-complete', 'success');

        // if (savedItem.Status == "Done") {
        //     this.sendPrint(savedItem.Status, true);
        // }
    }
    private calcOrder() {
        this.item._TotalQuantity = this.item.OrderLines?.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
        this.item.OriginalTotalBeforeDiscount = 0;
        this.item.OriginalTotalDiscount = 0;
        this.item.OriginalTax = 0;
        this.item.OriginalTotalAfterTax = 0;
        this.item.CalcOriginalTotalAdditions = 0;
        this.item.CalcTotalOriginal = 0;
        for (let m of this.menuList) for (let mi of m.Items) mi.BookedQuantity = 0;

        for (let line of this.item.OrderLines) {

            line._serviceCharge = 0;
            if (this.item.IDBranch == 174 //W-Cafe
                || this.item.IDBranch == 17 //The Log
                || (this.item.IDBranch == 416) //Gem Cafe && set menu  && line._item.IDMenu == 218
            ) {
                line._serviceCharge = 5;
            }

            //Parse data + Tính total
            line.UoMPrice = line.IsPromotionItem ? 0 : parseFloat(line.UoMPrice) || 0;
            line.TaxRate = parseFloat(line.TaxRate) || 0;
            line.Quantity = parseFloat(line.Quantity) || 0;         
            this.item.OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount;

            //line.OriginalPromotion
           
            this.item.OriginalTotalDiscount += line.OriginalTotalDiscount;

            
            this.item.OriginalTax += line.OriginalTax;           
            this.item.OriginalTotalAfterTax += line.OriginalTotalAfterTax;
            this.item.CalcOriginalTotalAdditions += line.CalcOriginalTotalAdditions; 
            this.item.CalcTotalOriginal += line.CalcTotalOriginal ;    
            line._OriginalTotalAfterDiscountFromSalesman = line.CalcTotalOriginal - line.OriginalDiscountFromSalesman;



            //Lấy hình & hiển thị thông tin số lượng đặt hàng lên menu
            for (let m of this.menuList)
                for (let mi of m.Items) {
                    if (mi.Id == line.IDItem) {
                        mi.BookedQuantity = this.item.OrderLines.filter(x => x.IDItem == line.IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
                        line._item = mi;
                    }
                }

            line._background = { 'background-image': 'url("' + environment.posImagesServer + ((line._item && line._item.Image) ? line._item.Image : 'assets/pos-icons/POS-Item-demo.png') + '")' };

        }
    }
}
