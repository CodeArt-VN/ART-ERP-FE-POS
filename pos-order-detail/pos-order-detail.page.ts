import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, POS_TerminalProvider, PR_ProgramProvider, SALE_OrderDeductionProvider, SALE_OrderProvider, SYS_ConfigProvider, SYS_PrinterProvider, } from 'src/app/services/static/services.service';
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
import { ModalNotifyComponent } from 'src/app/components/modal-notify/modal-notify.component';

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
    paymentType = [];
    statusList; //Show on bill
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered'];
    noLockLineStatusList = ['New', 'Waiting'];
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
    notifications:any = [];
    synth = speechSynthesis;
    constructor(
        public pageProvider: SALE_OrderProvider,
        public programProvider: PR_ProgramProvider,
        public deductionProvider: SALE_OrderDeductionProvider,
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
            Tables: [[this.idTable], Validators.required],
            IDBranch: [this.env.selectedBranch],
            IDOwner: [this.env.user.StaffID],
            //OrderDate: [new Date()],
            IDContact: [922],
            IDAddress: [902],
            IDType: [293],
            IDStatus: [101],
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
        this.pageConfig.subscribePOSOrder = this.env.getEvents().subscribe((data) => {         
			switch (data.Code) {
                case 'app:POSOrderPaymentUpdate':
                    this.getPayments();
                    this.notifyPayment(data);
                    break;
				case 'app:POSOrderFromCustomer':
                    this.notifyOrder(data.Data);				
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
        Promise.all([
            this.env.getStatus('POSOrder'),
            this.getTableGroupFlat(forceReload),
            this.getMenu(forceReload),
            this.getDeal(),
            this.sysConfigProvider.read({ Code: 'SODefaultBusinessPartner' }),
            this.env.getType('PaymentType'),
            this.pageProvider.commonService.connect('GET', 'SYS/Config/ConfigByBranch', {Code: 'IsAutoSave', IDBranch: this.env.selectedBranch}).toPromise(),
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
            if (values[6]['Value']) {
                this.pageConfig.IsAutoSave = Boolean(JSON.parse(values[6]['Value']));
            }
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
        }
        this.loadOrder();
        this.contactSearch();

        this.QZsetCertificate().then(() => {
            this.QZsignMessage().then(() => {
                this.defaultPrinter = []
                this.printerTerminalProvider.read({ IDBranch: this.env.selectedBranch, IsDeleted: false, IsDisabled: false }).then(async (results: any) => {
                    this.defaultPrinter.push(results['data']?.[0]?.['Printer'])
                });
            });
        });
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
            };

            this.item.OrderLines.push(line);

            this.addOrderLine(line);
            this.setOrderValue({ OrderLines: [line], Status: 'New'});
        }
        else {
            if ((line.Quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
                if (this.pageConfig.canDeleteItems) {
                    this.env.showPrompt('Item này đã chuyển Bar/Bếp, bạn chắc muốn giảm số lượng sản phẩm này?', item.Name, 'Xóa sản phẩm').then(_ => {
    
                        line.Quantity += quantity;
                        this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                    }).catch(_ => { });
                }
                else{
                    this.env.showMessage('Item đã chuyển Bar/Bếp');
                    return;
                }

            }
            
            else if ((line.Quantity + quantity) > 0) {
                line.Quantity += quantity;
                this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }], Status: 'New'});
            }
            else {
                if (this.item.Status == 'New') {
                    this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sản phẩm').then(_ => {
                        line.Quantity += quantity;
                        this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                    }).catch(_ => { });
                }
                else{
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

    async processDiscounts() {
        const modal = await this.modalController.create({
            component: POSDiscountModalPage,
            canDismiss: true,
            backdropDismiss: true,
            cssClass: 'modal-change-table',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
        if (role == 'confirm') {
            this.refresh();
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
            id: 'POSCancelModalPage',
            swipeToClose: true,
            backdropDismiss: true,
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
            this.setupPrinting(printerInfo, object, false, times, false);
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

                    let IDItem = ItemsForKitchen[index].IDItem;
                    let object: any = document.getElementById('bill-item-each-' + IDItem);

                    let printerInfo = kitchenPrinter['Printer'];
                    this.setupPrinting(printerInfo, object, false, times, true);
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

            let object: any = document.getElementById('bill');

            await this.setKitchenID('all').then(async _ => {
                let printerInfo = newTerminalList[index]['Printer'];
                this.setupPrinting(printerInfo, object, receipt, times, false);
            }); //Xem toàn bộ bill
        }
    }

    setupPrinting(printer, object, receipt, times, sendEachItem = false) {
        let printerCodeList = [];
        let base64dataList = [];
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

        printerCodeList.push(printerCode);
        base64dataList.push(data);

        this.sendQZTray(printerHost, printerCodeList, base64dataList, receipt, times, sendEachItem).catch(err => {
            this.submitAttempt = false;
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

    private notifyOrder(data){  
        const value = JSON.parse(data.value);    
        if(this.env.selectedBranch == value.IDBranch){
            this.playAudio("order");
            let message = "Khách bàn "+value.TableName+" Gọi món";
            let url = "pos-order/"+data.id+"/"+value.IDTable;
            this.pushNotification(null,value.IDBranch,"pos-order","Khách gọi món","pos-order",message,url);
            this.countNotification();
            if(this.id == data.id){
                this.refresh();
            }
        }                
    }
    private notifyPayment(data){
        const value = JSON.parse(data.Value);    
        if(this.env.selectedBranch == value.IDBranch && value.IDStaff == 0){
            this.playAudio("payment");
            let message = "Khách hàng bàn "+ value.TableName+" thanh toán online "+ lib.currencyFormat(value.Amount) +" cho đơn hàng #"+ value.IDSaleOrder;
            let url = "pos-order/"+value.IDSaleOrder+"/"+value.IDTable;
            this.pushNotification(null,value.IDBranch,"pos-order","Thanh toán","pos-order",message,url);
            this.countNotification();
        }
    }
    private playAudio(type){
        let audio = new Audio();
        if(type=="order"){
            audio.src = "../../../assets/audio/audio-order.wav";
        }
        if(type=="payment"){
            audio.src = "../../../assets/audio/audio-payment.wav";
        }
        audio.load();
        audio.play();
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

    setOrderValue(data, instantly = false, doneOrder = false) {
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


        if ((this.item.OrderLines.length || this.formGroup.controls.DeletedLines.value.length) && this.pageConfig.IsAutoSave) {
            if (instantly) 
                this.saveChange();
            else
                this.debounce(() => { this.saveChange() }, 1000);
        }   
        if (doneOrder) {
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

    getPromotionProgram(){
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
            component: POSContactModalPage,
            swipeToClose: true,
            cssClass: 'my-custom-class',
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
            this.setOrderValue({
                IDContact: address.Id,
                IDAddress: address.IDAddress
            }, true);
            this.item._Customer = address;
        }
    }

    private saveSO() {
        Object.assign(this.item, this.formGroup.value);
        this.saveChange();
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
                    this.paymentList = result.filter(p => p.IncomingPayment.Status == "Success" || p.IncomingPayment.Status == "Processing");
                    this.paymentList.forEach(e => {
                        e.IncomingPayment.TypeText = lib.getAttrib(e.IncomingPayment.Type, this.paymentType, 'Name', '--', 'Code');
                    });
                    let PaidAmounted = this.paymentList?.filter(x => x.IncomingPayment.Status == 'Success' && x.IncomingPayment.IsRefundTransaction == false).map(x => x.IncomingPayment.Amount).reduce((a, b) => (+a) + (+b), 0);
                    let RefundAmount = this.paymentList?.filter(x => (x.IncomingPayment.Status == 'Success' || x.IncomingPayment.Status == 'Processing') && x.IncomingPayment.IsRefundTransaction == true).map(x => x.IncomingPayment.Amount).reduce((a, b) => (+a) + (+b), 0);
                    
                    this.item.Received = PaidAmounted - RefundAmount;                 
                    this.item.Debt = (this.item.CalcTotalOriginal-this.item.OriginalDiscountFromSalesman) - this.item.Received;
                    if (this.item.Debt > 0) {
                        this.item.IsDebt = true;
                    }
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    private convertUrl(str) {
        return str.replace("=", "").replace("=", "").replace("+", "-").replace("_", "/")
    }

    goToPayment() {
        let payment = {
            IDBranch: this.item.IDBranch,
            IDStaff: this.env.user.StaffID,
            IDCustomer: this.item.IDContact,
            IDSaleOrder: this.item.Id,
            DebtAmount: parseFloat(this.item.Debt),
            IsActiveInputAmount: true,
            IsActiveTypeCash: true,
            Timestamp: Date.now()
        };
        let str = window.btoa(JSON.stringify(payment));
        let code = this.convertUrl(str);
        let url = environment.appDomain + "Payment?Code=" + code;
        window.open(url, "_blank");
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
                    if (line.Quantity > line.ShippedQuantity) {
                        line.ShippedQuantity = line.Quantity;
                        line.ReturnedQuantity = 0;
                        changed.OrderLines.push({ Id: line.Id, IDUoM: line.IDUoM, ShippedQuantity: line.ShippedQuantity, ReturnedQuantity: 0 });
                    }
                });
                changed.Status = 'Done';
                changed.IDStatus = 114;
                this.setOrderValue(changed, true, true);
            }).catch(_ => {

            });
        }
        else if (this.item.Debt > 0) {
            let message = 'Đơn hàng chưa thanh toán xong. Bạn có muốn tiếp tục hoàn tất?';
            this.env.showPrompt(message, null, 'Thông báo').then(_ => {
                changed.Status = 'Done';
                changed.IDStatus = 114;
                this.setOrderValue(changed, true, true);
            }).catch(_ => {

            });

        }
        else {
            changed.Status = 'Done';
            changed.IDStatus = 114;
            this.setOrderValue(changed, true, true);
        }

    }

    cssStyling = `
    .bill {
        display: block;
        color: #000;
        overflow: hidden !important;
   }
    .bill .sheet {
        box-shadow: none !important;
   }
    .bill .title {
        color: #000;
   }
    .bill .header {
        text-align: center;
   }
    .bill .header span {
        display: inline-block;
        width: 100%;
   }
    .bill .header .logo img {
        max-width: 150px;
        max-height: 75px;
   }
    .bill .header .brand {
        font-weight: bold;
   }
    .bill .header .address {
        font-size: 80%;
        font-style: italic;
   }
    .bill .header .bill-no {
        font-weight: bold;
   }
    .bill .table-info {
        border: solid;
        margin: 5px 0;
        padding: 5px;
        border-width: 1px 0;
   }
    .bill .table-info-top {
        border-top: solid;
        margin: 5px 0;
        padding: 5px;
        border-width: 1px 0;
   }
    .bill .table-info-bottom {
        border-bottom: solid;
        margin: 5px 0;
        padding: 5px;
        border-width: 1px 0;
   }
    .bill .items {
        margin: 5px 0;
   }
    .bill .items tr td {
        border-bottom: dashed 1px #ccc;
        padding-bottom: 5px;
   }
    .bill .items tr:last-child td {
        border: none !important;
   }
    .bill .items .name {
        width: 100%;
        border: none !important;
        padding-top: 5px;
        padding-bottom: 2px !important;
   }
    .bill .items .code {
        font-weight: bold;
        text-transform: uppercase;
   }
    .bill .items .quantity {
        font-weight: bold;
   }
    .bill .items .total {
        text-align: right;
   }
    .bill .message {
        text-align: center;
   }
    .bill .header, .bill .table-info, .bill .table-info-top, .bill .table-info-bottom, .bill .items, .bill .message {
        padding-left: 8px;
        padding-right: 8px;
   }
    .sheet {
        font-family: Arial, 'Times New Roman', Times, serif;
   }
    .page-footer-space {
        margin-top: 10px;
   }
    .table-name-bill {
        font-size: 16px;
   }
    .table-info-top td {
        padding-top: 5px;
   }
    .table-info-top .small {
        font-size: smaller !important;
   }
    .sheet {
        margin: 0;
        overflow: hidden;
        position: relative;
        box-sizing: border-box;
        page-break-after: always;
        font-family: 'Times New Roman', Times, serif;
        font-size: 13px;
        background: white;
        color: #000;
   }
    .sheet.rpt .top-zone {
        min-height: 940px;
   }
    .sheet.rpt table {
        width: 100%;
        border-collapse: collapse;
   }
    .sheet.rpt tbody table {
        width: 100%;
        border-collapse: collapse;
   }
    .sheet.rpt tbody table td {
        padding: 0px 0px;
   }
    .sheet.rpt .rpt-header .ngay-hd {
        width: 100px;
   }
    .sheet.rpt .rpt-header .title {
        font-size: 18px;
        font-weight: bold;
        color: #000;
   }
    .sheet.rpt .rpt-header .head-c1 {
        width: 75px;
   }
    .sheet.rpt .rpt-nvgh-header {
        margin-top: 20px;
   }
    .sheet.rpt .ds-san-pham {
        margin: 10px 0;
   }
    .sheet.rpt .ds-san-pham td {
        padding: 2px 5px;
        border: solid 1px #000;
        white-space: nowrap;
   }
    .sheet.rpt .ds-san-pham .head {
        background-color: #f1f1f1;
        font-weight: bold;
   }
    .sheet.rpt .ds-san-pham .oven {
        background-color: #f1f1f1;
   }
    .sheet.rpt .ds-san-pham .ghi-chu {
        min-width: 170px;
   }
    .sheet.rpt .ds-san-pham .tien {
        width: 200px;
   }
    .sheet.rpt .thanh-tien .c1 {
        width: 95px;
   }
    .sheet.rpt .chu-ky {
        margin-top: 20px;
   }
    .sheet.rpt .chu-ky td {
        font-weight: bold;
        text-align: center;
   }
    .sheet.rpt .chu-ky .line2 {
        font-weight: normal;
        height: 100px;
        page-break-inside: avoid;
   }
    .sheet.rpt .noti {
        margin-top: -105px;
   }
    .sheet.rpt .noti td {
        vertical-align: bottom;
   }
    .sheet.rpt .noti td .qrc {
        width: 100px;
        height: 100px;
        border: solid 1px;
        display: block;
   }
    .sheet.rpt .num {
        text-align: right;
   }
    .sheet.rpt .cen {
        text-align: center;
   }
    .sheet.rpt .bol {
        font-weight: bold;
   }
    .sheet.rpt .big {
        font-size: 16px;
        font-weight: bold;
        color: #b7332b;
   }
    .sheet .page-header, .sheet .page-header-space {
        height: 10mm;
   }
    .sheet .page-footer, .sheet .page-footer-space {
        height: 10mm;
   }
    .sheet table {
        page-break-inside: auto;
   }
    .sheet table break-guard {
        page-break-inside: avoid;
   }
    .sheet table break-guard * {
        page-break-inside: avoid;
   }
    .sheet table tr {
        page-break-inside: avoid;
        page-break-after: auto;
   }
    .sheet .no-break-page {
        page-break-inside: avoid;
   }
    .sheet .no-break-page * {
        page-break-inside: avoid;
   }
    .text-right {
        text-align: right;
   }
    .text-center {
        text-align: center;
   }
    .float-right {
        float: right;
   }
    .bold {
        font-weight: bold;
   }
    
    `
    deleteVoucher(p) {
        let apiPath = {
            method: "POST",
            url: function () { return ApiSetting.apiDomain("PR/Program/DeleteVoucher/") }
        };
        new Promise((resolve, reject) => {
            this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), { IDProgram: p.Id, IDSaleOrder: this.item.Id }).toPromise()
                .then((savedItem: any) => {
                    this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete', 'success');
                    resolve(true);
                    this.refresh();
                })
                .catch(err => {
                    this.env.showTranslateMessage('erp.app.pages.pos.pos-order.merge.message.can-not-save', 'danger');
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
                            if (printersDB.indexOf(p) > -1) { // Use this when fixed Printer
                                let config = qz.configs.create(p);
                                for (let idx = 0; idx < times; idx++) {
                                    actualPrinters.push(config);
                                }
                            }
                            else {
                                // let config = qz.configs.create("PDF");
                                // actualPrinters.push(config);
                                this.env.showTranslateMessage("Printer " + p + " Not Found! Using PDF Printing Instead!", "warning");
                            }

                            // let config = qz.configs.create("Microsoft Print to PDF"); // USE For test
                            // actualPrinters.push(config);
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

    async ConnectionPrompt(options, printInfo) {
        this.env.showPrompt('Bạn có muốn tiếp tục in?', options.host, 'Có lỗi khi gọi đến server').then(_ => {
            this.QCCloseConnection().then(() => {
                this.sendQZTray(printInfo.printerHost, printInfo.printerCodeList, printInfo.base64dataList, printInfo.receipt, printInfo.times, printInfo.sendEachItem);
            });
        }).catch(_ => {
            this.submitAttempt = false;
            this.QCCloseConnection();
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
            this.pageProvider.save(this.item).then((data:any) => {

                this.item.Status = data.Status;
                this.formGroup?.controls['Status'].setValue(this.item.Status);
                this.item.OrderLines.forEach(e => {
                    if (e.Image) {
                        e.imgPath = environment.posImagesServer + e.Image;
                    }
                });
                return this.QCCloseConnection();
            });
        }

        this.env.showTranslateMessage('Gửi đơn thành công!', 'success');
        this.submitAttempt = false;
        this.printData.undeliveredItems = []; //<-- clear;
        if (!receipt && !sendEachItem) {
            return this.sendKitchenEachItem();
        }
    }

    async QCCloseConnection() {
        let checkCon = qz.websocket.isActive();
        if (checkCon) {
            this.submitAttempt = false;
            return qz.websocket.disconnect();
        }
    }

    countNotification(){
        this.pageConfig.countNotifications = this.notifications.length;
    }
    pushNotification(Id?:number,IDBranch?:string,Type?:string,Name?:string,Code?:string,Message?:string,Url?:string){
        let notification = {
            Id:Id,
            IDBranch:IDBranch,
            Type:Type,
            Name:Name,
            Code:Code,
            Message:Message,
            Url:Url,
        }
        this.notifications.unshift(notification); 
    }
    async showNotify(){
        const modal = await this.modalController.create({
            component: ModalNotifyComponent,
            id: 'ModalNotify',
            canDismiss: true,
            backdropDismiss: true,
            cssClass: 'modal-notify',
            componentProps: {     
                notifications:this.notifications       
            }
        });
        
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
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