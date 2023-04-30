import { Component } from '@angular/core';
import { LoadingController, ModalController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { PR_ProgramProvider, SALE_OrderDeductionProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-pos-voucher-modal',
  templateUrl: './pos-voucher-modal.page.html',
  styleUrls: ['./pos-voucher-modal.page.scss'],
})
export class POSVoucherModalPage  extends PageBase {
  Code = "";
  Voucher;
  VoucherDiscountAmount = 0;
  constructor(
    public pageProvider: PR_ProgramProvider,
    public deductionProvider:SALE_OrderDeductionProvider,
    public env: EnvService,
    public modalController: ModalController,
    public loadingController: LoadingController,
  ) 
  {
    super();
  }
  loadData(event?: any): void {
    Object.assign(this.query, {
      IsPublic: true,
      Type:"Voucher",
    });
    super.loadData();
    this.VoucherDiscountAmount = this.item.OriginalDiscount1;  
  }
  
  loadedData(event?: any, ignoredFromGroup?: boolean): void {
    console.log(this.items);
  }
  changeCode(){
    if(this.Code != ""){
      let query = {
        Code_eq:this.Code,
        IsPublic:false
      }
      this.pageProvider.read(query).then(result=>{
        if(result['count']>0)
        {
          this.Voucher = result['data'][0];
        }
        else{
          this.Voucher = null;
        }
      }).catch(err=>{});
    }
  }
  applyVoucher(line){
    if(this.item.Deductions.length<2){
      let item ={
        IDOrder: this.item.Id,
        Id:0,
        Type:"Voucher",
        Amount:line.Value,
      }
      this.deductionProvider.save(item).then(result=>{
        let deduction = {
          Amount:result['Amount'],
          IDOrder:result['IDOrder'],
          IDOrderLine:null,
          Id:result['Id'],
          IssuedBy:null,
          Type:result['Type'],
        }
        this.item.Deductions.push(deduction);
      }).catch(err=>{console.log(err)})
    }
    else{
      this.env.showMessage("Chỉ được áp dụng 2 mã voucher trên 1 đơn hàng", "warning");
    }
   
  }
}
