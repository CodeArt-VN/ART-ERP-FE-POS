import { Component } from '@angular/core';
import { LoadingController, ModalController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import {
  PR_ProgramItemProvider,
  PR_ProgramPartnerProvider,
  PR_ProgramProvider,
  SALE_OrderDeductionProvider,
} from 'src/app/services/static/services.service';

@Component({
  selector: 'app-pos-voucher-modal',
  templateUrl: './pos-voucher-modal.page.html',
  styleUrls: ['./pos-voucher-modal.page.scss'],
})
export class POSVoucherModalPage extends PageBase {
  Code = '';
  Voucher;
  constructor(
    public pageProvider: PR_ProgramProvider,
    public programPartnerProvider: PR_ProgramPartnerProvider,
    public programItemProvider: PR_ProgramItemProvider,
    public deductionProvider: SALE_OrderDeductionProvider,
    public env: EnvService,
    public modalController: ModalController,
    public loadingController: LoadingController,
  ) {
    super();
  }
  loadData(event?: any): void {
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    Object.assign(this.query, {
      IsPublic: true,
      IsDeleted: false,
      BetweenDate: date,
      Type: 'Voucher',
      CanUse: true,
      Status: 'Approved',
    });
    super.loadData();
  }

  loadedData(event?: any, ignoredFromGroup?: boolean): void {
    super.loadedData();
    this.loadProgram();
  }
  loadProgram() {
    this.items.forEach((i) => {
      i.Used = false;
      let find = this.item.Deductions.find((p) => p.IDProgram == i.Id);
      if (find) {
        i.Used = true;
      }
      if (i.IsByPercent == true) {
        i.Value = (i.Value * this.item.OriginalTotalBeforeDiscount) / 100;
        if (i.Value > i.MaxValue) {
          i.Value = i.MaxValue;
        }
      }
    });
  }
  changeCode() {
    if (this.Code != '') {
      let date = new Date();
      date.setHours(0, 0, 0, 0);

      let query = {
        Code_eq: this.Code,
        BetweenDate: date,
        Type: 'Voucher',
        CanUse: true,
        Status: 'Approved',
      };
      this.pageProvider
        .read(query)
        .then((result) => {
          if (result['count'] > 0) {
            this.Voucher = result['data'][0];
            this.Voucher.Used = false;
            let find = this.item.Deductions.find((p) => p.IDProgram == this.Voucher.Id);
            if (find) {
              this.Voucher.Used = true;
            }
            if (this.Voucher.IsByPercent == true) {
              this.Voucher.Value = (this.Voucher.Value * this.item.OriginalTotalBeforeDiscount) / 100;
              if (this.Voucher.Value > this.Voucher.MaxValue) {
                this.Voucher.Value = this.Voucher.MaxValue;
              }
            }
          } else {
            this.env.showMessage('Mã Voucher không hợp lệ', 'danger');
          }
        })
        .catch((err) => {});
    }
  }
  async applyVoucher(line) {
    let count = this.item.Deductions.filter((d) => d.Type == 'Voucher').length;
    if (count < 2) {
      let apiPath = {
        method: 'POST',
        url: function () {
          return ApiSetting.apiDomain('PR/Program/ApplyVoucher/');
        },
      };
      new Promise((resolve, reject) => {
        this.pageProvider.commonService
          .connect(apiPath.method, apiPath.url(), {
            IDProgram: line.Id,
            IDSaleOrder: this.item.Id,
          })
          .toPromise()
          .then((savedItem: any) => {
            this.env.showTranslateMessage('Saving completed!', 'success');
            resolve(true);
            this.modalController.dismiss(this.item);
          })
          .catch((err) => {
            this.env.showTranslateMessage(err.error.Message, 'danger');
          });
      });
    } else {
      this.env.showMessage('Chỉ được áp dụng 2 mã voucher trên 1 đơn hàng', 'warning');
    }
  }
}
