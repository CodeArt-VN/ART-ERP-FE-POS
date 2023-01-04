import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController, MenuController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { AC_ARInvoiceProvider, BANK_IncomingPaymentDetailProvider, BANK_IncomingPaymentProvider, CRM_ContactProvider, POS_MemoProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, SALE_OrderAdditionProvider, SALE_OrderDeductionProvider, SALE_OrderDetailProvider, SALE_OrderProvider, SYS_PrinterProvider, } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { SaleOrderMobileAddContactModalPage } from '../../SALE/sale-order-mobile-add-contact-modal/sale-order-mobile-add-contact-modal.page';
import { TranslateService } from '@ngx-translate/core';
import { PopoverPage } from '../../SYS/popover/popover.page';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';
import { HostListener } from "@angular/core";
import { POSIntroModalPage } from '../pos-intro-modal/pos-intro-modal.page';
import { POSMemoModalPage } from '../pos-memo-modal/pos-memo-modal.page';
import { EInvoiceService } from 'src/app/services/einvoice.service';
import * as qz from 'qz-tray';
import html2canvas from 'html2canvas';
import { KJUR, KEYUTIL, stob64, hextorstr } from 'jsrsasign';
import { CRM_BusinessPartnerProvider } from 'src/app/services/custom.service';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-pos-order-detail',
    templateUrl: './pos-order-detail.page.html',
    styleUrls: ['./pos-order-detail.page.scss'],
})
export class POSOrderDetailPage extends PageBase {
    idSO: any;
    idTable: any;
    tableGroupList = [];
    tableList = [];
    menuList:any = [];
    posStatus = ['new', 'picking', 'delivered', 'done', 'cancelled'];
    statusList = [
        { Id: 101, Code: 'new', Name: 'Mới' },
        { Id: 106, Code: 'picking', Name: 'Đang lên món' },
        { Id: 109, Code: 'delivered', Name: 'Đã giao' },
        { Id: 111, Code: 'split', Name: 'Đơn đã chia' },
        { Id: 112, Code: 'merged', Name: 'Đơn đã gộp' },
        { Id: 113, Code: 'debt', Name: 'Còn nợ' },
        { Id: 114, Code: 'done', Name: 'Đã xong' },
        { Id: 115, Code: 'cancelled', Name: 'Đã hủy' }
    ];
    arInvoiceStatusList = [];
    OrderAdditionTypeList = [];
    OrderDeductionTypeList = [];
    paymentMethod = ['Tiền mặt', 'Chuyển khoản', 'Ví Momo', 'Credit Card', 'Thẻ ATM'];
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
            Name: 'Credit Card',
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
            Type: 'Credit Card',
        },
    ]

    paymentDetailList = []

    favItemsList = [];
    memoList = [];

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
    TotalPercentDiscount = 0;
    PercentDiscount = 0;
    DiscountAmount = 0;
    InternalPercentDiscount = 0;
    InternalDiscountAmount = 0;
    VoucherDiscount = 0;
    MembershipDiscount = 0;
    
    // AdditionList = []
    // DiscountList = [];
    
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
    isDebtOrder = false;
    TitleSelectedName = '';

    AllSegmentImage;

    selectedTables = [];
    kitchenQuery = 'all';
    currentBranch = null;

    orderInvoice: any = {
        CompanyName: '',
        CompanyAddress: '',
        TaxCode: '',
        EmailAddress: '',
    };

    transactionsList:any = [];

    occupiedTable;
    occupiedTableList = [];

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
        this.colsElement = document.getElementsByClassName('card-holder');
        this.rowsElement = document.getElementsByClassName('table-holder');


        this.clones = document.getElementsByClassName('clone-element');

        //Check width for display;
        // console.log(this.contentElement.offsetWidth)

        //Remove Clone items
        //Add Clone Item For Flexing
        await this.removeClone().then(_ => this.addClone());


        //Set Width for item
        await this.setWidth();

        // setTimeout(() => {
        //     for (let r of rowsElement) {   
        //         // if (contentElement.offsetWidth < 1184) {
        //         //     let list = r.classList;
        //         //     list.remove('space-between');
        //         //     list.add('space-evenly');
        //         // }
        //         // else if ( 1184 <= contentElement.offsetWidth ) {
        //         //     let list = r.classList;
        //         //     list.add('space-between');
        //         //     list.remove('space-evenly');
        //         // }

        //         let list = r.classList;
        //         list.add('center');
        //         // list.add('space-evenly');
        //         // list.remove('space-evenly');
        //     }
        // }, 0);
    }

    async removeClone() {
        let idx = 0;
        const max = this.clones.length;
        for (let index = 0; index < max; index++) {
            this.clones[0].parentNode.removeChild(this.clones[0]);
            if (idx == max-1) {
                return;
            }
            idx++;
        }
    }

    async addClone() {
        let counter = 0;
        setTimeout(() => {
            for (let r of this.rowsElement) {
                if ( 682 <= this.contentElement?.offsetWidth && this.contentElement?.offsetWidth < 1002) {
                    if (r.childElementCount % 2 === 0) {
                        //Full Row
                    } else {
                        const card = r.children[r.children.length - 1];
                        const clone = card.cloneNode(true);
                        clone.classList.add("clone-element");

                        r.appendChild(clone);
                    }
                }
                else if ( 1002 <= this.contentElement?.offsetWidth && this.contentElement?.offsetWidth < 1306 ) {
                    let number = r.childElementCount % 3;

                    if (r.childElementCount % 3 === 0) {
                        //Full Row
                    } else {
                       for (let index = 0; index < (3-number); index++) {
                            const card = r.children[r.children.length-1];
                            const clone = card.cloneNode(true);
                            clone.classList.add('clone-element');
                            r.appendChild(clone);
                       }
                    }
                }
                else if ( 1306 <= this.contentElement?.offsetWidth ) {
                    let number = r.childElementCount % 3;

                    if (r.childElementCount % 3 === 0) {
                        //Full Row
                    } else {
                       for (let index = 0; index < (3-number); index++) {
                            const card = r.children[r.children.length-1];
                            const clone = card.cloneNode(true);
                            clone.classList.add('clone-element');
                            r.appendChild(clone);
                       }
                    }
                }
                counter++;
            }
        }, 50);
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
            for (let co of this.colsElement) {
                if (this.contentElement?.offsetWidth < 675) { 
                    let list = co.classList;
                    list.add('fullscreen-table');
                }
                else {
                    let list = co.classList;
                    list.remove('fullscreen-table');
                }
            }
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

    jumpToItem(o) {
        let element = document.getElementsByClassName(o.IDItem);
        try {
            element[element.length-1].scrollIntoView({behavior: "smooth", block: "center"});
        } catch (error) {
            console.log(error);
        }
    }

    constructor(
        public pageProvider: SALE_OrderProvider,
        public saleOrderDetailProvider: SALE_OrderDetailProvider,
        public menuProvider: POS_MenuProvider,
        public tableGroupProvider: POS_TableGroupProvider,
        public tableProvider: POS_TableProvider,
        public memoProvider: POS_MemoProvider,
        public contactProvider: CRM_ContactProvider,
        public posContactProvider: CRM_BusinessPartnerProvider,
        public incomingPaymentProvider: BANK_IncomingPaymentProvider,
        public incomingPaymentDetailProvider: BANK_IncomingPaymentDetailProvider,
        public printerProvider: SYS_PrinterProvider,

        public arInvoiceProvider: AC_ARInvoiceProvider,

        public eInvoice: EInvoiceService,
        
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
        public menuCtrl: MenuController,
        public translate: TranslateService
    ) {
        super();
        this.pageConfig.isDetailPage = true;
        this.pageConfig.isShowFeature = true;
        this.pageConfig.isShowSearch = true;
        this.idSO = this.route.snapshot?.paramMap?.get('id');
        this.idSO = typeof (this.idSO) == 'string' ? parseInt(this.idSO) : this.idSO;
        this.idTable = this.route.snapshot?.paramMap?.get('table');
        this.idTable = typeof (this.idTable) == 'string' ? parseInt(this.idTable) : this.idTable;
        // this.formGroup = formBuilder.group({
        //     IDBranch: [''],
        //     Id: new FormControl({ value: '', disabled: true }),
        //     Code: [''],
        //     Name: ['', Validators.required],
        // });
    }

    ionViewWillEnter() {
        var menuBtn:any = document.getElementsByClassName("menu-toogle-btn")[0];
        menuBtn.style.visibility = "hidden";
        this.menuCtrl.enable(false);
    }

    ionViewDidEnter() {
        this.contentElement = document.getElementsByClassName('menu-view')[0];
        if (this.contentElement?.offsetWidth <= 650) { 
            this.pageConfig.isShowFeature = false;
        }
        else {
            this.pageConfig.isShowFeature = true;
        }
    }

    ionViewWillLeave() {
        var menuBtn:any = document.getElementsByClassName("menu-toogle-btn")[0];
        menuBtn.style.visibility = "visible";
        this.menuCtrl.enable(true);
    }

    preLoadData(event?: any): void {
        this.currentBranch = this.env.branchList.find(d => d.Id == this.env.selectedBranch);
        this.query.Keyword = 'all';
        this.getOrderList().then((data: any) => {
            let currentOrderList = data.data;

            currentOrderList.forEach(tb => {
                if (tb.Id != this.idSO) { 
                    let data = (tb?.Tables).toString();
                    if (data) {
                        this.occupiedTableList.push(data);
                    }
                }
            });
            if (this.occupiedTableList.length != 0) {
                this.occupiedTable = this.occupiedTableList.toString();
            }

            this.getTableGroup().then(async (data: any) => {
                this.tableList = [];
                data.forEach(g => {
                    this.tableList.push({ Id: 0, Name: g.Name, levels: [], disabled: true });
                    g.TableList.forEach(t => {
                        this.tableList.push({ Id: t.Id, Name: t.Name, levels: [{}] });
                    });
                });
                if (this.occupiedTable) {
                    let removeTblList = this.occupiedTable?.split(",");
                    if (removeTblList.length != 0) {
                        removeTblList.forEach(tb => {
                            let matchTable = this.tableList.find(i => i.Id == tb);
        
                            const index = this.tableList.indexOf(matchTable, 0);
                            this.tableList.splice(index, 1);
                        });
                    }
                }
                this.getMemoList(event);
                // this.getMenuList(event);
                // this.getFavItemsList(event);
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
            this.pageProvider.read({Keyword: '', Take: 5000, Skip: 0, IDStatus: 101}).then(data => {
                resolve(data);
            });
        });
    }

    async getMemoList(event) {
        this.memoProvider.read().then(resp => {
            this.memoList = resp['data'];
            this.getMenuList(event);
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
            if (data) {
                this.menuList = data;
                this.menuList.unshift(FavGroup);
                this.getFavItemsList(event);
            }
            else {
                Promise.all([
                    this.menuProvider.read(),
                ]).then(values => {
                    this.menuList = values[0]['data'];
                    this.menuList.unshift(FavGroup);
                    this.menuList.forEach(m => {
                        m.Items.sort((a, b) => a['Sort'] - b['Sort']);
                    });
                    this.env.setStorage('menuList' + this.env.selectedBranch, this.menuList);
                    this.getFavItemsList(event);
                })
            }
        });
    }

    async getFavItemsList(event) {
        this.env.getStorage('favItemsList' + this.env.selectedBranch).then((data: any) => {
            if (data) {
                let tempList:any = [];
                data.forEach(e => {
                    tempList = tempList.concat(e.Items);
                });
                this.favItemsList = tempList.splice(0,10);
                let menu:any = this.menuList.filter(i => i.Name == 'FAVOURITE');
                menu[0].Items = this.favItemsList;

                this.createMenuGroupImage();
                super.preLoadData(event);
            }
            else {

                let query = {
                    IDBranch: this.env.selectedBranch,
                }
        
                let apiPath = {
                    method: "GET",
                    url: function () { return ApiSetting.apiDomain("POS/Menu/FavouriteItems") }
                };

                Promise.all([
                    this.commonService.connect(apiPath.method, apiPath.url(), query).toPromise()
                ]).then(values => {
                    let data = values[0]['data'];
                    let tempList:any = [];
                    if (data) {
                        data.forEach(e => {
                            tempList = tempList.concat(e.Items);
                        });
    
                        this.favItemsList = tempList.splice(0,10);
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

    loadData(event?: any) {
        Promise.all([
            this.env.getStatus('ARInvoiceStatus'),
            this.env.getType('OrderAddition'),
            this.env.getType('OrderDeduction'),
        ]).then((results:any) => {
            this.arInvoiceStatusList = results[0];
            this.OrderAdditionTypeList = results[1];
            this.OrderDeductionTypeList = results[2];
            super.loadData(event);
        });
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        this.getScreenSize().then(_ => this.hideEmptyRow());
        this.menuList.forEach((m:any) => {
            m.Items.forEach(i => {
                i.imgPath = environment.posImagesServer + i?.Image;
            });
        });
        if (!this.item || !this.item.Id) {
            this.item = {
                Additions: [],
                Deductions: [],
                IDBranch: this.env.selectedBranch,
                OrderDate: lib.dateFormat(new Date()) + ' ' +lib.dateFormat(new Date(),'hh:MM:ss'),
                IDContact: 922,
                IDAddress: 902,
                CustomerName: 'Khách lẻ',
                IDType: 293,
                IDStatus: 101,
                IDOwner: this.env.user.StaffID,
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

            if (this.item.Deductions.length != 0) {
                this.item.Deductions.forEach(d => {
                    if (d.Type == 'TradeDiscount') {
                        console.log('TradeDiscount: ' + d.Amount);
                    }
                    else if (d.Type == 'SalesOff') {
                        this.PercentDiscount = (d.Amount / this.item.TotalBeforeDiscount) * 100;
                        this.DiscountAmount = d.Amount;

                    }
                    else if (d.Type == 'Voucher') {
                        this.VoucherDiscount = d.Amount;
                    }
                    else if (d.Type == 'Membership') {
                        this.MembershipDiscount = d.Amount;
                    }
                    else if (d.Type == 'InternalDiscount') {
                        this.InternalPercentDiscount = (d.Amount / this.item.TotalBeforeDiscount) * 100;
                        this.InternalDiscountAmount = d.Amount;
                    }
                });
            } 

            this.TotalPercentDiscount = this.TotalPercentDiscount || 0;
            this.transactionsList = [];
            this.incomingPaymentDetailProvider.search({IDSaleOrder: this.item.Id, IsDeleted: false}).toPromise().then((results:any) => {
                let counter = 0;
                this.paymentDetailList = results;
                this.paymentDetailList.forEach(e => {
                    Promise.all([
                        this.incomingPaymentProvider.getAnItem(e.IDIncomingPayment)
                    ]).then((data) => {
                        this.transactionsList.push(data[0]);
    
                        if (counter == this.paymentDetailList.length - 1) {
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

                if (this.paymentDetailList.length == 0) {
                    this.orderCalc();
                    this.checkMethod(this.item);
                    this.orderCalc();
                }
            });
        }

        if (this.item.IDContact == 922 && this.item.IDAddress == null) {
            this.item.IDAddress = 902;
        }
        else if (this.item.IDContact != 922 && this.item.IDAddress == null) {
            this.item.IDContact == 922;
            this.item.IDAddress = 902;
        }

        if (this.item.IDAddress) {
            this.posContactProvider.SearchContact({ Take: 20, Skip: 0, Term: this.item.IDContact }).subscribe((data: any) => {
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
        this.checkItemAdditional();
        super.loadedData(event, ignoredFromGroup);
    }

    events(e) {
        if (e.Code == 'add-contact' && e.data) {
            let contact = e.data;
            contact.IDAddress = contact.Address.Id;
            this.contactSelected = contact;
            this.item.IDContact = contact.Id;
            this.item.IDAddress = contact.IDAddress;
            // this.formGroup['controls'].IDContact.setValue(this.item.IDContact);
            // this.formGroup['controls'].IDAddress.setValue(this.item.IDAddress);
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
                switchMap(term => this.posContactProvider.SearchContact({ Take: 20, Skip: 0, Term: term ? term : this.item.IDContact }).pipe(
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
                this.saveChange().then(_=> {
                    setTimeout(() => {
                        if (i.IsStaff) {
                            this.env.showTranslateMessage('Khách hàng là nhân viên. Đơn thanh toán sẽ được chiết khấu, hoặc lưu Còn nợ.','warning', null, 3000);
                        }
                    }, 2000);
                })
            } 
        }
    }

    changedItemMemo(event, o) {
        if (o.Remark) {
            o.Remark = o.Remark.toString();
            this.saveChange();
        }
    }

    async createNewMemo(name) {
        let newMemo = { Id: null, Name: name, IDBranch: this.env.selectedBranch, Type: null};

        if (this.memoList.findIndex(d => d.name == name) == -1) {
            await this.memoProvider.save(newMemo).then(result => {
                this.memoList.push({ Id: result['Id'], Name: result['Name'], IDBranch: result['IDBranch'], Type: result['Type']});
                this.memoList = [...this.memoList];
                this.env.showTranslateMessage('Đã lưu ghi chú nhanh mới', 'success');
                newMemo.Id = result['Id'];
            });
            return newMemo;
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

    async addToCart(IDItem, Quantity, Index, NewItem = false) {
        if (this.submitAttempt) return;
        if (this.item.Tables == null || this.item.Tables.length == 0) {
            this.env.showTranslateMessage('Vui lòng chọn bàn trước khi thêm món!', 'warning');
            return
        }

        if ( (this.item.IDStatus != 113 && this.item.IDStatus != 114 && this.item.IDStatus != 115) ) {
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

                                    if (ite.ShippedQuantity < lineCheckQty) {
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
                i.Quantity = 0;
                this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
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

                                    this.orderCalc();
                                    this.changeDiscount();
                                    this.orderCalc();
                                    this.checkItemAdditional();
                                    this.saveChange(false, 101);
                                }
                            }
                        ]
                    }).then(alert => {
                        alert.present();
                    });
                }
                else if (it?.ShippedQuantity > lineCheckQty) {
                    if (it.QtyReduction) {
                        it.Quantity = this.item.OrderLines.filter(x => x.IDItem == IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0) + Quantity;
                        it.ShippedQuantity = it.Quantity;
                        it.QtyReduction = true;

                        this.orderCalc();
                        this.changeDiscount();
                        this.orderCalc();
                        this.checkItemAdditional();
                        this.saveChange(false, 101);
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
                                        it.ShippedQuantity = it.Quantity;
                                        it.QtyReduction = true;
    
                                        this.orderCalc();
                                        this.changeDiscount();
                                        this.orderCalc();
                                        this.checkItemAdditional();
                                        this.saveChange(false, 101);
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
                        it._item = i;
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
                            Remark: null,
        
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
                            Quantity: qty,
                            UoMSwap: 1,
                            IDBaseUoM: uom.Id,
                            // ShippedQuantity: qty,
                            ShippedQuantity: 0,
                            IDTax: i.IDSalesTaxDefinition,
                            Remark: null,
        
                            _item: i
                        };
                        this.item.OrderLines.push(it);
                    }

                    i.Quantity = qty;
                    this.orderCalc();
                    this.changeDiscount();
                    this.orderCalc();
                    this.checkItemAdditional();
                    this.saveChange(false, 101);
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
                                    this.saleOrderDetailProvider.delete(Ids).then(resp => {
                                        let index = this.item.Additions.findIndex(d => d.IDOrderLine == it.Id);
                                        if ( index != -1 ) {
                                            this.item.Additions.splice(this.item.Additions.findIndex(d => d.IDOrderLine == it.Id), 1);
                                        }
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

                                        setTimeout(async () => {
                                            await this.saveChange();
                                        }, 100);
                                    });
                                }
                            }
                        ]
                    }).then(alert => {
                        alert.present();
                    })
                }
            }
        }
        else {
            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }
    }

    kitchenList = [];
    orderCalc() {
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
                i.ServiceCharge = i.TotalAfterDiscount * (this.serviceCharge / 100 || 0);  //Default 5% for SC.
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
            if (this.id && i.Id) {
                this.saveAdditions(i);
            }
        });
        // console.log(this.kitchenList);


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
        // this.item.TaxRate = ((this.item.Tax / this.item.TotalAfterDiscount) * 100).toFixed();
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
        this.pageProvider.save(this.item).then(async (savedItem: any) => {
            if (this.id == 0) {
                this.id = savedItem.Id;
                this.item.Id = this.id;
                this.item.OrderLines = savedItem.OrderLines;
                this.loadedData();
                let newURL = '#pos-order/' + savedItem.Id + '/' + this.idTable;
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
            this.env.publishEvent({ Code: this.pageConfig.pageName });
            this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');
            this.submitAttempt = false;
            if (andPrint) {
                this.sendPrint(idStatus);
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

    saveAdditions(line) {
        let additionInfo: any = {};
        if (this.item.Additions && this.item.Additions.length != 0) {
            let checkServiceCharge:any = this.item.Additions.find(d => d.IDOrderLine == line.Id);
            if (checkServiceCharge) {
                checkServiceCharge.Amount = line.ServiceCharge;
                checkServiceCharge.IDOrderLine = line.Id;
                checkServiceCharge.IsDeleted = false;
            }
            else {
                additionInfo.Id = 0;
                additionInfo.IDOrder = this.item.Id;
                additionInfo.IDOrderLine = line.Id;
                additionInfo.Amount = line.ServiceCharge;
                additionInfo.TaxRate = line.TaxRate;
                additionInfo.IsDeleted = false;
                additionInfo.Type = "ServiceCharge";
                this.item.Additions.push(additionInfo);
            }
        }
        else {
            additionInfo.Id = 0;
            additionInfo.IDOrder = this.item.Id;
            additionInfo.IDOrderLine = line.Id;
            additionInfo.Amount = line.ServiceCharge;
            additionInfo.TaxRate = line.TaxRate;
            additionInfo.IsDeleted = false;
            additionInfo.Type = "ServiceCharge";
            this.item.Additions.push(additionInfo);
        }
    }

    discountInfo: any = {};
    async changeDiscount() {
        let sumTotalDiscount = 0.0;

        this.DiscountAmount =  ( this.item.TotalBeforeDiscount * this.PercentDiscount) / 100;
        this.InternalDiscountAmount =  ( this.item.TotalBeforeDiscount * this.InternalPercentDiscount) / 100;

        if (this.PercentDiscount != 0) {
            let checkCurrentDiscount = this.item.Deductions.find(d => d.Type == 'SalesOff');

            if (checkCurrentDiscount) {
                checkCurrentDiscount.Amount = this.DiscountAmount; //Update
            }
            else {
                this.discountInfo.Id = 0;
                this.discountInfo.Type = 'SalesOff';
                this.discountInfo.Amount = this.DiscountAmount;
                this.discountInfo.IDOrder = this.item.Id;
                this.item.Deductions.push(this.discountInfo);
            }
        }

        if (this.InternalPercentDiscount != 0) {
            let checkCurrentDiscount = this.item.Deductions.find(d => d.Type == 'InternalDiscount');

            if (checkCurrentDiscount) {
                checkCurrentDiscount.Amount = this.InternalDiscountAmount; //Update
            }
            else {
                this.discountInfo.Id = 0;
                this.discountInfo.Type = 'InternalDiscount';
                this.discountInfo.Amount = this.InternalDiscountAmount;
                this.discountInfo.IDOrder = this.item.Id;
                this.item.Deductions.push(this.discountInfo);
            }
        }

        this.item.TotalDiscount = this.VoucherDiscount + this.DiscountAmount + this.InternalDiscountAmount + this.MembershipDiscount; //sum
        this.item.TotalDiscount = parseInt(this.item.TotalDiscount);

        this.TotalPercentDiscount = ( this.item.TotalDiscount / this.item.TotalBeforeDiscount ) * 100;
        this.TotalPercentDiscount = ( this.TotalPercentDiscount || 0 );
        this.TotalPercentDiscount = Number(this.TotalPercentDiscount);

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
                }, 100);
            })
        }
        else {
            setTimeout(() => {
                print();
                this.saveChange();
            }, 100);
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
        this.submitAttempt = true;
        let idx = 0;
        let idx2 = 0;

        let skipTime = 0;
        this.printingItemsList = [];

        let printerCodeList = [];
        let base64dataList = [];

        this.item.OrderLines.forEach(e => {
            e.Additional = e.Quantity - e.ShippedQuantity;
            if (e.Additional > 0) {
                this.printingItemsList.push(e);
            }
        });

        const newKitchenList = [...new Map(this.printingItemsList.map((item: any) =>[item['_IDKitchen'], item._item.Kitchen])).values()];

        // debugger
        for (let index = 0; index < newKitchenList.length; index++) {
            this.item.IDStatus = 101;
            this.item.PaymentMethod = this.item.PaymentMethod.toString();
            this.item.OrderLines.forEach(e => {
                if (e.Remark) {
                    e.Remark = e.Remark.toString();
                }
            });

            if (this.printingItemsList.length == 0) {
                this.env.showTranslateMessage('Không có sản phẩm mới cần gửi đơn!', 'success');
                this.submitAttempt = false;
                return;                
            }

            let object: any = document.getElementById('bill');
            let list = object.classList;
            list.add("show-bill");

            var opt = { // Make Bill Printing Clearer
                logging: true,
                scale: 7,
            };

            await this.setKitchenID(newKitchenList[idx].Id);

            Promise.all([
                newKitchenList[idx2],
                html2canvas(object, opt),
                idx2++
            ]).then((values:any) => {
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

                console.log(printerCode);
                printerCodeList.push(printerCode);
                base64dataList.push(data);

                if (idx == base64dataList.length) {
                    this.QZsetCertificate().then(() => {
                        this.QZsignMessage().then(() => {
                            console.log(printerCodeList);
                            this.sendQZTray(printerHost, printerCodeList, base64dataList, skipTime, list).catch(err => {
                                console.log(err);
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

    async setKitchenID(value, ms = 1) {
        return new Promise((resolve, reject) => {
            this.kitchenQuery = value;
            setTimeout(() => {
                resolve(this.kitchenQuery);
            }, ms);
        });
    }

    idx4 = 0;
    async sendQZTray(printerHost, printerCodeList, base64dataList, skipTime, list, receipt = false) {

        //Flow: 
        // Open Connection >> 
        // Get Printer List from DB >> 
        // Check printer match ? (create printer config) : (create PDF config) >> 
        // QZ Printing >> 
        // Update item Quantity >> 
        // Save Order >> 
        // Close Connection >> Done.

        this.idx4;
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
                console.log("Printers List:" + printersDB);
                if (printerCodeList.length != 0) {
                    printerCodeList.forEach(p => {
                        if (printersDB.indexOf(p) > -1) { // Use this when fixed Printer
                            let config = qz.configs.create(p, {copies: 1});
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
                    await this.QZCheckData(list,skipTime, true).then(_ => {
                        if (this.item.IDStatus == 113 || this.item.IDStatus == 114 || this.item.IDStatus == 115 ) {
                            this.nav('/pos-order','back');
                        }
                    });
                }).catch(err => {
                    console.log(err);
                    this.submitAttempt = false;
                    this.QCCloseConnection();
                });
            }).catch(err => {
                console.log(err);
                this.submitAttempt = false;
                this.QCCloseConnection();
            });

        }).catch(err => {
            err;
            console.log(err);
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
        qz.security.setSignaturePromise(function(toSign) {
            return function(resolve, reject) {
                try {
                    
                    var pk = KEYUTIL.getKey(privateKey);
                    var sig = new KJUR.crypto.Signature({"alg": "SHA512withRSA"});  // Use "SHA1withRSA" for QZ Tray 2.0 and older
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

    async QZCheckData(list, skipTime, receipt = false) {
        // if (this.idx4 == this.kitchenList.length - (1 + skipTime)) {
            if (!receipt) {
                this.item.OrderLines.forEach(e => { 
                    e.ShippedQuantity = e.Quantity;
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
                        if (e?.Image) {
                            e.imgPath = environment.posImagesServer + e?.Image;
                        }
                    });
                });
            }
            list.remove("show-bill");
            this.env.showTranslateMessage('Gửi đơn thành công!', 'success');
            this.submitAttempt = false;
            this.printingItemsList = []; //<-- clear;
            this.idx4 = 0;
            return qz.websocket.disconnect();
        // }
        // this.idx4++;
    }

    async QCCloseConnection() {
        let checkCon = qz.websocket.isActive();
        if (checkCon) {
            qz.websocket.disconnect();
        }
    }

    async sendPrint(idStatus?) {
        this.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");
        this.submitAttempt = true;
        let idx = 0;
        let idx2 = 0;

        let skipTime = 0;
        this.printingItemsList = [];

        let printerCodeList = [];
        let base64dataList = [];

        this.printingItemsList.push(this.item.OrderLines[0]);
        let newKitchenList = [];

        this.printerProvider.search({IDBranch: this.env.selectedBranch, Remark: 'Receipt Printer', IsDeleted: false, IsDisabled: false}).toPromise().then(async (defaultPrinter: any) => { 
            console.log(defaultPrinter);
            if (defaultPrinter && defaultPrinter.length != 0) {
                defaultPrinter.forEach((p:any) => {
                    let Info = {
                        Id: p.Id,
                        Name: p.Name,
                        Code: p.Code,
                        Host: p.Host,
                        Port: p.Port
                    }
                    newKitchenList.push({'Printer' : Info});
                });
            }
            else {
                console.log(defaultPrinter);
                this.env.showTranslateMessage('Recheck Receipt Printer information!' , 'warning');
                return
            }

            for (let index = 0; index < newKitchenList.length; index++) {
                if (idStatus) {
                    this.item.IDStatus = idStatus;
                }
                this.item.PaymentMethod = this.item.PaymentMethod.toString();
                this.item.OrderLines.forEach(e => {
                    if (e.Remark) {
                        e.Remark = e.Remark.toString();
                    }
                });

                if (this.printingItemsList.length == 0) {
                    this.env.showTranslateMessage('Không có sản phẩm mới cần gửi đơn!', 'success');
                    this.submitAttempt = false;
                    return;                
                }

                let object: any = document.getElementById('bill');
                let list = object.classList;
                list.add("show-bill");

                var opt = { // Make Bill Printing Clearer
                    logging: true,
                    scale: 7,
                };

                await this.setKitchenID('all'); //Xem toàn bộ bill

                Promise.all([
                    newKitchenList[idx2],
                    html2canvas(object, opt),
                    idx2++
                ]).then((values:any) => {
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

                    console.log(printerCode);
                    printerCodeList.push(printerCode);
                    base64dataList.push(data);

                    if (idx == base64dataList.length) {
                        this.QZsetCertificate().then(() => {
                            this.QZsignMessage().then(() => {
                                console.log(printerCodeList);
                                this.sendQZTray(printerHost, printerCodeList, base64dataList, skipTime, list).catch(err => {
                                    console.log(err);
                                    this.submitAttempt = false;
                                    skipTime++;
                                });
                            });
                        });
                    }
                });
                idx++;
            }
        });
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
                        this.saveChange(false, 115).then(_ => {
                            this.nav('/pos-order','back');
                        });
                    }
                }
            ]
        }).then(alert => {
            alert.present();
        })
    }

    help() {
        this.processWelcome();
    }

    // ionViewDidEnter(): void {
    //     this.processWelcome();
    // }

    async openQuickMemo(ite) {

        const modal = await this.modalController.create({
            component: POSMemoModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-quick-memo',
            componentProps: {
                'quickMemuList': this.memoList,
                'selectedOrder': this.item,
                'selectedLine': ite,
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        // Send this data to save for Payment
        let Remark = data[0];
        let andApply = data[1];

        if ( this.item.IDStatus != 113 && this.item.IDStatus != 114 && this.item.IDStatus != 115 ) {
            if (andApply) {
                ite.Remark = Remark;
                this.saveChange();
            }
        }
        else {
            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }
    }

    async processWelcome() {
        const modal = await this.modalController.create({
            component: POSIntroModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-welcome-page',
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

        debugger

        // if ( this.item.IDStatus != 114 && this.item.IDStatus != 115 ) {
        //     if (newContact) {
        //         if ( newContact.IDAddress != this.contactSelected.IDAddress) {
        //             this.IDContactChanged = true;
        //             this.changedIDAddress(newContact);
        //             this.IDContactChanged = false;
        //         } 
        //     }

        //     if (andApply) {
        //         this.item.TotalDiscount = TotalDiscount;
        //     }
        //     this.checkMethod(this.item);
        //     this.orderCalc();
        //     this.saveChange();
        // }
        // else {
        //     this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        // }
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
        let PercentDiscount = data[3].PercentDiscount;
        let InternalPercentDiscount = data[3].InternalPercentDiscount;
        let VoucherDiscount = data[3].VoucherDiscount;
        let MembershipDiscount = data[3].MembershipDiscount;
        let DiscountList = data[4];

        if ( this.item.IDStatus != 113 && this.item.IDStatus != 114 && this.item.IDStatus != 115 ) {
            if (newContact) {
                if ( newContact.IDAddress != this.contactSelected.IDAddress) {
                    this.IDContactChanged = true;
                    this.changedIDAddress(newContact);
                    this.IDContactChanged = false;
                } 
            }
            if (andApply) {
                this.item.Deductions = DiscountList;
                this.item.TotalDiscount = TotalDiscount;
                this.PercentDiscount = PercentDiscount;
                this.InternalPercentDiscount = InternalPercentDiscount;
                this.VoucherDiscount = VoucherDiscount;
                this.MembershipDiscount = MembershipDiscount;
            }
            this.orderCalc();
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
                // 'recAmountBtn': this.recAmountBtn,
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
        let andCreateInvoice = data[4];
        let andPrint = data[5];
        this.isDebtOrder = data[6];
        this.TitleSelectedName = data[7];

        if ( this.item.IDStatus != 113 && this.item.IDStatus != 114 && this.item.IDStatus != 115 ) {
            if (newContact) {
                if ( newContact.IDAddress != this.contactSelected.IDAddress) {
                    this.IDContactChanged = true;
                    this.changedIDAddress(newContact);
                    this.IDContactChanged = false;
                } 
            }
            if (andCreateInvoice) {
                this.contactProvider.getAnItem(this.item.IDContact).then(data => {
                    let contact:any = data;
                    contact.CompanyName = this.orderInvoice.CompanyName;
                    contact.TaxCode = this.orderInvoice.TaxCode;
                    contact.Email = this.orderInvoice.EmailAddress;
                    contact.BillingAddress = this.orderInvoice.CompanyAddress;

                    this.contactProvider.save(contact).then(savedData => {
                        savedData;
                    });
                });
                this.item.IsInvoiceRequired = true;
            }
            else {
                this.item.IsInvoiceRequired = false;
            }
            this.orderCalc();
            this.checkMethod(this.item);
            this.orderCalc();
            if (andPrint) {
                this.eInvoice.CreateARInvoiceFromSOs([this.item.Id]).then(data => {

                    this.arInvoiceProvider.read({IDSaleOrder: this.item.Id}).then((results:any) => {
                        let arInvoice = results.data[0];

                        if (arInvoice) {
                            arInvoice.BuyerTaxCode = this.orderInvoice.TaxCode;
                            arInvoice.BuyerUnitName = this.orderInvoice.CompanyName;
                            arInvoice.BuyerName = newContact.Name;
                            arInvoice.BuyerAddress = this.orderInvoice.CompanyAddress;
    
                            arInvoice.CustomerName = newContact.Name;
                            arInvoice.ReceiverName = newContact.Name;
                            arInvoice.IDBusinessPartner = newContact.Id;
    
                            this.arInvoiceProvider.save(arInvoice).then(savedData => {
                                arInvoice = savedData;
                            });
                        }
                        this.item.OrderLines.forEach(i => {
                            i.ShippedQuantity = i.Quantity;
                            i.OriginalTotalBeforeDiscount = i.TotalBeforeDiscount;
                            i.OriginalTotalDiscount = i.TotalDiscount;
                            i.OriginalTotalAfterDiscount = i.TotalAfterDiscount;
                            i.OriginalTax = i.Tax;
                            i.OriginalTotalAfterTax = i.TotalAfterTax;
                        });
                        if (this.isDebtOrder) {
                            this.item.Remark = this.TitleSelectedName;
                            this.saveChange(true, 113); //Đơn còn nợ, dành cho khách là nhân viên thuộc các nhóm BOD/BOM/SALE/MARKETING/OTHERS
                        }
                        else {
                            this.item.Remark = '';
                        this.saveChange(true, 114); //Only when all Done
                        }
                    });
                }).catch(err => {
                    console.log(err);
                });
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
            else if (e.Name == "Credit Card") {
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
}
