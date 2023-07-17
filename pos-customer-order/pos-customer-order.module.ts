import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { POSCustomerOrderPage } from './pos-customer-order.page';
import { FileUploadModule } from 'ng2-file-upload';
import { PipesModule } from 'src/app/pipes/pipes.module';

const routes: Routes = [
  {
    path: '',
    component: POSCustomerOrderPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    FileUploadModule,
    ShareModule,
    PipesModule,
    RouterModule.forChild(routes)
  ],
  declarations: [POSCustomerOrderPage]
})
export class POSCustomerOrderPageModule { }
