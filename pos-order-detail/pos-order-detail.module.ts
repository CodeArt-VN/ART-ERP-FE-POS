import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { POSOrderDetailPage } from './pos-order-detail.page';
import { PipesModule } from 'src/app/pipes/pipes.module';
import { POSVoucherModalPage } from '../pos-voucher-modal/pos-voucher-modal.page';
import { POSContactModalPage } from '../pos-contact-modal/pos-contact-modal.page';
import { POSInvoiceModalPage } from '../pos-invoice-modal/pos-invoice-modal.page';
import { DeactivateGuard } from './deactivate-guard';
import { ComboModalPage } from './combo-modal/combo-modal.page';
const routes: Routes = [
	{
		path: '',
		component: POSOrderDetailPage,
		canDeactivate: [DeactivateGuard],
	},
];

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, ReactiveFormsModule, ShareModule, PipesModule, RouterModule.forChild(routes)],
	declarations: [POSOrderDetailPage, POSVoucherModalPage, POSContactModalPage, POSInvoiceModalPage, ComboModalPage],
})
export class POSOrderDetailPageModule {}
