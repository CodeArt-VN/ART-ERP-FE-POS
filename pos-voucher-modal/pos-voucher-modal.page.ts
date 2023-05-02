import { Component } from '@angular/core';
import { LoadingController, ModalController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { PR_ProgramItemProvider, PR_ProgramPartnerProvider, PR_ProgramProvider, SALE_OrderDeductionProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-pos-voucher-modal',
  templateUrl: './pos-voucher-modal.page.html',
  styleUrls: ['./pos-voucher-modal.page.scss'],
})
export class POSVoucherModalPage  extends PageBase {
  Code = "";
  Voucher;
  constructor(
    public pageProvider: PR_ProgramProvider,
    public programPartnerProvider: PR_ProgramPartnerProvider,
    public programItemProvider: PR_ProgramItemProvider,
    public deductionProvider:SALE_OrderDeductionProvider,
    public env: EnvService,
    public modalController: ModalController,
    public loadingController: LoadingController,
  ) 
  {
    super();
  }
  loadData(event?: any): void {
    let date =  new Date();
    date.setHours(0,0,0,0);
    Object.assign(this.query, {
      IsPublic: true,
      IsDeleted:false,
      BetweenDate: date,
      Type:"Voucher",
      CanUse: true,
    });
    super.loadData();
  }
  
  loadedData(event?: any, ignoredFromGroup?: boolean): void {
    super.loadedData();
    this.loadProgram();
  }
  loadProgram(){
    this.items.forEach(i=>{
      i.Used = false;
      let find = this.item.Deductions.find(p=>p.IDProgram== i.Id);
      if(find){
        i.Used = true;
      }
      if(i.IsByPercent == true){
        i.Value = i.Value * this.item.OriginalTotalBeforeDiscount / 100;
        if(i.Value > i.MaxValue){
          i.Value = i.MaxValue;
        }
      }
    })
  }
  changeCode(){
    if(this.Code != ""){
      let date =  new Date();
      date.setHours(0,0,0,0);
      
      let query = {
        Code_eq:this.Code,
        BetweenDate: date,
        Type:"Voucher",
        CanUse: true,
      }
      this.pageProvider.read(query).then(result=>{
        if(result['count']>0)
        {
            this.Voucher = result['data'][0];
            this.Voucher.Used = false;
            let find = this.item.Deductions.find(p=>p.IDProgram== this.Voucher.Id);
            if(find){
              this.Voucher.Used = true;
            }
            if(this.Voucher.IsByPercent == true){
              this.Voucher.Value = this.Voucher.Value * this.item.OriginalTotalBeforeDiscount / 100;
              if(this.Voucher.Value > this.Voucher.MaxValue){
                this.Voucher.Value = this.Voucher.MaxValue;
              }
            }       
        }
        else{
          this.env.showMessage("Mã Voucher không hợp lệ","danger");
        }
      }).catch(err=>{});
    }
  }
  async applyVoucher(line){
    let count = this.item.Deductions.filter(d=>d.Type=="Voucher").length;
    if(count<2){
      
      if(line.NumberOfUsed >= line.NumberOfCoupon){
          this.env.showMessage("Voucher này đã hết lượt sử dụng","danger");
          return false;
      }
      if(line.IsApplyAllCustomer == false){
          const checkContact = await this.checkContact(line)
          if(checkContact == false){
            this.env.showMessage("Khách hàng không nằm trong chính sách giảm giá của Voucher này","danger");
            return false;
          }
      }
      if(line.IsApplyAllProduct == false){   
        const checkitem = await this.checkItem(line);
        if(checkitem == false){
          this.env.showMessage("Đơn hàng của bạn chưa đủ điều kiện để áp dụng voucher này","danger");
          return false;
        }
      }
      if( this.item.OriginalTotalBeforeDiscount < line.MinOrderValue){
          this.env.showMessage("Đơn hàng của bạn chưa đủ điều kiện để áp dụng voucher này","danger");
          return false;
      }
      this.saveApply(line);    
    }
    else{
      this.env.showMessage("Chỉ được áp dụng 2 mã voucher trên 1 đơn hàng", "warning");
    }
   
  }
  saveApply(line){
    let item ={
      IDOrder: this.item.Id,
      Id:0,
      Type:"Voucher",
      Amount:0,
      IDProgram:line.Id,
      OriginalAmount: line.Value,
    }
    line.NumberOfUsed = line.NumberOfUsed + 1;
    this.pageProvider.save(line);
    this.deductionProvider.save(item).then(result=>{
      let deduction = {
        Amount:result['Amount'],
        IDOrder:result['IDOrder'],
        IDOrderLine:null,
        Id:result['Id'],
        IssuedBy:null,
        Type:result['Type'],
        OriginalAmount:result['OriginalAmount'],
        IDProgram:result['IDProgram'],
      }
      this.item.Deductions.push(deduction);
      let totalDeduction = this.item.Deductions?.map(x => x.OriginalAmount).reduce((a, b) => (+a) + (+b), 0);
      let percent = totalDeduction/this.item.OriginalTotalBeforeDiscount * 100;
      this.applyDiscountByOrder(percent);
      this.loadProgram();
    }).catch(err=>{console.log(err)})
  }
  checkContact(line) : Promise<boolean>{
    return this.programPartnerProvider.read({ IDProgram: line.Id, IDPartner: this.item.IDContact, IsDeleted: false }).then(result => {
      if (result['count'] == 0) {
        return false;
      } else {
        return true;
      }
    }).catch(err => { return false; });
   
  }
  checkItem(line) : Promise<boolean>{
    let listItems = this.item.OrderLines.map(i=>i.IDItem);
    return this.programItemProvider.read({IDProgram:line.Id,IDItem:listItems.toString(),IsDeleted:false}).then(result=>{
      if(result['count']==0){
        return false;
      }else{
        return true;
      }
    }).catch(err=>{return false});
  }
  applyDiscountByOrder(percent) {
    let apiPath = {
        method: "POST",
        url: function () { return ApiSetting.apiDomain("SALE/Order/UpdatePosOrderDiscount/") }
    };
    new Promise((resolve, reject) => {
        this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), {Id:this.item.Id,Percent:percent}).toPromise()
        .then((savedItem: any) => {
            this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');   
            resolve(true);  
            this.modalController.dismiss(this.item);         
        })
        .catch(err => {
            this.env.showTranslateMessage('erp.app.pages.pos.pos-order.merge.message.can-not-save','danger');
            reject(err);
        });
    });       
  }
}
