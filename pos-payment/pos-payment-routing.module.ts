import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PosPaymentPage } from './pos-payment.page';

const routes: Routes = [
  {
    path: '',
    component: PosPaymentPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PosPaymentPageRoutingModule {}
