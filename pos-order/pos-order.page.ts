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
    tableList = [];
    favItemsList = [];
    checkBillStatus = [111,112];
    checkDebtSplitMergeStatus = [111,112,113,114,115];
    segmentView = 'all';
    orderCounter = 0;
    oldOrderCounter = 0;
    showNewOrders = true;
    menuList;

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
    }

    ionViewWillEnter() {
        setInterval(() => {
            if (this.showNewOrders) {
                this.refresh();
                console.log('Auto refresh at ' + lib.dateFormat(new Date(),'hh:MM'));
            }
        }, 60000);
    }

    preLoadData(event?: any): void {
        this.query.IDType = 293;
        this.query.IDBranch = this.env.selectedBranch;
        if (!this.sort.Id) {
            this.sort.Id = 'Id';
            this.sortToggle('Id', true);
        }
        
        Promise.all([
            this.tableGroupProvider.read({IDBranch: this.env.selectedBranch}),
            this.tableProvider.read({IDBranch: this.env.selectedBranch, Take: 5000}),
        ]).then(values => {
            this.tableGroupList = values[0]['data'];
            this.tableList = values[1]['data'];
            this.tableGroupList.forEach(g => {
                g.TableList = this.tableList.filter(d => d.IDTableGroup == g.Id);
            });
            this.env.setStorage('tableGroup' + this.env.selectedBranch, this.tableGroupList);
        });

        this.menuProvider.read().then(data => {
            this.menuList = data['data'];
            this.menuList.forEach(m => {
                m.Items.sort((a, b) => a['Sort'] - b['Sort']);
                m.menuImage = environment.posImagesServer + m?.Image;
            });
            this.env.setStorage('menuList' + this.env.selectedBranch, this.menuList);
        });

        let query = {
            IDBranch: this.env.selectedBranch,
        }

        let apiPath = {
            method: "GET",
            url: function () { return ApiSetting.apiDomain("POS/Menu/FavouriteItems") }
        };

        this.commonService.connect(apiPath.method, apiPath.url(), query).toPromise().then((data: any) => {
            this.favItemsList = data;
            this.env.setStorage('favItemsList' + this.env.selectedBranch, this.favItemsList);
        }).catch(err => {
            console.log(err);
        });

        super.preLoadData(event);
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        let statusList = [
            {Id: 101, Code:'new', Name: 'Mới'},
            {Id: 106, Code:'picking', Name: 'Đang lên món'},
            {Id: 109, Code:'delivered', Name: 'Đã giao'},
            {Id: 111, Code:'split', Name: 'Đơn đã chia' },
            {Id: 112, Code:'merged', Name: 'Đơn đã gộp' },
            {Id: 114, Code:'done', Name: 'Đã xong'},
            {Id: 115, Code:'cancelled', Name: 'Đã hủy'},
        ];

        this.orderCounter = 0;
        this.oldOrderCounter = 0;
        
        this.items.forEach(o => {
            if(this.checkDebtSplitMergeStatus.indexOf(o.Status.IDStatus) == -1) { // if order is complete/cancel/split/merge >> skip to prevent table showing bug; else continue condition.

                //Update Blinking for Orders Update
                o.NeedPrint = false;
                // if (o?.OrderLines.length != 0) {
                //     o.OrderLines.forEach(e => {
                //         e.Additional = e.Quantity - e.ShippedQuantity;
                //         if (e.Additional > 0) {
                //             o.NeedPrint = true;
                //         }
                //     });
                // }

                o._Tables = [];
                if(!o.Tables) o.Tables = [];

                o.Tables.forEach(t => {
                    let i = null;

                    for (let g of this.tableGroupList) { 
                        for (let gt of g.TableList) { 

                            if (gt.Id == t) {
                                i = gt;
                                o.TableName = gt.Name;

                                if (o.NeedPrint) {
                                    i.NeedPrint = true;
                                }
                                else {
                                    i.NeedPrint = false;
                                }
                            }
                        };
                    };
                    if(i){
                        let checkStatus = [101];
                        if(checkStatus.indexOf(o.Status.IDStatus) >-1){
                            i.Order = o.Id;
                            i.OrderDate = o.OrderDate;
                            i.Status = o.Status;
                            i.Status.Name = this.getAttrib(i.Status.IDStatus, statusList);
                        }
                        else{
                            i.Order = null;
                            i.OrderDate = null;
                            i.Status = null;
                        }
                        o._Tables.push(i);
                    }
                });
                o.isHidden = false;
                this.orderCounter++;
            };
            if(this.checkDebtSplitMergeStatus.indexOf(o.Status.IDStatus) != -1) {
                o._Tables = [];
                if(!o.Tables) o.Tables = [];
                
                o.Tables.forEach(t => {
                    let i = null;

                    for (let g of this.tableGroupList) { 
                        for (let gt of g.TableList) { 

                            if (gt.Id == t) {
                                i = gt;
                                o.TableName = gt.Name;
                            }
                        };
                    };
                    o._Tables.push(i);
                });

                o.isHidden = true;
                this.oldOrderCounter++;
            }
        });
        if (this.showNewOrders) {
            this.items = [...this.items.filter(o => o.isHidden == false)];
        }
        else {
            this.items = [...this.items.filter(o => o.isHidden == true)];
        }
        super.loadedData(event, ignoredFromGroup);
    }

    segmentChanged(ev: any) {
        this.segmentView = ev.detail.value;
    }

    refresh() {
        this.preLoadData();
    }

    async splitPOSBill() {
        if (this.selectedItems.length>0) {
            let IDStatus = this.selectedItems[0].Status.IDStatus;
            if (!(IDStatus == 101 || IDStatus == 102 || IDStatus == 103)) {
                this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-split','warning');
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
        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.Status.IDStatus == 101 || i.Status.IDStatus == 102 || i.Status.IDStatus == 103));
        if (itemsCanNotProcess.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-merge','warning');
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

        if (i && i.Id) {
            this.selectedItems.push(i);
        }
        else{
            this.selectedItems.push(this.items[0])
        }

        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.Status.IDStatus == 101 || i.Status.IDStatus == 102 || i.Status.IDStatus == 103));
        if (itemsCanNotProcess.length) {
            this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.can-not-merge','warning');
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

    search(ev) {
        this.selectedItems = [];
        var val = ev.target.value;
        if (val == undefined) {
            val = '';
        }
        if (val.length > 2 || val == '') {
            // this.query.Keyword = val; //Skip this one
            this.query.Skip = 0;
            this.pageConfig.isEndOfData = false;
            this.loadData('search');
        }
    }

    toggleOrdersHistory() {
        this.showNewOrders =! this.showNewOrders;
        console.log('Toggle View Orders');
        this.preLoadData();
    }

}
