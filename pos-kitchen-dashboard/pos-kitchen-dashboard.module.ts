import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSKitchenDashboardPage } from './pos-kitchen-dashboard.page';
import { ShareModule } from 'src/app/share.module';
import { PipesModule } from 'src/app/pipes/pipes.module';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ShareModule,
    PipesModule,
    DragDropModule,
    RouterModule.forChild([{ path: '', component: POSKitchenDashboardPage }])
  ],
  declarations: [POSKitchenDashboardPage]
})
export class POSKitchenDashboardPageModule {}
