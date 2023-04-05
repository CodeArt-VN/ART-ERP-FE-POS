import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { POS_BillTableProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { POSSplitModalPage } from '../pos-split-modal/pos-split-modal.page';
import { POSMergeModalPage } from '../pos-merge-modal/pos-merge-modal.page';
import { Location } from '@angular/common';
import { POSChangeTableModalPage } from '../pos-change-table-modal/pos-change-table-modal.page';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-pos-order',
    templateUrl: 'pos-order.page.html',
    styleUrls: ['pos-order.page.scss']
})
export class POSOrderPage extends PageBase {
    tableGroupList = [];
    soStatusList = [];
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered',];//NewConfirmedScheduledPickingDeliveredSplittedMergedDebtDoneCancelled
    segmentView = 'all';
    orderCounter = 0;

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
        public commonService: CommonService,
    ) {
        super();
        this.pageConfig.isShowFeature = true;
        this.pageConfig.canMerge = true;
        this.pageConfig.canSplit = true;
        this.pageConfig.canChangeTable = true;
        this.pageConfig.canImport = false;
        this.pageConfig.canExport = false;
        this.env.getEvents().subscribe((data) => {
			console.log(data);
        })
    }

    preLoadData(event?: any): void {
        let forceReload = event === 'force';
        this.query.Type = 'POSOrder';
        this.query.Status = JSON.stringify(this.noLockStatusList);

        this.query.IDBranch = this.env.selectedBranch;

        if (!this.sort.Id) {
            this.sort.Id = 'Id';
            this.sortToggle('Id', true);
        }

        Promise.all([
            this.getTableGroupTree(forceReload),
            this.env.getStatus('POSOrder'),
        ]).then((values: any) => {
            this.tableGroupList = values[0];
            this.soStatusList = values[1];
            super.preLoadData(event);
        })

    }

    loadedData(event?: any): void {
        this.orderCounter = 0;
        this.checkTable(null, 0); //reset table status

        this.items.forEach(o => {
            o._Locked = this.noLockStatusList.indexOf(o.Status) == -1;
            o._Status = this.soStatusList.find(d => d.Code == o.Status);
            o._Tables = [];

            if (!o._Locked) this.orderCounter++;


            if (!o.Tables) o.Tables = [];
            o.Tables.forEach(tid => {
                this.checkTable(o, tid);
            });
        });

        super.loadedData(event);
    }

    checkTable(o, tid) {
        for (let g of this.tableGroupList) {
            for (let t of g.TableList) {
                if (!o && !tid)
                    t._Order = null;

                if (t.Id == tid) {
                    o._Tables.push(t);

                    if (!o._Locked)
                        t._Order = {
                            _Status: o._Status,
                            Id: o.Id,
                            OrderDate: o.OrderDate
                        }

                }
            };
        };
    }

    filter(type = null) {
        
        if (type == 'search') {
            this.selectedItems = [];
            if (this.query.Id?.length > 2 || !this.query.Id) {
                this.query.Skip = 0;
                this.pageConfig.isEndOfData = false;
                this.loadData('search');
            }
        }
        else{
            this.query.Status = (this.query.Status == '' ? JSON.stringify(this.noLockStatusList) : '');
            super.refresh();
        }

    }

    refresh(event?: any): void {
        if (event === true) {
            this.preLoadData('force');
        }
        else{
            super.refresh();
        }
    }

    segmentChanged(ev: any) {
        this.segmentView = ev.detail.value;
    }

    async splitPOSBill() {
        if (this.selectedItems.length > 0) {
            
            if (this.noLockStatusList.indexOf(this.selectedItems[0].Status) == -1) {
                this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-split', 'warning');
                return;
            }
        }

        const modal = await this.modalController.create({
            component: POSSplitModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal90',
            componentProps: {
                'selectedOrder': this.selectedItems[0],
                'orders': this.items,
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.selectedItems = [];
        this.refresh();
    }

    async mergePOSBills() {
        let itemsCanNotProcess = this.selectedItems.filter(i => this.noLockStatusList.indexOf(i.Status) ==-1 );
        if (itemsCanNotProcess.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-merge', 'warning');
            return;
        }

        const modal = await this.modalController.create({
            component: POSMergeModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-merge-orders',
            componentProps: {
                'selectedOrders': this.selectedItems
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.selectedItems = [];
        this.refresh();
    }

    async changeTable(i) {
        console.log('changeTable');
        
        if (i && i.Id) {
            this.selectedItems.push(i);
        }
        let itemsCanNotProcess = this.selectedItems.filter(i => this.noLockStatusList.indexOf(i.Status) ==-1 );
        if (itemsCanNotProcess.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-merge', 'warning');
            return;
        }

        const modal = await this.modalController.create({
            component: POSChangeTableModalPage,
            swipeToClose: false,
            backdropDismiss: false,
            cssClass: 'modal-change-table',
            componentProps: {
                'selectedOrder': this.selectedItems[0],
                'orders': this.items
            }
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();

        this.selectedItems = [];
        this.refresh();

    }

    interval = null;
    ionViewDidEnter() {

        if (!this.interval) {
            this.interval = setInterval(() => {
                //this.refresh();
            }, 15000);
        }
    }

    ionViewWillLeave() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private getTableGroupTree(forceReload) {
        return new Promise((resolve, reject) => {
            this.env.getStorage('tableGroup' + this.env.selectedBranch).then(data => {
                if (!forceReload && data) {
                    resolve(data);
                }
                else {
                    let query = { IDBranch: this.env.selectedBranch };
                    Promise.all([
                        this.tableGroupProvider.read(query),
                        this.tableProvider.read(query),
                    ]).then(values => {
                        let tableGroupList = values[0]['data'];
                        let tableList = values[1]['data'];

                        tableGroupList.forEach(g => {
                            g.TableList = tableList.filter(d => d.IDTableGroup == g.Id);
                        });
                        this.env.setStorage('tableGroup' + this.env.selectedBranch, tableGroupList);
                        resolve(tableGroupList);
                    }).catch(err => {
                        reject(err);
                    });
                }
            }).catch(err => {
                reject(err);
            });;
        })
    }
}
