import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, POS_TerminalProvider, SALE_OrderProvider, SYS_ConfigProvider, SYS_PrinterProvider, } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';

import { POSMemoModalPage } from '../pos-memo-modal/pos-memo-modal.page';
import * as qz from 'qz-tray';
import html2canvas from 'html2canvas';
import { KJUR, KEYUTIL, stob64, hextorstr } from 'jsrsasign';
import { environment } from 'src/environments/environment';
import { POSVoucherModalPage } from '../pos-voucher-modal/pos-voucher-modal.page';
import { POSContactModalPage } from '../pos-contact-modal/pos-contact-modal.page';
import { POSInvoiceModalPage } from '../pos-invoice-modal/pos-invoice-modal.page';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Component({
    selector: 'app-pos-order-detail',
    templateUrl: './pos-order-detail.page.html',
    styleUrls: ['./pos-order-detail.page.scss'],
})
export class POSOrderDetailPage extends PageBase {
    isOpenMemoModal = false;
    AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
    segmentView = 'all';
    idTable: any; //Default table
    tableList = [];
    menuList = [];
    dealList = [];
    paymentList = [];
    paymentType = [];
    statusList; //Show on bill
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered'];
    noLockLineStatusList = ['New', 'Waiting'];
    kitchenQuery = 'all';
    OrderAdditionTypeList = [];
    OrderDeductionTypeList = [];

    printData = {
        undeliveredItems: [], //To track undelivered items to the kitchen
        printDate: null,
        currentBranch: null,
        selectedTables: [],
    }

    constructor(
        public pageProvider: SALE_OrderProvider,
        public menuProvider: POS_MenuProvider,
        public tableGroupProvider: POS_TableGroupProvider,
        public tableProvider: POS_TableProvider,
        public contactProvider: CRM_ContactProvider,
        public sysConfigProvider: SYS_ConfigProvider,
        public printerProvider: SYS_PrinterProvider,
        public printerTerminalProvider: POS_TerminalProvider,
        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,
        public modalController: ModalController,
        public alertCtrl: AlertController,
        public popoverCtrl: PopoverController,
        public formBuilder: FormBuilder,
        public cdr: ChangeDetectorRef,
        public loadingController: LoadingController,
        public commonService: CommonService,
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
            IDBranch: [this.env.selectedBranch],
            //OrderDate: [new Date()],
            IDContact: [922],
            IDAddress: [902],
            IDType: [293],
            IDStatus: [101],
            Type: ['POSOrder'],
            SubType: ['TableService'],
            Status: new FormControl({ value: 'New', disabled: true }),
            IDOwner: [this.env.user.StaffID],
            NumberOfGuests : [1 ,Validators.required],
            IsCOD: [],
            IsInvoiceRequired: [],

            InvoicDate: new FormControl({ value: null, disabled: true }),
            InvoiceNumber: new FormControl({ value: null, disabled: true }),

            IsDebt: new FormControl({ value: null, disabled: true }),
            Debt: new FormControl({ value: null, disabled: true }),
            IsPaymentReceived: new FormControl({ value: null, disabled: true }),
            Received: new FormControl({ value: null, disabled: true }),
            ReceivedDiscountFromSalesman: new FormControl({ value: null, disabled: true }),

            // ExpectedDeliveryDate
            // PaymentMethod
            // ProductDimensions
            // ProductWeight
            // TaxRate

            // TotalBeforeDiscount
            // Promotion
            // Discount1
            // Discount2
            // DiscountByItem
            // DiscountByGroup
            // DiscountByOrder
            // DiscountByLine
            // TotalDiscount
            // TotalAfterDiscount
            // Tax
            // TotalAfterTax
            // DiscountFromSalesman


            // OriginalTotalBeforeDiscount
            // OriginalPromotion
            // OriginalDiscount1
            // OriginalDiscount2
            // OriginalDiscountByItem
            // OriginalDiscountByGroup
            // OriginalDiscountByOrder
            // OriginalDiscountByLine
            // OriginalTotalDiscount
            // OriginalTax
            // OriginalTotalAfterTax
            // OriginalTotalAfterDiscount
            // OriginalDiscountFromSalesman



        });
        
    }
    ngOnInit() {
        
        this.pageConfig.subscribePOSOrderDetail = this.env.getEvents().subscribe((data) => {         
			switch (data.Code) {
				case 'app:POSOrderFromCustomer':
					this.notify(data.Data)
					break;
            }
        });
        super.ngOnInit();
    }
    private notify(data){
        if(this.id == data.id){
            this.env.showMessage("Khách gọi món","warning");
            this.refresh();
        }
    }
    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrderDetail?.unsubscribe();
        super.ngOnDestroy();
    }
    preLoadData(event?: any): void {
        let forceReload = event === 'force';
        Promise.all([           
            this.env.getStatus('POSOrder'),
            this.getTableGroupFlat(forceReload),
            this.getMenu(forceReload),
            this.getDeal(),
            this.sysConfigProvider.read({ Code: 'SODefaultBusinessPartner' }),  
            this.env.getType('PaymentType'),       
        ]).then((values: any) => {              
            this.statusList = values[0];
            this.tableList = values[1];
            this.menuList = values[2];
            this.dealList = values[3];                     
            if (values[4]['data'].length) {
                let dbp = JSON.parse(values[4]['data'][0].Value);
                this.contactListSelected.push(dbp);
            }   
            this.paymentType = values[5];            
            super.preLoadData(event);
        }).catch(err => {
            this.loadedData();
        })
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        super.loadedData(event, ignoredFromGroup);
        if (!this.item?.Id) {
            
            Object.assign(this.item, this.formGroup.getRawValue());
            this.setOrderValue(this.item);
        }
        else {
            this.patchOrderValue();
            this.getPayments();
        }       
        this.loadOrder();
        this.contactSearch(); 
    }

    refresh(event?: any): void {
        this.preLoadData('force');
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


        if (!this.pageConfig.canEdit) {
            this.env.showTranslateMessage('Đơn hàng đã khóa, không thể chỉnh sửa hoặc thêm món!', 'warning');
            return;
        }

        if (this.item.Tables == null || this.item.Tables.length == 0) {
            this.env.showTranslateMessage('Vui lòng chọn bàn trước khi thêm món!', 'warning');
            return;
        }

        if (!item.UoMs.length) {
            this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
            return;
        }

        let uom = item.UoMs.find(d => d.Id == idUoM);
        let price = uom.PriceList.find(d => d.Type == 'SalePriceList');

        let line = this.item.OrderLines.find(d => d.IDUoM == idUoM); //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
        if (!line) {
            let UoMPrice = price.Price;
            if(price.NewPrice){
                UoMPrice = price.NewPrice;
            }
            line = {

                IDOrder: this.item.Id,
                Id: 0,
                Type: 'TableService',
                Status: 'New',

                IDItem: item.Id,
                IDTax: item.IDSalesTaxDefinition,
                TaxRate: item.SaleVAT,
                IDUoM: idUoM,
                UoMPrice: UoMPrice,

                Quantity: 1,
                IDBaseUoM: idUoM,
                UoMSwap: 1,
                UoMSwapAlter: 1,
                BaseQuantity: 0,

                ShippedQuantity: 0,

                Remark: null,
                IsPromotionItem: false,
                IDPromotion: null,
                          
                OriginalDiscountFromSalesman : 0,
            };           
            this.item.OrderLines.push(line);
            this.addOrderLine(line);
            this.setOrderValue({ OrderLines: [line] });
        }
        else {
            if ((line.Quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
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
					let tempQty = line.Quantity;
                    tempQty += quantity;
                    if (tempQty == 0 && this.item.OrderLines.length == 1) {
                        this.env.showMessage('Đơn hàng phải có ít nhất 1 sản phẩm!','warning');
                        return;
                    }
                this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sẩn phẩm').then(_ => {
                    
                    line.Quantity += quantity;
                    this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                }).catch(_ => { });
            }
        }
    }

    async openQuickMemo(line) {
        if (this.submitAttempt) return;

        const modal = await this.modalController.create({
            component: POSMemoModalPage,
            id: 'POSMemoModalPage',
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-quick-memo',
            componentProps: {
                item: JSON.parse(JSON.stringify(line))
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();

        if (role == 'confirm') {
            line.Remark = data ? data.toString() : null;
            this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Remark: line.Remark }] });
        }
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

    async processDiscounts() {
        const modal = await this.modalController.create({
            component: POSDiscountModalPage,
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-change-table',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data,role } = await modal.onWillDismiss();
        if (role == 'confirm') {
            this.refresh();     
        }
    }
    async processVouchers() {
        const modal = await this.modalController.create({
            component: POSVoucherModalPage,
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-change-table',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data,role } = await modal.onWillDismiss();
        if (role == 'confirm') {
            this.item = data;
        }
    }
    async processPayments() {
        const modal = await this.modalController.create({
            component: POSPaymentModalPage,
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-change-table',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data , role } = await modal.onWillDismiss();
        if (role == 'Done') {
            this.formGroup.controls.IDStatus.patchValue(114);
            this.formGroup.controls.IDStatus.markAsDirty();
            this.formGroup.controls.Status.patchValue("Done");
            this.formGroup.controls.Status.markAsDirty();
            this.saveSO();
        } 
    }
    InvoiceRequired(){
        if(this.pageConfig.canEdit == false){
            this.env.showTranslateMessage('Đơn hàng đã khóa không thể chỉnh sửa', 'warning');
            return  false;
        }
        if(!this.item._Customer){
            this.env.showTranslateMessage('Vui lòng chọn khách hàng', 'warning');
            return  false; 
        }
        if(this.item._Customer.Id == 922){
            this.env.showTranslateMessage('Không thể xuất hóa đơn cho khách lẻ', 'warning');
            return  false;
        }
        if(this.item.IsInvoiceRequired == false){
            this.processInvoice();
        }
        else{
            this.formGroup.controls.IsInvoiceRequired.patchValue(false);
            this.formGroup.controls.IsInvoiceRequired.markAsDirty();
            this.saveChange();
        } 
    }
    async processInvoice(){
        const modal = await this.modalController.create({
            component: POSInvoiceModalPage,
            swipeToClose: true,
            cssClass: 'my-custom-class',
            componentProps: {
                id: this.item.IDContact
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();
        if(data == true){
            this.item.IsInvoiceRequired = true;
            this.formGroup.controls.IsInvoiceRequired.patchValue(true);
            this.formGroup.controls.IsInvoiceRequired.markAsDirty();
            this.saveChange();
        }  
        else{
            this.item.IsInvoiceRequired = false;
        }  
    }
    cancelPOSOrder() {
        this.env.showPrompt('Bạn chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng').then(_ => {
            let publishEventCode = this.pageConfig.pageName;
            if (this.submitAttempt == false) {
                this.submitAttempt = true;

                this.pageProvider.commonService.connect('POST', 'SALE/Order/CancelOrders/', { Type: 'POSOrder', Ids: [this.item.Id] }).toPromise()
                    .then((savedItem: any) => {
                        if (publishEventCode) {
                            this.env.publishEvent({ Code: publishEventCode });
                        }
                        this.loadData();
                        this.submitAttempt = false;

                    }).catch(err => {
                        this.submitAttempt = false;
                    });
            }
        }).catch(_ => { });
    }

    async sendKitchen() {
        if (this.submitAttempt) return;
        this.submitAttempt = true;
        let idx = 0;
        let idx2 = 0;

        let skipTime = 0;
        this.printData.undeliveredItems = [];

        let printerCodeList = [];
        let base64dataList = [];

        this.item.IDOwner = this.env.user.StaffID;
        this.item.OrderLines.forEach(e => {
            e._undeliveredQuantity = e.Quantity - e.ShippedQuantity;
            if (e._undeliveredQuantity > 0) {
                this.printData.undeliveredItems.push(e);
            }
        });

        const newKitchenList = [...new Map(this.printData.undeliveredItems.map((item: any) => [item['_IDKitchen'], item._item.Kitchen])).values()];
        for (let index = 0; index < newKitchenList.length; index++) {
            this.item.Status = "New";
            
            //this.item.PaymentMethod = this.item.PaymentMethod.toString();
            this.item.OrderLines.forEach(e => {
                if (e.Remark) {
                    e.Remark = e.Remark.toString();
                }
            });

            if (this.printData.undeliveredItems.length == 0) {
                this.env.showTranslateMessage('Không có sản phẩm mới cần gửi đơn!', 'success');
                this.submitAttempt = false;
                return;
            }

            let object: any = document.getElementById('bill');
            object.classList.add("show-bill");

            var opt = { // Make Bill Printing Clearer
                logging: true,
                scale: 7,
            };

            await this.setKitchenID(newKitchenList[idx].Id);

            Promise.all([
                newKitchenList[idx2],
                html2canvas(object, opt),
                idx2++
            ]).then((values: any) => {
                let printerInfo = values[0];
                let canvasResult = values[1];

                let printerCode = printerInfo.Printer.Code;
                let printerHost = printerInfo.Printer.Host;
                let temp = canvasResult.toDataURL();
                let base64data = temp.split(',')[1];

                let data =
                    [{
                        type: 'Pixel',
                        format: 'image',
                        flavor: 'base64',
                        data: base64data
                    }];
                printerCodeList.push(printerCode);
                base64dataList.push(data);

                if (idx == base64dataList.length) {
                    this.QZsetCertificate().then(() => {
                        this.QZsignMessage().then(() => {
                            this.sendQZTray(printerHost, printerCodeList, base64dataList, skipTime, false).catch(err => {
                                this.submitAttempt = false;
                                skipTime++;
                            });
                        });
                    });
                }
            });
            idx++;
        }
    }

    async sendPrint(Status?, receipt = true) {
        this.printData.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");

        if (this.submitAttempt) return;
        this.submitAttempt = true;
        let idx = 0;
        let idx2 = 0;

        let skipTime = 0;
        this.printData.undeliveredItems = [];

        let printerCodeList = [];
        let base64dataList = [];

        this.printData.undeliveredItems.push(this.item.OrderLines[0]);
        let newKitchenList = [];

        this.printerTerminalProvider.search({ IDBranch: this.env.selectedBranch, IsDeleted: false, IsDisabled: false }).toPromise().then(async (results: any) => {
            this.printerProvider.search({Id:results[0].IDPrinter}).toPromise().then(async (defaultPrinter: any) => {
                if (defaultPrinter && defaultPrinter.length != 0) {
                    defaultPrinter.forEach((p: any) => {
                        let Info = {
                            Id: p.Id,
                            Name: p.Name,
                            Code: p.Code,
                            Host: p.Host,
                            Port: p.Port
                        }
                        newKitchenList.push({ 'Printer': Info });
                    });
                }
                else {
                    this.env.showTranslateMessage('Recheck Receipt Printer information!', 'warning');
                    return
                }
    
                for (let index = 0; index < newKitchenList.length; index++) {
                    if (Status) {
                        this.item.Status = Status;
                    }
                    //this.item.PaymentMethod = this.item.PaymentMethod.toString();
                    this.item.OrderLines.forEach(e => {
                        if (e.Remark) {
                            e.Remark = e.Remark.toString();
                        }
                    });
    
                    let object: any = document.getElementById('bill');
                    let list = object.classList;
                    list.add("show-bill");
    
                    var opt = { // Make Bill Printing Clearer
                        logging: true,
                        scale: 7,
                    };
    
                    await this.setKitchenID('all').then(_=> {
                        Promise.all([
                            newKitchenList[idx2],
                            html2canvas(object, opt),
                            idx2++
                        ]).then((values: any) => {
                            let printerInfo = values[0];
                            let canvasResult = values[1];
        
                            let printerCode = printerInfo.Printer.Code;
                            let printerHost = printerInfo.Printer.Host;
                            let temp = canvasResult.toDataURL();
                            let base64data = temp.split(',')[1];
        
                            let data =
                                [{
                                    type: 'Pixel',
                                    format: 'image',
                                    flavor: 'base64',
                                    data: base64data
                                }];
        
                            printerCodeList.push(printerCode);
                            base64dataList.push(data);
        
                            if (idx == base64dataList.length) {
                                this.QZsetCertificate().then(() => {
                                    this.QZsignMessage().then(() => {
                                        this.sendQZTray(printerHost, printerCodeList, base64dataList, skipTime, receipt).catch(err => {
                                            this.submitAttempt = false;
                                            skipTime++;
                                        });
                                    });
                                });
                            }
                        });
                        idx++;
                    }); //Xem toàn bộ bill
                }
            });
        });
    }


    private UpdatePrice(){
        
        this.dealList.forEach(d=>{                     
            this.menuList.forEach(m=>{                             
                let index = m.Items.findIndex(i=>i.SalesUoM == d.IDItemUoM);
                if(index != -1){ 
                    let idexUom =  m.Items[index].UoMs.findIndex(u=>u.Id == d.IDItemUoM);                    
                    let newPrice = d.Price;
                    if(d.IsByPercent == true){
                        newPrice = d.OriginalPrice - (d.OriginalPrice * d.DiscountByPercent/100);
                    }      
                    m.Items[index].UoMs[idexUom].PriceList.find(p=>p.Type=="SalePriceList").NewPrice = newPrice;    
                    //m.Items[index].UoMs[idexUom].PriceList[0].NewPrice = m.Items[index].UoMs[idexUom].PriceList[0].Price;                 
                }
            });
        })           
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
        if (this.item._Customer) {
            this.contactListSelected.push(this.item._Customer);
        }
        this.UpdatePrice();
        this.calcOrder();

    }

    //Hàm này để tính và show số liệu ra bill ngay tức thời mà ko cần phải chờ response từ server gửi về. 
    private calcOrder() {
        this.item._TotalQuantity = this.item.OrderLines?.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
        this.item.OriginalTotalBeforeDiscount = 0;
        this.item.OriginalDiscountFromSalesman = 0;
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
            line.OriginalTotalBeforeDiscount = line.UoMPrice * line.Quantity;
            this.item.OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount;

            //line.OriginalPromotion
            line.OriginalDiscount1 = line.IsPromotionItem ? 0 : parseFloat(line.OriginalDiscount1) || 0;
            line.OriginalDiscount2 = line.IsPromotionItem ? 0 : parseFloat(line.OriginalDiscount2) || 0;
            line.OriginalDiscountByItem = line.OriginalDiscount1 + line.OriginalDiscount2;
            line.OriginalDiscountByGroup = 0;
            line.OriginalDiscountByLine = line.OriginalDiscountByItem + line.OriginalDiscountByGroup;
            line.OriginalDiscountByOrder = 0;
            line.OriginalTotalDiscount = line.OriginalDiscountByLine + line.OriginalDiscountByOrder;
            this.item.OriginalTotalDiscount += line.OriginalTotalDiscount;

            line.OriginalTotalAfterDiscount = line.OriginalTotalBeforeDiscount - line.OriginalTotalDiscount;
            line.OriginalTax = line.OriginalTotalAfterDiscount * (line.TaxRate / 100.0);
            this.item.OriginalTax += line.OriginalTax;
            line.OriginalTotalAfterTax = line.OriginalTotalAfterDiscount + line.OriginalTax;
            this.item.OriginalTotalAfterTax += line.OriginalTotalAfterTax;
            line.CalcOriginalTotalAdditions = line.OriginalTotalAfterDiscount * (line._serviceCharge / 100.0) * (1 + line.TaxRate / 100.0);
            this.item.CalcOriginalTotalAdditions += line.CalcOriginalTotalAdditions;


            line.CalcTotalOriginal = line.OriginalTotalAfterTax + line.CalcOriginalTotalAdditions;
            this.item.CalcTotalOriginal += line.CalcTotalOriginal;
            line.OriginalDiscountFromSalesman = parseFloat(line.OriginalDiscountFromSalesman) || 0;
            line._OriginalTotalAfterDiscountFromSalesman = line.CalcTotalOriginal - line.OriginalDiscountFromSalesman;

            this.item.OriginalDiscountFromSalesman += line.OriginalDiscountFromSalesman;

            //Lấy hình & hiển thị thông tin số lượng đặt hàng lên menu
            for (let m of this.menuList)
                for (let mi of m.Items) {
                    if (mi.Id == line.IDItem) {
                        mi.BookedQuantity = this.item.OrderLines.filter(x => x.IDItem == line.IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
                        line._item = mi;
                    }
                }

            line._background = { 'background-image': 'url("' + environment.posImagesServer + ((line._item && line._item.Image) ? line._item.Image : 'assets/pos-icons/POS-Item-demo.png') + '")' };


            //Tính số lượng item chưa gửi bếp
            line._undeliveredQuantity = line.Quantity - line.ShippedQuantity;
            if (line._undeliveredQuantity > 0) {
                this.printData.undeliveredItems.push(line);
                line.Status = 'New';
            }
            else {
                line.Status = 'Waiting';
            }

            line._Locked = this.item._Locked ? true : this.noLockLineStatusList.indexOf(line.Status) == -1;


        }
    }


    //patch value to form
    private patchOrderValue() {
        this.formGroup?.patchValue(this.item);
        this.patchOrderLinesValue();
    }

    private patchOrderLinesValue() {
        this.formGroup.controls.OrderLines = new FormArray([]);
        if (this.item.OrderLines?.length) {
            for (let i of this.item.OrderLines) {
                this.addOrderLine(i);
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
                     
            OriginalDiscountFromSalesman: [line.OriginalDiscountFromSalesman],



            // OriginalTotalBeforeDiscount
            // OriginalPromotion
            // OriginalDiscount1
            // OriginalDiscount2
            // OriginalDiscountByItem
            // OriginalDiscountByGroup
            // OriginalDiscountByLine
            // OriginalDiscountByOrder
            // OriginalDiscountFromSalesman
            // OriginalTotalDiscount
            // OriginalTotalAfterDiscount
            // OriginalTax
            // OriginalTotalAfterTax
            // CalcOriginalTotalAdditions
            // CalcOriginalTotalDeductions
            // CalcTotalOriginal

            // ShippedQuantity
            // ReturnedQuantity

            // TotalBeforeDiscount
            // Discount1
            // Discount2
            // DiscountByItem
            // Promotion
            // DiscountByGroup
            // DiscountByLine
            // DiscountByOrder
            // DiscountFromSalesman
            // TotalDiscount
            // TotalAfterDiscount
            // Tax
            // TotalAfterTax
            // CalcTotalAdditions
            // CalcTotalDeductions
            // CalcTotal


            // CreatedBy
            // ModifiedBy
            // CreatedDate
            // ModifiedDate

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
        this.calcOrder();
       
        // if (this.item.OrderLines.length || this.item.DeletedLines.length) {
        //     this.debounce(() => { this.saveChange() }, 10000);
        // }

    }



    changeTable() {
        this.saveSO();
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
                switchMap(term => this.contactProvider.search({ Take: 20, Skip: 0, SkipMCP: true, Term: term ? term : 'BP:'+  this.item.IDContact }).pipe(
                    catchError(() => of([])), // empty list on error
                    tap(() => this.contactListLoading = false)
                ))

            )
        );
    }

    async addContact() {
        const modal = await this.modalController.create({
            component: POSContactModalPage,
            swipeToClose: true,
            cssClass: 'my-custom-class',
            componentProps: {
                item: null
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();
        if(data){             
            this.changedIDAddress(data); 
            this.contactListSelected.push(data);
            this.contactListSelected = [...this.contactListSelected];
            this.contactSearch();                                 
        }
        
    }

    changedIDAddress(address) { 
              
        if (address) {

            this.setOrderValue({
                IDContact: address.Id,
                IDAddress: address.IDAddress
            });
            this.item._Customer = address;
        }
    }



    segmentChanged(ev: any) {
        this.segmentView = ev;
    }




    kitchenList = [];
    calcTotalLine() {
        this.kitchenList = [];
        this.item.OrderLines.forEach(i => {
            i.TotalBeforeDiscount = i.Quantity * (i.UoMPrice || 0);
            i.VoucherDiscount = (i.VoucherDiscount || 0);
            i.TotalDiscount = (this.item.TotalDiscount / this.item.TotalBeforeDiscount) * i.TotalBeforeDiscount;
            i.TotalDiscount = (i.TotalDiscount || 0);
            i.TotalAfterDiscount = i.TotalBeforeDiscount - ((i.TotalDiscount) > i.TotalBeforeDiscount ? i.TotalBeforeDiscount : (i.TotalDiscount));

            i.TotalAfterServiceCharge = i.TotalAfterDiscount + i.ServiceCharge;
            i.Tax = i.TotalAfterServiceCharge * (i.TaxRate / 100 || 0);
            i.TotalAfterTax = i.TotalAfterServiceCharge + i.Tax;

            if (i._item?.Kitchen) {
                i._IDKitchen = i._item?.Kitchen.Id;
                if (this.kitchenList.findIndex(d => d.Id == i._item.Kitchen.Id) == -1) {
                    this.kitchenList.push(i._item.Kitchen);
                }
            }

        });
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
                let newURL = '#pos-order/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);
            }

            this.item = savedItem;
        }
        this.loadedData();

        this.submitAttempt = false;
        this.env.showTranslateMessage('erp.app.app-component.page-bage.save-complete', 'success');

        if (savedItem.Status == "Done") {
            this.sendPrint(savedItem.Status, true);
        }
    }


    async setKitchenID(value, ms = 1) {
        return new Promise((resolve, reject) => {
            this.kitchenQuery = value;
            setTimeout(() => {
                resolve(this.kitchenQuery);
            }, ms);
        });
    }

    async sendQZTray(printerHost, printerCodeList, base64dataList, skipTime, receipt) {

        //Flow: 
        // Open Connection >> 
        // Get Printer List from DB >> 
        // Check printer match ? (create printer config) : (create PDF config) >> 
        // QZ Printing >> 
        // Update item Quantity >> 
        // Save Order >> 
        // Close Connection >> Done.


        let actualPrinters = [];

        let ConnectOption =
        {
            // host: '192.168.1.97', //<< Use for test
            host: printerHost,
            keepAlive: 60,
            retries: 10,
        }

        let checkCon = qz.websocket.isActive();
        // if (checkCon) {
        //     qz.websocket.disconnect();
        // }

        await this.QZConnect(ConnectOption).then(() => {

            this.QZFindPrinter().then(async (printersDB) => {
                if (printerCodeList.length != 0) {
                    printerCodeList.forEach(p => {
                        if (printersDB.indexOf(p) > -1) { // Use this when fixed Printer
                            let config = qz.configs.create(p, { copies: 1 });
                            actualPrinters.push(config);
                        }
                        else {
                            // let config = qz.configs.create("PDF");
                            // actualPrinters.push(config);
                            this.env.showTranslateMessage("Printer " + p + " Not Found! Using PDF Printing Instead!", "warning");
                        }

                        // let config = qz.configs.create("PDF"); // USE For test
                        // actualPrinters.push(config);
                    });
                }
                else {
                    this.env.showTranslateMessage("No Printers Available, Please Check Printers' IP  / Printers' Power", "warning");
                    this.QCCloseConnection();
                    return;
                }

                await this.QZActualPrinting(actualPrinters, base64dataList).then(async () => {
                    await this.QZCheckData(skipTime, receipt).then(_ => {
                        if (this.item.Status == "Done" || this.item.Status == "Cancelled") {
                            this.nav('/pos-order', 'back');
                        }
                    });
                }).catch(err => {
                    this.submitAttempt = false;
                    this.QCCloseConnection();
                });
            }).catch(err => {
                this.submitAttempt = false;
                this.QCCloseConnection();
            });

        }).catch(err => {
            err;
            this.submitAttempt = false;
            this.QCCloseConnection();
        });
    }

    async QZsetCertificate() {
        /// Authentication setup ///
        qz.security.setCertificatePromise(function (resolve, reject) {
            resolve(
                "-----BEGIN CERTIFICATE-----\n" +
                "MIIEJzCCAw+gAwIBAgIUP4UAUIrS+ZMLzXTc4ZGmFwtrtZwwDQYJKoZIhvcNAQEL\n" +
                "BQAwgaIxCzAJBgNVBAYTAlZOMRQwEgYDVQQIDAtIbyBDaGkgTWluaDESMBAGA1UE\n" +
                "BwwJUGh1IE5odWFuMRMwEQYDVQQKDApJbmhvbGRpbmdzMRYwFAYDVQQLDA1pbmhv\n" +
                "bGRpbmdzLnZuMRkwFwYDVQQDDBBQT1MgUHJpbnQgQ2xpZW50MSEwHwYJKoZIhvcN\n" +
                "AQkBFhJ0ZXN0QGluaG9sZGluZ3Mudm4wHhcNMjIwOTI1MTM1NTI3WhcNMjMwOTI1\n" +
                "MTM1NTI3WjCBojELMAkGA1UEBhMCVk4xFDASBgNVBAgMC0hvIENoaSBNaW5oMRIw\n" +
                "EAYDVQQHDAlQaHUgTmh1YW4xEzARBgNVBAoMCkluaG9sZGluZ3MxFjAUBgNVBAsM\n" +
                "DWluaG9sZGluZ3Mudm4xGTAXBgNVBAMMEFBPUyBQcmludCBDbGllbnQxITAfBgkq\n" +
                "hkiG9w0BCQEWEnRlc3RAaW5ob2xkaW5ncy52bjCCASIwDQYJKoZIhvcNAQEBBQAD\n" +
                "ggEPADCCAQoCggEBAJBf111zS/Dr3uMyFapT7ke2gv1iBgvh7jUdYZBVtKLie3S0\n" +
                "zkZ2wtNiixDT9eJ77B1itYidy5ytL2RBHXqDzWNpostQIf8eU8fD4jnYwTw35ngd\n" +
                "6xEEqIBaM4EO4J4J7KAH4gsCM2h3nWCvj2J1doyuOHct1Z5vw9zgeYFFyBILbdqn\n" +
                "USA9UfomJvyxJUpqEbshS74vk/Y2GkOGvysvmkhEQSo2QIbh2b4+TAcSeAKshmM+\n" +
                "tUfS51+97BtdpHmm9HbtqKbfYByu6/Fs8yNeeeNS/XmiubHJCipBSoMZpN/60sfw\n" +
                "kJ76P9R9Z0WY7aHZ0BvETxjY1anIWpISTehKH/UCAwEAAaNTMFEwHQYDVR0OBBYE\n" +
                "FHoXLOUeEJNf0ZmULwH/17usIuFLMB8GA1UdIwQYMBaAFHoXLOUeEJNf0ZmULwH/\n" +
                "17usIuFLMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAIDcSH81\n" +
                "qVyxDJvZs8LfjbgsctIAjYhp/LgC+22JwfWykg5ZVJ5gFXnxdVgZlLywmAQUQRwb\n" +
                "TCZtI9k4jDznqOIeh5j8ikiufQA/OSn6qjnhsQSsKiTi0XraHAzC2r+PSOHQ8eOL\n" +
                "iNeguOD3K0DwlJo9rG55O3vNf9fxTxA0vGt90+ghrBeVU5xnE6v0FBlwA/zenZKn\n" +
                "MQnaBcbRZZoZGNXmvRQTIj1ZRU3DoAVS2eynSn8+wV7K63Aaoxj2lGvabGY20UVr\n" +
                "mWO/G3e2a+816GZtiPkn7dmLgy5+n5KysSemi8WaYeuG2A5GxElVAhiLu3Gydlur\n" +
                "y9qArmIOTNgB+Ck=\n" +
                "-----END CERTIFICATE-----\n"
            );
        });
    }

    async QZsignMessage() {
        var privateKey = "-----BEGIN PRIVATE KEY-----\n" +
            "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCQX9ddc0vw697j\n" +
            "MhWqU+5HtoL9YgYL4e41HWGQVbSi4nt0tM5GdsLTYosQ0/Xie+wdYrWIncucrS9k\n" +
            "QR16g81jaaLLUCH/HlPHw+I52ME8N+Z4HesRBKiAWjOBDuCeCeygB+ILAjNod51g\n" +
            "r49idXaMrjh3LdWeb8Pc4HmBRcgSC23ap1EgPVH6Jib8sSVKahG7IUu+L5P2NhpD\n" +
            "hr8rL5pIREEqNkCG4dm+PkwHEngCrIZjPrVH0udfvewbXaR5pvR27aim32Acruvx\n" +
            "bPMjXnnjUv15ormxyQoqQUqDGaTf+tLH8JCe+j/UfWdFmO2h2dAbxE8Y2NWpyFqS\n" +
            "Ek3oSh/1AgMBAAECggEAGb6lcloZfCQrcjsfpuhhkLMoh5N/vYWzyw/qsmi+Fd+q\n" +
            "ISUOtXz+/9/OKZmKerEbaSANfAebY9x0G34LCipPqT8Qkw2+ijY3vWMeR69xwdG8\n" +
            "DMZVAQtiGsU68vQatMPTSLQvKERjs2jFDRUxTd7hXXPByOrI8YA/nnb+48D0TNct\n" +
            "RR4P7VBacMSrdjfwvqpaODrWPgoQoONoVU5uDsnWPWEaO/rAM4Io9ziPawrM4zuq\n" +
            "gu4lFCT+87Sbbhm6mq8VKUQRAB9vnDKO1MXqW5eIGvMnO+o7Ow0OWylPk/bp+6sc\n" +
            "BPQcC4ht4CjjfdXZ8/ZGyCgV4cXyycXa6qxwlIDDYQKBgQDJC4Z1d/TMXK6XjraG\n" +
            "TCmlqWp2d1AopO1c7fNnBXZU8+ZHKWEOY/EX+GjOT7yUoAw9rFW0fISfddmOXb0m\n" +
            "nDakpJ4mZ3/vgIK2lWMtGNFk1JtZMOBIvhYRrYJBXzUeWJ5LwxtpDeWHjRYn0TSC\n" +
            "kmj1Z8KRdeaBXicRXOUbQFdqxQKBgQC31rCAzng3QYx0BGVjzUeOEJ4fyqDXlkk6\n" +
            "RK45ugQfJ380dOObFKOd6nh0cqVJY1Y82bnJDIoBJKRBpGj6dIG4HhO+kkxEcgXJ\n" +
            "DQe4+W8tQK2rr9ODce9VZ/nec3nYpq83jgvt+UaL0cwWSgIh4LM+sVvvsaYj4971\n" +
            "A0omy5/zcQKBgEO9cGawLnmVWPaUDYgerYG2Hbsg5I9tUtUXEAZMXtys+ZBMrvks\n" +
            "T5XmC1pIn5/sdXNqV85ijkU0bkN77jnONNMw7GDASukmAeUHXM1bKWKyCE37G/cm\n" +
            "pUT7k4H3VGyPK3cXnGq/VfFgZnCwGuNL9bWKapKciThZwwwkosWV3l6JAoGAWfcu\n" +
            "mVpxalkhqwUbuSOUiOmI+HXpEJfzbhh+SrHFoplpnvo1CIepKna8TABu8uMyKMVE\n" +
            "Lid8weJ0n8sdtLOfZ8MQVoqx2C0Ut7cwuE0ZI0QruYFqOUFgpqMjnMFWN7gat01E\n" +
            "eUksRPB+t8mwEXQtQ9j37O07KQUy7ySU/TdZJ4ECgYEAj8K18PVHKqVGrWL6/s+J\n" +
            "TfrOPwZXa3Hr/P8Cc01wewKZA9RTisl2cMp3k0YwGiIs8Ki51en7F230iC3tg2Vo\n" +
            "7xIo4TXmLNfXSq2L5RyMqDmMVmUMOwcEFs6rqXKc2xeMeY31995cfY+x7wkAdS8V\n" +
            "E7blzos2DBPw7nGs7E2/YRE=\n" +
            "-----END PRIVATE KEY-----\n" +
            "";

        qz.security.setSignatureAlgorithm("SHA512"); // Since 2.1
        qz.security.setSignaturePromise(function (toSign) {
            return function (resolve, reject) {
                try {

                    var pk = KEYUTIL.getKey(privateKey);
                    var sig = new KJUR.crypto.Signature({ "alg": "SHA512withRSA" });  // Use "SHA1withRSA" for QZ Tray 2.0 and older
                    sig.init(pk);
                    sig.updateString(toSign);
                    var hex = sig.sign();
                    // console.log("DEBUG: \n\n" + stob64(hextorstr(hex)));
                    resolve(stob64(hextorstr(hex)));
                } catch (err) {
                    console.error(err);
                    reject(err);
                }
            };
        });
    }

    async QZConnect(options) {
        return qz.websocket.connect(options);
    }

    async QZFindPrinter(printerCode = null) {
        if (printerCode == null) {
            return qz.printers.find();
        }
        else {
            return qz.printers.find(printerCode);
        }
    }

    async QZGetDefaultPrinter(signature = null, signingTimestamp = null) {
        return qz.printers.getDefault(signature, signingTimestamp);
    }

    async QZActualPrinting(actualPrinters, base64dataList) {
        actualPrinters;
        base64dataList;

        return qz.print(actualPrinters, base64dataList, true);
    }

    async QZCheckData(skipTime, receipt = true) {
        if (!receipt) {
            this.item.OrderLines.forEach(e => {
                e.ShippedQuantity = e.Quantity;
                e.ReturnedQuantity =  e.Quantity - e.ShippedQuantity;
            });            
            this.pageProvider.save(this.item).then(data => {
                
                if (typeof this.item.PaymentMethod === 'string') {
                    let payments = this.item.PaymentMethod.split(',');
                    this.item.PaymentMethod = [];
                    this.item.PaymentMethod = payments;
                }
                this.item.OrderLines.forEach(e => {
                    if (e.Remark) {
                        if (typeof e.Remark === 'string') {
                            let Remark = e.Remark.split(',');
                            e.Remark = [];
                            e.Remark = Remark;
                        }
                    }
                    if (e.Image) {
                        e.imgPath = environment.posImagesServer + e.Image;
                    }
                });
            });
        }
        let object: any = document.getElementById('bill');
        object.classList.remove("show-bill");

        this.env.showTranslateMessage('Gửi đơn thành công!', 'success');
        this.submitAttempt = false;
        this.printData.undeliveredItems = []; //<-- clear;

        return qz.websocket.disconnect();

    }

    async QCCloseConnection() {
        let checkCon = qz.websocket.isActive();
        if (checkCon) {
            qz.websocket.disconnect();
        }
    }



    private saveSO() {
        Object.assign(this.item, this.formGroup.value);
        this.saveChange();
    }



    private getMenu(forceReload) {
        return new Promise((resolve, reject) => {
            this.env.getStorage('menuList' + this.env.selectedBranch).then(data => {
                if (!forceReload && data) {
                    resolve(data);
                }
                else {
                    this.menuProvider.read({ IDBranch: this.env.selectedBranch }).then(resp => {
                        let menuList = resp['data'];
                        menuList.forEach((m: any) => {
                            m.menuImage = environment.posImagesServer + (m.Image ? m.Image : 'assets/pos-icons/POS-Item-demo.png');
                            m.Items.sort((a, b) => a['Sort'] - b['Sort']);
                            m.Items.forEach(i => {
                                i.imgPath = environment.posImagesServer + (i.Image ? i.Image : 'assets/pos-icons/POS-Item-demo.png');
                            });
                        });
                        this.env.setStorage('menuList' + this.env.selectedBranch, menuList);
                        resolve(menuList);
                    }).catch(err => {
                        reject(err);
                    });
                }
            }).catch(err => {
                reject(err);
            });
        });
    }

    private getDeal(){
        let apiPath = {
            method: "GET",
            url: function(){return ApiSetting.apiDomain("PR/Deal/ForPOS")}  
        };  
        return new Promise((resolve, reject) => {                 
            this.commonService.connect(apiPath.method, apiPath.url(),this.query).toPromise()
					.then((result: any) => {					
						resolve(result);
					})
					.catch(err => {						
						reject(err);
					});
        });
    }

    private getTableGroupFlat(forceReload) {
        return new Promise((resolve, reject) => {
            this.getTableGroupTree(forceReload).then((data: any) => {
                let tableList = [];

                data.forEach(g => {
                    tableList.push({ Id: 0, Name: g.Name, levels: [], disabled: true });
                    g.TableList.forEach(t => {
                        tableList.push({ Id: t.Id, Name: t.Name, levels: [{}] });
                    });
                });

                resolve(tableList);

            }).catch(err => {
                reject(err);
            });
        })
    }

    private getTableGroupTree(forceReload) {
        return new Promise((resolve, reject) => {

            this.env.getStorage('tableGroup' + this.env.selectedBranch).then(data => {
                if (!forceReload && data) {
                    resolve(data);
                }
                else {
                    let query = { IDBranch: this.env.selectedBranch };
                    Promise.all([
                        this.tableGroupProvider.read(query),
                        this.tableProvider.read(query),
                    ]).then(values => {
                        let tableGroupList = values[0]['data'];
                        let tableList = values[1]['data'];

                        tableGroupList.forEach(g => {
                            g.TableList = tableList.filter(d => d.IDTableGroup == g.Id);
                        });
                        this.env.setStorage('tableGroup' + this.env.selectedBranch, tableGroupList);
                        resolve(tableGroupList);
                    }).catch(err => {
                        reject(err);
                    });
                }
            }).catch(err => {
                reject(err);
            });;
        })
    }
    search(ev) {
        var val = ev.target.value.toLowerCase();
        if (val == undefined) {
            val = '';
        }
        if (val.length > 2 || val == '') {
            this.query.Keyword = val;                  
        }

    }
    discountFromSalesman(line,form){
        let OriginalDiscountFromSalesman = form.controls.OriginalDiscountFromSalesman.value;     
        if(OriginalDiscountFromSalesman == ""){
            OriginalDiscountFromSalesman = 0;
        }
        
        if(OriginalDiscountFromSalesman > line.CalcTotalOriginal){
            this.env.showMessage("Số tiền tặng không lớn hơn số lượng thực tế!","danger");
            return false;
        }     
        this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Remark: line.Remark, OriginalDiscountFromSalesman: OriginalDiscountFromSalesman }] });
    }
    private getPayments(){
        let apiPath = {
            method: "GET",
            url: function(){return ApiSetting.apiDomain("BANK/IncomingPaymentDetail")}  
        };  
        return new Promise((resolve, reject) => {
            let query = {
                IDBranch:this.item.IDBranch,
                IDSaleOrder: this.item.Id,
                IsDeleted: false,
                Keyword: '',
                Take: 100,
                Skip: 0,
            }                 
            this.commonService.connect(apiPath.method, apiPath.url(),query).toPromise()
					.then((result: any) => {					
						this.paymentList = result.filter(p=>p.IncomingPayment.Status=="Success");
                        this.paymentList.forEach(e => {                          
                            e.IncomingPayment.TypeText = lib.getAttrib(e.IncomingPayment.Type, this.paymentType, 'Name', '--', 'Code');                          
                        });    
					})
					.catch(err => {						
						reject(err);
					});
        });
    }  
}



/*
1201
Mới
New

1202
Tiếp nhận
Confirmed

1203
Đã chuyển bếp/bar
Scheduled

1204
Đang chuẩn bị
Picking

1205
Đã lên món
Delivered

1206
Đơn đã chia
Splitted

1207
Đơn đã gộp
Merged

1208
Còn nợ
Debt

1209
Đã xong
Done

1210
Đã hủy
Cancelled





1301
Mới
New

1302
Chờ tiếp nhận
Waiting

1303
Đang thực hiện
Preparing

1304
Đã sẵn sàng
Ready

1305
Đang phục vụ
Serving

1306
Đã xong
Done

1307
Đã hủy
Cancelled

1308
Đã đổi trả
Returned



*/