import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BRA_BranchProvider, BANK_IncomingPaymentDetailProvider, BANK_IncomingPaymentProvider, CRM_ContactProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, SALE_OrderDetailProvider, SALE_OrderProvider, } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { SaleOrderMobileAddContactModalPage } from '../../SALE/sale-order-mobile-add-contact-modal/sale-order-mobile-add-contact-modal.page';
import { TranslateService } from '@ngx-translate/core';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSCustomerOrderModalPage } from '../pos-customer-order-modal/pos-customer-order-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';
import { HostListener } from "@angular/core";
import QRCode from 'qrcode';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-pos-customer-order',
    templateUrl: './pos-customer-order.page.html',
    styleUrls: ['./pos-customer-order.page.scss'],
})
export class POSCustomerOrderPage extends PageBase {
    idSO: any;
    idTable: any;
    idBranch: any;
    tableGroupList = [];
    tableList = [];
    menuList = [];
    cart = [];
    QRC = null;
    posStatus = ['new', 'picking', 'delivered', 'done', 'cancelled'];
    statusList = [
        { Id: 101, Code: 'new', Name: 'Mới' },
        { Id: 106, Code: 'picking', Name: 'Đang lên món' },
        { Id: 109, Code: 'delivered', Name: 'Đã giao' },
        { Id: 114, Code: 'done', Name: 'Đã xong' },
        { Id: 115, Code: 'cancelled', Name: 'Đã hủy' }
    ];
    paymentMethod = ['Tiền mặt', 'Chuyển khoản', 'Ví Momo', 'Cà thẻ', 'Thẻ ATM'];
    Methods = [
        {
            Id: 1,
            IDType: 72,
            Name: 'Tiền mặt',
            Icon: 'Cash',
            Selected: false,
        },
        {
            Id: 2,
            IDType: 1376,
            Name: 'Chuyển khoản',
            Icon: 'Business',
            Selected: false,
        },
        {
            Id: 3,
            IDType: 0,
            Name: 'Ví Momo',
            Icon: 'Wallet',
            Selected: false,
        },
        {
            Id: 4,
            IDType: 1402,
            Name: 'Cà thẻ',
            Icon: 'Card',
            Selected: false,
        },
        {
            Id: 5,
            IDType: 0,
            Name: 'Thẻ ATM',
            Icon: 'Card',
            Selected: false,
        },
    ];

    IDTypeText = [
        {
            IDType: 72,
            Type: 'Tiền Mặt'
        },
        {
            IDType: 1376,
            Type: 'Chuyển khoản',
        },
        {
            IDType: 1402,
            Type: 'Cà thẻ',
        },
    ]

    favItemsList = [];

    recAmountBtn = [];
    appliedVoucherList = [];
    calcVoucherDiscount;

    // InCashOptions = false;
    // WireTransferOptions = false;
    // QRCodeOptions = false;
    VoucherOptions = false;
    InternalOptions = false;

    InCashOptions = false;
    DepositOptions = false;
    MomoWalletOptions = false;
    VisaMasterOptions = false;
    ATMCardOptions = false;

    InCashTotal = 0;
    DepositTotal = 0;
    MomoWalletTotal = 0;
    VisaMasterTotal = 0;
    ATMCardTotal = 0;

    serviceCharge = 0;

    // OriginalDiscount1: 0
    // OriginalDiscount2: 0
    // OriginalDiscountByGroup: 0
    // OriginalDiscountByItem: 0
    // OriginalDiscountByLine: 0
    // OriginalDiscountByOrder: 0
    // OriginalDiscountFromSalesman: 0
    // OriginalPromotion: 0
    // OriginalTax: 0
    // OriginalTotalAfterDiscount: 0
    // OriginalTotalAfterTax: 0
    // OriginalTotalBeforeDiscount: 0
    // OriginalTotalDiscount: 0

    IDContactChanged = false;

    selectedTables = [];
    mainOrderView = 'menu';
    kitchenQuery = 'all';
    currentBranch = null;

    orderInvoice: any = {
        CompanyName: '',
        CompanyAddress: '',
        TaxCode: '',
        EmailAddress: '',
    };
    transactionsList: any = [];

    occupiedTable;
    occupiedTableList = [];
    
    currentOrderList = [];

    AllSegmentImage;

    contentElement;
    cardsElement;
    colsElement;
    rowsElement;
    clones;

    @HostListener('window:resize', ['$event'])
    async getScreenSize(event?) {

        // this.pageConfig.isShowFeature = true;
        this.contentElement = document.getElementsByClassName('menu-view')[0];
        this.cardsElement = document.getElementsByClassName('item-card-resize');

        // if (contentElement.offsetWidth > 820) {
        //     this.pageConfig.isShowFeature = true;
        // }
        // else {
        //     this.pageConfig.isShowFeature = false;
        // }

        //Set Width for item
        await this.setWidth();

    }

    async setWidth() {
        setTimeout(() => {
            for (let c of this.cardsElement) { 
                if (this.contentElement?.offsetWidth < 675) { 
                    let list = c.classList;
                    list.add('fullscreen-table');
                }
                else {
                    let list = c.classList;
                    list.remove('fullscreen-table');
                }
            }
            // for (let co of this.colsElement) {
            //     if (this.contentElement.offsetWidth < 675) { 
            //         let list = co.classList;
            //         list.add('fullscreen-table');
            //     }
            //     else {
            //         let list = co.classList;
            //         list.remove('fullscreen-table');
            //     }
            // }
        }, 50);
    }

    hideEmptyRow() {
        var CheckItemsMatch;
        CheckItemsMatch = document.getElementsByClassName('table-holder');
        for (let c of CheckItemsMatch) {
            if (c.children.length == 0) {
                let MenuGroupName = c.previousElementSibling;
                let list = MenuGroupName.classList;
                list.add('hide-name');
            }
            else {
                let MenuGroupName = c.previousElementSibling;
                let list = MenuGroupName.classList;
                list.remove('hide-name');
            }
        }
    }

    constructor(
        public pageProvider: SALE_OrderProvider,
        public saleOrderDetailProvider: SALE_OrderDetailProvider,
        public menuProvider: POS_MenuProvider,
        public tableGroupProvider: POS_TableGroupProvider,
        public tableProvider: POS_TableProvider,
        public contactProvider: CRM_ContactProvider,
        public incomingPaymentProvider: BANK_IncomingPaymentProvider,
        public incomingPaymentDetailProvider: BANK_IncomingPaymentDetailProvider,
        public branchProvider: BRA_BranchProvider,

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
        this.pageConfig.isShowFeature = false;
        this.pageConfig.isShowSearch = false;

        this.idSO = this.route.snapshot?.paramMap?.get('id');
        this.idSO = typeof (this.idSO) == 'string' ? parseInt(this.idSO) : this.idSO;
        this.idTable = this.route.snapshot?.paramMap?.get('table');
        this.idTable = typeof (this.idTable) == 'string' ? parseInt(this.idTable) : this.idTable;
        this.idBranch = this.route.snapshot?.paramMap?.get('branch');
        this.idBranch = typeof (this.idBranch) == 'string' ? parseInt(this.idBranch) : this.idBranch;
        // this.formGroup = formBuilder.group({
        //     IDBranch: [''],
        //     Id: new FormControl({ value: '', disabled: true }),
        //     Code: [''],
        //     Name: ['', Validators.required],
        // });
    }

    preLoadData(event?: any): void {
        
        this.branchProvider.read({Id: this.idBranch}).then((branch: any) =>{
            this.currentBranch = branch.data[0];
            console.log(this.currentBranch);

            this.env.branchList.push(this.currentBranch);
            // if (this.currentBranch.LogoURL) {
            //     this.currentBranch.LogoURL = 'assets/logos/logo-the-log-hine-wine.png';
            // }

            this.env.selectedBranchAndChildren = this.idBranch;
            this.env.selectedBranch = this.idBranch;


            this.query.Keyword = 'all';
            this.getOrderList().then((data: any) => {
                this.currentOrderList = data.data;

                this.currentOrderList.forEach(tb => {
                    if (tb.Id != this.idSO) {
                        this.occupiedTableList.push((tb.Tables).toString());
                    }
                });
                this.occupiedTable = this.occupiedTableList.toString();

                this.getTableGroup().then(async (data: any) => {
                    this.tableList = [];
                    data.forEach(g => {
                        this.tableList.push({ Id: 0, Name: g.Name, levels: [], disabled: true });
                        g.TableList.forEach(t => {
                            this.tableList.push({ Id: t.Id, Name: t.Name, levels: [{}] });
                        });
                    });

                    let removeTblList = this.occupiedTable.split(",");
                    removeTblList.forEach(tb => {
                        let matchTable = this.tableList.find(i => i.Id == tb);

                        const index = this.tableList.indexOf(matchTable, 0);
                        this.tableList.splice(index, 1);
                    });

                    await this.getMenuList(event);
                    // await this.getFavItemsList(event);

                });
            });

        });
    }


    getTableGroup() {
        return new Promise((resolve, reject) => {
            this.env.getStorage('tableGroup' + this.env.selectedBranch).then(data => {
                if (data) {
                    this.tableGroupList = data;
                    resolve(data);
                }
                else {
                    Promise.all([
                        this.tableGroupProvider.read(),
                        this.tableProvider.read(),
                    ]).then(values => {

                        this.tableGroupList = values[0]['data'];
                        let tableList = values[1]['data'];
                        this.tableGroupList.forEach(g => {
                            g.TableList = tableList.filter(d => d.IDTableGroup == g.Id);
                        });
                        this.env.setStorage('tableGroup' + this.env.selectedBranch, this.tableGroupList);
                        resolve(this.tableGroupList);
                    });
                }
            });
        });
    }

    getOrderList() {
        return new Promise((resolve, reject) => {
            this.pageProvider.read({ Keyword: '', Take: 5000, Skip: 0, Status: "New", IDType: 293}).then(data => {
                resolve(data);
            });
        });
    }

    async getMenuList(event) {
        this.env.getStorage('menuList' + this.env.selectedBranch).then(data => {
            let FavGroup = {
                Id: 0,
                Items: [],
                Name: "FAVOURITE",
                Image: "Uploads/POS/Menu/Icons/Favourite.png"
            }
            data = null;
            if (data) {
                this.menuList = data;
                this.menuList.unshift(FavGroup);
                this.getFavItemsList(event);
            }
            else {
                let query = {
                    IDtable: this.idTable,
                }

                let apiPath = {
                    method: "GET",
                    url: function () { return ApiSetting.apiDomain("POS/Menu/MenuForAnomymousUser") }
                };

                Promise.all([
                    this.commonService.connect(apiPath.method, apiPath.url(), query).toPromise()
                ]).then((values: any) => {
                    this.menuList = values[0];

                    if (this.menuList) {
                        this.menuList.unshift(FavGroup);
                        this.menuList.forEach(m => {
                            m.Items.sort((a, b) => a['Sort'] - b['Sort']);
                        });
                        this.env.setStorage('menuList' + this.env.selectedBranch, this.menuList);
                    }
                    this.getFavItemsList(event);
                    // super.preLoadData(event);
                })
            }

        });
    }

    async getFavItemsList(event) {
        this.env.getStorage('favItemsList' + this.env.selectedBranch).then((data: any) => {
            data = null;
            if (data) {
                let tempList: any = [];
                data.forEach(e => {
                    tempList = tempList.concat(e.Items);
                });

                this.favItemsList = tempList.splice(0, 10);
                let menu: any = this.menuList.filter(i => i.Name == 'FAVOURITE');
                menu[0].Items = this.favItemsList;

                this.createMenuGroupImage();
                super.preLoadData(event);
            }
            else {

                let query = {
                    IDtable: this.idTable,
                }

                let apiPath = {
                    method: "GET",
                    url: function () { return ApiSetting.apiDomain("POS/Menu/FavouriteItemsForAnomymousUser") }
                };

                Promise.all([
                    this.commonService.connect(apiPath.method, apiPath.url(), query).toPromise()
                ]).then((values: any) => {
                    let data = values[0];

                    let tempList: any = [];
                    if (data) {
                        data.forEach(e => {
                            tempList = tempList.concat(e.Items);
                        });

                        this.favItemsList = tempList.splice(0, 10);
                        let menu = this.menuList.filter(i => i.Name == 'FAVOURITE');
                        menu[0].Items = this.favItemsList;
                        this.env.setStorage('favItemsList' + this.env.selectedBranch, this.favItemsList);
                    }

                    this.createMenuGroupImage();
                    super.preLoadData(event);
                })
            }
        });
    }

    createMenuGroupImage() {
        this.menuList.forEach(m => {
            m.menuImage = environment.posImagesServer + m?.Image;
        });
        this.AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png';
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        super.loadedData(event, ignoredFromGroup);
        this.menuList.forEach((m:any) => {
            m.Items.forEach(i => {
                i.imgPath = environment.posImagesServer + i?.Image;
            });
        });
        this.getScreenSize().then(_ => this.hideEmptyRow());
        if (!this.item || !this.item.Id) {
            this.item = {
                Additions: [],
                Deductions: [],
                IDBranch: this.idBranch,
                OrderDate: lib.dateFormat(new Date()) + ' ' + lib.dateFormat(new Date(), 'hh:MM:ss'),
                IDContact: null,
                IDAddress: null,
                CustomerName: 'Khách lẻ',
                IDType: 293,
                IDStatus: 101,
                IDOwner: 4, //Default Hardcode
                PaymentMethod: '',
                Lines: [],
                Tables: this.idTable ? [this.idTable] : null,
                IDDepartment: new Number(),
            };
        }
        // Recalculate Data for Properties
        if (this.item && this.item.Id) {

            if (this.item.PaymentMethod) {
                if (typeof this.item.PaymentMethod === 'string') {
                    let payments = this.item.PaymentMethod.split(',');
                    this.item.PaymentMethod = [];
                    this.item.PaymentMethod = payments;
                }
            }
            else {
                this.item.PaymentMethod = '';
            }

            this.item.OrderLines.forEach(it => {
                if (it.Remark) {
                    if (typeof it.Remark === 'string') {
                        let Remark = it.Remark.split(',');
                        it.Remark = [];
                        it.Remark = Remark;
                    }
                }

                let i = null;
                for (let m of this.menuList) { 
                    for (let mi of m.Items) {
                        if (mi.Id == it.IDItem) {
                            i = mi;
                            i.Quantity = this.item.OrderLines.filter(x => x.IDItem == it.IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
                            // i.Quantity = it.Quantity;
                            it._item = i;
                            it.Image = i?.Image;
                        }
                    }
                }

                if (it?.Image) {
                    it.imgPath = environment.posImagesServer + it?.Image;
                }
            });

            // this.item.PercentTotalDiscount = this.item.PercentTotalDiscount || 0;
            this.transactionsList = [];
            this.incomingPaymentDetailProvider.search({ IDSaleOrder: this.item.Id }).toPromise().then((results: any) => {
                let counter = 0;
                results.forEach(e => {
                    Promise.all([
                        this.incomingPaymentProvider.getAnItem(e.IDIncomingPayment)
                    ]).then((data) => {
                        this.transactionsList.push(data[0]);

                        if (counter == results.length - 1) {
                            this.transactionsList.forEach(e => {
                                e.Type = this.IDTypeText.find(i => i.IDType == e.IDType).Type;
                                e.AmountText = lib.currencyFormat(e.Amount);
                            });
                            this.transactionsList.sort((a, b) => a.CreatedDate - b.CreatedDate);

                            this.orderCalc();
                            this.checkMethod(this.item);
                            this.orderCalc();
                        }
                        counter++;
                    });
                });

                if (results.length == 0) {
                    this.orderCalc();
                    this.checkMethod(this.item);
                    this.orderCalc();
                }
            });
        }
        if (this.item.IDAddress) {
            this.contactProvider.search({ Take: 20, Skip: 0, Term: this.item.IDContact }).subscribe((data: any) => {
                let contact = data.find(d => d.IDAddress == this.item.IDAddress);
                this.contactSelected = contact;
                data.filter(d => d.Id == this.item.IDContact).forEach(i => {
                    if (i && this.contactListSelected.findIndex(d => d.IDAddress == i.IDAddress) == -1)
                        this.contactListSelected.push(i);
                });

                this.contactSearch();
                this.cdr.detectChanges();
            });
        }
        else {
            this.contactSearch();
        }

        if (!this.item.OrderLines) {
            this.item.OrderLines = [];
        }

        var CheckItemsMatch;
        CheckItemsMatch = document.getElementsByClassName('table-holder');
        for (let c of CheckItemsMatch) {
            if (c.children.length == 0) {
                let MenuGroupName = c.previousElementSibling;
                let list = MenuGroupName.classList;
                list.add('hide-name');
            }
            else {
                let MenuGroupName = c.previousElementSibling;
                let list = MenuGroupName.classList;
                list.remove('hide-name');
            }
        }
        this.checkItemAdditional();
    }

    events(e) {
        if (e.Code == 'add-contact' && e.data) {
            let contact = e.data;
            contact.IDAddress = contact.Address.Id;
            this.contactSelected = contact;
            this.item.IDContact = contact.Id;
            this.item.IDAddress = contact.IDAddress;
            this.formGroup.controls.IDContact.setValue(this.item.IDContact);
            this.formGroup.controls.IDAddress.setValue(this.item.IDAddress);
            this.contactListSelected.push(contact);
            this.contactListSelected = [...this.contactListSelected];

            this.contactSearch();
            this.cdr.detectChanges();

            this.saveChange();
            // this.refresh();
        }
    }

    changeTable() {
        if (this.item.OrderLines.length > 0) {
            if (this.item?.Tables != null && this.item?.Tables.length != 0) {
                this.saveChange();
            }
            else {
                this.env.showTranslateMessage('Đơn đã có món, thông tin bàn không được phép để trống.', 'warning')
                this.refresh();
            }
        }
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
            component: SaleOrderMobileAddContactModalPage,
            swipeToClose: true,
            cssClass: 'my-custom-class',
            componentProps: {
                'firstName': 'Douglas',
                'lastName': 'Adams',
                'middleInitial': 'N'
            }
        });
        return await modal.present();
    }

    changedIDAddress(i) {
        if (i) {
            this.contactSelected = i;
            this.item.IDContact = i.Id;
            this.item.IDAddress = i.IDAddress; //When save data from Payment Modal;

            if (this.contactListSelected.findIndex(d => d.Id == i.Id) == -1) {
                this.contactListSelected.push(i);
                this.contactListSelected = [...this.contactListSelected];
                this.contactSearch();
                this.cdr.detectChanges();
            }

            if (!this.IDContactChanged && this.item.OrderLines.length > 0) {
                this.saveChange();
            }
        }
    }

    setSegmentAll(ev) {
        this.segmentView = 'all';
    } 

    doThat(ev) {
        this.segmentView = this.tempSegment;
    }

    segmentView = 'all';
    tempSegment = '';
    segmentChanged(ev: any) {
        // this.segmentView = ev.detail.value;
        this.segmentView = ev;
        this.tempSegment = ev;
        this.getScreenSize();
    }

    async showItemDetail(IDItem){
        let i = null;
        this.menuList.some(m => {
            m.Items.some(it => {
                if (it.Id == IDItem) {
                    i = it;
                    return true;
                }
            });
            if (i) return true;
        });

        let tempItem = this.item.OrderLines.find(o => o.IDItem == i.Id);

        const modal = await this.modalController.create({
            component: POSCustomerOrderModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-customer-order-item',
            componentProps: {
                'selectedItem': i,
                'itemRemark': tempItem.Remark ? tempItem.Remark : null,
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        let itemUpdated = data[0];
        let newQuantity = data[1];
        let andApply = data[2];

        if (andApply) {
            this.addToCart(itemUpdated.Id, newQuantity, itemUpdated.Remark);
            this.currencyChange();
        }
    }

    async addToCart(IDItem, Quantity, Remark, Index?, NewItem = false) {
        if (this.item.Tables == null || this.item.Tables.length == 0) {
            this.env.showTranslateMessage('Vui lòng chọn bàn trước khi thêm món!', 'warning');
            return
        }

        let i = null;
        let checkQty = 0;
        let lineCheckQty = 0;
        for (let m of this.menuList) {
            let added = false;
            for (let it of m.Items) {
                if (!added) {
                    if (it.Id == IDItem) {
                        i = it;

                        let uom = i.UoMs[0];
                        if (!uom.PriceList || !uom.PriceList.length) {
                            i.Quantity = 0;
                            this.env.showAlert('Sản phẩm này không có giá! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
                            return;
                        }

                        i.Quantity = ( i.Quantity || 0 );
                        checkQty = i.Quantity + Quantity;
                        if (checkQty > 0) {
                            if (Index != null) {
                                let ite = this.item.OrderLines[Index];
                                lineCheckQty = ite?.Quantity + Quantity;

                                if (ite.ShippedQuantity< lineCheckQty) {
                                    if (lineCheckQty > 0) {
                                        i.Quantity = this.item.OrderLines.filter(x => x.IDItem == IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0) + Quantity;
                                    }
                                }
                            }
                            else {
                                i.Quantity += Quantity;
                            }
                        }
                        added = true;
                    }
                }
            }
        }

        if (!i || !i?.UoMs.length) {
            this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ phục vụ để được hổ trợ.');
            return;
        }

        let uom = i.UoMs[0];
        // if (!uom.PriceList || !uom.PriceList.length) {
        //     i.Quantity = 0;
        //     this.env.showAlert('Sản phẩm này không có giá! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
        //     return;
        // }

        let price = uom.PriceList[0];
        let qty = ( checkQty > 0 ? ( i.Quantity || 0 ) : 0);
        let it;

        if (Index != null) {
            it = this.item.OrderLines[Index];
        }
        else {
            it = this.item.OrderLines.find(d => d.IDItem == IDItem);
        }

        if (checkQty > 0) {
            let lineCheckQty = it?.Quantity + Quantity;
            // it?.Quantity + Quantity 
            if (lineCheckQty <= 0) {
                this.submitAttempt = true;
                this.alertCtrl.create({
                    header: 'Xóa sản phẩm',
                    //subHeader: '---',
                    message: 'Bạn chắc muốn xóa sản phẩm?',
                    buttons: [
                        {
                            text: 'Không',
                            role: 'cancel',
                            handler: () => {
                                this.submitAttempt = false;
                            }
                        },
                        {
                            text: 'Đồng ý xóa',
                            cssClass: 'danger-btn',
                            handler: () => {
                                this.submitAttempt = false;
                                this.item.OrderLines.splice(Index, 1);

                                i.Quantity = this.item.OrderLines.filter(x => x.IDItem == it.IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);

                                this.changeDiscount();
                                this.orderCalc();
                                this.checkItemAdditional();
                                // this.saveChange(false, 101);
                            }
                        }
                    ]
                }).then(alert => {
                    alert.present();
                });
            }
            else if (it?.ShippedQuantity> lineCheckQty) {
                if (it.QtyReduction) {
                    it.Quantity = this.item.OrderLines.filter(x => x.IDItem == IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0) + Quantity;
                    it.ShippedQuantity= it.Quantity;
                    it.QtyReduction = true;

                    this.changeDiscount();
                    this.orderCalc();
                    this.checkItemAdditional();
                    // this.saveChange(false, 101);
                }
                else {
                    this.submitAttempt = true;
                    this.alertCtrl.create({
                        header: 'Kiểm tra số lượng',
                        //subHeader: '---',
                        message: 'Số lượng đang ít hơn số lượng đã chuyển KIT/BAR, bạn có muốn thao tác tiếp không?',
                        buttons: [
                            {
                                text: 'Không',
                                role: 'cancel',
                                handler: () => {
                                    this.submitAttempt = false;
                                }
                            },
                            {
                                text: 'Đồng ý',
                                cssClass: 'danger-btn',
                                handler: () => {
                                    this.submitAttempt = false;
                                    it.Quantity = this.item.OrderLines.filter(x => x.IDItem == IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0) + Quantity;
                                    it.ShippedQuantity= it.Quantity;
                                    it.QtyReduction = true;

                                    this.changeDiscount();
                                    this.orderCalc();
                                    this.checkItemAdditional();
                                    // this.saveChange(false, 101);
                                }
                            }
                        ]
                    }).then(alert => {
                        alert.present();
                    });
                }
            }
            else {
                if (it && !NewItem) {
                    it.Quantity += Quantity;
                    it.imgPath = i.imgPath;
                }
                else if (it && NewItem) {
                    it = {
                        Additional: 0,
                        IDItem: i.Id,
                        ItemCode: i.Code,
                        ItemName: i.Name,
                        ItemGroup: i.IDMenu,
                        imgPath: i.imgPath,
                        IDUoM: uom.Id,
                        UoMName: uom.Name,
                        UoMPrice: price.Price,
                        TaxRate: i.SaleVAT,
                        Quantity: 1,
                        UoMSwap: 1,
                        IDBaseUoM: uom.Id,
                        // ShippedQuantity: 1,
                        ShippedQuantity: 0,
                        IDTax: i.IDSalesTaxDefinition,
                        Remark: Remark,
    
                        _item: i
                    };
                    this.item.OrderLines.push(it);
                }
                else {
                    it = {
                        Additional: 0,
                        IDItem: i.Id,
                        ItemCode: i.Code,
                        ItemName: i.Name,
                        ItemGroup: i.IDMenu,
                        imgPath: i.imgPath,
                        IDUoM: uom.Id,
                        UoMName: uom.Name,
                        UoMPrice: price.Price,
                        TaxRate: i.SaleVAT,
                        Quantity: i.Quantity,
                        UoMSwap: 1,
                        IDBaseUoM: uom.Id,
                        ShippedQuantity: 0,
                        IDTax: i.IDSalesTaxDefinition,
                        Remark: Remark,

                        _item: i
                    };
                    this.item.OrderLines.push(it);
                }

                i.Quantity = qty;
                this.changeDiscount();
                this.orderCalc();
                this.checkItemAdditional();
                // this.saveChange(false, 101);
            }
        }
        else {
            if (it) {
                this.submitAttempt = true;
                this.alertCtrl.create({
                    header: 'Xóa sản phẩm',
                    //subHeader: '---',
                    message: 'Bạn chắc muốn xóa sản phẩm?',
                    buttons: [
                        {
                            text: 'Không',
                            role: 'cancel',
                            handler: () => {
                                this.submitAttempt = false;
                            }
                        },
                        {
                            text: 'Đồng ý xóa',
                            cssClass: 'danger-btn',
                            handler: () => {
                                this.submitAttempt = false;
                                let Ids = [];
                                Ids.push({ Id: it.Id });
                                // this.saleOrderDetailProvider.delete(Ids).then(resp => {
                                    this.item.OrderLines.splice(this.item.OrderLines.findIndex(d => d.IDItem == IDItem), 1);
                                    this.orderCalc();
                                    this.checkItemAdditional();
                                    this.env.publishEvent({ Code: this.pageConfig.pageName });
                                    this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.delete-complete','success');

                                    let i = null;

                                    for (let m of this.menuList) { 
                        
                                        for (let it of m.Items) {
                                            it;
                                            if (it.Id == IDItem) {
                                                i = it;
                                                i.Quantity = 0;
                                            }
                                        }
                                    }

                                //     setTimeout(async () => {
                                //         await this.saveChange();
                                //     }, 100);
                                // });
                            }
                        }
                    ]
                }).then(alert => {
                    alert.present();
                })
            }
        }
    }

    kitchenList = [];
    async orderCalc() {
        this.kitchenList = [];
        this.item.OrderLines.forEach(i => {
            i.TotalBeforeDiscount = i.Quantity * (i.UoMPrice || 0);
            i.VoucherDiscount = (i.VoucherDiscount || 0);
            i.TotalDiscount = (this.item.TotalDiscount / this.item.TotalBeforeDiscount) * i.TotalBeforeDiscount;
            i.TotalDiscount = (i.TotalDiscount || 0);
            i.TotalAfterDiscount = i.TotalBeforeDiscount - ((i.TotalDiscount) > i.TotalBeforeDiscount ? i.TotalBeforeDiscount : (i.TotalDiscount));
            if (this.env.selectedBranch == 416) { //only Gem Cafe
                if (i._item.IDMenu == 218) {
                    this.serviceCharge = 5;
                    i.ServiceCharge = i.TotalAfterDiscount * (this.serviceCharge / 100 || 0);  //If set menu; SVC == 5%
                }
                else {
                    i.ServiceCharge = i.TotalAfterDiscount * (0 / 100 || 0);  //else SVC == 0;
                }
            }
            else if (this.env.selectedBranch == 17) { //only The Log
                this.serviceCharge = 5;
                i.ServiceCharge = i.TotalAfterDiscount * (this.serviceCharge / 100 || 0);  //Default 5% for SC.
            }
            else {
                this.serviceCharge = 5;
                i.ServiceCharge = i.TotalAfterDiscount * (this.serviceCharge / 100 || 0);  //Default 0% for SC.
            }
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

        this.item.TotalQuantity = this.item.OrderLines.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);

        this.item.TotalBeforeDiscount = this.item.OrderLines.map(x => x.TotalBeforeDiscount).reduce((a, b) => (+a) + (+b), 0);
        // this.item.InternalDiscount = this.item.OrderLines.map(x => x.InternalDiscount).reduce((a, b) => (+a) + (+b), 0);
        // this.item.VoucherDiscount = this.item.OrderLines.map(x => x.VoucherDiscount).reduce((a, b) => (+a) + (+b), 0);
        // this.item.Discount = this.item.OrderLines.map(x => x.Discount).reduce((a, b) => (+a) + (+b), 0);
        this.item.TotalDiscount = this.item.OrderLines.map(x => x.TotalDiscount).reduce((a, b) => (+a) + (+b), 0);
        this.item.TotalAfterDiscount = this.item.OrderLines.map(x => x.TotalAfterDiscount).reduce((a, b) => (+a) + (+b), 0);
        this.item.TotalAfterServiceCharge = this.item.OrderLines.map(x => x.TotalAfterServiceCharge).reduce((a, b) => (+a) + (+b), 0);
        this.item.ServiceCharge = this.item.OrderLines.map(x => x.ServiceCharge).reduce((a, b) => (+a) + (+b), 0);
        this.item.Tax = this.item.OrderLines.map(x => x.Tax).reduce((a, b) => (+a) + (+b), 0);
        this.item.TotalAfterTax = this.item.OrderLines.map(x => x.TotalAfterTax).reduce((a, b) => (+a) + (+b), 0);
        this.item.Received = this.transactionsList.map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
        this.item.TheChange = this.item.Received - this.item.TotalAfterTax;
        this.item.TaxRate = ((this.item.Tax / this.item.TotalAfterServiceCharge) * 100).toFixed();
        this.item.OrderDateText = lib.dateFormat(this.item.OrderDate, 'hh:MM dd/mm/yyyy');

        this.item.OriginalDiscount1 = 0;
        this.item.OriginalDiscount2 = 0;
        this.item.OriginalDiscountByGroup = 0;
        this.item.OriginalDiscountByItem = 0;
        this.item.OriginalDiscountByLine = 0;
        this.item.OriginalDiscountByOrder = 0;
        this.item.OriginalDiscountFromSalesman = 0;
        this.item.OriginalPromotion = 0;
        this.item.OriginalTotalBeforeDiscount = this.item.TotalBeforeDiscount
        this.item.OriginalTotalDiscount = this.item.TotalDiscount;
        this.item.OriginalTotalAfterDiscount = this.item.TotalAfterDiscount;
        this.item.OriginalTax = this.item.Tax;
        this.item.OriginalTotalAfterTax = this.item.TotalAfterTax;

        this.item.TotalBeforeDiscountText = lib.currencyFormat(this.item.TotalBeforeDiscount);
        this.selectedTables = this.tableList.filter(d => this.item.Tables.indexOf(d.Id) > -1);
    }

    async saveChange(andPrint = false, idStatus = null) {
        if (this.submitAttempt) return;
        if (andPrint) this.kitchenQuery = 'all'; //Xem toàn bộ bill
        if (idStatus) this.item.IDStatus = idStatus;
        this.item.PaymentMethod = this.item.PaymentMethod.toString();
        this.item.OrderLines.forEach(e => {
            if (e.Remark) {
                e.Remark = e.Remark.toString();
            }
        });

        this.submitAttempt = true;

        let apiPath = {
            method: "POST",
            url: function () { return ApiSetting.apiDomain("POS/Menu/AddNewOrderForAnomymousUser") }
        };

        // this.pageProvider.save(this.item).then((savedItem: any) => {
        this.commonService.connect(apiPath.method, apiPath.url(), this.item).toPromise().then((savedItem: any) => {
                
            if (this.id == 0) {
                this.id = savedItem.Id;
                this.item.Id = this.id;
                this.item.OrderLines = savedItem.OrderLines;
                this.loadedData();
                let newURL = '#pos-customer-order/' + this.idBranch + '/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);
            }
            else {
                this.item.OrderLines = savedItem.OrderLines;
                this.item.OrderLines.forEach(it => {
                    let i = null;
                    for (let m of this.menuList) { 
                        for (let mi of m.Items) {
                            if (mi.Id == it.IDItem) {
                                i = mi;
                                it._item = i;
                                it.Image = i?.Image;
                            }
                        }
                    }
                });
            }

            this.checkItemAdditional();

            let that = this;
            QRCode.toDataURL('O:' + savedItem.Id, { errorCorrectionLevel: 'M', version: 2, width: 500, scale: 20, type: 'image/webp' }, function (err, url) {
                that.QRC = url;
            });

            this.mainOrderView = 'done';

            this.env.publishEvent({ Code: this.pageConfig.pageName });
            this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete', 'success');
            this.submitAttempt = false;
            if (andPrint) {
                this.print();
            }
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
                if (e?.Image) {
                    e.imgPath = environment.posImagesServer + e?.Image;
                }
            });
        }).catch(err => {
            console.log(err);
            this.submitAttempt = false;
        });
    }

    changeDiscount() {
        let sumTotalDiscount = 0.0;
        // this.item.PercentTotalDiscount = parseInt(this.item.PercentTotalDiscount);
        this.item.TotalDiscount = parseInt(this.item.TotalDiscount);
        this.item.OrderLines.forEach(i => {
            i.TotalBeforeDiscount = i.Quantity * (i.UoMPrice || 0);
            i.TotalDiscount = (i.TotalBeforeDiscount / this.item.TotalBeforeDiscount) * this.item.TotalDiscount;
            sumTotalDiscount += i.TotalDiscount;
        });
        if ((this.item.TotalDiscount - sumTotalDiscount) != 0) {
            this.item.OrderLines[0].TotalDiscount += (this.item.TotalDiscount - sumTotalDiscount);
        }
    }

    printDate = null;
    sendKitchen(kitchen) {
        this.printDate = lib.dateFormat(new Date(), 'hh:MM dd/mm/yyyy');
        this.kitchenQuery = kitchen.Id;
        if (!this.item.Id || this.item.IDStatus == 101) {
            this.saveChange(false, 101).then(_ => {
                setTimeout(() => {
                    print();
                }, 300);
            })
        }
        else {
            setTimeout(() => {
                print();
                this.saveChange();
            }, 300);
        }

    }

    checkItemAdditional() {
        this.printingItemsList = [];
        this.item.OrderLines.forEach(e => {
            e.Additional = e.Quantity - e.ShippedQuantity;
            if (e.Additional > 0) {
                this.printingItemsList.push(e);
            }
        });
    }

    printingItemsList = [];

    async sendKitchenNew() {
        this.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");
        let idx = 0;
        for (let index = 0; index < this.kitchenList.length; index++) {
            this.item.IDStatus = 101;
            this.item.PaymentMethod = this.item.PaymentMethod.toString();
            this.kitchenQuery = this.kitchenList[idx].Id;

            setTimeout(() => {
                Promise.all([
                    this.kitchenQuery = this.kitchenList[idx].Id,
                    this.pageProvider.save(this.item),
                    idx++,
                ]).then((values: any) => {
                    this.kitchenQuery = values[0];
                    let savedItem = values[1];
                    print();
                    if (typeof this.item.PaymentMethod === 'string') {
                        let payments = this.item.PaymentMethod.split(',');
                        this.item.PaymentMethod = [];
                        this.item.PaymentMethod = payments;
                    }
                });
            }, 300);
        }
    }

    async sendPrint() {
        this.kitchenQuery = 'all'; //Xem toàn bộ bill
        setTimeout(() => {
            print();
        }, 300);
    }

    cancelPOSOrder() {
        this.alertCtrl.create({
            header: 'Hủy đơn hàng',
            //subHeader: '---',
            message: 'Bạn chắc muốn hủy đơn hàng?',
            buttons: [
                {
                    text: 'Không',
                    role: 'cancel',
                },
                {
                    text: 'Đồng ý hủy',
                    cssClass: 'danger-btn',
                    handler: () => {
                        this.saveChange(false, 115);
                    }
                }
            ]
        }).then(alert => {
            alert.present();
        })
    }

    async processDiscounts() {
        const modal = await this.modalController.create({
            component: POSDiscountModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-change-table',
            componentProps: {
                'selectedOrder': this.item,
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        // Send this data to save for Payment
        let TotalDiscount = data[0];
        let newContact = data[1];
        let andApply = data[2];

        if (this.item.IDStatus != 114 && this.item.IDStatus != 115) {
            if (newContact) {
                if (newContact.IDAddress != this.contactSelected.IDAddress) {
                    this.IDContactChanged = true;
                    this.changedIDAddress(newContact);
                    this.IDContactChanged = false;
                }
            }

            if (andApply) {
                this.item.TotalDiscount = TotalDiscount;
            }
            this.checkMethod(this.item);
            this.orderCalc();
            this.saveChange();
        }
        else {
            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }
    }

    async processPayments() {
        const modal = await this.modalController.create({
            component: POSPaymentModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-change-table',
            componentProps: {
                'selectedOrder': this.item,
                'recAmountBtn': this.recAmountBtn,
                'currentContact': this.contactSelected,
                'orderInvoice': this.orderInvoice,
                'transactionsList': this.transactionsList,
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.item = data[0];
        this.orderInvoice = data[1];
        let newContact = data[2];
        this.transactionsList = data[3];
        let newInvoice = data[4];
        let andPrint = data[5];

        if (this.item.IDStatus != 114 && this.item.IDStatus != 115) {
            if (newContact) {
                if (newContact.IDAddress != this.contactSelected.IDAddress) {
                    this.IDContactChanged = true;
                    this.changedIDAddress(newContact);
                    this.IDContactChanged = false;
                }
            }
            if (newInvoice) {
                this.contactProvider.getAnItem(this.item.IDContact).then(data => {
                    let contact: any = data;
                    contact.CompanyName = this.orderInvoice.CompanyName;
                    contact.TaxCode = this.orderInvoice.TaxCode;
                    contact.Email = this.orderInvoice.EmailAddress;
                    contact.BillingAddress = this.orderInvoice.CompanyAddress;

                    this.contactProvider.save(contact).then(savedData => {
                        savedData
                    })
                });
            }
            this.orderCalc();
            this.checkMethod(this.item);
            this.orderCalc();
            if (andPrint) {
                this.saveChange(true, 114); //Only when all Done
            }
            else {
                this.saveChange();
            }
        }
        else {
            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }
    }

    checkMethod(item) {
        this.Methods.forEach(e => {
            let selected = (item.PaymentMethod.indexOf(e.Name) > -1);
            if (e.Name == "Tiền mặt") {
                if (selected == true) {
                    this.InCashOptions = true;
                    this.InCashTotal = this.transactionsList.filter(y => y.IDType == e.IDType).map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
                }
                else {
                    this.InCashOptions = false;
                    this.InCashTotal = 0;
                }
            }
            else if (e.Name == "Chuyển khoản") {
                if (selected == true) {
                    this.DepositOptions = true;
                    this.DepositTotal = this.transactionsList.filter(y => y.IDType == e.IDType).map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
                }
                else {
                    this.DepositOptions = false;
                    this.DepositTotal = 0;
                }
            }
            else if (e.Name == "Ví Momo") {
                if (selected == true) {
                    this.MomoWalletOptions = true;
                    this.MomoWalletTotal = this.transactionsList.filter(y => y.IDType == e.IDType).map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
                }
                else {
                    this.MomoWalletOptions = false;
                    this.MomoWalletTotal = 0;
                }
            }
            else if (e.Name == "Cà thẻ") {
                if (selected == true) {
                    this.VisaMasterOptions = true;
                    this.VisaMasterTotal = this.transactionsList.filter(y => y.IDType == e.IDType).map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
                }
                else {
                    this.VisaMasterOptions = false;
                    this.VisaMasterTotal = 0;
                }
            }
            else if (e.Name == "Thẻ ATM") {
                if (selected == true) {
                    this.ATMCardOptions = true;
                    this.ATMCardTotal = this.transactionsList.filter(y => y.IDType == e.IDType).map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
                }
                else {
                    this.ATMCardOptions = false;
                    this.ATMCardTotal = 0;
                }
            }
        });
        this.changeDiscount();
    }

    RemoveAppliedVoucher(i) {
        const index = this.appliedVoucherList.indexOf(i, 0);
        this.appliedVoucherList.splice(index, 1);
        this.calcVoucherDiscount = true;
        this.changeDiscount();
    }


    SlidingCard = [
        {
            Splash: 'assets/pos-banners/banner-the-log.png',
            Header: 'Welcome!',
            Remark: "Chào mừng bạn đã đến với ứng dụng đặt món tại bàn của nhà hàng."
        },
        {
            Splash: 'assets/pos-banners/banner-the-log.png',
            Header: 'Gọi món dễ dàng',
            Remark: 'Chỉ với vài thao tác đơn giản, nhà hàng đã sẵn sàng để phục vụ món cho bạn.'
        },
        {
            Splash: 'assets/pos-banners/banner-the-log.png',
            Header: 'Luôn luôn sẵn sàng',
            Remark: 'Không phải chờ đợi được phục vụ, bạn luôn luôn chủ động trong việc gọi món cho mình.'
        }
    ]

    slideOptsDefault = {
        initialSlide: 0,
        speed: 400,
        loop: true,
        autoplay: 2000,
    };

    slideOptsFade = {
        on: {
            beforeInit() {
                const swiper = this;
                swiper.classNames.push(`${swiper.params.containerModifierClass}fade`);
                const overwriteParams = {
                    slidesPerView: 1,
                    slidesPerColumn: 1,
                    slidesPerGroup: 1,
                    watchSlidesProgress: true,
                    spaceBetween: 0,
                    virtualTranslate: true,
                };
                swiper.params = Object.assign(swiper.params, overwriteParams);
                swiper.params = Object.assign(swiper.originalParams, overwriteParams);
            },
            setTranslate() {
                const swiper = this;
                const { slides } = swiper;
                for (let i = 0; i < slides.length; i += 1) {
                    const $slideEl = swiper.slides.eq(i);
                    const offset$$1 = $slideEl[0].swiperSlideOffset;
                    let tx = -offset$$1;
                    if (!swiper.params.virtualTranslate) tx -= swiper.translate;
                    let ty = 0;
                    if (!swiper.isHorizontal()) {
                        ty = tx;
                        tx = 0;
                    }
                    const slideOpacity = swiper.params.fadeEffect.crossFade
                        ? Math.max(1 - Math.abs($slideEl[0].progress), 0)
                        : 1 + Math.min(Math.max($slideEl[0].progress, -1), 0);
                    $slideEl
                        .css({
                            opacity: slideOpacity,
                        })
                        .transform(`translate3d(${tx}px, ${ty}px, 0px)`);
                }
            },
            setTransition(duration) {
                const swiper = this;
                const { slides, $wrapperEl } = swiper;
                slides.transition(duration);
                if (swiper.params.virtualTranslate && duration !== 0) {
                    let eventTriggered = false;
                    slides.transitionEnd(() => {
                        if (eventTriggered) return;
                        if (!swiper || swiper.destroyed) return;
                        eventTriggered = true;
                        swiper.animating = false;
                        const triggerEvents = ['webkitTransitionEnd', 'transitionend'];
                        for (let i = 0; i < triggerEvents.length; i += 1) {
                            $wrapperEl.trigger(triggerEvents[i]);
                        }
                    });
                }
            },
        },
    };

    slideOptsFlip = {
        on: {
            beforeInit() {
                const swiper = this;
                swiper.classNames.push(`${swiper.params.containerModifierClass}flip`);
                swiper.classNames.push(`${swiper.params.containerModifierClass}3d`);
                const overwriteParams = {
                    slidesPerView: 1,
                    slidesPerColumn: 1,
                    slidesPerGroup: 1,
                    watchSlidesProgress: true,
                    spaceBetween: 0,
                    virtualTranslate: true,
                };
                swiper.params = Object.assign(swiper.params, overwriteParams);
                swiper.originalParams = Object.assign(swiper.originalParams, overwriteParams);
            },
            setTranslate() {
                const swiper = this;
                const { $, slides, rtlTranslate: rtl } = swiper;
                for (let i = 0; i < slides.length; i += 1) {
                    const $slideEl = slides.eq(i);
                    let progress = $slideEl[0].progress;
                    if (swiper.params.flipEffect.limitRotation) {
                        progress = Math.max(Math.min($slideEl[0].progress, 1), -1);
                    }
                    const offset$$1 = $slideEl[0].swiperSlideOffset;
                    const rotate = -180 * progress;
                    let rotateY = rotate;
                    let rotateX = 0;
                    let tx = -offset$$1;
                    let ty = 0;
                    if (!swiper.isHorizontal()) {
                        ty = tx;
                        tx = 0;
                        rotateX = -rotateY;
                        rotateY = 0;
                    } else if (rtl) {
                        rotateY = -rotateY;
                    }

                    $slideEl[0].style.zIndex = -Math.abs(Math.round(progress)) + slides.length;

                    if (swiper.params.flipEffect.slideShadows) {
                        // Set shadows
                        let shadowBefore = swiper.isHorizontal()
                            ? $slideEl.find('.swiper-slide-shadow-left')
                            : $slideEl.find('.swiper-slide-shadow-top');
                        let shadowAfter = swiper.isHorizontal()
                            ? $slideEl.find('.swiper-slide-shadow-right')
                            : $slideEl.find('.swiper-slide-shadow-bottom');
                        if (shadowBefore.length === 0) {
                            shadowBefore = swiper.$(
                                `<div class="swiper-slide-shadow-${swiper.isHorizontal() ? 'left' : 'top'}"></div>`
                            );
                            $slideEl.append(shadowBefore);
                        }
                        if (shadowAfter.length === 0) {
                            shadowAfter = swiper.$(
                                `<div class="swiper-slide-shadow-${swiper.isHorizontal() ? 'right' : 'bottom'}"></div>`
                            );
                            $slideEl.append(shadowAfter);
                        }
                        if (shadowBefore.length) shadowBefore[0].style.opacity = Math.max(-progress, 0);
                        if (shadowAfter.length) shadowAfter[0].style.opacity = Math.max(progress, 0);
                    }
                    $slideEl.transform(`translate3d(${tx}px, ${ty}px, 0px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
                }
            },
            setTransition(duration) {
                const swiper = this;
                const { slides, activeIndex, $wrapperEl } = swiper;
                slides
                    .transition(duration)
                    .find(
                        '.swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left'
                    )
                    .transition(duration);
                if (swiper.params.virtualTranslate && duration !== 0) {
                    let eventTriggered = false;
                    // eslint-disable-next-line
                    slides.eq(activeIndex).transitionEnd(function onTransitionEnd() {
                        if (eventTriggered) return;
                        if (!swiper || swiper.destroyed) return;

                        eventTriggered = true;
                        swiper.animating = false;
                        const triggerEvents = ['webkitTransitionEnd', 'transitionend'];
                        for (let i = 0; i < triggerEvents.length; i += 1) {
                            $wrapperEl.trigger(triggerEvents[i]);
                        }
                    });
                }
            },
        },
    };

    slidesElement: any;
    getSliders(slides) {
        this.slidesElement = slides;

        setInterval(() => {
            this.slidesElement.slideNext()
        }, 8000);
        // debugger
    }

    toggleView() {
        if (this.mainOrderView == 'cart') {
            this.mainOrderView = 'menu';
            setTimeout(() => {
                this.getScreenSize().then(_ => this.hideEmptyRow());
            }, 100);
        }
        else {
            this.mainOrderView = 'cart';
            this.currencyChange();
        }
    }

    currencyChange() {
        if (this.item.OrderLines.length != 0) {
            this.item.OrderLines.forEach(o => {
                o.PriceText = lib.currencyFormat(o.TotalAfterDiscount);
            });
        }
    }
}
