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
  @Input() item;
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
    super.loadData(event);
    console.log(this.item);
  }
  changeVoucher(){
    if(this.VoucherCode == "VC01"){
      this.VoucherDiscountAmount = 10000;
    }
    if(this.VoucherCode == "VC02"){
      this.VoucherDiscountAmount = 20000;
    }
  }
  voucherCalc(){
    this.item.OriginalDiscount1 = this.VoucherDiscountAmount;
    this.item.OriginalTotalDiscount = this.item.OriginalTotalDiscount + this.VoucherDiscountAmount;
        //this.item.OriginalTotalAfterTax = this.item.OriginalTotalBeforeDiscount - this.item.OriginalTotalDiscount;
    this.item.CalcTotalOriginal = this.item.OriginalTotalBeforeDiscount - this.item.OriginalTotalDiscount - this.item.OriginalTax;
  }
  applyVoucher(apply = false){
    if (apply) {     
      this.voucherCalc();    
      this.modalController.dismiss(this.item);         
      //this.modalController.dismiss([this.item.TotalDiscount, this.contactSelected, apply, this.item, this.DiscountList]);
    }
    else {
        this.modalController.dismiss();
        //this.modalController.dismiss([null, this.contactSelected, apply, this.item, this.DiscountList]);
    }
  }
}
