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
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import { ModalNotifyComponent } from 'src/app/components/modal-notify/modal-notify.component';

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
    numberOfGuestCounter = 0;
    notifications:any = [];
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
    ngOnInit() {
        this.pageConfig.subscribePOSOrder = this.env.getEvents().subscribe((data) => {         
			switch (data.Code) {
				case 'app:POSOrderFromCustomer':
                    this.notify(data.Data);				
					break;
            }
        });
        this.pageConfig.subscribePOSOrderPaymentUpdate = this.env.getEvents().subscribe((data) => {            
			switch (data.Code) {
				case 'app:POSOrderPaymentUpdate':
					this.notifyPayment(data);
					break;
            }
        })
        super.ngOnInit();
    }
    private notifyPayment(data){
        const value = JSON.parse(data.Value);       
        if(this.env.selectedBranch == value.IDBranch && value.IDStaff == 0){
            let message = "Khách hàng bàn "+ value.TableName+" thanh toán online "+ lib.currencyFormat(value.Amount) +" cho đơn hàng #"+ value.IDSaleOrder;
            let url = "pos-order/"+data.Id+"/"+value.IDTable;
            this.pushNotification(null,value.IDBranch,"pos-order","Khách gọi món","pos-order",message,url);
            this.countNotification();
        }
    }
    private notify(data){  
        const value = JSON.parse(data.value);    
        if(this.env.selectedBranch == value.IDBranch){
            let message = "Khách bàn "+value.TableName+" Gọi món";
            let url = "pos-order/"+data.Id+"/"+value.IDTable;
            this.pushNotification(null,value.IDBranch,"pos-order","Khách gọi món","pos-order",message,url);
            this.countNotification();
        }                
    }
    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrderPaymentUpdate?.unsubscribe(); 
        this.pageConfig?.subscribePOSOrder?.unsubscribe();
        super.ngOnDestroy();
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
        this.numberOfGuestCounter = 0;      
        this.checkTable(null, 0); //reset table status
        this.items.forEach(o => {
            o._Locked = this.noLockStatusList.indexOf(o.Status) == -1;
            o._Status = this.soStatusList.find(d => d.Code == o.Status);
            o._Tables = [];
            if (!o._Locked) {
                this.orderCounter++ ;
                this.numberOfGuestCounter = this.numberOfGuestCounter + o.NumberOfGuests;
            }


            if (!o.Tables) o.Tables = [];
            o.Tables.forEach(tid => {
                this.checkTable(o, tid);
            });
        });

        super.loadedData(event);
        this.items.forEach(o=>{
            if(o.Status=='New'){
                let message = "Đơn hàng "+o.Id+" có sản phẩm chưa gửi bếp";
                let url = "pos-order/"+o.Id+"/"+o.Tables[0];
                this.pushNotification(null,o.IDBranch,"pos-order","chưa gửi bếp","pos-order",message,url);
            }
            
        })
        this.countNotification();
    }

    checkTable(o, tid) {       
        for (let g of this.tableGroupList) {
            for (let t of g.TableList) {
                if (!o && !tid)
                    t._Orders = [];

                if (t.Id == tid) {
                    o._Tables.push(t);

                    if (!o._Locked) {
                        let order = {
                            _Status: o._Status,
                            Id: o.Id,
                            OrderDate: o.OrderDate,
                            NumberOfGuests: o.NumberOfGuests,
                            CalcTotalOriginal: o.CalcTotalOriginal,
                            Order: o
                        };
                        t._Orders.push(order);
                    }
                }
            };
        };
    }

    // nav('/pos-order/'+od.Id+'/'+t.Id,'back')

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

    async openCancellationReason() {
        if (this.submitAttempt) return;

        const modal = await this.modalController.create({
            component: POSCancelModalPage,
            id: 'POSCancelModalPage',
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-cancellation-reason',
            componentProps: { item: {} }
        });
        modal.present();

        const { data, role } = await modal.onWillDismiss();

        if (role == 'confirm') {
            let cancelData: any = { Code: data.Code };
            if (cancelData.Code == 'Other') {
                cancelData.Remark = data.CancelNote
            }

            this.env.showPrompt('Bạn chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng').then(_ => {
                let publishEventCode = this.pageConfig.pageName;
                if (this.submitAttempt == false) {
                    this.submitAttempt = true;
                    cancelData.Type = 'POSOrder';
                    cancelData.Ids = this.selectedItems.map(m => m.Id);
                    this.pageProvider.commonService.connect('POST', 'SALE/Order/CancelOrders/', cancelData).toPromise()
                        .then(() => {
                            if (publishEventCode) {
                                this.env.publishEvent({ Code: publishEventCode });
                            }
                            this.loadData();
                            this.submitAttempt = false;
                            this.nav('/pos-order', 'back');
                        }).catch(err => {
                            this.submitAttempt = false;
                        });
                }
            }).catch(_ => { });
        }
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
    async showNotify(){
        const modal = await this.modalController.create({
            component: ModalNotifyComponent,
            id: 'ModalNotify',
            canDismiss: true,
            backdropDismiss: true,
            cssClass: 'modal-notify',
            componentProps: {     
                notifications:this.notifications       
            }
        });
        
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
    }
    countNotification(){
        this.pageConfig.countNotifications = this.notifications.length;
    }
    pushNotification(Id?:number,IDBranch?:string,Type?:string,Name?:string,Code?:string,Message?:string,Url?:string){
        let notification = {
            Id:Id,
            IDBranch:IDBranch,
            Type:Type,
            Name:Name,
            Code:Code,
            Message:Message,
            Url:Url,
        }
        this.notifications.unshift(notification); 
    }
}
