import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, HRM_StaffProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, POS_TerminalProvider, PR_ProgramProvider, SALE_OrderDeductionProvider, SALE_OrderProvider, SYS_ConfigProvider, SYS_PrinterProvider, } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { POSPaymentModalPage } from '../pos-payment-modal/pos-payment-modal.page';
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';

import { POSMemoModalPage } from '../pos-memo-modal/pos-memo-modal.page';
import * as qz from 'qz-tray';
import { KJUR, KEYUTIL, stob64, hextorstr } from 'jsrsasign';
import { environment } from 'src/environments/environment';
import { POSVoucherModalPage } from '../pos-voucher-modal/pos-voucher-modal.page';
import { POSContactModalPage } from '../pos-contact-modal/pos-contact-modal.page';
import { POSInvoiceModalPage } from '../pos-invoice-modal/pos-invoice-modal.page';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';

@Component({
    selector: 'app-pos-order-detail',
    templateUrl: './pos-order-detail.page.html',
    styleUrls: ['./pos-order-detail.page.scss'],
})
export class POSOrderDetailPage extends PageBase {

    @ViewChild('numberOfGuestsInput') numberOfGuestsInput: ElementRef;
    isOpenMemoModal = false;
    AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
    segmentView = 'all';
    idTable: any; //Default table
    tableList = [];
    menuList = [];
    dealList = [];
    paymentList = [];
    paymentTypeList = [];
    paymentStatusList = [];
    soStatusList = []; //Show on bill
    soDetailStatusList = [];
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered'];
    noLockLineStatusList = ['New', 'Waiting'];
    checkDoneLineStatusList = ['Done', 'Cancelled', 'Returned'];
    kitchenQuery = 'all';
    kitchenList = [];
    OrderAdditionTypeList = [];
    OrderDeductionTypeList = [];
    promotionAppliedPrograms = [];
    defaultPrinter = [];
    printData = {
        undeliveredItems: [], //To track undelivered items to the kitchen
        printDate: null,
        currentBranch: null,
        selectedTables: [],
    };
    Discount;
    Staff;
    constructor(
        public pageProvider: SALE_OrderProvider,
        public programProvider: PR_ProgramProvider,
        public deductionProvider: SALE_OrderDeductionProvider,
        public menuProvider: POS_MenuProvider,
        public tableGroupProvider: POS_TableGroupProvider,
        public tableProvider: POS_TableProvider,
        public contactProvider: CRM_ContactProvider,
        public staffProvider: HRM_StaffProvider,
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
            Tables: [[this.idTable], Validators.required],
            IDBranch: [this.env.selectedBranch],
            IDOwner: [this.env.user.StaffID],
            //OrderDate: [new Date()],
            IDContact: [null],
            IDAddress: [null],
            Type: ['POSOrder'],
            SubType: ['TableService'],
            Status: new FormControl({ value: 'New', disabled: true }),
            IsCOD: [],
            IsInvoiceRequired: [],
            NumberOfGuests: [1, Validators.required],
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

    ////EVENTS
    ngOnInit() {
        this.pageConfig.subscribePOSOrderDetail = this.env.getEvents().subscribe((data) => {
            switch (data.Code) {
                case 'app:POSOrderPaymentUpdate':
                    this.notifyPayment(data);
                    break;
                case 'app:POSOrderFromCustomer':
                    this.notifyOrder(data.Data);
                    break;
                case 'app:POSLockOrderFromStaff':
                    this.notifyLockOrder(data.Data);
                    break;
                case 'app:POSLockOrderFromCustomer':
                    this.notifyLockOrder(data.Data);
                    break;
                case 'app:POSUnlockOrder':
                    this.notifyUnlockOrder(data.Data);
                    break;
            }
        });

        super.ngOnInit();
    }
    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrderDetail?.unsubscribe();
        super.ngOnDestroy();
    }
    private notifyPayment(data) {
        const value = JSON.parse(data.Value);
        if (value.IDSaleOrder == this.item?.Id) {
            this.refresh();
        }
    }
    private notifyOrder(data) {
        if (data.id == this.item?.Id) {
            this.refresh();
        }
    }
    private notifyLockOrder(data) {
        const value = JSON.parse(data.value);
        let index = value.Tables.map(t => t.IDTable).indexOf(this.idTable);

        if (index != -1) {
            this.env.showTranslateMessage("Đơn hàng đã được tạm khóa. Để tiếp tục đơn hàng, xin bấm nút Hủy tạm tính.", 'warning');
            this.refresh();
        }
    }
    private notifyUnlockOrder(data) {
        const value = JSON.parse(data.value);
        let index = value.Tables.map(t => t.IDTable).indexOf(this.idTable);

        if (index != -1) {
            this.env.showTranslateMessage("Đơn hàng đã mở khóa. Xin vui lòng tiếp tục đơn hàng.", 'warning');
            this.refresh();
        }
    }

    preLoadData(event?: any): void {
        //'IsUseIPWhitelist','IPWhitelistInput', 'IsRequireOTP','POSLockSpamPhoneNumber',
        let sysConfigQuery = ['IsAutoSave', 'SODefaultBusinessPartner', 'POSSettleAtCheckout', 'POSHideSendBarKitButton', 'POSEnableTemporaryPayment', 'POSEnablePrintTemporaryBill', 'POSAutoPrintBillAtSettle'];

        let forceReload = event === 'force';
        Promise.all([
            this.env.getStatus('POSOrder'),
            this.env.getStatus('POSOrderDetail'),
            this.getTableGroupFlat(forceReload),
            this.getMenu(forceReload),
            this.getDeal(),
            this.sysConfigProvider.read({ Code_in: sysConfigQuery }),
            this.env.getType('PaymentType'),
            this.env.getStatus('PaymentStatus'),
        ]).then((values: any) => {
            this.pageConfig.systemConfig = {};
            values[5]['data'].forEach(e => {
                if ((e.Value == null || e.Value == 'null') && e._InheritedConfig) {
                    e.Value = e._InheritedConfig.Value;
                }
                this.pageConfig.systemConfig[e.Code] = JSON.parse(e.Value);
            });

            this.soStatusList = values[0];
            this.soDetailStatusList = values[1];
            this.tableList = values[2];
            this.menuList = values[3];

            this.dealList = values[4];

            if (this.pageConfig.systemConfig.SODefaultBusinessPartner) {
                this.contactListSelected.push(this.pageConfig.systemConfig.SODefaultBusinessPartner);
            }

            this.paymentTypeList = values[6];
            this.paymentStatusList = values[7];
            super.preLoadData(event);
        }).catch(err => {
            this.loadedData();
        })
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        super.loadedData(event, ignoredFromGroup);
        if (this.item.IDBranch != this.env.selectedBranch && this.item.Id) {
            this.env.showTranslateMessage('Không tìm thấy đơn hàng, vui lòng kiểm tra chi nhánh!', 'danger');
            return;
        }

        if (!this.item?.Id) {

            Object.assign(this.item, this.formGroup.getRawValue());
            this.setOrderValue(this.item);
        }
        else {
            this.patchOrderValue();
            this.getPayments();
            this.getPromotionProgram();
            if (this.item._Customer.IsStaff == true) {
                this.getStaffInfo(this.item._Customer.Code);
            }
        }
        this.loadOrder();
        this.contactSearch();
        this.cdr.detectChanges();

        this.printerTerminalProvider.read({ IDBranch: this.env.selectedBranch, IsDeleted: false, IsDisabled: false }).then(async (results: any) => {
            this.defaultPrinter.push(results['data']?.[0]?.['Printer']);
            this.defaultPrinter = [...new Map(this.defaultPrinter.map((item: any) => [item?.['Id'], item])).values()];
        });
    }

    refresh(event?: any): void {
        this.preLoadData('force');
    }

    segmentFilterDishes = 'New';
    changeFilterDishes(event) {
        this.segmentFilterDishes = event.detail.value;
    }

    countDishes(segment) {
        if (segment == 'New')
            return this.item.OrderLines.filter(d => d.Status == 'New' || d.Status == 'Waiting').map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);

        return this.item.OrderLines.filter(d => !(d.Status == 'New' || d.Status == 'Waiting')).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
    }

    async addToCart(item, idUoM, quantity = 1, idx = -1) {
        if (item.IsDisabled) {
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

        if (!this.pageConfig.canAdd) {
            this.env.showTranslateMessage('Bạn không có quyền thêm sản phẩm!', 'warning');
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

        let line;
        if (quantity == 1) {
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

                CreatedDate: new Date()
            };

            this.item.OrderLines.push(line);

            this.addOrderLine(line);
            this.setOrderValue({ OrderLines: [line], Status: 'New' });
        }
        else {
            if ((line.Quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
                if (this.pageConfig.canDeleteItems) {
                    this.env.showPrompt('Item này đã chuyển Bar/Bếp, bạn chắc muốn giảm số lượng sản phẩm này?', item.Name, 'Xóa sản phẩm').then(_ => {

                        line.Quantity += quantity;
                        this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                    }).catch(_ => { });
                }
                else {
                    this.env.showMessage('Item đã chuyển Bar/Bếp');
                    return;
                }

            }

            else if ((line.Quantity + quantity) > 0) {
                line.Quantity += quantity;
                this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }], Status: 'New' });
            }
            else {
                if (line.Status == 'New') {
                    this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm').then(_ => {
                        line.Quantity += quantity;
                        this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                    }).catch(_ => { });
                }
                else {
                    if (this.pageConfig.canDeleteItems) {
                        this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm').then(_ => {
                            line.Quantity += quantity;
                            this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                        }).catch(_ => { });
                    }
                    else {
                        this.env.showMessage('Tài khoản chưa được cấp quyền xóa sản phẩm!', 'warning');
                    }
                }

            }

        }
    }

    async openQuickMemo(line) {
        if (this.submitAttempt) return;
        if (line.Status != 'New') return;

        const modal = await this.modalController.create({
            component: POSMemoModalPage,
            id: 'POSMemoModalPage', backdropDismiss: true,
            cssClass: 'modal-quick-memo',
            componentProps: {
                item: JSON.parse(JSON.stringify(line))
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();

        if (role == 'confirm') {
            line.Remark = data ? data.toString() : null;
            this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Remark: line.Remark }] }, true);
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
            component: POSPaymentModalPage,
            id: 'POSPaymentModalPage',
            canDismiss: true,
            backdropDismiss: true,
            cssClass: 'modal-payments',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
        if (role == 'confirm') {
            let changed: any = { OrderLines: [] };
            if (data.SetShippedQuantity)
                this.item.OrderLines.forEach(line => {
                    if (line.Quantity > line.ShippedQuantity) {
                        line.ShippedQuantity = line.Quantity;
                        line.ReturnedQuantity = 0;
                        changed.OrderLines.push({ Id: line.Id, IDUoM: line.IDUoM, ShippedQuantity: line.ShippedQuantity, ReturnedQuantity: 0 });
                    }
                });

            if (data.SetDone) {
                changed.Status = 'Done';
                changed.IDStatus = 114;
            }

            this.setOrderValue(changed, true);
        }
    }

    goToPayment() {
        let payment = {
            IDBranch: this.item.IDBranch,
            IDStaff: this.env.user.StaffID,
            IDCustomer: this.item.IDContact,
            IDSaleOrder: this.item.Id,
            DebtAmount: Math.round(this.item.Debt),
            IsActiveInputAmount: true,
            IsActiveTypeCash: true,
            ReturnUrl: window.location.href,
            Lang: this.env.language.current,
            Timestamp: Date.now()
        };
        let str = window.btoa(JSON.stringify(payment));
        let code = this.convertUrl(str);
        let url = environment.appDomain + "Payment?Code=" + code;
        window.open(url, "_blank");
    }

    private convertUrl(str) {
        return str.replace("=", "").replace("=", "").replace("+", "-").replace("_", "/")
    }

    async processDiscounts() {
        this.Discount = {
            Amount: this.item.OriginalTotalDiscount,
            Percent: this.item.OriginalTotalDiscount * 100 / this.item.OriginalTotalBeforeDiscount,
        }
        const modal = await this.modalController.create({
            component: POSDiscountModalPage,
            canDismiss: true,
            backdropDismiss: true,
            cssClass: 'modal-change-table',
            componentProps: {
                Discount: this.Discount,
                item: this.item
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
        if (role == 'confirm') {
            this.applyDiscount();
        }
    }

    async processVouchers() {
        const modal = await this.modalController.create({
            component: POSVoucherModalPage,
            canDismiss: true,
            backdropDismiss: true,
            cssClass: 'modal-change-table',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
        if (data) {
            this.item = data;
            this.refresh();
        }
    }

    InvoiceRequired() {
        if (this.pageConfig.canEdit == false) {
            this.env.showTranslateMessage('Đơn hàng đã khóa không thể chỉnh sửa', 'warning');
            return false;
        }
        if (!this.item._Customer) {
            this.env.showTranslateMessage('Vui lòng chọn khách hàng', 'warning');
            return false;
        }
        if (this.item._Customer.Id == 922) {
            this.env.showTranslateMessage('Không thể xuất hóa đơn cho khách lẻ', 'warning');
            return false;
        }
        if (this.item.IsInvoiceRequired == false) {
            this.processInvoice();
        }
        else {
            this.formGroup.controls.IsInvoiceRequired.patchValue(false);
            this.formGroup.controls.IsInvoiceRequired.markAsDirty();
            this.saveChange();
        }
    }

    async processInvoice() {
        const modal = await this.modalController.create({
            component: POSInvoiceModalPage,
            canDismiss: true,
            cssClass: 'my-custom-class',
            componentProps: {
                id: this.item.IDContact
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();
        if (data == true) {
            this.item.IsInvoiceRequired = true;
            this.formGroup.controls.IsInvoiceRequired.patchValue(true);
            this.formGroup.controls.IsInvoiceRequired.markAsDirty();
            this.saveChange();
        }
        else {
            this.item.IsInvoiceRequired = false;
        }
    }



    async openCancellationReason() {
        if (this.submitAttempt) return;
        if (this.item.Received > 0) {
            this.env.showTranslateMessage('Đơn hàng đã thanh toán không thể hủy, vui lòng hoàn tiền lại để hủy đơn hàng này!', 'warning');
            return false;
        };

        const modal = await this.modalController.create({
            component: POSCancelModalPage,
            id: 'POSCancelModalPage', backdropDismiss: true,
            cssClass: 'modal-cancellation-reason',
            componentProps: { item: {} }
        });
        modal.present();

        const { data, role } = await modal.onWillDismiss();

        if (role == 'confirm') {
            let cancelData: any = { Code: data.Code };
            if (cancelData.Code == 'Other') {
                cancelData.Remark = data.CancelNote
            }

            this.env.showPrompt('Bạn chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng').then(_ => {
                let publishEventCode = this.pageConfig.pageName;
                if (this.submitAttempt == false) {
                    this.submitAttempt = true;
                    cancelData.Type = 'POSOrder';
                    cancelData.Ids = [this.item.Id];

                    this.pageProvider.commonService.connect('POST', 'SALE/Order/CancelOrders/', cancelData).toPromise()
                        .then(() => {
                            if (publishEventCode) {
                                this.env.publishEvent({ Code: publishEventCode });
                            }
                            this.loadData();
                            this.submitAttempt = false;
                            this.nav('/pos-order', 'back');
                        }).catch(err => {
                            this.submitAttempt = false;
                        });
                }
            }).catch(_ => { });
        }
    }

    saveOrderData() {
        let message = 'Bạn có muốn in đơn gửi bar/bếp ?';
        this.env.showPrompt(message, null, 'Thông báo').then(_ => {
            this.saveChange2().finally(async () => {
                this.submitAttempt = false;
                await this.sendKitchen();
            });
        }).catch(_ => {
            this.saveChange();
        });
    }

    async sendKitchen() {
        this.printData.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");
        // console.log(lib.dateFormat(new Date(), "hh:MM:ss") + '  ' + new Date().getMilliseconds()); // For Testing
        if (this.submitAttempt) return;
        this.submitAttempt = true;
        let times = 2; // Số lần in phiếu; Nếu là 2, in 2 lần;

        this.printData.undeliveredItems = [];

        this.item.OrderLines.forEach(e => {
            e._undeliveredQuantity = e.Quantity - e.ShippedQuantity;
            e._IDKitchen = e._item?.Kitchen.Id;
            if (e.Remark) {
                e.Remark = e.Remark.toString();
            }
            if (e._undeliveredQuantity > 0) {
                e.Status = 'Serving';
                this.printData.undeliveredItems.push(e);
            }
        });

        if (this.printData.undeliveredItems.length == 0) {
            this.env.showTranslateMessage('Không có sản phẩm mới cần gửi đơn!', 'success');
            this.submitAttempt = false;
            return;
        }

        const newKitchenList = [...new Map(this.printData.undeliveredItems.map((item: any) => [item['_item']['Kitchen']['Name'], item._item.Kitchen])).values()];
        this.kitchenList = newKitchenList;
        for (let index = 0; index < newKitchenList.length; index++) {

            await this.setKitchenID(newKitchenList[index].Id);

            let object: any = document.getElementById('bill');

            let printerInfo = newKitchenList[index]['Printer'];
            this.setupPrinting(printerInfo, object, false, times, false, newKitchenList.length);
        }
    }

    haveFoodItems = false;
    async sendKitchenEachItem() {
        if (this.submitAttempt) return;
        this.submitAttempt = true;
        let times = 1; // Số lần in phiếu; Nếu là 2, in 2 lần;
        this.printData.undeliveredItems = [];

        this.item.IDOwner = this.env.user.StaffID;
        this.item.OrderLines.forEach(e => {
            e._undeliveredQuantity = e.Quantity - e.ShippedQuantity;
            e._IDKitchen = e._item?.Kitchen.Id;
            if (e._undeliveredQuantity > 0) {
                e.Status = 'Serving';
                this.printData.undeliveredItems.push(e);
            }
            if (e.Remark) {
                e.Remark = e.Remark.toString();
            }
        });

        if (this.printData.undeliveredItems.length == 0) {
            this.env.showTranslateMessage('Không có sản phẩm mới cần gửi đơn!', 'success');
            this.submitAttempt = false;
            return;
        }

        // Flow để in Type == Food và trường hợp có máy in nhiều chỗ.
        // Lọc ra List A (ItemsForKitchen) : mảng các items là Foods. 
        // Lọc ra List B (newKitchenList2) : Các máy in để in cho List A.
        // Vòng lặp qua list A >> thiết lập View (SetKitchenID) và  chọn máy in phù hợp để mapping lại với nhau.
        // >> có được cặp dữ liệu hình ảnh cần thiết, và vị trí máy in tương ứng.

        const IDItemGroupList = [...new Map(this.printData.undeliveredItems.map((item: any) => [item['_item']['IDItemGroup'], item._item.IDItemGroup])).values()];
        for (let index = 0; index < IDItemGroupList.length; index++) {
            const element = IDItemGroupList[index];
            if (element == 193) { // Type == Food only (IDItemGroup == 193);
                this.haveFoodItems = true;
                let ItemsForKitchen = this.printData.undeliveredItems.filter(i => i._item.IDItemGroup == element);

                const newKitchenList2 = [...new Map(ItemsForKitchen.map((item: any) => [item['_item']['Kitchen']['Name'], item._item.Kitchen])).values()];
                this.kitchenList = newKitchenList2;

                for (let index = 0; index < ItemsForKitchen.length; index++) {
                    let kitchenPrinter = newKitchenList2.find(p => p.Id == ItemsForKitchen[index]._IDKitchen);

                    await this.setKitchenID(kitchenPrinter.Id);

                    let LineID = ItemsForKitchen[index].Id;
                    let object: any = document.getElementById('bill-item-each-' + LineID);

                    let printerInfo = kitchenPrinter['Printer'];
                    this.setupPrinting(printerInfo, object, false, times, true, ItemsForKitchen.length);
                }
            }
        }
        if (!this.haveFoodItems) {
            this.submitAttempt = false; // Không có item nào thuộc là food;
            console.log('Không có item nào thuộc là food');
            this.QZCheckData(false, true, true);
        }
    }

    async sendPrint(Status?, receipt = true) {
        this.printData.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");

        if (this.submitAttempt) return;
        this.submitAttempt = true;
        let times = 1; // Số lần in phiếu; Nếu là 2, in 2 lần;

        // let printerCodeList = [];
        // let base64dataList = [];
        let newTerminalList = [];

        if (this.defaultPrinter && this.defaultPrinter.length != 0) {
            this.defaultPrinter.forEach((p: any) => {
                let Info = {
                    Id: p.Id,
                    Name: p.Name,
                    Code: p.Code,
                    Host: p.Host,
                    Port: p.Port
                }
                newTerminalList.push({ 'Printer': Info });
            });
        }
        else {
            this.env.showTranslateMessage('Recheck Receipt Printer information!', 'warning');
            this.submitAttempt = false;
            return
        }

        for (let index = 0; index < newTerminalList.length; index++) {
            if (Status) {
                this.item.Status = Status; // Sử dụng khi in kết bill ( Status = 'Done' )
            }

            await this.setKitchenID('all');

            let object: any = document.getElementById('bill'); //Xem toàn bộ bill

            let printerInfo = newTerminalList[index]['Printer'];

            this.setupPrinting(printerInfo, object, receipt, times, true);
        }
    }

    unlockOrder() {
        this.formGroup?.enable();
        this.formGroup.controls.Status.setValue("Scheduled");
        this.formGroup.controls.Status.markAsDirty();
        let submitItem = this.getDirtyValues(this.formGroup);
        this.saveChange2();
    }

    lockOrder() {
        this.formGroup?.enable();
        this.formGroup.controls.Status.setValue("TemporaryBill");
        this.formGroup.controls.Status.markAsDirty();
        let submitItem = this.getDirtyValues(this.formGroup);
        this.saveChange2();
    }

    printerCodeList = [];
    base64dataList = [];
    setupPrinting(printer, object, receipt, times, sendEachItem = false, printerListLength = 1) {
        let printerInfo = printer;
        let printerCode = printerInfo.Code;
        let printerHost = printerInfo.Host;

        let data =
            [{
                type: 'pixel',
                format: 'html',
                flavor: 'plain', // 'file' or 'plain' if the data is raw HTML
                data:
                    `
            <html>
                <head>
                    <style>
                    `+ this.cssStyling +
                    `
                    </style>
                </head>
                <body>
                ` + object.outerHTML +
                    `
                </body>
            </html>
            `
            }];

        Promise.all([
            printerCode,
            data
        ]).then(data => {
            this.printerCodeList.push(data[0]);
            this.base64dataList.push(data[1]);
            if (this.printerCodeList.length == printerListLength && this.base64dataList.length == printerListLength) {
                this.QZsetCertificate().then(() => {
                    this.QZsignMessage().then(() => {
                        this.sendQZTray(printerHost, this.printerCodeList, this.base64dataList, receipt, times, sendEachItem).catch(err => {
                            this.submitAttempt = false;
                        });
                    });
                });
            }
        });
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
                    //m.Items[index].UoMs[idexUom].PriceList[0].NewPrice = m.Items[index].UoMs[idexUom].PriceList[0].Price;                 
                }
            });
        })
    }

    private loadOrder() {
        this.printData.undeliveredItems = [];
        this.printData.selectedTables = this.tableList.filter(d => this.item.Tables.indexOf(d.Id) > -1);
        this.printData.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");
        
        this.item._Locked = this.noLockStatusList.indexOf(this.item.Status) == -1;
        this.printData.currentBranch = this.env.branchList.find(d => d.Id == this.item.IDBranch);

        if (this.item._Locked) {
            this.pageConfig.canEdit = false;
            this.formGroup?.disable();
        }
        else {
            this.pageConfig.canEdit = true;
            this.formGroup?.enable();
        }
        if (this.item._Customer) {
            this.contactListSelected.push(this.item._Customer);
        }
        this.UpdatePrice();
        this.calcOrder();
    }

    //Hàm này để tính và show số liệu ra bill ngay tức thời mà ko cần phải chờ response từ server gửi về. 
    private calcOrder() {
        this.Discount = {
            Amount: this.item.OriginalTotalDiscount,
            Percent: this.item.OriginalTotalDiscount * 100 / this.item.OriginalTotalBeforeDiscount,
        }

        this.item._TotalQuantity = this.item.OrderLines?.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);

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
            if (this.Discount?.Percent > 0) {
                line.OriginalDiscountByOrder = this.Discount?.Percent * line.OriginalTotalBeforeDiscount / 100;
            }
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
            this.updateOrderLineStatus(line);

            line._Locked = this.item._Locked ? true : this.noLockLineStatusList.indexOf(line.Status) == -1;
            if (this.pageConfig.canDeleteItems) {
                line._Locked = false;
            }
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

    private updateOrderLineStatus(line) {
        line.StatusText = lib.getAttrib(line.Status, this.soDetailStatusList, 'Name', '--', 'Code');
        line.StatusColor = lib.getAttrib(line.Status, this.soDetailStatusList, 'Color', '--', 'Code');
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

    private getDeal() {
        let apiPath = {
            method: "GET",
            url: function () { return ApiSetting.apiDomain("PR/Deal/ForPOS") }
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

            CreatedDate: new FormControl({ value: line.CreatedDate, disabled: true }),

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

    setOrderValue(data, instantly = false, forceSave = false) {
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

                    let numberOfGuests = this.formGroup.get('NumberOfGuests');
                    numberOfGuests.setValue(this.item.OrderLines?.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0));
                    numberOfGuests.markAsDirty();

                    const parentElement = this.numberOfGuestsInput?.nativeElement?.parentElement;
                    if (parentElement) {
                        parentElement.classList.add('shake');
                        setTimeout(() => { parentElement.classList.remove('shake'); }, 2000);
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


        if ((this.item.OrderLines.length || this.formGroup.controls.DeletedLines.value.length) && this.pageConfig.systemConfig.IsAutoSave) {
            if (instantly)
                this.saveChange();
            else
                this.debounce(() => { this.saveChange() }, 1000);
        }
        if (forceSave) {
            this.saveChange();
        }
    }

    async saveChange() {
        let submitItem = this.getDirtyValues(this.formGroup);
        this.saveChange2();
    }

    savedChange(savedItem?: any, form?: FormGroup<any>): void {
        if (savedItem) {
            if (form.controls.Id && savedItem.Id && form.controls.Id.value != savedItem.Id)
                form.controls.Id.setValue(savedItem.Id);

            if (form.controls.IDContact.value != savedItem.IDContact)
                this.changedIDAddress(savedItem._Customer);

            if (this.pageConfig.isDetailPage && form == this.formGroup && this.id == 0) {
                this.id = savedItem.Id;
                let newURL = '#pos-order/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);
            }

            this.item = savedItem;

        }
        this.loadedData();

        this.submitAttempt = false;
        this.env.showTranslateMessage('Saving completed!', 'success');

        if (savedItem.Status == "Done") {
            this.sendPrint(savedItem.Status, true);
        }
        if (savedItem.Status == "TemporaryBill" && this.pageConfig.systemConfig.POSEnableTemporaryPayment && this.pageConfig.systemConfig.POSEnablePrintTemporaryBill) {
            this.sendPrint();
        }
    }

    getPromotionProgram() {
        this.programProvider.commonService.connect('GET', 'PR/Program/AppliedProgramInSaleOrder', { IDSO: this.id }).toPromise().then((data: any) => {
            this.promotionAppliedPrograms = data;
        }).catch(err => {
            console.log(err);
        })
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
                switchMap(term => this.contactProvider.search({ Take: 20, Skip: 0, SkipMCP: true, Term: term ? term : 'BP:' + this.item.IDContact }).pipe(
                    catchError(() => of([])), // empty list on error
                    tap(() => this.contactListLoading = false)
                ))

            )
        );
    }

    async addContact() {
        const modal = await this.modalController.create({
            component: POSContactModalPage, cssClass: 'my-custom-class',
            componentProps: {
                item: null
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();
        if (data) {
            this.changedIDAddress(data);
            this.contactListSelected.push(data);
            this.contactListSelected = [...this.contactListSelected];
            this.contactSearch();
        }

    }

    changedIDAddress(address) {
        if (address) {
            this.Staff = null;
            this.setOrderValue({
                IDContact: address.Id,
                IDAddress: address.IDAddress
            }, true);
            this.item._Customer = address;
            if (this.item._Customer.IsStaff == true) {
                this.getStaffInfo(this.item._Customer.Code);
            }
        }
    }

    private saveSO() {
        Object.assign(this.item, this.formGroup.value);
        this.saveChange();
    }
    getStaffInfo(Code) {
        if (Code != null) {
            this.staffProvider.read({ Code_eq: Code, IDBranch: this.env.branchList.map(b => b.Id).toString() }).then((result: any) => {
                if (result['count'] > 0) {
                    this.Staff = result['data'][0];
                    this.Staff.DepartmentName = this.env.branchList.find(b => b.Id == this.Staff.IDDepartment).Name;
                    this.Staff.JobTitleName = this.env.jobTitleList.find(b => b.Id == this.Staff.IDJobTitle).Name;
                    this.Staff.avatarURL = environment.staffAvatarsServer + this.item._Customer.Code + '.jpg?t=' + new Date().getTime();
                }
            })
        }

    }
    discountFromSalesman(line, form) {
        let OriginalDiscountFromSalesman = form.controls.OriginalDiscountFromSalesman.value;
        if (OriginalDiscountFromSalesman == "") {
            OriginalDiscountFromSalesman = 0;
        }

        if (OriginalDiscountFromSalesman > line.CalcTotalOriginal) {
            this.env.showMessage("Số tiền tặng không lớn hơn trị giá sản phẩm!", "danger");
            return false;
        }
        this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Remark: line.Remark, OriginalDiscountFromSalesman: OriginalDiscountFromSalesman }] }, true);
    }

    private getPayments() {
        return new Promise((resolve, reject) => {
            this.commonService.connect('GET', 'BANK/IncomingPaymentDetail', { IDSaleOrder: this.item.Id }).toPromise()
                .then((result: any) => {
                    this.paymentList = result;//.filter(p => p.IncomingPayment.Status == "Success" || p.IncomingPayment.Status == "Processing");
                    this.paymentList.forEach(e => {
                        console.log(this.paymentStatusList);

                        e.IncomingPayment._Status = this.paymentStatusList.find(s => s.Code == e.IncomingPayment.Status) || { Code: e.IncomingPayment.Status, Name: e.IncomingPayment.Status, Color: 'danger' };
                        e.IncomingPayment.TypeText = lib.getAttrib(e.IncomingPayment.Type, this.paymentTypeList, 'Name', '--', 'Code');
                    });
                    let PaidAmounted = this.paymentList?.filter(x => x.IncomingPayment.Status == 'Success' && x.IncomingPayment.IsRefundTransaction == false).map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
                    let RefundAmount = this.paymentList?.filter(x => (x.IncomingPayment.Status == 'Success' || x.IncomingPayment.Status == 'Processing') && x.IncomingPayment.IsRefundTransaction == true).map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);

                    this.item.Received = PaidAmounted - RefundAmount;
                    this.item.Debt = Math.round((this.item.CalcTotalOriginal - this.item.OriginalDiscountFromSalesman) - this.item.Received);
                    if (this.item.Debt > 0) {
                        this.item.IsDebt = true;
                    }

                    if (this.pageConfig.systemConfig.POSSettleAtCheckout && Math.abs(this.item.Debt) < 10 && this.item.Status != 'Done') {
                        this.env.showTranslateMessage('The order has been paid, the system will automatically close this bill.');
                        this.doneOrder();
                    }

                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    doneOrder() {
        let changed: any = { OrderLines: [] };
        if (this.printData.undeliveredItems.length > 0) {
            let message = 'Bạn có sản phẩm chưa in gửi bếp. Bạn có muốn tiếp tục hoàn tất?';
            if (this.item.Debt > 0) {
                message = 'Bạn có sản phẩm chưa in gửi bếp và đơn hàng chưa thanh toán xong. Bạn có muốn tiếp tục hoàn tất?'
            }
            this.env.showPrompt(message, null, 'Thông báo').then(_ => {
                this.printData.undeliveredItems = []; //<-- clear;
                this.item.OrderLines.forEach(line => {
                    if (this.checkDoneLineStatusList.indexOf(line.Status) == -1) {
                        line.Status = 'Done';
                    }
                    if (line.Quantity > line.ShippedQuantity) {
                        line.ShippedQuantity = line.Quantity;
                        line.ReturnedQuantity = 0;
                        changed.OrderLines.push({ Id: line.Id, IDUoM: line.IDUoM, ShippedQuantity: line.ShippedQuantity, ReturnedQuantity: 0 });
                    }
                });
                changed.OrderLines = this.item.OrderLines;
                changed.Status = 'Done';
                changed.IDStatus = 114;
                this.setOrderValue(changed, true, true);
            }).catch(_ => {

            });
        }
        else if (this.item.Debt > 0) {
            let message = 'Đơn hàng chưa thanh toán xong. Bạn có muốn tiếp tục hoàn tất?';
            this.env.showPrompt(message, null, 'Thông báo').then(_ => {
                this.item.OrderLines.forEach(line => {
                    if (this.checkDoneLineStatusList.indexOf(line.Status) == -1) {
                        line.Status = 'Done';
                    }
                });
                changed.OrderLines = this.item.OrderLines;
                changed.Status = 'Done';
                changed.IDStatus = 114;
                this.setOrderValue(changed, true, true);
            }).catch(_ => {

            });

        }
        else {
            this.item.OrderLines.forEach(line => {
                if (this.checkDoneLineStatusList.indexOf(line.Status) == -1) {
                    line.Status = 'Done';
                }
            });
            changed.OrderLines = this.item.OrderLines;
            changed.Status = 'Done';
            changed.IDStatus = 114;
            this.setOrderValue(changed, true, true);
        }

    }

    cssStyling = `
    .bill .items .name,.bill .items tr:last-child td{border:none!important}.bill,.bill .title,.sheet{color:#000}.sheet .no-break-page,.sheet .no-break-page *,.sheet table break-guard,.sheet table break-guard *,.sheet table tr{page-break-inside:avoid}.bill{display:block;overflow:hidden!important}.bill .sheet{box-shadow:none!important}.bill .header,.bill .message,.sheet.rpt .cen,.text-center{text-align:center}.bill .header span{display:inline-block;width:100%}.bill .header .logo img{max-width:150px;max-height:75px}.bill .header .bill-no,.bill .header .brand,.bill .items .quantity,.bold,.sheet.rpt .bol{font-weight:700}.bill .header .address{font-size:80%;font-style:italic}.bill .table-info{border:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .table-info-top{border-top:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .table-info-bottom{border-bottom:solid;margin:5px 0;padding:5px;border-width:1px 0}.bill .items{margin:5px 0}.bill .items tr td{border-bottom:1px dashed #ccc;padding-bottom:5px}.bill .items .name{width:100%;padding-top:5px;padding-bottom:2px!important}.bill .items .code{font-weight:700;text-transform:uppercase}.bill .items .total,.sheet.rpt .num,.text-right{text-align:right}.bill .header,.bill .items,.bill .message,.bill .table-info,.bill .table-info-bottom,.bill .table-info-top{padding-left:8px;padding-right:8px}.page-footer-space{margin-top:10px}.table-name-bill{font-size:16px}.table-info-top td{padding-top:5px}.table-info-top .small{font-size:smaller!important}.sheet{margin:0;overflow:hidden;position:relative;box-sizing:border-box;page-break-after:always;font-family:'Times New Roman',Times,serif;font-size:13px;background:#fff}.sheet.rpt .top-zone{min-height:940px}.sheet.rpt table,.sheet.rpt tbody table{width:100%;border-collapse:collapse}.sheet.rpt tbody table td{padding:0}.sheet.rpt .rpt-header .ngay-hd{width:100px}.sheet.rpt .rpt-header .title{font-size:18px;font-weight:700;color:#000}.sheet.rpt .rpt-header .head-c1{width:75px}.sheet.rpt .chu-ky,.sheet.rpt .rpt-nvgh-header{margin-top:20px}.sheet.rpt .ds-san-pham{margin:10px 0}.sheet.rpt .ds-san-pham td{padding:2px 5px;border:1px solid #000;white-space:nowrap}.sheet.rpt .ds-san-pham .head{background-color:#f1f1f1;font-weight:700}.sheet.rpt .ds-san-pham .oven{background-color:#f1f1f1}.sheet.rpt .ds-san-pham .ghi-chu{min-width:170px}.sheet.rpt .ds-san-pham .tien{width:200px}.sheet.rpt .thanh-tien .c1{width:95px}.sheet.rpt .chu-ky td{font-weight:700;text-align:center}.sheet.rpt .chu-ky .line2{font-weight:400;height:100px;page-break-inside:avoid}.sheet.rpt .noti{margin-top:-105px}.sheet.rpt .noti td{vertical-align:bottom}.sheet.rpt .noti td .qrc{width:100px;height:100px;border:1px solid;display:block}.sheet.rpt .big{font-size:16px;font-weight:700;color:#b7332b}.sheet .page-footer,.sheet .page-footer-space,.sheet .page-header,.sheet .page-header-space{height:10mm}.sheet table{page-break-inside:auto}.sheet table tr{page-break-after:auto}.float-right{float:right}
    `;
    deleteVoucher(p) {
        let apiPath = {
            method: "POST",
            url: function () { return ApiSetting.apiDomain("PR/Program/DeleteVoucher/") }
        };
        new Promise((resolve, reject) => {
            this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), { IDProgram: p.Id, IDSaleOrder: this.item.Id }).toPromise()
                .then((savedItem: any) => {
                    this.env.showTranslateMessage('Saving completed!', 'success');
                    resolve(true);
                    this.refresh();
                })
                .catch(err => {
                    this.env.showTranslateMessage('Cannot save, please try again!', 'danger');
                    reject(err);
                });
        });
    }


    async setKitchenID(value, ms = 1) {
        return new Promise((resolve, reject) => {
            this.kitchenQuery = value;
            setTimeout(() => {
                resolve(this.kitchenQuery);
            }, ms);
        });
    }

    async sendQZTray(printerHost, printerCodeList, base64dataList, receipt, times, sendEachItem) {

        //Flow: 
        // Open Connection >> 
        // Get Printer List from DB >> 
        // Check printer match ? (create printer config) : (create PDF config) >> 
        // QZ Printing >> 
        // Update item Quantity >> 
        // Save Order >> 
        // Close Connection >> Done.

        let printInfo = {
            printerHost: printerHost,
            printerCodeList: printerCodeList,
            base64dataList: base64dataList,
            receipt: receipt,
            times: times,
            sendEachItem: sendEachItem
        }

        let actualPrinters = [];
        let actualDatas = [];

        let ConnectOption =
        {
            // host: '192.168.1.97', //<< Use for test
            host: printerHost,
            keepAlive: 60,
            retries: 0,
        }

        let checkCon = qz.websocket.isActive();
        // if (checkCon) {
        //     qz.websocket.disconnect();
        // }
        await this.QZConnect(ConnectOption, printInfo).then(() => {
            if (qz.websocket.isActive()) {
                this.QZFindPrinter(null, ConnectOption, printInfo).then(async (printersDB: any) => {
                    if (printerCodeList.length != 0 && printersDB) {
                        printerCodeList.forEach(p => {

                            // ------PRODUCTION-----
                            if (printersDB.indexOf(p) > -1) {
                                let config = qz.configs.create(p);
                                for (let idx = 0; idx < times; idx++) {
                                    actualPrinters.push(config);
                                }
                            }
                            else {
                                this.env.showTranslateMessage("Printer " + p + " Not Found! Check Printers Info Database!", "warning");
                            }
                            // ----------------------

                            // // ------TEST----
                            // for (let idx = 0; idx < times; idx++) {
                            //     let config = qz.configs.create("Microsoft Print to PDF"); // USE For test
                            //     actualPrinters.push(config);
                            // }
                            // // ---------------
                        });
                        base64dataList.forEach(d => {
                            for (let idx = 0; idx < times; idx++) {
                                actualDatas.push(d);
                            }
                        });
                    }
                    else {
                        this.env.showTranslateMessage("No Printers Available, Please Check Printers' IP  / Printers' Power", "warning");
                        this.submitAttempt = false;
                    }

                    if (actualPrinters.length != 0 && actualDatas.length != 0) {
                        await this.QZActualPrinting(actualPrinters, actualDatas, ConnectOption, printInfo).then(async (result: any) => {
                            if (result) {
                                this.submitAttempt = false;
                                await this.QZCheckData(receipt, !receipt, sendEachItem).then(_ => {
                                    if (this.item.Status == "Done" || this.item.Status == "Cancelled") {
                                        this.nav('/pos-order', 'back');
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    async QZsetCertificate() {
        /// Authentication setup ///
        qz.security.setCertificatePromise(function (resolve, reject) {
            resolve(
`-----BEGIN CERTIFICATE-----
MIIDyjCCArKgAwIBAgIUNyDQWpqLjSk0Gmf3SLg67MuWdkkwDQYJKoZIhvcNAQEL
BQAwazEWMBQGA1UEAwwNaW5ob2xkaW5ncy52bjELMAkGA1UEBhMCVk4xDDAKBgNV
BAgMA0hDTTEMMAoGA1UEBwwDSENNMRMwEQYDVQQKDApJbmhvbGRpbmdzMRMwEQYD
VQQLDApJbmhvbGRpbmdzMB4XDTIzMDkyNjA0MTYxM1oXDTMzMDkyMzA0MTYxM1ow
azEWMBQGA1UEAwwNaW5ob2xkaW5ncy52bjELMAkGA1UEBhMCVk4xDDAKBgNVBAgM
A0hDTTEMMAoGA1UEBwwDSENNMRMwEQYDVQQKDApJbmhvbGRpbmdzMRMwEQYDVQQL
DApJbmhvbGRpbmdzMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoFj3
TUVwCHLXQ6Yux5YfJeXeDvuvq+agqXhJv7C31WLz5on6nf86Dyh+l5rPmNe1Xg1s
8jZlmW8a+BZWZwEoao+XINa/KjBzHuVTBU8PDMioFcHeJxomW7kuAAaCXVG0FrrM
aQE3zialGN1igdPscC0RHo8AcwJV4k+KnoQgbIatUFl/fFFD1LL5t7lTgO/u/uLS
HxOBBqTWs7Pfti3o/nm7JzyZGZcGSIRt3+MEh0RgJDyxMSb6bXcSxmEAza7hDCrG
grvpcKhF/NQKjKeP3L1OLIDZONMifkQLIq8zvZ9XVPhWIfmZLu81aTCwQeLlvNEu
pWh0QO9mihhmUEudOwIDAQABo2YwZDAdBgNVHQ4EFgQUURovU+z5QvkVTkjZxgSY
pnjO7xEwHwYDVR0jBBgwFoAUURovU+z5QvkVTkjZxgSYpnjO7xEwDgYDVR0PAQH/
BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQEwDQYJKoZIhvcNAQELBQADggEBAHoK
6OvwM2gQndUxm2nqNOMsjKFdu0HyLg/Wc75rAbc7Ga7uVACqypWHgjvtjcOAqrUt
hslwf9Gib6h3a+o0Ywx3lLQbUuXpX1cKAqSLbkILw4SW2tOsTWOwkYDQ9ztqu1Tr
0hpTOLWVe+RHbrx5P81noSfGprqQ6YTxEqC4tgclQt/MT8FFmZpHoTruEyoIU+Xv
p2MLbl23oY2mUUrc0/+JMKDu4X3pVTYGx/Nb78W9vZeAj1RhMq3aFGr2ervESx9b
+aNn0Q3uhefUWOukJENQeMo/7so+vqD3V6WIJTEmb9Xk721Yz7fHISlajgBPjL67
5ULUsV0wtlXgroVVEL8=
-----END CERTIFICATE-----`
            );
        });
    }

    async QZsignMessage() {
        var privateKey =
`-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCgWPdNRXAIctdD
pi7Hlh8l5d4O+6+r5qCpeEm/sLfVYvPmifqd/zoPKH6Xms+Y17VeDWzyNmWZbxr4
FlZnAShqj5cg1r8qMHMe5VMFTw8MyKgVwd4nGiZbuS4ABoJdUbQWusxpATfOJqUY
3WKB0+xwLREejwBzAlXiT4qehCBshq1QWX98UUPUsvm3uVOA7+7+4tIfE4EGpNaz
s9+2Lej+ebsnPJkZlwZIhG3f4wSHRGAkPLExJvptdxLGYQDNruEMKsaCu+lwqEX8
1AqMp4/cvU4sgNk40yJ+RAsirzO9n1dU+FYh+Zku7zVpMLBB4uW80S6laHRA72aK
GGZQS507AgMBAAECggEANSHFsGEV4nbLRatHTPM9lv04O5bCex+MlRs6tL4F7DtB
vl5yIPB1eJheejXeHDM98dBZDVlhCRp7wUEFmFQV5Fl4JnWCGqS7QL2UaOntfrru
l2cKCcLsevA9gdymTe3I0s9K9HBm4XSEuFyDS6nBatpEFfAkofdgJgFdWXFGnS7s
8RwGI6jF/zBB+BAwyfLJvKLf7gLz4p6FHlnK/a6T7cWSH3nqo95/WZGj5FRdk2n8
VghKGYmGkdZKLK6jRngpeJwC3c6gcSa/dCahCYuYyxnFmiZawg90mAKjwaIv7kwJ
i6Oj+tPZj6gWSLi75hF7OO4KDDOoRqfQu3emVI9jAQKBgQDLx/U1yYyckbngPuP9
G/kFb6tFi5l36yuIJudgRTQD/c5gKnuL6gZ8ma0fEXLzEvMlDjCzBsMSZxuw6pe3
2nujy5GdvppsOXDrNT/v4OCuWFlu9R/MHJ8RfCQOkS/zXX1hmuLQfW5Pde0WPYF8
+ktIjB2hFBe61zAPdbV0sAn1GwKBgQDJb8QRHfZhqZnhr1Fv7T67WupyBJDJ5vaB
Fsjl9e6zNCTfemtlA1IRWEEaxan/idMkvB3QyCAY7mR7nekRP3SAV/giSNoqXlEL
51X89jnQss6GwYqVVWwmC5yqO+Or4Z5OqdlbmWrvhceIjPmaLyZtxZlxD2KvM1SX
H5rM4/MaYQKBgQComFWiW47vFo3PHpknlpYPTlVII3gkQ7fvXCh/eKHRT5IH8/3l
Qwh82/PkSV5uBtaNaNEXvNd1iULauyws2yEB4fEmrkQ6l8d5gcPVJZseA1BywXC+
QUvFfoyiVLJ0SXvrXeabkbrLGQi/JsHT8YyJiAsXcnUzisdjcwJeeSqz0wKBgCHm
KjPLPAxhc2EUlPrmDRmQikXX2NnxgWhmAjcY9Su5Sb9GJc6hCW2b0ZEE1MAJXLwg
4E+jbitj6wsWnwNlD2EN7NcwNW7N4ovDSahBc6dYgAMTjRPmhUW9zIalf4IMfQy1
7rtIjUNz2wly2AqHhssQZuss8KmVVNX93po+fknhAoGAVXtryIo3lOUfzXsjUzHZ
7RBxXLYZ5+hxpyivrDI11eFolaWJnp+bOWa2c4dOlb1NkTMzIPIFQS7FCMU1UKkX
eXh8jdv+XZW7tXqxNxCFxKzfxMn9SaA14D4tKFAZzOG8USqInmZ7xJHXI2oGt9ob
Zb2Mby/Ky+iBPuRtLuWciAI=
-----END PRIVATE KEY-----`;

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

    async ConnectionPrompt(options, printInfo) {
        this.env.showPrompt('Bạn có muốn tiếp tục in?', options.host, 'Có lỗi khi gọi đến server').then(_ => {
            this.QZCloseConnection().then(() => {
                this.sendQZTray(printInfo.printerHost, printInfo.printerCodeList, printInfo.base64dataList, printInfo.receipt, printInfo.times, printInfo.sendEachItem);
            });
        }).catch(_ => {
            this.submitAttempt = false;
            this.QZCloseConnection();
        });
    }

    async QZConnect(options, printInfo) {
        let checkCon = qz.websocket.isActive();
        if (!checkCon)
            return qz.websocket.connect(options).then().catch(err => {
                this.ConnectionPrompt(options, printInfo);
            });
    }

    async QZFindPrinter(printerCode = null, options, printInfo) {
        if (printerCode == null) {
            return qz.printers.find().catch(err => {
                this.ConnectionPrompt(options, printInfo);
            });
        }
        else {
            return qz.printers.find(printerCode).catch(err => {
                this.ConnectionPrompt(options, printInfo);
            });
        }
    }

    async QZGetDefaultPrinter(signature = null, signingTimestamp = null) {
        return qz.printers.getDefault(signature, signingTimestamp);
    }

    async QZActualPrinting(actualPrinters, actualDatas, options, printInfo) {
        return new Promise((resolve, reject) => {
            qz.print(actualPrinters, actualDatas, true).then(() => {
                resolve(true);
            }).catch(err => {
                this.ConnectionPrompt(options, printInfo);
            });
        });
    }

    async QZCheckData(receipt = true, saveData = true, sendEachItem = false) {
        if (!receipt && saveData && sendEachItem) {
            this.item.OrderLines.forEach(e => {
                e.ShippedQuantity = e.Quantity;
                e.ReturnedQuantity = e.Quantity - e.ShippedQuantity;
            });
            this.item.Status = 'Scheduled';
            this.pageProvider.save(this.item).then((data: any) => {

                this.item.Status = data.Status;
                this.formGroup?.controls['Status'].setValue(this.item.Status);
                this.item.OrderLines.forEach(e => {
                    if (e.Image) {
                        e.imgPath = environment.posImagesServer + e.Image;
                    }
                    this.updateOrderLineStatus(e);
                });
                this.refresh();
                // console.log(lib.dateFormat(new Date(), "hh:MM:ss") + '  ' + new Date().getMilliseconds()); // For Testing
                return this.QZCloseConnection();
            });
        }

        this.env.showTranslateMessage('Gửi đơn thành công!', 'success');
        this.submitAttempt = false;
        this.printData.undeliveredItems = []; //<-- clear;
        this.printerCodeList = [];
        this.base64dataList = [];
        if (!receipt && !sendEachItem) {
            return this.sendKitchenEachItem();
        }
    }

    async QZCloseConnection() {
        let checkCon = qz.websocket.isActive();
        if (checkCon) {
            this.submitAttempt = false;
            return qz.websocket.disconnect();
        }
    }

    applyDiscount() {
        this.pageProvider.commonService.connect('POST', 'SALE/Order/UpdatePosOrderDiscount/', { Id: this.item.Id, Percent: this.Discount.Percent }).toPromise()
            .then(result => {
                this.env.showTranslateMessage('Saving completed!', 'success');
                this.refresh();
            }).catch(err => {
                this.env.showTranslateMessage('Cannot save, please try again!', 'danger');
            })
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