import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSWorkOrderDetailPage } from './pos-work-order-detail.page';
import { ShareModule } from 'src/app/share.module';
import { PipesModule } from 'src/app/pipes/pipes.module';

const routes: Routes = [
	{
		path: '',
		component: POSWorkOrderDetailPage,
	},
];

@NgModule({
	imports: [IonicModule, CommonModule, FormsModule, ShareModule, PipesModule, RouterModule.forChild(routes)],
	declarations: [POSWorkOrderDetailPage],
})
export class POSWorkOrderDetailPageModule {}
