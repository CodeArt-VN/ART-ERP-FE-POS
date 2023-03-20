import { Component, Input } from '@angular/core';
import { LoadingController, ModalController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';



@Component({
  selector: 'app-pos-voucher-modal',
  templateUrl: './pos-voucher-modal.page.html',
  styleUrls: ['./pos-voucher-modal.page.scss'],
})
export class POSVoucherModalPage  extends PageBase {
  VoucherCode = "";
  VoucherDiscountAmount = 0;
  constructor(
    public env: EnvService,
    public modalController: ModalController,
    public loadingController: LoadingController,
  ) 
  {
    super();
  }
  loadData(event) {
    this.VoucherDiscountAmount = this.item.OriginalDiscount1;
  }
  changeVoucher(){
    if(this.VoucherCode == "VC01"){
      this.VoucherDiscountAmount = 10000;
    }
    if(this.VoucherCode == "VC02"){
      this.VoucherDiscountAmount = 20000;
    }
  }
  applyVoucher(apply = false){
    this.item.OriginalDiscount1 = this.VoucherDiscountAmount;
    return this.modalController.dismiss(this.item, (apply ? 'confirm' : 'cancel'));
  }
}
