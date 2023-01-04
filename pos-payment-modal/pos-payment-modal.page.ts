import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { BANK_IncomingPaymentDetailProvider, BANK_IncomingPaymentProvider, CRM_ContactProvider, POS_TableProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { SaleOrderMobileAddContactModalPage } from '../../SALE/sale-order-mobile-add-contact-modal/sale-order-mobile-add-contact-modal.page';
import { CommonService } from 'src/app/services/core/common.service';
import QRCode from 'qrcode'
import { POSDiscountModalPage } from '../pos-discount-modal/pos-discount-modal.page';
import { POSAddContactModalPage } from '../pos-add-contact-modal/pos-add-contact-modal.page';
import { CRM_BusinessPartnerProvider } from 'src/app/services/custom.service';


@Component({
    selector: 'app-pos-payment-modal',
    templateUrl: './pos-payment-modal.page.html',
    styleUrls: ['./pos-payment-modal.page.scss'],
})
export class POSPaymentModalPage extends PageBase {
    @Input() selectedOrder;
    @Input() orderInvoice;
    serviceCharge = 0;
    isDebtOrder = false;

    Methods = [
        {
            Id: 1,
            IDType: 72,
            Name: 'Tiền mặt',
            Icon: 'Cash',
            Selected: true,
        },
        {
            Id: 2,
            IDType: 1376,
            Name: 'Chuyển khoản',
            Icon: 'Business',
            Selected: false,
        },
        // {
        //     Id: 3,
        //     Name: 'Ví Momo',
        //     Icon: 'Wallet',
        //     Selected: false,
        // },
        {
            Id: 4,
            IDType: 1402,
            Name: 'Credit Card',
            Icon: 'Card',
            Selected: false,
        },
        // {
        //     Id: 5,
        //     Name: 'Thẻ ATM',
        //     Icon: 'Card',
        //     Selected: false,
        // },
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

    bankList = [
        {
            Id: 1,
            Name: 'Vietinbank',
            IsSelected: false
        },
        {
            Id: 2,
            Name: 'Vietcombank',
            IsSelected: false
        },
        {
            Id: 3,
            Name: 'MBBank',
            IsSelected: false
        },
    ];
    selectedBank;

    titleList = [
        {
            Id: 1,
            Name: 'BOD',
            IsSelected: false
        },
        {
            Id: 2,
            Name: 'BOM',
            IsSelected: false
        },
        {
            Id: 3,
            Name: 'SALE',
            IsSelected: false
        },
        {
            Id: 4,
            Name: 'MARKETING',
            IsSelected: false
        },
        {
            Id: 5,
            Name: 'OTHERS',
            IsSelected: false
        },
    ];
    selectedTitle;

    paymentDetailList = []
    transactionsList: any = [];
    recAmountBtn = [];

    InCashOptions = false;
    DepositOptions = false;
    MomoWalletOptions = false;
    VisaMasterOptions = false;
    ATMCardOptions = false;

    InvoiceOptions = false;

    IDContactChanged = false;
    kitchenQuery = 'all';

    constructor(
        public pageProvider: SALE_OrderProvider,
        public contactProvider: CRM_ContactProvider,
        public posContactProvider: CRM_BusinessPartnerProvider,
        public tableProvider: POS_TableProvider,
        public incomingPaymentProvider: BANK_IncomingPaymentProvider,
        public incomingPaymentDetailProvider: BANK_IncomingPaymentDetailProvider,
        public commonService: CommonService,

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
        this.pageConfig.isDetailPage = true;
        this.pageConfig.canEdit = true;
        this.pageConfig.pageName = 'POSOrderPayment';
        this.config.notFoundText = 'Không tìm thấy dữ liệu phù hợp...';
        this.config.clearAllText = 'Xóa hết';

        this.pageConfig.canAddCustomer = true;
    }

    loadData(event) {

        this.item = { Id: this.selectedOrder.Id, IDContact: this.selectedOrder.IDContact, IDAddress: this.selectedOrder.IDAddress, IDTable: this.selectedOrder.Tables[0], IDOrder: this.selectedOrder.Id, QRC: null};
        this.InvoiceOptions = this.selectedOrder.IsInvoiceRequired;
        this.recAmountBtn;
        this.transactionsList = [];
        this.checkPayment(this.Methods[0]);
        this.generateRecommendNumber();

        this.incomingPaymentDetailProvider.search({IDSaleOrder: this.selectedOrder.Id, IsDeleted: false}).toPromise().then((results:any) => {
            let counter = 0;
            this.paymentDetailList = results;
            this.paymentDetailList.forEach(e => {
                Promise.all([
                    // this.incomingPaymentProvider.search({Id: e.IDIncomingPayment}).toPromise()
                    this.incomingPaymentProvider.getAnItem(e.IDIncomingPayment)
                ]).then((results) => {
                    let data = results[0];
                    if (data) {
                        this.transactionsList.push(data);
                    }

                    if (counter == this.paymentDetailList.length - 1) {
                        this.transactionsList.forEach(e => {
                            e.Type = this.IDTypeText.find(i => i.IDType == e.IDType).Type;
                            e.AmountText = lib.currencyFormat(e.Amount);
                        });

                        this.transactionsList.sort((a, b) => a.CreatedDate - b.CreatedDate);

                        this.loadedData(event);
                    }
                    counter++;
                });
            });

            if (this.paymentDetailList.length == 0) {
                this.loadedData(event);
            }
        });
    }

    loadedData(event) {

        let momoCode;
        QRCode.toDataURL('IDSO:' + this.item.IDOrder, { errorCorrectionLevel: 'H', version: 2, width: 500, scale: 20, type: 'image/webp' }, function (err, url) {
            momoCode = url;
        });
        this.item.QRC = momoCode;

        this.posContactProvider.SearchContact({ Take: 20, Skip: 0, Term: this.item.IDContact }).subscribe((data: any) => {
            let contact = data.find(d => d.IDAddress == this.item.IDAddress);

            this.contactSelected = contact;

            data.filter(d => d.Id == this.item.IDContact).forEach(i => {
                if (i && this.contactListSelected.findIndex(d => d.IDAddress == i.IDAddress) == -1)
                    this.contactListSelected.push(i);
            });
            this.contactSearch();
            this.cdr.detectChanges();

            this.contactProvider.getAnItem(this.item.IDContact).then((data:any) => {
                this.orderInvoice = {
                    CompanyName: data.CompanyName,
                    CompanyAddress: data.BillingAddress,
                    TaxCode: data.TaxCode,
                    EmailAddress: data.Email,
                };
                super.loadedData(event);
                this.orderCalc();
            });
        });
    }
    segmentView = '1';
    segmentChanged(ev: any) {
        this.segmentView = ev.detail.value;
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
            this.selectedOrder.IDAddress = i.IDAddress;

            this.contactProvider.read({ Take: 20, Skip: 0, Id: i.Id}).then(results => {
                let invoiceData = results['data'][0];
                if (invoiceData) {
                    this.orderInvoice.CompanyName = invoiceData.CompanyName;
                    this.orderInvoice.CompanyAddress = invoiceData.BillingAddress;
                    this.orderInvoice.PhoneNumber = this.contactSelected?.WorkPhone;
                    this.orderInvoice.TaxCode = invoiceData.TaxCode;
                    this.orderInvoice.EmailAddress = invoiceData.Email;
                }
            });

            if (this.contactListSelected.findIndex(d => d.Id == i.Id) == -1) {
                this.contactListSelected.push(i);
                this.contactListSelected = [...this.contactListSelected];
                this.contactSearch();
                this.cdr.detectChanges();
            }
        }
    }

    searchTaxCode(ev) {
        let term = ev.detail.value;
        let query = {
            TaxCode: term,
            IDBranch: this.selectedOrder.IDBranch,
        }
        if (term.length >= 10) {
            this.contactProvider.read({ Take: 20, Skip: 0, TaxCode: term}).then((values: any) => {

                if (values['data'][0]) {
                    let invoiceData = values['data'][0];
                    this.orderInvoice.Addressee = this.contactSelected?.Name;
                    this.orderInvoice.PhoneNumber = this.contactSelected?.WorkPhone;
                    this.orderInvoice.CompanyName = invoiceData.CompanyName;
                    this.orderInvoice.CompanyAddress = invoiceData.BillingAddress;
                }

                if (values['data'].length == 0) {
                    let apiPath = {
                        method: "GET",
                        url: function () { return ApiSetting.apiDomain("AC/ARInvoice/GetBusinessInfo") }
                    };

                    this.commonService.connect(apiPath.method, apiPath.url(), query).toPromise().then((result: any) => {
                        if (result) {
                            let invoiceData;
                            try {
                                invoiceData = JSON.parse(result);

                                this.orderInvoice.Addressee = this.contactSelected?.Name;
                                this.orderInvoice.PhoneNumber = this.contactSelected?.WorkPhone;
                                this.orderInvoice.CompanyName = invoiceData.TenChinhThuc;
                                this.orderInvoice.CompanyAddress = invoiceData.DiaChiGiaoDichChinh;
                                console.log(this.orderInvoice);
                            } catch (error) {
                                console.log(result);
                                this.env.showTranslateMessage('Không thể tìm thấy MST, vui lòng kiểm tra lại','danger');
                            }
                        }
                    }).catch(err => {
                        console.log(err);
                        this.env.showTranslateMessage('Không thể tìm thấy MST, vui lòng kiểm tra lại','danger');
                    });
                }
            });
        }
        else {
            this.orderInvoice.Addressee = null;
            this.orderInvoice.PhoneNumber = null;
            this.orderInvoice.CompanyName = null;
            this.orderInvoice.CompanyAddress = null;
        }
    }

    async addContact() {
        const modal = await this.modalController.create({
            component: POSAddContactModalPage,
            swipeToClose: true,
            cssClass: 'my-custom-class',
            componentProps: {
                'firstName': 'Douglas',
                'lastName': 'Adams',
                'middleInitial': 'N'
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();
        
        let newContact = data[0];
        let andApply = data[1];

        if ( this.selectedOrder.IDStatus != 113 && this.selectedOrder.IDStatus != 114 && this.selectedOrder.IDStatus != 115 ) {
            if (newContact) {
                if (newContact.Address.Id != this.contactSelected.IDAddress) {
                    this.IDContactChanged = true;
                    this.changedIDContact(newContact);
                    this.IDContactChanged = false;
                } 
            }
            if (andApply) {
                this.orderInvoice.TaxCode = newContact.TaxCode;
                this.orderInvoice.CompanyName = newContact.CompanyName;
                this.orderInvoice.CompanyAddress = newContact.BillingAddress;
                this.saveChange();
            }
        }
        else {
            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }

    }

    checkPayment(i) {
        this.Methods.forEach((element,index)=>{
            if(element.Id == i.Id) {
                this.Methods[index].Selected = true;
            }
            else {
                this.Methods[index].Selected = false;
            }

            if (element.Id == 1) {
                if (this.Methods[index].Selected == true) {
                    this.InCashOptions = true;
                }
                else {
                    this.InCashOptions = false;
                    this.item.CashReceived = 0;
                }
            }
            else if (element.Id == 2) {
                if (this.Methods[index].Selected == true) {
                    this.DepositOptions = true;
                }
                else {
                    this.DepositOptions = false;
                    this.item.DepositReceived = 0;
                }
            }
            // else if (element.Id == 3) {
            //     if (this.Methods[index].Selected == true) {
            //         this.MomoWalletOptions = true;
            //     }
            //     else {
            //         this.MomoWalletOptions = false;
            //         this.item.MomoWalletReceived = 0;
            //     }
            // }
            else if (element.Id == 4) {
                if (this.Methods[index].Selected == true) {
                    this.VisaMasterOptions = true;
                }
                else {
                    this.VisaMasterOptions = false;
                    this.item.VisaMasterReceived = 0;
                }
            }
            // else if (element.Id == 5) {
            //     if (this.Methods[index].Selected == true) {
            //         this.ATMCardOptions = true;
            //     }
            //     else {
            //         this.ATMCardOptions = false;
            //         this.item.ATMCardReceived = 0;
            //     }
            // }
        });
        // this.orderCalc();
    }

    setAmount(i) {
        if (this.InCashOptions) {
            this.item.CashReceived = i.Amount;
        }
        else if (this.DepositOptions) {
            this.item.DepositReceived = i.Amount;
        }
        else if (this.MomoWalletOptions) {
            this.item.MomoWalletReceived = i.Amount;
        }
        else if (this.VisaMasterOptions) {
            this.item.VisaMasterReceived = i.Amount;
        }
        else if (this.ATMCardOptions) {
            this.item.ATMCardReceived = i.Amount;
        }
        this.orderCalc();
    }

    changeDiscount() {
        let sumTotalDiscount = 0.0;
        // this.item.PercentTotalDiscount = parseInt(this.item.PercentTotalDiscount);
        this.selectedOrder.TotalDiscount = parseInt(this.selectedOrder.TotalDiscount);
        this.selectedOrder.OrderLines.forEach(i => {
            i.TotalBeforeDiscount = i.Quantity * (i.UoMPrice || 0);
            i.TotalDiscount = (i.TotalBeforeDiscount / this.selectedOrder.TotalBeforeDiscount) * this.selectedOrder.TotalDiscount;
            sumTotalDiscount += i.TotalDiscount;
        });
        if ((this.selectedOrder.TotalDiscount - sumTotalDiscount) != 0) {
            this.selectedOrder.OrderLines[0].TotalDiscount += (this.selectedOrder.TotalDiscount - sumTotalDiscount);
        }
    }

    kitchenList = [];
    async orderCalc() {
        if (this.selectedOrder.IDStatus == 113 || this.selectedOrder.IDStatus == 114 || this.selectedOrder.IDStatus == 115) {
            this.item.CashReceived = 0;
            this.item.DepositReceived = 0;
            this.item.MomoWalletReceived = 0;
            this.item.VisaMasterReceived = 0;
            this.item.ATMCardReceived = 0;
            this.item.Remark = '';

            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }
        else {
            this.kitchenList = [];
            this.selectedOrder.OrderLines.forEach(i => {
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
            console.log(this.kitchenList);
    
    
            this.selectedOrder.TotalQuantity = this.selectedOrder.OrderLines.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
    
            this.selectedOrder.TotalBeforeDiscount = this.selectedOrder.OrderLines.map(x => x.TotalBeforeDiscount).reduce((a, b) => (+a) + (+b), 0);
            // this.selectedOrder.InternalDiscount = this.selectedOrder.OrderLines.map(x => x.InternalDiscount).reduce((a, b) => (+a) + (+b), 0);
            // this.selectedOrder.VoucherDiscount = this.selectedOrder.OrderLines.map(x => x.VoucherDiscount).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.Discount = this.selectedOrder.OrderLines.map(x => x.Discount).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.TotalDiscount = this.selectedOrder.OrderLines.map(x => x.TotalDiscount).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.TotalAfterDiscount = this.selectedOrder.OrderLines.map(x => x.TotalAfterDiscount).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.TotalAfterServiceCharge = this.selectedOrder.OrderLines.map(x => x.TotalAfterServiceCharge).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.ServiceCharge = this.selectedOrder.OrderLines.map(x => x.ServiceCharge).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.Tax = this.selectedOrder.OrderLines.map(x => x.Tax).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.TotalAfterTax = this.selectedOrder.OrderLines.map(x => x.TotalAfterTax).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.Received = this.transactionsList.map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
            this.selectedOrder.TheChange = this.selectedOrder.Received - this.selectedOrder.TotalAfterTax;
            this.selectedOrder.TaxRate = ((this.selectedOrder.Tax / this.selectedOrder.TotalAfterDiscount) * 100).toFixed();
            this.selectedOrder.OrderDateText = lib.dateFormat(this.selectedOrder.OrderDate, 'hh:MM dd/mm/yyyy');
    
            this.selectedOrder.OriginalDiscount1 = 0;
            this.selectedOrder.OriginalDiscount2 = 0;
            this.selectedOrder.OriginalDiscountByGroup = 0;
            this.selectedOrder.OriginalDiscountByItem = 0;
            this.selectedOrder.OriginalDiscountByLine = 0;
            this.selectedOrder.OriginalDiscountByOrder = 0;
            this.selectedOrder.OriginalDiscountFromSalesman = 0;
            this.selectedOrder.OriginalPromotion = 0;
            this.selectedOrder.OriginalTotalBeforeDiscount = this.selectedOrder.TotalBeforeDiscount
            this.selectedOrder.OriginalTotalDiscount = this.selectedOrder.TotalDiscount;
            this.selectedOrder.OriginalTotalAfterDiscount = this.selectedOrder.TotalAfterDiscount;
            this.selectedOrder.OriginalTax = this.selectedOrder.Tax;
            this.selectedOrder.OriginalTotalAfterTax = this.selectedOrder.TotalAfterTax;

            ////

            this.item.CashReceived = ( parseFloat(this.item.CashReceived) || 0);
            this.item.DepositReceived = ( parseFloat(this.item.DepositReceived) || 0);
            this.item.MomoWalletReceived = ( parseFloat(this.item.MomoWalletReceived) || 0);
            this.item.VisaMasterReceived = ( parseFloat(this.item.VisaMasterReceived) || 0);
            this.item.ATMCardReceived = ( parseFloat(this.item.ATMCardReceived) || 0);
    
            this.item.TransactionTotal = this.transactionsList.map(x => x.Amount).reduce((a, b) => (+a) + (+b), 0);
    
            this.selectedOrder.Received = this.item.TransactionTotal + this.item.CashReceived + this.item.DepositReceived + this.item.MomoWalletReceived + this.item.VisaMasterReceived + this.item.ATMCardReceived;
            this.selectedOrder.TheChange = this.selectedOrder.Received - this.selectedOrder.TotalAfterTax;
        }
    }

    receiveAmount() {
        let transaction:any =
        {
            Id: 0,
            IDBranch: this.selectedOrder.IDBranch,
            IDStaff: this.env.user.StaffID,
            IDCustomer: this.selectedOrder.IDContact,
            IDType: null,
            IDSaleOrder: this.selectedOrder.Id,
            Amount: 0,
            IsCanceled: false,
            IsPrinted: false
        }
        if (this.InCashOptions) {
            transaction.Type = 'Tiền mặt';
            transaction.IDType = 72;
            transaction.Amount = this.item.CashReceived;
        }
        else if (this.DepositOptions) {
            transaction.Type = 'Chuyển khoản';
            transaction.IDType = 1376;
            transaction.Amount = this.item.DepositReceived;

            if (!this.selectedBank?.Name) {
                this.env.showTranslateMessage('Vui lòng chọn ngân hàng!','warning');
                return
            }
        }
        else if (this.MomoWalletOptions) {
            transaction.Type = 'Ví Momo';
            transaction.Amount = this.item.MomoWalletReceived;
        }
        else if (this.VisaMasterOptions) {
            transaction.Type = 'Credit Card';
            transaction.IDType = 1402;
            transaction.Amount = this.item.VisaMasterReceived;

            if (!this.selectedBank?.Name) {
                this.env.showTranslateMessage('Vui lòng chọn ngân hàng!','warning');
                return
            }
        }
        else if (this.ATMCardOptions) {
            transaction.Type = 'Thẻ ATM';
            transaction.Amount = this.item.ATMCardReceived;
        }
        if (this.selectedBank?.Name) {
            this.item.Remark = (this.item.Remark || '');
            transaction.Remark = this.item.Remark + ( this.selectedBank? ' | ' + this.selectedBank.Name : '') + (this.selectedTitle? ' | ' + this.selectedTitle.Name : '');
        }
        else {
            transaction.Remark = this.item.Remark;
        }

        if (transaction.Amount == 0) {
            this.env.showMessage('Vui lòng nhập số tiền', 'warning');
            return
        }
        if (this.selectedOrder.IDStatus == 113 || this.selectedOrder.IDStatus == 114 || this.selectedOrder.IDStatus == 115) {
            this.item.CashReceived = 0;
            this.item.DepositReceived = 0;
            this.item.MomoWalletReceived = 0;
            this.item.VisaMasterReceived = 0;
            this.item.ATMCardReceived = 0;
            this.item.Remark = '';

            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
            return
        }

        let apiPath = {
            method: "POST",
            url: function () { return ApiSetting.apiDomain("BANK/IncomingPayment/AddPOSPayments") }
        };

        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(), transaction).toPromise().then(async (result: any) => {
                transaction.Id = result[0]['Id'];
                this.transactionsList.push(transaction);
                this.transactionsList.forEach(e => {
                    e.AmountText = lib.currencyFormat(e.Amount);
                });

                if (typeof this.selectedOrder.PaymentMethod === 'string') {
                    let payments = this.selectedOrder.PaymentMethod.split(',');
                    this.selectedOrder.PaymentMethod = [];
                    this.selectedOrder.PaymentMethod = payments;
                }

                let selected = (this.selectedOrder.PaymentMethod.indexOf(transaction.Type) > -1);
                if (!selected) {
                    this.selectedOrder.PaymentMethod.push(transaction.Type);
                }

                this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');

                this.item.CashReceived = 0;
                this.item.DepositReceived = 0;
                this.item.MomoWalletReceived = 0;
                this.item.VisaMasterReceived = 0;
                this.item.ATMCardReceived = 0;
                this.item.Remark = '';

                await this.generateRecommendNumber();
                await this.orderCalc();
            }).catch(err => {
                console.log(err);
                this.env.showTranslateMessage('Không lưu được, xin vui lòng thử lại.','danger');
            });
        });
    }

    async processDiscounts() {
        const modal = await this.modalController.create({
            component: POSDiscountModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-change-table',
            componentProps: {
                'selectedOrder': this.selectedOrder,
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        // Send this data to save for Payment
        let TotalDiscount = data[0];
        let newContact = data[1]; 
        let andApply = data[2];

        if ( this.selectedOrder.IDStatus != 113 && this.selectedOrder.IDStatus != 114 && this.selectedOrder.IDStatus != 115 ) {
            if (newContact) {
                if ( newContact.IDAddress != this.contactSelected.IDAddress) {
                    this.IDContactChanged = true;
                    this.changedIDContact(newContact);
                    this.IDContactChanged = false;
                } 
            }

            if (andApply) {
                this.selectedOrder.TotalDiscount = TotalDiscount;
            }

            // this.checkMethod(this.item); //Currently not Available.
            this.changeDiscount();
            this.orderCalc();
            this.saveChange();
            await this.generateRecommendNumber();
        }
        else {
            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }
    }

    async saveChange() {
        this.selectedOrder.PaymentMethod = this.selectedOrder.PaymentMethod.toString();
        this.pageProvider.save(this.selectedOrder).then((savedItem: any) => {
            this.env.publishEvent({ Code: this.pageConfig.pageName });
            this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');

            if (typeof this.selectedOrder.PaymentMethod === 'string') {
                let payments = this.selectedOrder.PaymentMethod.split(',');
                this.selectedOrder.PaymentMethod = [];
                this.selectedOrder.PaymentMethod = payments;
            }
        }).catch(err => {
            console.log(err);
           debugger 
        });
    }

    async orderPaying(andPrint = true) {
        if (andPrint) {
            if (this.selectedOrder.IDContact == 922 && this.InvoiceOptions) {
                this.env.showTranslateMessage('Không thể xuất hóa đơn cho khách lẻ!', 'warning');
                return;
            }
            else {
                if (this.selectedOrder.TotalAfterTax < 20000000) {
                    this.alertCtrl.create({
                        header: 'Hoàn thành đơn hàng',
                        //subHeader: '---',
                        message: 'Bạn chắc muốn hoàn thành đơn?',
                        buttons: [
                            {
                                text: 'Không',
                                role: 'cancel',
                            },
                            {
                                text: 'Đồng ý',
                                cssClass: 'danger-btn',
                                handler: () => {
                                    this.modalController.dismiss([this.selectedOrder, this.orderInvoice, this.contactSelected, this.transactionsList, this.InvoiceOptions, andPrint, this.isDebtOrder, this.selectedTitle?.Name]);
                                }
                            }
                        ]
                    }).then(alert => {
                        alert.present();
                    })
                }
                else {
                    this.alertCtrl.create({
                        header: 'Nhắc nhở tách đơn',
                        //subHeader: '---',
                        message: 'Hóa đơn đang vượt quá 20 triệu, bạn có muốn tiếp tục mà không tách đơn?',
                        buttons: [
                            {
                                text: 'Không',
                                role: 'cancel',
                            },
                            {
                                text: 'Đồng ý',
                                cssClass: 'danger-btn',
                                handler: () => {
                                    this.modalController.dismiss([this.selectedOrder, this.orderInvoice, this.contactSelected, this.transactionsList, this.InvoiceOptions, andPrint, this.isDebtOrder, this.selectedTitle?.Name]);
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
            this.modalController.dismiss([this.selectedOrder, this.orderInvoice, this.contactSelected, this.transactionsList, this.InvoiceOptions, andPrint, this.isDebtOrder, this.selectedTitle?.Name]);
        }
    }


    async generateRecommendNumber() {
        let theChange = this.selectedOrder.TheChange;
        if (theChange >= 0) {
            this.recAmountBtn = [];
        }
        else {
            theChange = Math.abs(this.selectedOrder.TheChange);
            this.recAmountBtn = [];

            let DivideNumArray = [];
            let DivideNum = 0;
            const numLen = Math.ceil(Math.log10(theChange + 1));
            for (let index = 0; index < numLen-1; index++) {
                DivideNumArray.push(0);
                if (index == numLen-2) {
                    DivideNumArray.unshift(1);
                }
            }
            DivideNum = parseInt(DivideNumArray.join(""));
    
            let option1 = theChange;
            let option2 = Math.ceil(Number((theChange / (DivideNum/10)).toFixed(2))) * (DivideNum/10);
            let option3 = Math.ceil(Number((theChange / (DivideNum)).toFixed(2))) * (DivideNum);
    
            this.recAmountBtn = [
                {
                    Id: 1,
                    Amount: option1,
                },
                {
                    Id: 2,
                    Amount: option2,
                },
                {
                    Id: 3,
                    Amount: option3,
                },
            ];
        }

    }

    removeLine(i, permanentlyRemove = true) {
        if ( this.selectedOrder.IDStatus != 113 && this.selectedOrder.IDStatus != 114 && this.selectedOrder.IDStatus != 115 ) {
            this.alertCtrl.create({
                header: 'Xóa giao dịch',
                //subHeader: '---',
                message: 'Bạn chắc muốn xóa giao dịch ' + i.AmountText + ' ?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                    },
                    {
                        text: 'Đồng ý xóa',
                        cssClass: 'danger-btn',
                        handler: () => {
                            this.incomingPaymentDetailProvider.search({IDSaleOrder: this.selectedOrder.Id, IsDeleted: false}).toPromise().then((results:any) => {
                                this.paymentDetailList = results;
    
                                let Ids = [];
                                let data = this.paymentDetailList.find(p => p.IDIncomingPayment == i.Id);
                                Ids.push({ Id: data.Id });
                                let Ids2 = [];
                                Ids2.push({ Id: i.Id });
        
                                if(permanentlyRemove)
                                {
                                    this.incomingPaymentDetailProvider.delete(Ids).then(resp => {
                                        this.incomingPaymentProvider.delete(Ids2).then(resp => {
                                            let line = this.transactionsList.find(t => t.Id == i.Id)
                                            this.transactionsList.splice(this.transactionsList.indexOf(line),1); 
                                            this.transactionsList = [...this.transactionsList];
                                            this.orderCalc().then(async () => {
                                                await this.generateRecommendNumber();
                                            });
                                            this.env.showTranslateMessage('erp.app.pages.product.bill-of-material.message.delete-complete','success');
                                        });
                                    });
                                }
                            });
                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
        else {
            this.env.showTranslateMessage('Đơn hàng đã xong hoặc đã hủy, không thể chỉnh sửa hoặc thêm món!', 'warning');
        }
    }

    toogleBankSelect(b) {
        b.IsSelected = !b.IsSelected;

        this.bankList.forEach(ds => {
            if (ds.Id != b.Id) {
                ds.IsSelected = false;
            }
        });

        if (b.IsSelected == true) {
            this.selectedBank = b;
        }
        else {
            this.selectedBank = null;
        }
    }

    toogleTitleSelect(d) {
        d.IsSelected = !d.IsSelected;

        this.titleList.forEach(dp => {
            if (dp.Id != d.Id) {
                dp.IsSelected = false;
            }
        });

        if (d.IsSelected == true) {
            this.selectedTitle = d;
            this.isDebtOrder = true;
            this.env.showTranslateMessage('Khách hàng là ' + this.selectedTitle?.Name + '. Đơn khi thanh toán sẽ lưu Còn nợ.', 'warning');
        }
        else {
            this.selectedTitle = null;
            this.isDebtOrder = false;
            this.env.showTranslateMessage('Đơn thanh toán bình thường.');
        }

        console.log(this.selectedTitle?.Name + this.isDebtOrder);
    }

}
