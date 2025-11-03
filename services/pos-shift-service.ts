import { Injectable } from '@angular/core';
import { POS_CashHandoverProvider, POS_ShiftProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { EnvService } from 'src/app/services/core/env.service';
import { ModalController } from '@ionic/angular';
import { POSShiftDetailPage } from '../pos-shift-detail/pos-shift-detail.page';
import { C } from '@fullcalendar/core/internal-common';

export interface SyncConflictResolution {
}

@Injectable({
  providedIn: 'root'
})
export class POS_ShiftPService {
  pendingShiftList: any[] = [];
  currentShift: any;
  hangoverPendingShifts: any;
  hangoverList: any;
  pageConfig:any = {};
  constructor(
    private shiftProvider: POS_ShiftProvider,
    private env: EnvService,
    private modalController: ModalController
  ) {
    this.env.getEvents().subscribe((data) => {
      if (data && data.Code === 'Refresh') {
        this.initShift();
      }
    });
  }
  initShift() {
    this.loadShift().then(() => {
      if ((!this.currentShift.Id || this.currentShift.IDPreviousClosingStaff!= this.env.user.StaffID)
         && this.pageConfig.canCloseShift  && this.currentShift.Status == 'Unconfirmed' ) {
        this.openShiftModal();
      }
    })
  }
  loadShift() {
    return Promise.all([this.shiftProvider.read({ IDBranch: this.env.selectedBranch, Take: 1, SortBy: 'Id_desc' })
    ]).then((values: any) => {
      if (values[0] && values[0].data && values[0].data.length > 0) {
        this.currentShift = values[0]?.data[0];
      }
      else {
        this.currentShift = {
          IDBranch: this.env.selectedBranch,
          Status: 'Unconfirmed',
        }
      }
    });
  }
  async openShiftModal(i = this.currentShift) {
    this.loadShift().then(async () => {
      const modal = await this.modalController.create({
        component: POSShiftDetailPage,
        componentProps: {
          item: i,
        },
        cssClass: 'modal90',
      });
      await modal.present();
      const { data } = await modal.onWillDismiss();
      if (data) {
        if (data.Role && data.Role == 'Refresh') this.initShift();
        else this.currentShift = data;
      }
    }).catch(async(error) => {
      const modal = await this.modalController.create({
        component: POSShiftDetailPage,
        componentProps: {
          item: i,
        },
        cssClass: 'modal90',
      });
      await modal.present();
      const { data } = await modal.onWillDismiss();
      if (data) {
        if (data.Role && data.Role == 'Refresh') this.initShift();
        else this.currentShift = data;
      }
    }).catch((error) => {
    });

  }

  getFormattedDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
}
