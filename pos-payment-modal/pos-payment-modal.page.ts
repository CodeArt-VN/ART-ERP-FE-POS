import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import {
  BANK_IncomingPaymentDetailProvider,
  BANK_IncomingPaymentProvider,
} from 'src/app/services/static/services.service';
import { FormBuilder } from '@angular/forms';
import { lib } from 'src/app/services/static/global-functions';
import { CommonService } from 'src/app/services/core/common.service';
import { environment } from 'src/environments/environment';
import { number } from 'echarts';
import { flattenDiagnosticMessageText } from 'typescript';

@Component({
  selector: 'app-pos-payment-modal',
  templateUrl: './pos-payment-modal.page.html',
  styleUrls: ['./pos-payment-modal.page.scss'],
})
export class POSPaymentModalPage extends PageBase {
  DebtAmount = 0;
  PaidAmounted = 0;
  statusList;
  typeList;
  payments;

  constructor(
    public pageProvider: BANK_IncomingPaymentDetailProvider,
    public IncomingPaymentProvider: BANK_IncomingPaymentProvider,
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
  ) {
    super();
  }
  ngOnInit() {
    this.pageConfig.subscribePOSOrderPaymentUpdate = this.env.getEvents().subscribe((data) => {
      switch (data.Code) {
        case 'app:POSOrderPaymentUpdate':
          this.pushPayment(data);
          break;
      }
    });
    super.ngOnInit();
  }
  ngOnDestroy() {
    this.pageConfig?.subscribePOSOrderPaymentUpdate?.unsubscribe();
    super.ngOnDestroy();
  }

  loadData(event) {
    Object.assign(this.query, {
      SortBy: '[Id_desc]',
      IDSaleOrder: this.item.Id,
      IsDeleted: false,
    });
    super.loadData(event);
    this.env.getStatus('PaymentStatus').then((data) => {
      this.statusList = data;
    });
    this.env.getType('PaymentType').then((data) => {
      this.typeList = data;
    });
  }
  loadedData(event) {
    super.loadedData(event);
    this.items.forEach((p, index) => {
      if (p.IncomingPayment.Status == 'Processing') {
        this.getStatus(index, p.IncomingPayment.Id);
      }
    });
    this.calcPayment();
  }
  private convertUrl(str) {
    return str.replace('=', '').replace('=', '').replace('+', '-').replace('_', '/');
  }
  private calcPayment() {
    let PaidAmounted = this.items
      ?.filter((x) => x.IncomingPayment.Status == 'Success' && x.IncomingPayment.IsRefundTransaction == false)
      .map((x) => x.IncomingPayment.Amount)
      .reduce((a, b) => +a + +b, 0);
    let RefundAmount = this.items
      ?.filter(
        (x) =>
          (x.IncomingPayment.Status == 'Success' || x.IncomingPayment.Status == 'Processing') &&
          x.IncomingPayment.IsRefundTransaction == true,
      )
      .map((x) => x.IncomingPayment.Amount)
      .reduce((a, b) => +a + +b, 0);
    this.payments = this.items?.filter((x) => x.IncomingPayment.IsRefundTransaction == false);
    this.payments.forEach((e) => {
      let TotalRefund = this.items
        ?.filter(
          (x) =>
            (x.IncomingPayment.Status == 'Success' || x.IncomingPayment.Status == 'Processing') &&
            x.IncomingPayment.IDOriginalTransaction == e.IncomingPayment.Id,
        )
        .map((x) => x.IncomingPayment.Amount)
        .reduce((a, b) => +a + +b, 0);
      e.IncomingPayment.PaymentCode =
        lib.dateFormat(e.IncomingPayment.CreatedDate, 'yyMMdd') + '_' + e.IncomingPayment.Id;
      e.IncomingPayment.CreatedDateText = lib.dateFormat(e.IncomingPayment.CreatedDate, 'dd/mm/yyyy');
      e.IncomingPayment.CreatedTimeText = lib.dateFormat(e.IncomingPayment.CreatedDate, 'hh:MM');
      e.IncomingPayment.TypeText = lib.getAttrib(e.IncomingPayment.Type, this.typeList, 'Name', '--', 'Code');
      e.IncomingPayment.StatusText = lib.getAttrib(e.IncomingPayment.Status, this.statusList, 'Name', '--', 'Code');
      e.IncomingPayment.StatusColor = lib.getAttrib(e.IncomingPayment.Status, this.statusList, 'Color', 'dark', 'Code');
      e.IncomingPayment.TotalRefund = TotalRefund;
      e.IncomingPayment.Refund = this.items?.filter(
        (x) => x.IncomingPayment.IDOriginalTransaction == e.IncomingPayment.Id,
      );
      e.IncomingPayment.Refund.forEach((r) => {
        r.IncomingPayment.TypeText = lib.getAttrib(r.IncomingPayment.Type, this.typeList, 'Name', '--', 'Code');
        r.IncomingPayment.StatusText = lib.getAttrib(r.IncomingPayment.Status, this.statusList, 'Name', '--', 'Code');
      });
    });
    this.PaidAmounted = PaidAmounted - RefundAmount;
    this.DebtAmount = this.item.CalcTotalOriginal - this.PaidAmounted;
  }
  getStatus(i, id) {
    this.IncomingPaymentProvider.getAnItem(id)
      .then((data) => {
        this.items[i].IncomingPayment.Status = data['Status'];
        if (data['IsRefundTransaction'] == true) {
          switch (data['Status']) {
            case 'Success':
              this.env.showTranslateMessage('Refund successful', 'success');
              break;
            case 'Fail':
              this.env.showTranslateMessage('Refund failed', 'danger');
              break;
            default:
              this.env.showTranslateMessage('Refund pending', 'warning');
              break;
          }
        } else {
          switch (data['Status']) {
            case 'Success':
              this.env.showTranslateMessage('Payment successful', 'success');
              break;
            case 'Fail':
              this.env.showTranslateMessage('Transaction failed', 'danger');
              break;
            default:
              this.env.showTranslateMessage('Waiting for customers to pay', 'warning');
              break;
          }
        }
        this.calcPayment();
      })
      .catch((err) => {
        console.log(err);
      });
  }
  goToRefund(i) {
    if (!this.pageConfig.canRefund) {
      this.env.showTranslateMessage('You have not been authorized to refund', 'danger');
      return false;
    }
    // if(i.IncomingPayment.Status != "Success"){
    //     this.env.showTranslateMessage('Không thể hoàn tiền trên giao dịch này', 'danger');
    //     return false;
    // }
    if (parseInt(i.IncomingPayment.TotalRefund) >= parseInt(i.IncomingPayment.Amount)) {
      this.env.showTranslateMessage('Refunds cannot be continued on this transaction', 'danger');
      return false;
    }
    let RefundAmount = i.IncomingPayment.Amount - i.IncomingPayment.TotalRefund;
    let payment = {
      IDBranch: this.item.IDBranch,
      IDStaff: this.env.user.StaffID,
      IDCustomer: this.item.IDContact,
      IDSaleOrder: this.item.Id,
      DebtAmount: RefundAmount,
      IsActiveInputAmount: true,
      IsActiveTypeCash: true,
      IsRefundTransaction: true,
      IDOriginalTransaction: i.IDIncomingPayment,
      IsActiveTypeZalopayApp: false,
      IsActiveTypeATM: false,
      IsActiveTypeCC: false,
      Timestamp: Date.now(),
    };
    if (
      i.IncomingPayment.Type != 'Cash' &&
      i.IncomingPayment.Type != 'Card' &&
      i.IncomingPayment.Type != 'Transfer' &&
      i.IncomingPayment.Type != 'Debt' &&
      i.IncomingPayment.Type != 'BOD'
    ) {
      payment.IsActiveTypeCash = false;
    }
    if (i.IncomingPayment.Type == 'ATM') {
      payment.IsActiveTypeATM = true;
    }
    if (i.IncomingPayment.Type == 'CC') {
      payment.IsActiveTypeCC = true;
    }
    if (i.IncomingPayment.Type == 'ZalopayApp') {
      payment.IsActiveTypeZalopayApp = true;
    }
    let str = window.btoa(JSON.stringify(payment));
    let code = this.convertUrl(str);
    let url = environment.appDomain + 'Payment?Code=' + code;
    window.open(url, '_blank');
  }
  toDetail(code) {
    let url = environment.appDomain + 'Payment?Code=' + code;
    window.open(url, '_blank');
  }
  pushPayment(data) {
    let query: any = {
      IDIncomingPayment: data.Id,
      IDSaleOrder: this.item.Id,
    };
    this.pageProvider.read(query).then((result: any) => {
      if (result['count'] > 0 && result['data'][0].IDSaleOrder == this.item.Id) {
        let index = this.items.findIndex((i) => i.IncomingPayment.Id == data.Id);
        console.log(index);
        if (index == -1) {
          result['data'].forEach((e) => {
            this.items.unshift(e);
          });
        } else {
          this.items[index].IncomingPayment.Status = result['data'][0].IncomingPayment.Status;
        }
        this.calcPayment();
      }
    });
  }
}
