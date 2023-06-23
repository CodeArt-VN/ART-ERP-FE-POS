import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';
import { POS_ForCustomerProvider } from 'src/app/services/custom.service';
import { POSCustomerMemoModalPage } from '../memo/pos-memo-modal.page';
import { POSForCustomerPaymentModalPage } from '../payment/pos-payment-modal.page';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-pos-customer-order',
    templateUrl: './pos-customer-order.page.html',
    styleUrls: ['./pos-customer-order.page.scss'],
})
export class POSCustomerOrderPage extends PageBase {
    ImagesServer = environment.posImagesServer;
    AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
    segmentView = 'all';
    AllowSendOrder = false;
    idTable: any; //Default table
    Table: any;
    menuList = [];
    IDBranch = null;
    Branch;
    dealList = [];
    soStatusList = []; //Show on bill
    soDetailStatusList = [];
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered'];
    noLockLineStatusList = ['New', 'Waiting'];
    printData = {
        undeliveredItems: [], //To track undelivered items to the kitchen
        printDate: null,
        currentBranch: null,
        selectedTables: [],
    }
    ipWhitelist = [];
    myIP = '';
    isWifiSecuredModalOpen = false;
    isLanguageModalOpen = false;
    OrderLines = [];
    childrenOrders;
    parentOrder;
    alertButtons = ['OK'];
    IsMyHandle = false;
    OrdersOfTable;
    constructor(
        public pageProvider: POS_ForCustomerProvider,
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
        public translate: TranslateService
    ) {
        super();
        this.pageConfig.isDetailPage = true;
        this.pageConfig.isShowFeature = false;
        this.pageConfig.canEdit = true;
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
            IDBranch: [''],
            IDOwner: [-1],
            IDContact: [-1],
            IDAddress: [-1],
            Type: ['POSOrder'],
            SubType: ['TableService'],
            Status: new FormControl({ value: 'New', disabled: true }),
            IDTable: [this.idTable],
            IsCOD: [],
            IsInvoiceRequired: [],
            NumberOfGuests: [1],
            InvoicDate: new FormControl({ value: null, disabled: true }),
            InvoiceNumber: new FormControl({ value: null, disabled: true }),

            IsDebt: new FormControl({ value: null, disabled: true }),
            Debt: new FormControl({ value: null, disabled: true }),
            IsPaymentReceived: new FormControl({ value: null, disabled: true }),
            Received: new FormControl({ value: null, disabled: true }),
            ReceivedDiscountFromSalesman: new FormControl({ value: null, disabled: true }),
        })
        Object.assign(this.query, { IDTable: this.idTable });
    }

    ////EVENTS
    ngOnInit() {
        this.pageConfig.subscribePOSOrder = this.env.getEvents().subscribe((data) => {
            switch (data.Code) {
                case 'app:POSOrderPaymentUpdate':
                    this.notifyPayment(data);                 
                    break;
                case 'app:POSOrderFromStaff':
                    this.notifyOrder(data.Data);
                    break;
                case 'app:POSOrderFromCustomer':
                    this.notifyFromCustomer(data.Data);				
					break;
            }
        });
        super.ngOnInit();
    }

    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrder?.unsubscribe();
        super.ngOnDestroy();
    }

    preLoadData(event?: any): void {
        let forceReload = event === 'force';
        this.AllowSendOrder = false;
        Promise.all([
            this.env.getStatus('POSOrder'),
            this.env.getStatus('POSOrderDetail'),
            this.getMenu(),
            this.getTable(),
            this.getDeal(),
        ]).then((values: any) => {
            this.soStatusList = values[0]; // Không load dược do không có token;
            this.soDetailStatusList = values[1]; // Không load dược do không có token;
            this.menuList = values[2];
            this.Table = values[3];
            this.dealList = values[4];
            this.checkIPConfig(event);
        }).catch(err => {
            this.loadedData(event);
        })
    }

    async checkIPConfig(event) {
        Promise.all([
            this.pageProvider.commonService.connect('GET', 'POS/ForCustomer/CheckIPCustomer', {IDBranch: this.Table.IDBranch}).toPromise(),
        ]).then((values: any) => {
            if (values[0]['canEdit']) {
                this.pageConfig.canEdit = true;
                this.isWifiSecuredModalOpen = false;
            }
            else {
                this.pageConfig.canEdit = false;
                this.isWifiSecuredModalOpen = true;
            }
            super.preLoadData(event);
        });
    }

    async loadedData(event?: any, ignoredFromGroup?: boolean): Promise<void> {
        super.loadedData(event, ignoredFromGroup);
        //await this.getOrdersOfTable(this.idTable);
        this.getBranch(this.Table.IDBranch);
        await  this.env.getStorage("OrderLines" + this.idTable).then((result:any)=>{
            if(result){
                this.OrderLines = result;
            }
        });
        if (!this.item?.Id) {
            await this.checkOrderOfTable(this.idTable);
            if(this.id !=0){
                let newURL = '#/pos-customer-order/' + this.id + '/' + this.idTable;
                history.pushState({}, null, newURL);
                Promise.all([
                    this.translate.get('erp.app.pages.pos.pos-customer-order.check-preorder').toPromise(),
                    this.translate.get('erp.app.pages.pos.pos-customer-order.check-order-update').toPromise(),
                    this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
                ]).then(trans => {
                    this.env.showAlert(trans[0],trans[1],trans[2]);               
                    this.refresh();
                });
            }     
            this.formGroup.controls.IDBranch.patchValue(this.Table.IDBranch);
            Object.assign(this.item, this.formGroup.getRawValue());
            this.setOrderValue(this.item);
        }
        else {
            this.notifyFromStaff();           
            this.patchOrderValue();
        }
        this.loadOrder();
        this.loadInfoOrder();
        if(this.OrderLines?.length>0){
            this.AllowSendOrder = true;
            this.OrderLines.forEach(line=>{
                this.addToCart(line.Item,line.IDUoM,+line.Quantity,true);
            });
        }
    }
    
    refresh(event?: any): void {
        this.preLoadData('force');
    }
    async getChildrenOrder(IDParent){
        await this.commonService.connect('GET', 'POS/ForCustomer/ChildrenOrder/'+IDParent, null).toPromise().then(result=>{
           this.childrenOrders = result;
        }).catch(err=>{});
    }
    async getParentOrder(IDParent){
        await this.commonService.connect('GET', 'POS/ForCustomer/ParentOrder/'+IDParent, null).toPromise().then(result=>{
           this.parentOrder = result;
           console.log(this.parentOrder);
        }).catch(err=>{});
    }
    async addToStorage(item, idUoM, quantity = 1,IsDelete = false,idx = -1){

        if (item.IsDisabled) {
            this.env.showTranslateMessage('erp.app.pages.pos.pos-customer-order.product-not-available', 'warning');
            return;
        }

        let line = {
            Item:item,
            IDUoM:idUoM,
            Quantity:quantity,
        }
        let index = this.OrderLines.map(x=>x.IDUoM).indexOf(idUoM);
        if(index==-1){
            this.OrderLines.push(line);
        }
        else{
            if(IsDelete == true){
                this.OrderLines.splice(index,1);
            }
            else{
                this.OrderLines[index].Quantity += quantity;
                if(this.OrderLines[index].Quantity==0){
                    this.OrderLines.splice(index,1);
                }
            }     
        }    
        this.env.setStorage("OrderLines" + this.idTable, this.OrderLines).then(_ => {

            this.addToCart(item, idUoM, quantity, null, idx);
        })
    }

    addToCart(item, idUoM, quantity = 1, IsUpdate = false, idx = -1) {
        this.AllowSendOrder = true;

        if (this.pageConfig.IsUseIPWhitelist) {
            if (this.ipWhitelist.indexOf(this.myIP) == -1) {
                this.pageConfig.canEdit = false;
                this.isWifiSecuredModalOpen = true;
    
                return;
            }
        }
        else {
            this.pageConfig.canEdit = true;
            this.isWifiSecuredModalOpen = false;
        }


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
            this.env.showTranslateMessage('erp.app.pages.pos.pos-customer-order.order-locked', 'warning');
            return;
        }

        if (!item.UoMs.length) {
            this.translate.get('erp.app.pages.pos.pos-customer-order.item-has-no-uom').toPromise().then(trans => {
                this.env.showAlert(trans);
                return;
            });
        }

        let uom = item.UoMs.find(d => d.Id == idUoM);
        let price = uom.PriceList.find(d => d.Type == 'SalePriceList');

        let line;
        if (quantity >= 1) {
            line = this.item.OrderLines.find(d => d.IDUoM == idUoM && d.Status == 'New'); //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
        }
        else {
            line = this.item.OrderLines[idx]; //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
        }

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
                UoMPrice: price.NewPrice ? price.NewPrice : price.Price,
                UoMName: uom.Name,
                Quantity: quantity,
                IDBaseUoM: idUoM,
                UoMSwap: 1,
                UoMSwapAlter: 1,
                BaseQuantity: 0,
                ShippedQuantity: 0,

                Remark: null,
                IsPromotionItem: false,
                IDPromotion: null,

                OriginalDiscountFromSalesman: 0,
            };

            this.item.OrderLines.push(line);

            this.addOrderLine(line);
            this.setOrderValue({ OrderLines: [line], Status: 'New'});
        }
        else {
            if ((line.Quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
                Promise.all([
                    this.translate.get('erp.app.pages.pos.pos-customer-order.contact-staff-support').toPromise(),
                    this.translate.get('erp.app.pages.pos.pos-customer-order.sent-kitchen').toPromise(),
                    this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
                ]).then(trans => { // Sản phẩm đã chuyển bếp, liên hệ nhân viên
                    this.env.showAlert(trans[0], item.Name + " " + trans[1] + " " + line.ShippedQuantity + " " + line.UoMName, trans[2]);
                });
            }
            else if ((line.Quantity + quantity) > 0) {
                line.Quantity += quantity;
                this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }], Status: 'New'});
            }
            else {
                Promise.all([
                    this.translate.get('erp.app.pages.pos.pos-customer-order.confirm-to-remove').toPromise(),
                    this.translate.get('erp.app.pages.pos.pos-customer-order.remove-product').toPromise(),
                ]).then(trans => {
                    this.env.showPrompt(trans[0], item.Name, trans[1]).then(_ => { // Xóa sản phẩm
                        line.Quantity += quantity;
                        this.loadInfoOrder();
                        this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                    }).catch(_ => { });
                });
            }

        }
    }

    async openQuickMemo(line) {
        if (this.submitAttempt) return;
        if (line.Status != 'New') return;

        const modal = await this.modalController.create({
            component: POSCustomerMemoModalPage,
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

    segmentChanged(ev: any) {
        this.segmentView = ev;
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

    async processPayments() {
        if(this.OrderLines.length>0 || this.AllowSendOrder == true){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-memo.update-order-then-proceed-payment').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-memo.notification').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-memo.update').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-memo.no').toPromise()
            ]).then(trans => {
                this.env.showPrompt(trans[0],null, trans[1],trans[2],trans[3])
                .then(_ => {
                    this.sendOrder();
                    this.openModalPayments();
                }).catch(_ => {
                    
                });
            })
        }
        else{
            this.openModalPayments();
        }
       
    }

    async openModalPayments(){
        const modal = await this.modalController.create({
            component: POSForCustomerPaymentModalPage,
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-payments',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
    }





    ////PRIVATE METHODS
    private UpdatePrice() {
        this.dealList.forEach(d => {
            this.menuList.forEach(m => {
                let index = m.Items.findIndex(i => i.SalesUoM == d.IDItemUoM);
                if (index != -1) {
                    let idexUom = m.Items[index].UoMs.findIndex(u => u.Id == d.IDItemUoM);
                    let newPrice = d.Price;
                    if (d.IsByPercent == true) {
                        newPrice = d.OriginalPrice - (d.OriginalPrice * d.DiscountByPercent / 100);
                    }
                    m.Items[index].UoMs[idexUom].PriceList.find(p => p.Type == "SalePriceList").NewPrice = newPrice;

                    if (d.MaxPerOrder != null) {
                        m.Items[index].UoMs[idexUom].MaxPerOrder = d.MaxPerOrder;
                    }
                }
            });
        })
    }

    private loadOrder() {
        this.printData.undeliveredItems = [];
        this.printData.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");

        this.item._Locked = !this.pageConfig.canEdit ? false : this.noLockStatusList.indexOf(this.item.Status) == -1;
        this.printData.currentBranch = this.env.branchList.find(d => d.Id == this.item.IDBranch);

        if (this.item._Locked) {
            this.pageConfig.canEdit = false;
            this.formGroup?.disable();
        }
        this.UpdatePrice();
        this.calcOrder();
    }

    //Hàm này để tính và show số liệu ra bill ngay tức thời mà ko cần phải chờ response từ server gửi về. 
    private calcOrder() {
        this.item._TotalQuantity = this.item.OrderLines?.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
        this.item._TotalShipedQuantity = this.item.OrderLines?.map(x => x.ShippedQuantity).reduce((a, b) => (+a) + (+b), 0);
        this.item.OriginalTotalBeforeDiscount = 0;
        this.item.OriginalDiscountByOrder = 0;
        this.item.OriginalDiscountFromSalesman = 0;
        this.item.OriginalTotalDiscount = 0;
        this.item.AdditionsAmount = 0;
        this.item.AdditionsTax = 0;
        this.item.OriginalTotalAfterDiscount = 0;
        this.item.OriginalTax = 0;
        this.item.OriginalTotalAfterTax = 0;
        this.item.CalcOriginalTotalAdditions = 0;
        this.item.CalcTotalOriginal = 0;

        this.item.OriginalTotalDiscountPercent = 0;
        this.item.OriginalTaxPercent = 0;
        this.item.CalcOriginalTotalAdditionsPercent = 0;
        this.item.AdditionsAmountPercent = 0;
        this.item.OriginalDiscountFromSalesmanPercent = 0;
        this.item._OriginalTotalAfterDiscountFromSalesman = 0;

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
            line.OriginalDiscountByOrder = parseFloat(line.OriginalDiscountByOrder) || 0;
            this.item.OriginalDiscountByOrder += line.OriginalDiscountByOrder;
            line.OriginalTotalDiscount = line.OriginalDiscountByLine + line.OriginalDiscountByOrder;
            this.item.OriginalTotalDiscount += line.OriginalTotalDiscount;

            line.OriginalTotalAfterDiscount = line.OriginalTotalBeforeDiscount - line.OriginalTotalDiscount;
            line.OriginalTax = line.OriginalTotalAfterDiscount * (line.TaxRate / 100.0);
            this.item.OriginalTotalAfterDiscount += line.OriginalTotalAfterDiscount;
            this.item.OriginalTax += line.OriginalTax;
            line.OriginalTotalAfterTax = line.OriginalTotalAfterDiscount + line.OriginalTax;
            this.item.OriginalTotalAfterTax += line.OriginalTotalAfterTax;
            line.CalcOriginalTotalAdditions = line.OriginalTotalAfterDiscount * (line._serviceCharge / 100.0) * (1 + line.TaxRate / 100.0);
            line.AdditionsAmount = line.OriginalTotalAfterDiscount * (line._serviceCharge / 100.0);
            this.item.AdditionsAmount += line.AdditionsAmount;
            this.item.AdditionsTax += (line.CalcOriginalTotalAdditions - line.AdditionsAmount);
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
            // else {
            //     line.Status = 'Serving';
            // }

            line._Locked = this.item._Locked ? true : this.noLockLineStatusList.indexOf(line.Status) == -1;


        }

        this.item.OriginalTotalDiscountPercent = ((this.item.OriginalTotalDiscount / this.item.OriginalTotalBeforeDiscount) * 100.0).toFixed(0);
        this.item.OriginalTaxPercent = (((this.item.OriginalTax + this.item.AdditionsTax) / (this.item.OriginalTotalAfterDiscount + this.item.AdditionsAmount)) * 100.0).toFixed(0);
        this.item.CalcOriginalTotalAdditionsPercent = ((this.item.CalcOriginalTotalAdditions / this.item.OriginalTotalAfterTax) * 100.0).toFixed(0);
        this.item.AdditionsAmountPercent = ((this.item.AdditionsAmount / this.item.OriginalTotalAfterDiscount) * 100.0).toFixed(0);
        this.item.OriginalDiscountFromSalesmanPercent = ((this.item.OriginalDiscountFromSalesman / this.item.CalcTotalOriginal) * 100.0).toFixed(0);
        this.item.Debt = Math.round((this.item.CalcTotalOriginal - this.item.OriginalDiscountFromSalesman) - this.item.Received);
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

    async notifyOrder(data) {
        const value = JSON.parse(data.value);
        if (this.item.Id == data.id) {
            this.refresh();
        }
        // else{
        //     let index = value.Tables.map(t=>t.IDTable).indexOf(this.idTable);
        //     if(index != -1){
        //         await this.getOrdersOfTable(this.idTable);
        //         this.env.showAlert("Có đơn hàng mới trên bàn này","Kiểm tra đơn hàng ",'Thông báo');

        //     }
        // }
    }
    private notifyFromCustomer(data) {
        const value = JSON.parse(data.value);   
        let index = value.Tables.map(t=>t.IDTable).indexOf(this.idTable);
        if(index != -1){
            if(!this.IsMyHandle){
                Promise.all([
                    this.translate.get('erp.app.pages.pos.pos-customer-order.check-for-new-order').toPromise(),
                    this.translate.get('erp.app.pages.pos.pos-customer-order.check-order').toPromise(),
                    this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
                ]).then(trans => {
                    this.env.showAlert(trans[0],trans[1],trans[2]);
                    this.id = data.id;
                    let newURL = '#/pos-customer-order/' + this.id + '/' + value.Tables[0].IDTable;
                    history.pushState({}, null, newURL);
                    this.refresh();
                });
            }
            this.IsMyHandle = false;
        }
    }

    private notifyPayment(data){
        const value = JSON.parse(data.Value);  
        if (this.item.Id == value.IDSaleOrder){
            let type;
            let status;
            let header = "";
            this.translate.get('erp.app.pages.pos.pos-customer-order.payment').toPromise().then(trans => {
                header = trans;
            });
            if(value.IsRefundTransaction == true){
                this.translate.get('erp.app.pages.pos.pos-customer-order.refund').toPromise().then(trans => {
                    header = trans;
                });
            }
            switch (value.Status) {
                case 'Success':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.success').toPromise().then(trans => {
                        status = trans;
                    });
                    break;
                case 'Processing':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.processing').toPromise().then(trans => {
                        status = trans;
                    });
                    break;
                case 'Fail':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.fail').toPromise().then(trans => {
                        status = trans;
                    });
                    break;
            }
            switch (value.Type) {
                case 'Card':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.card').toPromise().then(trans => {
                        type = trans;
                    });
                    break;
                case 'Transfer':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.transfer').toPromise().then(trans => {
                        type = trans;
                    });
                    break;
                case 'Cash':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.cash').toPromise().then(trans => {
                        type = trans;
                    });
                    break;
                case 'ZalopayApp':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.zalopay-app').toPromise().then(trans => {
                        type = trans;
                    });
                    break;
                case 'CC':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.cc').toPromise().then(trans => {
                        type = trans;
                    });
                    break;
                case 'ATM':
                    this.translate.get('erp.app.pages.pos.pos-customer-order.atm').toPromise().then(trans => {
                        type = trans;
                    });
                    break;
            }
            this.env.showAlert("<h2>"+lib.currencyFormat(value.Amount)+"</h2>",type +" | "+status,header);
            this.playAudio("Payment");
            this.refresh();
        }
    }
    private playAudio(type){
        let audio = new Audio();
        if(type=="Order"){
            audio.src = "assets/audio/audio-order.wav";
        }
        if(type=="Payment"){
            audio.src = "assets/audio/audio-payment.wav";
        }
        audio.load();
        audio.play();
    }
    async notifyFromStaff(){
        if(this.item.Status == "Splitted"){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-splitted').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
                await this.getChildrenOrder(this.item.Id);
            });
        }
        if(this.item.Status =='Merged'){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-merged').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
                await this.getParentOrder(this.item.IDParent);
            });
        }
        if(this.item.Status =='Done'){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-done').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
                this.playAudio("Order");
            });
        }
        if(this.item.Status =='Cancelled'){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-cancelled').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
                this.playAudio("Order");
            });
        }
        if(this.item.Status == "Confirmed"){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-confirmed').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
                this.playAudio("Order");
            });
        }
        // if(this.item.Status == "Scheduled"){
        //     Promise.all([
        //         this.translate.get('erp.app.pages.pos.pos-customer-order.order-scheduled').toPromise(),
        //         this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
        //     ]).then(async trans => {
        //         this.env.showAlert(trans[0], null, trans[1]);
        //         this.playAudio("Order");
        //     });
        // }
        if(this.item.Status == "Picking"){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-picking').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
            });                
        }
        if(this.item.Status == "Delivered"){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-delivered').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
            });
        }
        if(this.idTable != this.item.Tables[0]){
            await this.reloadTable(this.item.Tables[0]);
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.order-table-changed-to').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
            ]).then(async trans => {
                this.env.showAlert(trans[0], null, trans[1]);
                this.env.showAlert(trans[0] +this.Table.Name, null, trans[0]);
            });
            this.env.setStorage("OrderLines" + this.idTable, []);
            this.env.setStorage("OrderLines" + this.item.Tables[0], this.OrderLines);
            this.idTable = this.item.Tables[0];
            let newURL = '#/pos-customer-order/' + this.item.Id + '/' + this.item.Tables[0];
            history.pushState({}, null, newURL);
        }
    }
    async reloadTable(IDTable){
        await this.commonService.connect('GET', 'POS/ForCustomer/Table/'+IDTable, this.query).toPromise().then((result: any) => {
            this.Table = result;
        });
    }
    private getMenu() {
        let apiPath = {
            method: "GET",
            url: function () { return ApiSetting.apiDomain("POS/ForCustomer/Menu") }
        };
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(), this.query).toPromise()
                .then((resp: any) => {
                    let menuList = resp;
                        menuList.forEach((m: any) => {
                            m.menuImage = environment.posImagesServer + (m.Image ? m.Image : 'assets/pos-icons/POS-Item-demo.png');
                            m.Items.sort((a, b) => a['Sort'] - b['Sort']);
                            m.Items.forEach(i => {
                                i.imgPath = environment.posImagesServer + (i.Image ? i.Image : 'assets/pos-icons/POS-Item-demo.png');
                            });
                        });
                        resolve(menuList);

                    
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    private getTable() {
        let apiPath = {
            method: "GET",
            url: function (id) { return ApiSetting.apiDomain("POS/ForCustomer/Table/") + id }
        };
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(this.idTable), this.query).toPromise()
                .then((result: any) => {
                    resolve(result);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    private getDeal() {
        let apiPath = {
            method: "GET",
            url: function () { return ApiSetting.apiDomain("POS/ForCustomer/Deal") }
        };
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(), this.query).toPromise()
                .then((result: any) => {
                    resolve(result);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    private getBranch(id) {
        let apiPath = {
            method: "GET",
            url: function (id) { return ApiSetting.apiDomain("POS/ForCustomer/Branch/") + id }
        };
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(id), this.query).toPromise()
                .then((result: any) => {
                    this.Branch = result;
                    resolve(result);
                })
                .catch(err => {
                    reject(err);
                });
        });
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
        this.loadInfoOrder();
        this.calcOrder();
        this.checkAllowSendOrder();
    }

    async checkAllowSendOrder() {
        await this.env.getStorage("OrderLines" + this.idTable).then(result => {
            if (result?.length > 0) {
                
                for (let index = 0; index < this.item.OrderLines.length; index++) {
                    let orderLine = this.item.OrderLines[index];
                    let cacheLine = result.find(od => od.Item.Id == orderLine.IDItem);
                    if (cacheLine && (cacheLine.Item.BookedQuantity == orderLine.Quantity)) {
                        this.AllowSendOrder = false;
                    }
                    else {
                        this.AllowSendOrder = true;
                        return
                    }
                }
            }
            else {
                this.AllowSendOrder = false;
            }
        });
    }

    async saveChange() {
        this.formGroup.controls.Status.patchValue("New");
        this.formGroup.controls.Status.markAsDirty();
        let submitItem = this.getDirtyValues(this.formGroup);
        this.saveChange2();
    }

    savedChange(savedItem?: any, form?: FormGroup<any>): void {
        if (savedItem) {
            if (form.controls.Id && savedItem.Id && form.controls.Id.value != savedItem.Id)
                form.controls.Id.setValue(savedItem.Id);

            if (this.pageConfig.isDetailPage && form == this.formGroup && this.id == 0) {
                let order = {
                    Id:savedItem.Id,
                    IDTable:this.idTable,
                    TableName:this.Table.Name,
                }
                this.addOrderToStorage(order);
                this.id = savedItem.Id;
                let newURL = '#/pos-customer-order/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);

            }

            this.item = savedItem;
            this.isSuccessModalOpen = true;
        }
        this.loadedData();

        this.submitAttempt = false;
    }

    closeSuccessModal(){
        this.isSuccessModalOpen = false; 
        setTimeout(() => {
            this.pageConfig.isShowFeature = false;
        }, 1);
        
    }

    async sendOrder() {
        if(this.Table.IsAllowCustomerOrder == true){       
            if(this.id == 0){
                await this.checkOrderOfTable(this.idTable);
                if(this.id !=0){
                    let newURL = '#/pos-customer-order/' + this.id + '/' + this.idTable;
                    history.pushState({}, null, newURL); 
                    Promise.all([
                        this.translate.get('erp.app.pages.pos.pos-customer-order.check-preorder').toPromise(),
                        this.translate.get('erp.app.pages.pos.pos-customer-order.check-order-update').toPromise(),
                        this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise(),
                    ]).then(trans => {
                        this.env.showAlert(trans[0],trans[1],trans[2]);               
                        this.refresh();
                    });
                }
                else{
                    this.saveOrder();
                }
            }
            else{
                this.saveOrder();
            }
        }
        else {
            this.env.showTranslateMessage('erp.app.pages.pos.pos-customer-order.self-service-unavailable', 'warning');
            return false;
        }
    }

    saveOrder(){
        this.saveChange();
        this.AllowSendOrder = false;
        this.IsMyHandle = true;
        this.OrderLines = [];
        this.env.setStorage("OrderLines" + this.idTable, []);
    }

    loadInfoOrder() {
        for (let line of this.item.OrderLines) {
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

    isSuccessModalOpen = false;

    callStaff(){
        let ItemModel = {
            ID: this.idTable,
            Code: "POSSupport",
            Name: this.Table.IDBranch,
            Remark: "khách hàng bàn " + this.Table.Name + " yêu cầu phục vụ"
        }
        Promise.all([
            this.translate.get('erp.app.pages.pos.pos-customer-order.customer-at-table').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-order.request-for-service').toPromise(),
        ]).then(trans => {
            ItemModel.Remark = trans[0] + this.Table.Name + trans[1]
            this.commonService.connect('POST', 'POS/ForCustomer/CallStaff', ItemModel).toPromise().then(result=>{
                this.env.showTranslateMessage('erp.app.pages.pos.pos-customer-order.called-for-service',"success");
            }).catch(err=>{
                console.log(err);
            });
        });
    }

    async helpOrder(status) {
        let subHeader;
        let message;
        if(status == 'Done'){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-done-subhead').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-done-message').toPromise(),
            ]).then(trans => {
                subHeader = trans[0];
                message = trans[1];
            });
        }
        if(status == 'Splitted'){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-splitted-subhead').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-splitted-message').toPromise(),
            ]).then(trans => {
                subHeader = trans[0];
                message = trans[1];
            });
        }
        if(status == 'Cancelled'){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-cancelled-subhead').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-cancelled-message').toPromise(),
            ]).then(trans => {
                subHeader = trans[0];
                message = trans[1];
            });
        }
        if(status == 'Merged'){
            Promise.all([
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-merged-subhead').toPromise(),
                this.translate.get('erp.app.pages.pos.pos-customer-order.help-order-merged-message').toPromise(),
            ]).then(trans => {
                subHeader = trans[0];
                message = trans[1];
            });
        }
        this.translate.get('erp.app.pages.pos.pos-customer-order.notification').toPromise().then(trans => {
            this.env.showAlert(message, subHeader, trans);
        });
    }

    async checkOrderOfTable(IDTable){
        let apiPath = { method: "GET",url: function (id) { return ApiSetting.apiDomain("POS/ForCustomer/OrderOfTable/") + id }};
        await this.commonService.connect(apiPath.method, apiPath.url(IDTable), this.query).toPromise().then(result=>{
            if(result){  
                this.id = result;
            }
        }).catch(err => {});
    }
    async getOrdersOfTable(IDTable){
        await this.commonService.connect('GET', 'POS/ForCustomer/OrdersOfTable/'+IDTable, null).toPromise().then(result=>{
            if(result){  
                this.OrdersOfTable = result;
            }
        }).catch(err => {});
    }
    goToOrder(IDSaleOrder,IDTable){
        this.id = IDSaleOrder;
        let newURL = '#/pos-customer-order/' + IDSaleOrder + '/' + IDTable;
        history.pushState({}, null, newURL);               
        this.refresh();
    }
    async addOrderToStorage(order){
        let Orders = [];
        await this.env.getStorage('Orders').then(result=>{
            if(result){
                Orders = result;
                Orders.push(order); 
            }else{
                Orders.push(order);
            }  
        });
        this.env.setStorage('Orders', Orders);
    }

    changeLanguage(lang = null) {
		if (lang) {
			this.translate.use(lang);
		}
		else {
			if (this.translate.currentLang != 'vi-VN') {
				this.translate.use('vi-VN');
			}
			else {
				this.translate.use('en-US')
			}

			this.env.setStorage('lang', this.translate.currentLang);
		}
	}
}
