import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ShareModule } from 'src/app/share.module';
import { POSOrderDetailPage } from './pos-order-detail.page';
import { FileUploadModule } from 'ng2-file-upload';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgOptionHighlightModule } from '@ng-select/ng-option-highlight';
import { NgxMaskModule } from 'ngx-mask';
import { PipesModule } from 'src/app/pipes/pipes.module';

const routes: Routes = [
  {
    path: '',
    component: POSOrderDetailPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    FileUploadModule,
    NgSelectModule,
    NgOptionHighlightModule,
    ShareModule,
    PipesModule,
    NgxMaskModule.forRoot(),
    RouterModule.forChild(routes)
  ],
  declarations: [POSOrderDetailPage]
})
export class POSOrderDetailPageModule { }
