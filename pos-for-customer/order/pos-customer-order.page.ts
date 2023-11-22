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
import { SYS_ConfigProvider } from 'src/app/services/static/services.service';

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
    isSuccessModalOpen = false;
    isStatusModalOpen = false;
    isLockOrderFromStaff = false;

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
        public sysConfigProvider: SYS_ConfigProvider,
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
                case 'app:POSLockOrderFromStaff':
                    this.notifyLockOrderFromStaff(data.Data);
                    break;
                case 'app:POSLockOrderFromCustomer':
                    this.notifyLockOrderFromCustomer(data.Data);
                    break;
                case 'app:POSUnlockOrderFromStaff':
                    this.notifyUnlockOrder(data.Data);
                case 'app:POSUnlockOrderFromCustomer':
                    this.notifyUnlockOrder(data.Data);
                    break;
                // case 'app:POSOrderFromCustomer':
                //     this.notifyFromCustomer(data.Data);
                //     break;
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
        let sysConfigQuery = ['POSAudioCallStaff','POSAudioCallToPay','POSAudioOrderUpdate','POSAudioIncomingPayment'];
        Promise.all([
            this.getMenu(),
            this.getTable(),
            this.getDeal(),
            this.sysConfigProvider.read({ Code_in: sysConfigQuery })
        ]).then((values: any) => {
            this.menuList = values[0];
            this.Table = values[1];
            this.dealList = values[2];
            this.pageConfig.systemConfig = {};
            values[3]['data'].forEach(e => {
                if ((e.Value == null || e.Value == 'null') && e._InheritedConfig) {
                    e.Value = e._InheritedConfig.Value;
                }
                this.pageConfig.systemConfig[e.Code] = JSON.parse(e.Value);
            });
            this.checkIPConfig(event);
        }).catch(err => {
            this.loadedData(event);
        })
    }

    async checkIPConfig(event) {

        this.pageProvider.commonService.connect('GET', 'POS/ForCustomer/CheckIPCustomer', { IDBranch: this.Table.IDBranch }).toPromise().then((resp: any) => {
            if (resp['canEdit']) {
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

    private checkLastModifiedDate() {
            if (this.item.Id && ['Merged', 'Splitted', 'Done'].indexOf(this.item.Status) == -1) {
                this.pageProvider.commonService.connect('GET', 'POS/ForCustomer/CheckPOSModifiedDate', { IDOrder: this.item.Id }).toPromise()
                .then(lastModifiedDate => {
                    let itemModifiedDateText = lib.dateFormat(this.item.ModifiedDate, 'yyyy-mm-dd') + ' ' + lib.dateFormat(this.item.ModifiedDate, 'hh:MM:ss');
                    let lastModifiedDateText = lib.dateFormat(lastModifiedDate, 'yyyy-mm-dd') + ' ' + lib.dateFormat(lastModifiedDate, 'hh:MM:ss');
                    if (lastModifiedDateText > itemModifiedDateText) {
                        this.env.showMessage('Thông tin đơn hàng đã được thay đổi, đơn sẽ được cập nhật lại.','danger');
                        this.refresh();
                        return true;
                    }
                }).catch(err => {
                    console.log(err);
                    return true;
                });
            }
            else {
                return false;
            } 
    }

    async loadedData(event?: any, ignoredFromGroup?: boolean): Promise<void> {
        super.loadedData(event, ignoredFromGroup);
        //await this.getOrdersOfTable(this.idTable);
        this.getBranch(this.Table.IDBranch);
        await this.env.getStorage("OrderLines" + this.idTable).then((result: any) => {
            if (result) {
                this.OrderLines = result;
            }
        });
        if (!this.item?.Id) {
            await this.checkOrderOfTable(this.idTable);
            if (this.id != 0) {
                let newURL = '#/pos-customer-order/' + this.id + '/' + this.idTable;
                history.pushState({}, null, newURL);
                this.env.showAlert("Bàn này đã có người đặt hàng trước đó. Nếu không phải là khách hàng đi cùng bạn vui lòng bấm vào loa bên dưới để gọi phục vụ", "Kiểm tra đơn hàng và cập nhật", 'Thông báo');
                this.refresh();
            }
            if (this.formGroup.controls['Id'].value != 0 && this.id == 0) {
                this.env.showPrompt('',null,'Đơn hàng đã hoàn tất','Tạo đơn mới','Đóng').then(_ => {
                    this.newOrder();
                }).catch(_ => { });
                this.formGroup.removeControl('OrderLines');
                this.formGroup.addControl('OrderLines', this.formBuilder.array([]));
                this.AllowSendOrder = false;
            }
            if (this.item ==null) this.item = {Id: 0, IsDisabled: false};
            this.formGroup.controls.IDBranch.patchValue(this.Table.IDBranch);
            Object.assign(this.item, this.formGroup.getRawValue());
            this.item.OrderLines = [];
            this.setOrderValue(this.item);
        }
        else {
            this.notifyFromStaff();
            this.patchOrderValue();
        }
        this.loadOrder();
        this.loadInfoOrder();
        if (this.OrderLines?.length > 0 && this.id) {
            this.AllowSendOrder = true;
            this.OrderLines.forEach(line => {
                this.addToCart(line.Item, line.IDUoM, +line.Quantity, true);
            });
        }
    }

    refresh(event?: any): void {
        this.preLoadData('force');
    }

    segmentFilterDishes = 'New';
    changeFilterDishes(event) {
        this.segmentFilterDishes = event.detail.value;
    }
   
    countDishes(segment){
        if (segment == 'New') 
            return this.item.OrderLines .filter(d => d.Status == 'New' || d.Status == 'Waiting').map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);

        return this.item.OrderLines .filter(d => !(d.Status == 'New' || d.Status == 'Waiting')).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
    }

    addToCart(item, idUoM, quantity = 1, IsUpdate = false, idx = -1) {

        if (!this.pageConfig.canEdit) {
            this.env.showTranslateMessage('Đơn hàng đang tạm khóa, không thể thêm món!', 'warning');
            // this.isWifiSecuredModalOpen = true;
            return;
        }
        
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

        if (item.IsDisabled){
            return;
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
            this.env.showTranslateMessage('Đơn hàng đã khóa, không thể chỉnh sửa hoặc thêm món!', 'warning');
            return;
        }

        if (!item.UoMs.length) {
            this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
            return;
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
            this.setOrderValue({ OrderLines: [line], Status: 'New' });
        }
        else {
            if ((line.Quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
                this.env.showAlert("Vui lòng liên hệ nhân viên để được hỗ trợ ", item.Name + " đã chuyển bếp " + line.ShippedQuantity + " " + line.UoMName, "Thông báo");
            }
            else if ((line.Quantity + quantity) > 0) {
                line.Quantity += quantity;
                this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }], Status: 'New' });
            }
            else {
                this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm').then(_ => {
                    line.Quantity += quantity;
                    this.loadInfoOrder();
                    this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                }).catch(_ => { });
            }

        }
    }

    async openQuickMemo(line) {
        if (this.submitAttempt) return;
        if (line.Status != 'New') return;
        if (this.item.Status == 'TemporaryBill') {
            this.env.showTranslateMessage('Đơn hàng đã khóa, không thể chỉnh sửa hoặc thêm món!', 'warning');
            return;
        }

        const modal = await this.modalController.create({
            component: POSCustomerMemoModalPage,
            id: 'POSMemoModalPage',            backdropDismiss: true,
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
        if (this.OrderLines.length > 0 || this.AllowSendOrder == true) {
            this.env.showPrompt('Cập nhật đơn hàng và tiến hành thanh toán!', null, 'Thông báo', 'Cập nhật', 'không')
                .then(_ => {
                    this.sendOrder();
                    this.openModalPayments();
                }).catch(_ => {

                });
        }
        else {
            this.openModalPayments();
        }

    }

    goToPayment() {
        let payment = {
            IDBranch: this.item.IDBranch,
            IDStaff: 0,
            IDCustomer: this.item.IDContact,
            IDSaleOrder: this.item.Id,
            DebtAmount: Math.round(this.item.Debt),
            IsActiveInputAmount : false,
            IsActiveTypeCash: false,
            ReturnUrl: window.location.href,
            Lang: this.env.language.current,
            Timestamp:Date.now(),
            CreatedBy: null
        };

        let str = window.btoa(JSON.stringify(payment));
        let code =  this.convertUrl(str);
        let url = environment.appDomain + "Payment?Code="+code;
        window.open(url, "_blank");
    }

    private convertUrl(str) {
        return str.replace("=", "").replace("=", "").replace("+", "-").replace("_", "/")
    }

    async openModalPayments() {
        const modal = await this.modalController.create({
            component: POSForCustomerPaymentModalPage,            backdropDismiss: true,
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

        this.item._Locked = this.noLockStatusList.indexOf(this.item.Status) == -1;
        this.printData.currentBranch = this.env.branchList.find(d => d.Id == this.item.IDBranch);

        if (this.item._Locked) {
            this.pageConfig.canEdit = false;
            this.formGroup?.disable();
        }
        else {
            this.pageConfig.canEdit = true;
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
                || this.item.IDBranch == 416 //Gem Cafe && set menu  && line._item.IDMenu == 218
                || this.item.IDBranch == 864 //TEST
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
        // else {
        //     let index = value.Tables.map(t=>t.IDTable).indexOf(this.idTable);
        //     if(index != -1){
        //         await this.getOrdersOfTable(this.idTable);
        //         this.env.showAlert("Có đơn hàng mới trên bàn này","Kiểm tra đơn hàng ",'Thông báo');
        //     }
        // }
    }
    private notifyFromCustomer(data) {
        const value = JSON.parse(data.value);
        let index = value.Tables.map(t => t.IDTable).indexOf(this.idTable);
        if (index != -1) {
            if (!this.IsMyHandle) {
                this.env.showAlert("Có một khách hàng nào đó đã gọi món trên bàn này. Nếu không phải là khách hàng đi cùng bạn vui lòng bấm vào loa bên dưới để gọi phục vụ", "Kiểm tra đơn hàng ", 'Thông báo');
                this.id = data.id;
                let newURL = '#/pos-customer-order/' + this.id + '/' + value.Tables[0].IDTable;
                history.pushState({}, null, newURL);
                this.refresh();
            }
            this.IsMyHandle = false;
        }
    }

    private notifyLockOrderFromStaff(data) {
        const value = JSON.parse(data.value);
        let index = value.Tables.map(t => t.IDTable).indexOf(this.idTable);
        if (index != -1) {
            this.refresh();
            setTimeout(() => {
                this.isLockOrderFromStaff = true;
                this.pageConfig.isShowFeature = true;
                this.isStatusModalOpen = true;
            }, 2500);
        }
    }

    private notifyLockOrderFromCustomer(data) {
        const value = JSON.parse(data.value);
        let index = value.Tables.map(t => t.IDTable).indexOf(this.idTable);
        if (index != -1) {
            this.refresh();
            setTimeout(() => {
                this.isLockOrderFromStaff = false;
                this.pageConfig.isShowFeature = true;
                this.isStatusModalOpen = true;
            }, 2500);
        }
    }

    private notifyUnlockOrder(data) {
        const value = JSON.parse(data.value);
        let index = value.Tables.map(t => t.IDTable).indexOf(this.idTable);
        if (index != -1) {
            this.refresh();
            setTimeout(() => {
                this.pageConfig.isShowFeature = true;
                this.isStatusModalOpen = true;
            }, 2500);
        }
    }

    private notifyPayment(data) {
        const value = JSON.parse(data.Value);
        if (this.item.Id == value.IDSaleOrder) {
            let type;
            let status;
            let header = "Thanh toán";
            if (value.IsRefundTransaction == true) {
                header = "Hoàn tiền";
            }
            switch (value.Status) {
                case 'Success':
                    status = "Thành công";
                    break;
                case 'Processing':
                    status = "Đang xử lý";
                    break;
                case 'Fail':
                    status = "Thất bại";
                    break;
            }
            switch (value.Type) {
                case 'Card':
                    type = "Cà thẻ";
                    break;
                case 'Transfer':
                    type = "Chuyển khoản";
                    break;
                case 'Cash':
                    type = "Tiền mặt";
                    break;
                case 'ZalopayApp':
                    type = "Ví ZaloPay";
                    break;
                case 'CC':
                    type = "Thẻ Visa, Master, JCB (qua Cổng ZaloPay)";
                    break;
                case 'ATM':
                    type = "Thẻ ATM (qua Cổng ZaloPay)";
                    break;
            }
            this.env.showAlert("<h2>" + lib.currencyFormat(value.Amount) + "</h2>", type + " | " + status, header);
            this.playAudio("Payment");
            this.refresh();
        }
    }
    private playAudio(type){
        let audio = new Audio();
        if(type=="Order"){
            audio.src = this.pageConfig.systemConfig['POSAudioOrderUpdate'];
        }
        else if(type=="CallToPay"){
            audio.src = this.pageConfig.systemConfig['POSAudioCallToPay'];
        }
        else if(type=="Payment"){
            audio.src = this.pageConfig.systemConfig['POSAudioIncomingPayment'];
        }
        else if(type=="Support"){
            audio.src = this.pageConfig.systemConfig['POSAudioCallStaff'];
        }
        if(audio.src){
            audio.load();
            audio.play();
        }
    }
    
    async notifyFromStaff() {
        if (['Merged', 'Splitted', 'Done'].indexOf(this.item.Status) != -1 || (this.formGroup.controls['Id'].value != 0 && this.id == 0)) {
            this.env.showPrompt('',null,'Đơn hàng đã hoàn tất','Tạo đơn mới','Đóng').then(_ => {
            this.newOrder();
            }).catch(_ => { });
        }
        if (this.item.Status == 'Cancelled') {
            this.env.showAlert("Đơn hàng này đã hủy!");
        }
        if (this.item.Status == "Confirmed") {
            this.env.showAlert("Đơn hàng đã được xác nhận!");
            this.playAudio("Order");
        }
        // if(this.item.Status == "Scheduled"){
        //     this.env.showAlert("Món bạn vừa đặt đã được chuyển Bar/Bếp",null,'Thông báo'); 
        //     //this.playAudio("Order");        
        // }
        if (this.item.Status == "Picking") {
            this.env.showAlert("Món đã được chuẩn bị");
        }
        if (this.item.Status == "Delivered") {
            this.env.showAlert("Chúc quý khách ngon miệng");
        }
        if (this.idTable != this.item.Tables[0]) {
            await this.reloadTable(this.item.Tables[0]);
            this.env.showAlert("Đơn hàng của bạn đã được chuyển bàn " + this.Table.Name, null, 'Thông báo chuyển bàn');
            this.env.setStorage("OrderLines" + this.idTable, []);
            this.env.setStorage("OrderLines" + this.item.Tables[0], this.OrderLines);
            this.idTable = this.item.Tables[0];
            let newURL = '#/pos-customer-order/' + this.item.Id + '/' + this.item.Tables[0];
            history.pushState({}, null, newURL);
        }
    }

    async reloadTable(IDTable) {
        await this.commonService.connect('GET', 'POS/ForCustomer/Table/' + IDTable, this.query).toPromise().then((result: any) => {
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
        this.checkAllowSendOrder().finally(() => {
            if (!this.AllowSendOrder) {
                this.checkFormGroupDirty();
            }
        });
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

    checkFormGroupDirty() {
        let fa = <FormArray>this.formGroup.controls.OrderLines;
        for (let idx = 0; idx < fa.controls.length; idx++) {
            let cfg = <FormGroup>fa.controls[idx];
            if (cfg.controls.Remark.dirty) {
                this.AllowSendOrder = true;
                return;
            }
            else {
                this.AllowSendOrder = false;
            }
        }
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
                    Id: savedItem.Id,
                    IDTable: this.idTable,
                    TableName: this.Table.Name,
                }
                this.addOrderToStorage(order);
                this.id = savedItem.Id;
                let newURL = '#/pos-customer-order/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);

            }

            this.item = savedItem;
            if (this.item.Status == 'New') {
                this.isSuccessModalOpen = true;
            }
        }
        this.loadedData();

        this.submitAttempt = false;
    }

    closeSuccessModal() {
        this.isSuccessModalOpen = false;
        setTimeout(() => {
            this.pageConfig.isShowFeature = false;
        }, 1);

    }

    closeStatusModal() {
        this.isStatusModalOpen = false;
        setTimeout(() => {
            this.pageConfig.isShowFeature = true;
            if (this.item.Status == 'TemporaryBill') {
                if (!this.isLockOrderFromStaff) {
                    this.goToPayment();
                }
            };
        }, 1);
    }

    async sendOrder() {
        if (this.Table.IsAllowCustomerOrder == true) {
            if (this.id == 0) {
                await this.checkOrderOfTable(this.idTable);
                if (this.id != 0) {
                    let newURL = '#/pos-customer-order/' + this.id + '/' + this.idTable;
                    history.pushState({}, null, newURL);
                    this.env.showAlert("Bàn này đã có người đặt hàng trước đó. Nếu không phải là khách hàng đi cùng bạn vui lòng bấm vào loa bên dưới để gọi phục vụ", "Kiểm tra đơn hàng và cập nhật", 'Thông báo');
                    this.refresh();

                }
                else {
                    this.saveOrder();
                }
            }
            else {
                this.saveOrder();
            }
        }
        else {
            this.env.showTranslateMessage('Xin lỗi quý khách bàn này chưa được kích hoạt gọi món', 'warning');
            return false;
        }
    }

    saveOrder() {
        this.saveChange();
        this.AllowSendOrder = false;
        this.IsMyHandle = true;
        this.OrderLines = [];
        this.env.setStorage("OrderLines" + this.idTable, []);
        // this.callOrder();
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


    callOrder() {
        if (this.item.Id) {
            let ItemModel = {
                ID: this.idTable,
                Code: "POSOrderFromCustomer",
                Title: "Yêu cầu gọi món",
                IDSaleOrder: this.item.Id,
                Name: this.Table.IDBranch,
                Remark: "khách hàng bàn " + this.Table.Name + " đã gọi món",
            }
            this.commonService.connect('POST', 'POS/ForCustomer/CallStaff', ItemModel).toPromise().then(result => {
                this.env.showMessage("Đã gọi món", "success");
            }).catch(err => {
                console.log(err);
            });
        }
    }

    callToPay() {
        if (this.item.Id) {
            let ItemModel = {
                ID: this.idTable,
                Code: "POSCallToPay",
                Title: "Yêu cầu tính tiền",
                IDSaleOrder: this.item.Id,
                Name: this.Table.IDBranch,
                Remark: "khách hàng bàn " + this.Table.Name + " yêu cầu tính tiền",
            }
            this.commonService.connect('POST', 'POS/ForCustomer/CallStaff', ItemModel).toPromise().then(result => {
                this.env.showMessage("Đã gọi tính tiền", "success");
            }).catch(err => {
                console.log(err);
            });
        }
    }

    callStaff() {
        if (this.item.Id) {
            let ItemModel = {
                ID: this.idTable,
                Code: "POSSupport",
                Title: "Yêu cầu phục vụ",
                IDSaleOrder: this.item.Id,
                Name: this.Table.IDBranch,
                Remark: "khách hàng bàn " + this.Table.Name + " yêu cầu phục vụ",
            }
            this.commonService.connect('POST', 'POS/ForCustomer/CallStaff', ItemModel).toPromise().then(result => {
                this.env.showMessage("Đã gọi phục vụ", "success");
            }).catch(err => {
                console.log(err);
            });
        }
    }

    newOrder(){
        let newURL = '#/pos-customer-order/' + 0 + '/'+ this.item.Tables[0];
        window.location.href = newURL;
        window.location.reload();
    }
    unlockOrder() {
        let orderUpdate = this.checkLastModifiedDate();
        if (orderUpdate) {
            return;
        }
        const Debt = this.item.Debt;
        let postDTO = { Id: this.item.Id, Code: 'Scheduled', Debt: Debt};

        this.pageProvider.commonService.connect("POST", "POS/ForCustomer/toggleBillStatus/", postDTO).toPromise()
        .then((savedItem: any) => {
            this.refresh();
        });
    }

    lockOrder() {
        let orderUpdate = this.checkLastModifiedDate();
        if (orderUpdate) {
            return;
        }
        if (this.item.Status == "TemporaryBill") {
            this.goToPayment();
        }
        else {
            const Debt = this.item.Debt;
            let postDTO = { Id: this.item.Id, Code: 'TemporaryBill', Debt: Debt};
    
            this.pageProvider.commonService.connect("POST", "POS/ForCustomer/toggleBillStatus/", postDTO).toPromise()
            .then((savedItem: any) => {
                this.refresh();
            });
        }
    }

    async helpOrder(status) {
        let subHeader;
        let message;
        if (status == 'Done') {
            subHeader = 'Đơn hàng đã hoàn tất';
            message = 'Không thể thao tác trên đơn hàng này. Vui lòng quét lại mã để đặt món';
        }
        if (status == 'Splitted') {
            subHeader = 'Đơn hàng đã chia';
            message = 'Không thể thao tác trên đơn hàng này. Vui lòng chọn bàn phía dưới để đi đến đơn hàng của bạn';
        }
        if (status == 'Cancelled') {
            subHeader = 'Đơn hàng đã hủy';
            message = 'Không thể thao tác trên đơn hàng này. Vui lòng chọn bàn phía dưới để đi đến đơn hàng của bạn';
        }
        if (status == 'Merged') {
            subHeader = 'Đơn hàng đã gộp';
            message = 'Không thể thao tác trên đơn hàng này. Vui lòng đi đến đơn gốc để tiếp tục đặt hàng';
        }
        this.env.showAlert(message, subHeader, 'Thông báo');
    }

    async checkOrderOfTable(IDTable) {
        let apiPath = { method: "GET", url: function (id) { return ApiSetting.apiDomain("POS/ForCustomer/OrderOfTable/") + id } };
        await this.commonService.connect(apiPath.method, apiPath.url(IDTable), this.query).toPromise().then(result => {
            if (result) {
                this.id = result;
            }
            else {
                this.id = 0;
            }
        }).catch(err => { });
    }
    async getOrdersOfTable(IDTable) {
        await this.commonService.connect('GET', 'POS/ForCustomer/OrdersOfTable/' + IDTable, null).toPromise().then(result => {
            if (result) {
                this.OrdersOfTable = result;
            }
        }).catch(err => { });
    }
    goToOrder(IDSaleOrder, IDTable) {
        this.id = IDSaleOrder;
        let newURL = '#/pos-customer-order/' + IDSaleOrder + '/' + IDTable;
        history.pushState({}, null, newURL);
        this.refresh();
    }
    async addOrderToStorage(order) {
        let Orders = [];
        await this.env.getStorage('Orders').then(result => {
            if (result) {
                Orders = result;
                Orders.push(order);
            } else {
                Orders.push(order);
            }
        });
        this.env.setStorage('Orders', Orders);
    }

    async getChildrenOrder(IDParent) {
        await this.commonService.connect('GET', 'POS/ForCustomer/ChildrenOrder/' + IDParent, null).toPromise().then(result => {
            this.childrenOrders = result;
        }).catch(err => { });
    }
    async getParentOrder(IDParent) {
        await this.commonService.connect('GET', 'POS/ForCustomer/ParentOrder/' + IDParent, null).toPromise().then(result => {
            this.parentOrder = result;
            console.log(this.parentOrder);
        }).catch(err => { });
    }
    async addToStorage(item, idUoM, quantity = 1, IsDelete = false, idx = -1) {
        if (this.item.Status == 'TemporaryBill') {
            this.env.showTranslateMessage('Đơn hàng đã khóa, không thể chỉnh sửa hoặc thêm món!', 'warning');
            return;
        }
        else if(['Merged', 'Splitted', 'Done'].indexOf(this.item.Status) != -1 || (this.formGroup.controls['Id'].value != 0 && this.id == 0)){
            this.env.showPrompt('',null,'Đơn hàng đã hoàn tất','Tạo đơn mới','Đóng').then(_ => {
              this.newOrder();
            }).catch(_ => { });
            return;
        }

        if (!this.pageConfig.canEdit) {
            if (!this.id) this.isWifiSecuredModalOpen = true;
            return;
        }

        let orderUpdate = this.checkLastModifiedDate();
        if (orderUpdate) {
            return;
        }

        let line = {
            Item: item,
            IDUoM: idUoM,
            Quantity: quantity,
        }
        let index = this.OrderLines.map(x => x.IDUoM).indexOf(idUoM);
        if (index == -1) {
            this.OrderLines.push(line);
        }
        else {
            if (IsDelete == true) {
                this.OrderLines.splice(index, 1);
            }
            else {
                this.OrderLines[index].Quantity += quantity;
                if (this.OrderLines[index].Quantity == 0) {
                    this.OrderLines.splice(index, 1);
                }
            }
        }
        this.env.setStorage("OrderLines" + this.idTable, this.OrderLines).then(_ => {
            this.addToCart(item, idUoM, quantity, null, idx);
        })
    }

}
