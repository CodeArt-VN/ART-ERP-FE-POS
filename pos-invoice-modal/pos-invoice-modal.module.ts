import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { POSInvoiceModalPage } from './pos-invoice-modal.page';

@NgModule({
	imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, ShareModule],
	declarations: [POSInvoiceModalPage],
	exports: [POSInvoiceModalPage],
})
export class POSInvoiceModalPageModule {}
