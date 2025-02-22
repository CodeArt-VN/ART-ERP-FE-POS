import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSWorkOrderPage } from './pos-work-order.page';
import { ShareModule } from 'src/app/share.module';
import { PipesModule } from 'src/app/pipes/pipes.module';

@NgModule({
	imports: [IonicModule, CommonModule, FormsModule, ShareModule, PipesModule, RouterModule.forChild([{ path: '', component: POSWorkOrderPage }])],
	declarations: [POSWorkOrderPage],
})
export class POSWorkOrderPageModule {}
