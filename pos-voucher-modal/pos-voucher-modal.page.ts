import { Component, Input } from '@angular/core';
import { LoadingController, ModalController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { PR_ProgramProvider } from 'src/app/services/static/services.service';



@Component({
  selector: 'app-pos-voucher-modal',
  templateUrl: './pos-voucher-modal.page.html',
  styleUrls: ['./pos-voucher-modal.page.scss'],
})
export class POSVoucherModalPage  extends PageBase {
  VoucherCode = "";
  Program;
  VoucherDiscountAmount = 0;
  constructor(
    public voucherProvider: PR_ProgramProvider,
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
    // this.voucherProvider.read({Code:this.VoucherCode}).then(result=>{
    //   this.Program = result['data'][0];         
    // }).catch(err=>{});
    
  }
  applyVoucher(apply = false){
    
    // if(this.Program.MinOrderValue > this.item.OriginalTotalBeforeDiscount){
    //   this.env.showMessage("đơn hàng của bạn chưa đủ điều kiện áp dụng mã voucher này","warning");
    //   return;
    // }
    // this.item.OriginalDiscount1 = this.Program.Value;
    // return this.modalController.dismiss(this.item, (apply ? 'confirm' : 'cancel'));
  }
}
