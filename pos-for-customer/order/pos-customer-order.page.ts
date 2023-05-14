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
    statusList; //Show on bill
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
            IDType: [293],
            IDStatus: [101],
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
        this.env.getStorage("Order").then(result => {
            if (result?.Id && result?.IDTable == this.idTable && result.Status == "New") {
                this.id = result.Id;
                let newURL = '#/pos-customer-order/' + result.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);
                this.refresh();
            }
        });
    }

    ////EVENTS
    ngOnInit() {
        this.pageConfig.subscribePOSOrderPaymentUpdate = this.env.getEvents().subscribe((data) => {
            switch (data.Code) {
                case 'app:POSOrderPaymentUpdate':
                    this.refresh();
                    break;
            }
        });
        this.pageConfig.subscribePOSOrderCustomer = this.env.getEvents().subscribe((data) => {
            switch (data.Code) {
                case 'app:POSOrderFromStaff':
                    this.notify(data.Data);
                    break;
            }
        });
        super.ngOnInit();
    }

    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrderPaymentUpdate?.unsubscribe();
        this.pageConfig?.subscribePOSOrderCustomer?.unsubscribe();
        super.ngOnDestroy();
    }

    preLoadData(event?: any): void {
        let forceReload = event === 'force';
        this.AllowSendOrder = false;
        Promise.all([
            this.env.getStatus('POSOrder'),
            this.getMenu(),
            this.getTable(),
            this.getDeal(),
            this.pageProvider.commonService.connect('GET', ApiSetting.apiDomain("Account/MyIP"), null).toPromise(),
        ]).then((values: any) => {
            this.statusList = values[0];
            this.menuList = values[1];
            this.Table = values[2];
            this.dealList = values[3];
            this.checkIPConfig(event);
        }).catch(err => {
            this.loadedData(event);
        })
    }

    async checkIPConfig(event) {
        Promise.all([
            this.pageProvider.commonService.connect('GET', 'POS/ForCustomer/ConfigByBranch', {Code: 'IsUseIPWhitelist', IDBranch: this.Table.IDBranch}).toPromise(),
            this.pageProvider.commonService.connect('GET', 'POS/ForCustomer/ConfigByBranch', {Code: 'IPWhitelistInput', IDBranch: this.Table.IDBranch}).toPromise(),
            this.pageProvider.commonService.connect('GET', ApiSetting.apiDomain("Account/MyIP"), null).toPromise()
        ]).then((values: any) => {
            if (values[0]['Value']) {
                this.pageConfig.IsUseIPWhitelist = Boolean(JSON.parse(values[0]['Value']));
            }
            if (this.pageConfig.IsUseIPWhitelist) {
                this.ipWhitelist = JSON.parse(values[1]['Value']);
                this.myIP = values[2];
                if (this.ipWhitelist) {
                    if (this.ipWhitelist.indexOf(this.myIP) > -1) {
                        this.pageConfig.canEdit = true;
                        this.isWifiSecuredModalOpen = false;
                    }
                    else {
                        // this.env.showTranslateMessage('Vui lòng kết nối wifi tòa nhà để đặt món!', 'warning');
                        this.pageConfig.canEdit = false;
                        this.isWifiSecuredModalOpen = true;
                    }
                }
                else {
                    // this.env.showTranslateMessage('Vui lòng kiểm tra danh sách IP Whitelist!', 'warning');
                    this.pageConfig.canEdit = false;
                    this.isWifiSecuredModalOpen = true;
                }
            }
            super.preLoadData(event);
        });
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        super.loadedData(event, ignoredFromGroup);
        this.getBranch(this.Table.IDBranch);
        if (!this.item?.Id) {

            this.formGroup.controls.IDBranch.patchValue(this.Table.IDBranch);
            Object.assign(this.item, this.formGroup.getRawValue());
            this.env.getStorage("OrderLines" + this.idTable).then(result => {
                if (result?.length > 0) {
                    this.item.OrderLines = result;
                    this.patchOrderValue();
                    this.loadOrder();
                    this.loadInfoOrder();
                    this.setOrderValue(this.item);
                }
                else {
                    this.setOrderValue(this.item);
                    this.AllowSendOrder = false;
                }
            });
        }
        else {
            this.env.setStorage("Order", { Id: this.item.Id, IDTable: this.idTable, Status: this.item.Status });
            this.patchOrderValue();
        }
        this.loadOrder();
        
        this.loadInfoOrder();
    }

    refresh(event?: any): void {
        this.preLoadData('force');
    }

    async addToCart(item, idUoM, quantity = 1, IsUpdate = false) {
        this.AllowSendOrder = true;
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

        if (!item.UoMs.length) {
            this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
            return;
        }

        let uom = item.UoMs.find(d => d.Id == idUoM);
        let price = uom.PriceList.find(d => d.Type == 'SalePriceList');

        let line = this.item.OrderLines.find(d => d.IDUoM == idUoM); //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)
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

                Quantity: 1,
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
            this.setOrderValue({ OrderLines: [line] });
            if (this.id == 0) {
                this.env.setStorage("OrderLines" + this.idTable, this.item.OrderLines);
            }
        }
        else {
            if ((line.Quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
                this.env.showAlert("Vui lòng liên hệ nhân viên để được hỗ trợ ", item.Name + " đã chuyển bếp " + line.ShippedQuantity + " " + line.UoMName, "Thông báo");
            }
            else if ((line.Quantity + quantity) > 0) {
                line.Quantity += quantity;
                this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                if (this.id == 0) {
                    this.env.setStorage("OrderLines" + this.idTable, this.item.OrderLines);
                }
            }
            else {
                this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm').then(_ => {
                    line.Quantity += quantity;
                    this.loadInfoOrder();
                    this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                    if (this.id == 0) {
                        this.env.setStorage("OrderLines" + this.idTable, this.item.OrderLines);
                    }
                }).catch(_ => { });
            }

        }
    }

    async openQuickMemo(line) {
        if (this.submitAttempt) return;

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
            else {
                line.Status = 'Waiting';
            }

            line._Locked = this.item._Locked ? true : this.noLockLineStatusList.indexOf(line.Status) == -1;


        }

        this.item.OriginalTotalDiscountPercent = ((this.item.OriginalTotalDiscount / this.item.OriginalTotalBeforeDiscount) * 100.0).toFixed(0);
        this.item.OriginalTaxPercent = (((this.item.OriginalTax + this.item.AdditionsTax) / (this.item.OriginalTotalAfterDiscount + this.item.AdditionsAmount)) * 100.0).toFixed(0);
        this.item.CalcOriginalTotalAdditionsPercent = ((this.item.CalcOriginalTotalAdditions / this.item.OriginalTotalAfterTax) * 100.0).toFixed(0);
        this.item.AdditionsAmountPercent = ((this.item.AdditionsAmount / this.item.OriginalTotalAfterDiscount) * 100.0).toFixed(0);
        this.item.OriginalDiscountFromSalesmanPercent = ((this.item.OriginalDiscountFromSalesman / this.item.CalcTotalOriginal) * 100.0).toFixed(0);
        this.item.Debt = (this.item.CalcTotalOriginal - this.item.OriginalDiscountFromSalesman) - this.item.Received;
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

    private notify(data) {
        if (this.item.Id == data.id) {
            this.refresh();
            this.env.setStorage("Order", { Id: this.item.Id, IDTable: this.idTable, Status: this.item.Status });
        }
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
    }

    async saveChange() {
        let submitItem = this.getDirtyValues(this.formGroup);
        this.saveChange2();
    }

    savedChange(savedItem?: any, form?: FormGroup<any>): void {
        if (savedItem) {
            if (form.controls.Id && savedItem.Id && form.controls.Id.value != savedItem.Id)
                form.controls.Id.setValue(savedItem.Id);

            if (this.pageConfig.isDetailPage && form == this.formGroup && this.id == 0) {
                this.id = savedItem.Id;
                let newURL = '#/pos-customer-order/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);
            }

            this.item = savedItem;
            this.isSuccessModalOpen = true;
            this.env.setStorage("Order", { Id: this.item.Id, IDTable: this.idTable, Status: this.item.Status });
        }
        this.loadedData();

        this.submitAttempt = false;
    }

    sendOrder() {
        if(this.Table.IsAllowCustomerOrder == true){
            this.saveChange();
            this.AllowSendOrder = false;
        }
        else{
            this.env.showTranslateMessage('Xin lỗi quý khách bạn này chưa được kích hoạt gọi món', 'warning');
            return false;
        }
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
 

}
