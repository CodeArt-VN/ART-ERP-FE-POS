import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PosPaymentPageRoutingModule } from './pos-payment-routing.module';

import { PosPaymentPage } from './pos-payment.page';
import { ShareModule } from 'src/app/share.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ShareModule,
    PosPaymentPageRoutingModule
  ],
  declarations: [PosPaymentPage]
})
export class PosPaymentPageModule {}
