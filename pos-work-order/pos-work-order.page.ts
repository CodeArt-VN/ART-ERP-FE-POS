import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import {
  POS_BillTableProvider,
  POS_MenuProvider,
  POS_TableGroupProvider,
  POS_TableProvider,
  SALE_OrderProvider,
} from 'src/app/services/static/services.service';
import { Location } from '@angular/common';

@Component({
    selector: 'app-pos-work-order',
    templateUrl: 'pos-work-order.page.html',
    styleUrls: ['pos-work-order.page.scss'],
    standalone: false
})
export class POSWorkOrderPage extends PageBase {
  tableGroupList = [];
  tableList = [];
  statusList = [];

  segmentView = 'all';

  constructor(
    public pageProvider: SALE_OrderProvider,
    public tableGroupProvider: POS_TableGroupProvider,
    public tableProvider: POS_TableProvider,
    public menuProvider: POS_MenuProvider,
    public modalController: ModalController,
    public popoverCtrl: PopoverController,
    public alertCtrl: AlertController,
    public loadingController: LoadingController,
    public env: EnvService,
    public navCtrl: NavController,
    public location: Location,
  ) {
    super();
    this.pageConfig.ShowFeature = true;
  }

  preLoadData(event?: any): void {
    this.query.IDType = 293;
    Promise.all([
      this.tableGroupProvider.read(),
      this.tableProvider.read({ Take: 5000 }),
      this.env.getStatus('POSOrder'),
    ]).then((values) => {
      this.tableGroupList = values[0]['data'];
      this.tableList = values[1]['data'];
      this.statusList = values[2]['data'];
      this.tableGroupList.forEach((g) => {
        g.TableList = this.tableList.filter((d) => d.IDTableGroup == g.Id);
      });
      this.env.setStorage('tableGroup' + this.env.selectedBranch, this.tableGroupList);
    });

    this.menuProvider.read().then((data) => {
      this.env.setStorage('menuList' + this.env.selectedBranch, data['data']);
    });

    super.preLoadData(event);
  }

  loadedData(event?: any, ignoredFromGroup?: boolean): void {
    this.items.forEach((o) => {
      o._Tables = [];
      o.Tables.forEach((t) => {
        let i = null;
        this.tableGroupList.some((g) => {
          g.TableList.some((gt) => {
            if (gt.Id == t) {
              i = gt;
              return true;
            }
          });
          if (i) return true;
        });
        if (i) {
          let checkStatus = ['New', 'Picking', 'Delivered'];
          if (checkStatus.indexOf(o.Status.Status) > -1) {
            i.Order = o.Id;
            i.OrderDate = o.OrderDate;
            i.Status = o.Status;
            i.Status.Name = this.getAttrib(i.Status.Status, this.statusList);
          } else {
            i.Order = null;
            i.OrderDate = null;
            i.Status = null;
          }
          o._Tables.push(i);
        }
      });
    });
    super.loadedData(event, ignoredFromGroup);
  }

  segmentChanged(ev: any) {
    this.segmentView = ev.detail.value;
  }
}
