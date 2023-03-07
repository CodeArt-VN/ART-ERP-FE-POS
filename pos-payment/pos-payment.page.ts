import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController, NavController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { lib } from 'src/app/services/static/global-functions';
import { BANK_IncomingPaymentProvider, BRA_BranchProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-pos-payment',
  templateUrl: './pos-payment.page.html',
  styleUrls: ['./pos-payment.page.scss'],
})
export class PosPaymentPage extends PageBase {
  statusList;
  constructor
  (
      public pageProvider: BANK_IncomingPaymentProvider,
      public branchProvider: BRA_BranchProvider,
      public modalController: ModalController,
      public popoverCtrl: PopoverController,
      public alertCtrl: AlertController,
      public loadingController: LoadingController,
      public env: EnvService,
      public navCtrl: NavController
  ) 
  {
      super();
  }
  preLoadData(event) {
    this.env.getStatus('PAYMENT').then(data => {this.statusList = data});
    super.preLoadData(event);
}
  loadedData(event) {
    this.items.forEach(i => {
        i.Amount = lib.currencyFormat(i.Amount);
        i.CreatedDateText = lib.dateFormat(i.CreatedDate, 'dd/mm/yyyy');
        i.CreatedTimeText = lib.dateFormat(i.CreatedDate, 'hh:MM:ss');
        //i.StatusText = this.statusList.filter();
        i.StatusText = lib.getAttrib(i.Status, this.statusList, 'Name', '--', 'Code');
        i.StatusColor = lib.getAttrib(i.Status, this.statusList, 'Color', 'dark', 'Code');
    });
    super.loadedData(event);
  }
}
