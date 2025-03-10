import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { POSCustomerOrderPage } from './pos-customer-order.page';
import { PipesModule } from 'src/app/pipes/pipes.module';
import { POSCustomerMemoModalPage } from '../memo/pos-memo-modal.page';
import { POSForCustomerPaymentModalPage } from '../payment/pos-payment-modal.page';
const routes: Routes = [
	{
		path: '',
		component: POSCustomerOrderPage,
	},
];

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, ReactiveFormsModule, ShareModule, PipesModule, RouterModule.forChild(routes)],
	declarations: [POSCustomerOrderPage, POSCustomerMemoModalPage, POSForCustomerPaymentModalPage],
})
export class POSCustomerOrderPageModule {}
