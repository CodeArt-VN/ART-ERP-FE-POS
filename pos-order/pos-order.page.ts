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
import { POSNotifyModalPage } from 'src/app/modals/pos-notify-modal/pos-notify-modal.page';

@Component({
    selector: 'app-pos-order',
    templateUrl: 'pos-order.page.html',
    styleUrls: ['pos-order.page.scss']
})
export class POSOrderPage extends PageBase {
    tableGroupList = [];
    soStatusList = [];
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered'];//NewConfirmedScheduledPickingDeliveredSplittedMergedDebtDoneCancelled
    segmentView = 'all';
    orderCounter = 0;
    numberOfGuestCounter = 0;
    notifications = [];
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
    }
    ngOnInit() {
        this.pageConfig.subscribePOSOrder = this.env.getEvents().subscribe((data) => {         
			switch (data.Code) {
				case 'app:POSOrderFromCustomer':
                    this.notifyOrder(data.Data);				
					break;
                case 'app:POSOrderPaymentUpdate':
                    this.notifyPayment(data);
                    break;
                case 'app:POSSupport':
                    this.notifySupport(data.Data);
                    break;
                case 'app:POSCallToPay':
                    this.notifyCallToPay(data.Data);
                    break;
                case 'app:POSLockOrder':
                    this.notifyLockOrder(data.Data);
                    break;
                case 'app:POSUnlockOrder':
                    this.notifyUnlockOrder(data.Data);
                    break;
            }
        });
        
        super.ngOnInit();
    }
    private notifyPayment(data){
        const value = JSON.parse(data.Value);    
        if(this.env.selectedBranch == value.IDBranch && value.IDStaff == 0){
            this.playAudio("Payment");
            
            let message = "Khách hàng bàn "+ value.TableName+" thanh toán online "+ lib.currencyFormat(value.Amount) +" cho đơn hàng #"+ value.IDSaleOrder;
            this.env.showMessage(message,"warning");
            let url = "pos-order/"+value.IDSaleOrder+"/"+value.IDTable;
                      
            this.setStorageNotification(null,value.IDBranch,value.IDSaleOrder,"Payment","Thanh toán","pos-order",message,url);
        }
    }
    private notifyOrder(data){  
        const value = JSON.parse(data.value);  
        console.log(value);  
        if(this.env.selectedBranch == value.IDBranch){
            this.playAudio("Order");
            let message = "Khách bàn "+value.Tables[0].TableName+" Gọi món";
            this.env.showMessage(message,"warning");
            let url = "pos-order/"+data.id+"/"+value.Tables[0].IDTable;
            
            this.setStorageNotification(null,value.IDBranch,data.id,"Order","Đơn hàng","pos-order",message,url);
            this.refresh();
        }                
    }
    private notifySupport(data){
        if(this.env.selectedBranch == data.name){
            this.playAudio("Support");       
            this.env.showMessage(data.value,"warning");
            this.setStorageNotification(null,null,null,"Support","Yêu cầu phục vụ","pos-order",data.value,null);
            this.refresh();
        }
    }

    private notifyCallToPay(data){
        // const value = JSON.parse(data.value);

        if(this.env.selectedBranch == data.name){
            this.playAudio("Support");       
            this.env.showMessage(data.value,"warning");
            // let url = "pos-order/"+data.id+"/"+value.Tables[0].IDTable;

            this.setStorageNotification(null,null,null,"Support","Yêu cầu tính tiền","pos-order",data.value,null);
            this.refresh();
        }
    }

    private notifyLockOrder(data){
        const value = JSON.parse(data.value);  
        console.log(value);  

        if(this.env.selectedBranch == value.IDBranch){
            this.playAudio("Support");
            let message = "Khách bàn "+value.Tables[0].TableName+" đã khóa đơn";
            this.env.showMessage(message,"warning");
            let url = "pos-order/"+data.id+"/"+value.Tables[0].IDTable;
            
            this.setStorageNotification(null,value.IDBranch,data.id,"Support","Khóa đơn hàng","pos-order",message,url);
            this.refresh();
        }     
    }

    private notifyUnlockOrder(data){
        const value = JSON.parse(data.value);  
        console.log(value);  

        if(this.env.selectedBranch == value.IDBranch){
            this.playAudio("Support");
            let message = "Khách bàn "+value.Tables[0].TableName+" đã mở đơn";
            this.env.showMessage(message,"warning");
            let url = "pos-order/"+data.id+"/"+value.Tables[0].IDTable;
            
            this.setStorageNotification(null,value.IDBranch,data.id,"Support","Mở khóa đơn hàng","pos-order",message,url);
            this.refresh();
        }     
    }

    private playAudio(type){
        let audio = new Audio();
        if(type=="Order"){
            audio.src = "assets/audio/audio-order.wav";
        }
        if(type=="Payment"){
            audio.src = "assets/audio/audio-payment.wav";
        }
        if(type=="Support"){
            audio.src = "assets/audio/audio-support.wav";
        }
        audio.load();
        audio.play();
    }
    
    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrder?.unsubscribe();
        super.ngOnDestroy();
    }
    preLoadData(event?: any): void {
        
        let forceReload = event === 'force';
        this.query.Type = 'POSOrder';
        this.query.Status = JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']);

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
            o._Locked = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'].indexOf(o.Status) == -1;
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
        this.env.getStorage('Notifications').then(result=>{
            if(result?.length>0){
                this.notifications = result;
            }
            else{
                if(this.items.filter(o=>o.Status=='New').length > 0){
                    this.setNotifications(this.items.filter(o=>o.Status=='New'));
                }
            }
        });
        
        
        
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
                            Debt: o.Debt,
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
            this.query.Status = (this.query.Status == '' ? JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']) : '');
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
                this.env.showTranslateMessage('Your selected order cannot be split. Please choose draft, new, pending for approval or disaaproved order', 'warning');
                return;
            }
        }

        const modal = await this.modalController.create({
            component: POSSplitModalPage,
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
            this.env.showTranslateMessage('Your selected invoices cannot be combined. Please select new or disapproved invoice', 'warning');
            return;
        }

        const modal = await this.modalController.create({
            component: POSMergeModalPage,
            
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
            this.env.showTranslateMessage('Your selected invoices cannot be combined. Please select new or disapproved invoice', 'warning');
            return;
        }

        const modal = await this.modalController.create({
            component: POSChangeTableModalPage,
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

    async openCancellationReason(order = null) {
        if (this.submitAttempt) return;

        if (order) {
            this.selectedItems = [order];
        }

        const modal = await this.modalController.create({
            component: POSCancelModalPage,
            id: 'POSCancelModalPage',            
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
                            this.nav('/pos-order', 'forward');
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
            component: POSNotifyModalPage,
            canDismiss: true,
            backdropDismiss: true,
            cssClass: 'modal-notify',
            componentProps: {     
                item: this.notifications,       
            }
        });
        
        await modal.present();
        const { data, role } = await modal.onWillDismiss();
        if(data){
            this.notifications = data;
        }
    }
    setNotifications(items){
        if(items.length>0){
            items.forEach(o=>{
                let message = "Đơn hàng "+o.Id+" có sản phẩm chưa gửi bếp";
                let url = "pos-order/"+o.Id+"/"+o.Tables[0];
                this.setStorageNotification(null,o.IDBranch,o.Id,"Order","Đơn hàng","pos-order",message,url);
            })
        }
    }
    async setStorageNotification(Id,IDBranch,IDSaleOrder,Type,Name,Code,Message,Url){
        let notification = {
            Id:Id,
            IDBranch:IDBranch,
            IDSaleOrder:IDSaleOrder,
            Type:Type,
            Name:Name,
            Code:Code,
            Message:Message,
            Url:Url,
            Watched:false,
        }
        const notifications = await this.env.getStorage('Notifications').then(result=>{
            if(result){return result}else{return []}
        });
        notifications.unshift(notification);
        this.env.setStorage('Notifications',notifications);
        this.notifications.unshift(notification);
    }

    exportPOSData() {
        let query = {
            IDBranch: this.query.IDBranch,
            Type: this.query.Type,
            Keyword: this.query.Keyword
        };
        this.loadingController.create({
            cssClass: 'my-custom-class',
            message: 'Đang tạo bảng kê, xin vui lòng chờ giây lát...'
        }).then(loading => {
            loading.present();
            this.commonService.connect("GET", "SALE/Order/ExportPOSOrderList", query).toPromise().then((response: any) => {
                this.submitAttempt = false;
                if (loading) loading.dismiss();
                this.downloadURLContent(ApiSetting.mainService.base + response);
            }).catch(err => {
				if (err.message != null) {
					this.env.showMessage(err.message, 'danger');
				}
				else {
					this.env.showTranslateMessage('erp.app.pages.bi.sales-report.message.can-not-get-data','danger');
				}
                this.submitAttempt = false;
                if (loading) loading.dismiss();
                this.refresh();
            });

        });
    }
}
