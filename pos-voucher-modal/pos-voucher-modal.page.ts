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
    standalone: false
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
    // let date = new Date();
    // let time = date.toTimeString().split(' ')[0];
    // date.setHours(0, 0, 0, 0);
    // Object.assign(this.query, {
    //   IsPublic: true,
    //   IsDeleted: false,
    //   BetweenDate: date,
    //   BetweenTime: time,
    //   Type: 'Voucher',
    //   CanUse: true,
    //   Status: 'Approved',
    // });
    // super.loadData();

    // #region Load các Promotion manual
    this.env.getStorage('promotions').then((promotions) => {
      this.listPromotions = promotions;
      // các promotion lúc này đang bao gồm tất cả các khuyến mãi (manual và autoapply)
      // tại đây chỉ lấy các promotion manual
      
      this.items = this.listPromotions.filter(
        (p) => !p.IsAutoApply && p.IsPublic
      );


      this.loadedData();
    });
    // #endregion
  }

  checkCondition(pro, type) {
    if (type == 'Product') {
      // Check các item trong orderline xem có nằm trong danh sách các item được phép áp dụng voucher không
      this.item.OrderLines.forEach((line) => {
        let find = pro.Items.find((p) => p.IDItem == line.IDItem);
        if (find) {
          return true;
        }
      });
    } else {
      // Check partner trong orderxem có nằm trong danh sách các partner được phép áp dụng voucher không
      let find = pro.Partners.find((p) => p.IDPartner == this.item.IDContact);
      if (find) {
        return true;
      }
    }
    return false;
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
      this.Voucher = this.listPromotions
        .find((d) => d.Code == this.Code && !d.IsAutoApply);
      if (this.Voucher) {
        this.Voucher.Used = false;
        let find = this.item.Deductions.filter((p) => p.IDProgram == this.Voucher.Id);
        if (this.Voucher.MaxUsagePerCustomer && !(this.Voucher.MaxUsagePerCustomer > find.length)) {
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
    }

    // if (this.Code != '') {
    //   let date = new Date();
    //   date.setHours(0, 0, 0, 0);

    //   let query = {
    //     Code_eq: this.Code,
    //     BetweenDate: date,
    //     Type: 'Voucher',
    //     CanUse: true,
    //     Status: 'Approved',
    //   };
    //   this.pageProvider
    //     .read(query)
    //     .then((result) => {
    //       if (result['count'] > 0) {
    //         this.Voucher = result['data'][0];
    //         this.Voucher.Used = false;
    //         let find = this.item.Deductions.filter((p) => p.IDProgram == this.Voucher.Id);
    //         if (this.Voucher.MaxUsagePerCustomer && !(this.Voucher.MaxUsagePerCustomer > find.length)) {
    //           this.Voucher.Used = true;
    //         }
    //         if (this.Voucher.IsByPercent == true) {
    //           this.Voucher.Value = (this.Voucher.Value * this.item.OriginalTotalBeforeDiscount) / 100;
    //           if (this.Voucher.Value > this.Voucher.MaxValue) {
    //             this.Voucher.Value = this.Voucher.MaxValue;
    //           }
    //         }
    //       } else {
    //         this.env.showMessage('Mã Voucher không hợp lệ', 'danger');
    //       }
    //     })
    //     .catch((err) => {});
    // }
  }
  async applyVoucher(line) {
    let count = this.item.Deductions.filter((d) => d.Type == 'Voucher' && d.IDProgram == line.Id).length;

    let apiPath = {
      method: 'POST',
      url: function () {
        return ApiSetting.apiDomain('PR/Program/ApplyVoucher/');
      },
    };
    let query = {
      IDPrograms: [line.Id],
      IDSaleOrder: this.item.Id,
    };
    new Promise((resolve, reject) => {
      this.pageProvider.commonService
        .connect(apiPath.method, apiPath.url(),query )
        .toPromise()
        .then((savedItem: any) => {
          this.env.showMessage('Saving completed!', 'success');
          resolve(true);
          this.modalController.dismiss(this.item);
        })
        .catch((err) => {
          this.env.showMessage(err.error.Message, 'danger');
        });
    });

    //Khi áp dụng voucher thì cần kiểm tra xem voucher đó có áp dụng cho Order này không
    // if (count < line.MaxUsagePerCustomer) {
    //   this.listPromotions.find((p) => p.Id == line.Id).NumberOfUsed += 1;
    //   this.env.setStorage('promotions', this.listPromotions);
    // } else {
    //   this.env.showMessage('Bạn chỉ được sử dụng 1 voucher loại này', 'danger');
    // }
  }
}
