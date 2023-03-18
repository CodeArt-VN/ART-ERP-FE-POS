import { Component, Input } from '@angular/core';
import { LoadingController, ModalController } from '@ionic/angular';
import { Subject, of ,concat} from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_BusinessPartnerProvider } from 'src/app/services/custom.service';
import { CRM_ContactProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-pos-invoice-modal',
  templateUrl: './pos-invoice-modal.page.html',
  styleUrls: ['./pos-invoice-modal.page.scss'],
})
export class POSInvoiceModalPage extends PageBase {
  @Input() Customer;
  constructor(
    public pageProvider: CRM_ContactProvider,
    public posContactProvider: CRM_BusinessPartnerProvider,
    public modalController: ModalController,
    public env: EnvService,
    public loadingController: LoadingController,
  ) { 
    super();
    this.pageConfig.isDetailPage = true;

  }
  loadData(event) {
    super.loadData(event);
    console.log(this.Customer);
  }
  searchTaxCode(event){
    console.log(event.target.value);
    let query: any = {
      TaxCode : event.target.value
    }  
    this.pageProvider.search(query).toPromise().then(data=>{
      
      this.Customer.Code = data[0]?.TaxCode;
    });
  }
  applyInvoice(apply = false){
    if (apply) {     
      //this.voucherCalc();    
      this.modalController.dismiss(this.item);         
      //this.modalController.dismiss([this.item.TotalDiscount, this.contactSelected, apply, this.item, this.DiscountList]);
    }
    else {
        this.modalController.dismiss();
        //this.modalController.dismiss([null, this.contactSelected, apply, this.item, this.DiscountList]);
    }
  }
}
