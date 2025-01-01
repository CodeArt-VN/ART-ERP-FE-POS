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
  SYS_ConfigProvider,
} from 'src/app/services/static/services.service';
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
    styleUrls: ['pos-order.page.scss'],
    standalone: false
})
export class POSOrderPage extends PageBase {
  tableGroupList = [];
  soStatusList = [];
  noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered']; //NewConfirmedScheduledPickingDeliveredSplittedMergedDebtDoneCancelled
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
    public sysConfigProvider: SYS_ConfigProvider,
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
  }
  ngOnInit() {
    this.pageConfig.subscribePOSOrder = this.env.getEvents().subscribe((data) => {
      switch (data.code) {
        case 'app:POSOrderFromCustomer':
          this.notifyOrder(data);
          break;
        case 'app:POSOrderPaymentUpdate':
          this.notifyPayment(data);
          break;
        case 'app:POSSupport':
          this.notifySupport(data);
          break;
        case 'app:POSCallToPay':
          this.notifyCallToPay(data);
          break;
        case 'app:POSLockOrderFromStaff':
          this.notifyLockOrderFromStaff(data);
          break;
        case 'app:POSLockOrderFromCustomer':
          this.notifyLockOrderFromCustomer(data);
          break;
        case 'app:POSUnlockOrderFromStaff':
          this.notifyUnlockOrderFromStaff(data);
          break;
        case 'app:POSUnlockOrderFromCustomer':
          this.notifyUnlockOrderFromCustomer(data);
          break;
        case 'app:POSOrderSplittedFromStaff':
          this.notifySplittedOrderFromStaff(data);
          break;
        case 'app:POSOrderMergedFromStaff':
          this.notifyMergedOrderFromStaff(data);
          break;
      }
    });

    super.ngOnInit();
  }
  private notifyPayment(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch && value.IDStaff == 0) {
      this.playAudio('Payment');

      let message =
        'Khách hàng bàn ' +
        value.TableName +
        ' thanh toán online ' +
        lib.currencyFormat(value.Amount) +
        ' cho đơn hàng #' +
        value.IDSaleOrder;
      this.env.showMessage(message, 'warning');
      let url = 'pos-order/' + value.IDSaleOrder + '/' + value.IDTable;

      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: value.IDSaleOrder,
        Type:'Payment',
        Name: 'Thanh toán',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
    }
  }
  private notifyOrder(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Order');
      let message = 'Khách bàn ' + value.Tables[0].TableName + ' Gọi món';
      this.env.showMessage(message, 'warning');
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Order',
        Name: 'Đơn hàng',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
      this.refresh();
    }
  }

  private notifySupport(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Support');
      let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu phục vụ';
      this.env.showMessage(message, 'warning');
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name:'Yêu cầu phục vụ',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
      this.refresh();
    }
  }

  private notifyCallToPay(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Support');
      let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu tính tiền';
      this.env.showMessage(message, 'warning');
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name:'Yêu cầu tính tiền',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
      this.refresh();
    }
  }

  private notifyLockOrderFromStaff(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Order');
      let message = 'Nhân viên đã khóa đơn bàn ' + value.Tables[0].TableName;
      this.env.showMessage("Nhân viên đã khóa đơn bàn {{value}}", 'warning',value.Tables[0].TableName);
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name:'Khóa đơn hàng',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
      this.refresh();
    }
  }

  private notifyLockOrderFromCustomer(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Order');
      let message = 'Khách bàn ' + value.Tables[0].TableName + ' đã khóa đơn';
      this.env.showMessage("Khách bàn {{value}} đã khóa đơn", 'warning',value.Tables[0].TableName );
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name:'Khóa đơn hàng',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
      this.refresh();
    }
  }

  private notifyUnlockOrderFromStaff(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Order');
      let message = 'Nhân viên đã mở đơn bàn ' + value.Tables[0].TableName;
      this.env.showMessage("Nhân viên đã mở đơn bàn {{value}}", 'warning',value.Tables[0].TableName);
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name: 'Mở khóa đơn hàng',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
      this.refresh();
    }
  }

  private notifyUnlockOrderFromCustomer(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Order');
      let message = 'Khách bàn ' + value.Tables[0].TableName + ' đã mở đơn';
      this.env.showMessage('Khách bàn {{value}} đã mở đơn', 'warning',value.Tables[0].TableName);
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

        
      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name: 'Mở khóa đơn hàng',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)
      this.refresh();
    }
  }

  private notifySplittedOrderFromStaff(data) {
    const value = JSON.parse(data.value);
    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Order');
      let message = 'Nhân viên đã chia đơn bàn ' + value.Tables[0].TableName;
      this.env.showMessage('Nhân viên đã chia đơn bàn {{value}}', 'warning',value.Tables[0].TableName);
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

      
      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name: 'Chia đơn hàng',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)

      this.refresh();
    }
  }

  private notifyMergedOrderFromStaff(data) {
    const value = JSON.parse(data.value);
    console.log(value);

    if (this.env.selectedBranch == value.IDBranch) {
      this.playAudio('Order');
      let message = 'Nhân viên đã gộp đơn bàn ' + value.Tables[0].TableName;
      this.env.showMessage('Nhân viên đã gộp đơn bàn {{value}}', 'warning',value.Tables[0].TableName);
      let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

     
      let notification = {
        Id: null,
        IDBranch: value.IDBranch,
        IDSaleOrder: data.id,
        Type:'Support',
        Name:  'Gộp đơn hàng',
        Code: 'pos-order',
        Message: message,
        Url: url,
      };
      this.setNotifications(notification,true)

      this.refresh();
    }
  }

  private playAudio(type) {
    let audio = new Audio();
    if (type == 'Order') {
      audio.src = this.pageConfig.systemConfig['POSAudioOrderUpdate'];
    } else if (type == 'CallToPay') {
      audio.src = this.pageConfig.systemConfig['POSAudioCallToPay'];
    } else if (type == 'Payment') {
      audio.src = this.pageConfig.systemConfig['POSAudioIncomingPayment'];
    } else if (type == 'Support') {
      audio.src = this.pageConfig.systemConfig['POSAudioCallStaff'];
    }
    if (audio.src) {
      audio.load();
      audio.play();
    }
  }

  ngOnDestroy() {
    this.pageConfig?.subscribePOSOrder?.unsubscribe();
    super.ngOnDestroy();
  }
  preLoadData(event?: any): void {
    let sysConfigQuery = ['POSAudioCallStaff', 'POSAudioCallToPay', 'POSAudioOrderUpdate', 'POSAudioIncomingPayment'];
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
      this.sysConfigProvider.read({
        Code_in: sysConfigQuery,
        IDBranch: this.env.selectedBranch,
      }),
    ]).then((values: any) => {
      this.tableGroupList = values[0];
      this.soStatusList = values[1];
      this.pageConfig.systemConfig = {};
      values[2]['data'].forEach((e) => {
        if ((e.Value == null || e.Value == 'null') && e._InheritedConfig) {
          e.Value = e._InheritedConfig.Value;
        }
        this.pageConfig.systemConfig[e.Code] = JSON.parse(e.Value);
      });
      super.preLoadData(event);
    });
  }

  loadedData(event?: any): void {
    this.orderCounter = 0;
    this.numberOfGuestCounter = 0;
    this.checkTable(null, 0); //reset table status
    this.items.forEach((o) => {
      o._Locked = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'].indexOf(o.Status) == -1;
      o._Status = this.soStatusList.find((d) => d.Code == o.Status);
      o._Tables = [];
      if (!o._Locked) {
        this.orderCounter++;
        this.numberOfGuestCounter = this.numberOfGuestCounter + o.NumberOfGuests;
      }

      if (!o.Tables) o.Tables = [];
      o.Tables.forEach((tid) => {
        this.checkTable(o, tid);
      });
    });

    super.loadedData(event);
    this.env.getStorage('Notifications').then((result) => {
      if (result?.length > 0) {
        this.notifications = result.filter((n) => !n.Watched && n.IDBranch == this.env.selectedBranch);
      }
    });
    this.CheckPOSNewOrderLines();
  }

  private CheckPOSNewOrderLines() {
    this.pageProvider.commonService
      .connect('GET', 'SALE/Order/CheckPOSNewOrderLines/', this.query)
      .toPromise()
      .then(async (results: any) => {
        if (results) {
          let orderNotification = this.notifications.filter(d=> !results.map(s=>s.Id).includes(d.IDSaleOrder) && d.Type == 'Order' && d.Code == 'pos-order');
          orderNotification.forEach(o => {
            let index = this.notifications.indexOf(o);
            this.notifications.splice(index, 1);
          });
          await results.forEach(async (r) => {// kiểm tra noti cũ có số order line chưa gửi bếp khác với DB thì update
            let oldNotis = this.notifications.filter((n) => n.IDSaleOrder == r.Id && n.Type == 'Order' && n.Code == 'pos-order');
           await oldNotis.forEach(async (oldNoti) => {
              if(oldNoti.NewOrderLineCount != r.NewOrderLineCount){
                let index = this.notifications.indexOf(oldNoti);
                this.notifications.splice(index, 1);
              }
            });
            
          }
        );
          this.setNotifiOrder(results);
        }
      })
      .catch((err) => {
        if (err.message != null) {
          this.env.showMessage(err.message, 'danger');
        }
      });
  }

  checkTable(o, tid) {
    for (let g of this.tableGroupList) {
      for (let t of g.TableList) {
        if (!o && !tid) t._Orders = [];

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
              Order: o,
            };
            t._Orders.push(order);
          }
        }
      }
    }
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
    } else {
      this.query.Status =
        this.query.Status == ''
          ? JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'])
          : '';
      super.refresh();
    }
  }

  refresh(event?: any): void {
    if (event === true) {
      this.preLoadData('force');
    } else {
      super.refresh();
    }
  }

  segmentChanged(ev: any) {
    this.segmentView = ev.detail.value;
  }

  async splitPOSBill() {
    if (this.selectedItems.length > 0) {
      if (this.noLockStatusList.indexOf(this.selectedItems[0].Status) == -1) {
        this.env.showMessage(
          'Your selected order cannot be split. Please choose draft, new, pending for approval or disaaproved order',
          'warning',
        );
        return;
      }
    }

    const modal = await this.modalController.create({
      component: POSSplitModalPage,
      backdropDismiss: false,
      cssClass: 'modal90',
      componentProps: {
        selectedOrder: this.selectedItems[0],
        orders: this.items,
      },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();

    this.selectedItems = [];
    this.refresh();
  }

  async mergePOSBills() {
    let itemsCanNotProcess = this.selectedItems.filter((i) => this.noLockStatusList.indexOf(i.Status) == -1);
    if (itemsCanNotProcess.length) {
      this.env.showMessage(
        'Your selected invoices cannot be combined. Please select new or disapproved invoice',
        'warning',
      );
      return;
    }

    const modal = await this.modalController.create({
      component: POSMergeModalPage,

      backdropDismiss: false,
      cssClass: 'modal-merge-orders',
      componentProps: {
        selectedOrders: this.selectedItems,
      },
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
    let itemsCanNotProcess = this.selectedItems.filter((i) => this.noLockStatusList.indexOf(i.Status) == -1);
    if (itemsCanNotProcess.length) {
      this.env.showMessage(
        'Your selected invoices cannot be combined. Please select new or disapproved invoice',
        'warning',
      );
      return;
    }

    const modal = await this.modalController.create({
      component: POSChangeTableModalPage,
      backdropDismiss: false,
      cssClass: 'modal-change-table',
      componentProps: {
        selectedOrder: this.selectedItems[0],
        orders: this.items,
      },
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
      componentProps: { item: {} },
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role == 'confirm') {
      let cancelData: any = { Code: data.Code };
      if (cancelData.Code == 'Other') {
        cancelData.Remark = data.CancelNote;
      }

      this.env
        .showPrompt('Bạn có chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng')
        .then((_) => {
          let publishEventCode = this.pageConfig.pageName;
          if (this.submitAttempt == false) {
            this.submitAttempt = true;
            cancelData.Type = 'POSOrder';
            cancelData.Ids = this.selectedItems.map((m) => m.Id);
            this.pageProvider.commonService
              .connect('POST', 'SALE/Order/CancelOrders/', cancelData)
              .toPromise()
              .then(() => {
                if (publishEventCode) {
                  this.env.publishEvent({
                    Code: publishEventCode,
                  });
                }
                this.loadData();
                this.submitAttempt = false;
                this.nav('/pos-order', 'forward');
              })
              .catch((err) => {
                this.submitAttempt = false;
              });
          }
        })
        .catch((_) => {});
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
      this.env
        .getStorage('tableGroup' + this.env.selectedBranch)
        .then((data) => {
          if (!forceReload && data) {
            resolve(data);
          } else {
            let query = { IDBranch: this.env.selectedBranch };
            Promise.all([this.tableGroupProvider.read(query), this.tableProvider.read(query)])
              .then((values) => {
                let tableGroupList = values[0]['data'];
                let tableList = values[1]['data'];

                tableGroupList.forEach((g) => {
                  g.TableList = tableList.filter((d) => d.IDTableGroup == g.Id);
                });
                this.env.setStorage('tableGroup' + this.env.selectedBranch, tableGroupList);
                resolve(tableGroupList);
              })
              .catch((err) => {
                reject(err);
              });
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
  async showNotify() {
    const modal = await this.modalController.create({
      component: POSNotifyModalPage,
      canDismiss: true,
      backdropDismiss: true,
      cssClass: 'modal-notify',
      componentProps: {
        item: this.notifications,
      },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (data) {
      this.notifications = data;
    }
  }

  async setNotifiOrder(items){

    for (let item of items) {
      let url = 'pos-order/' + item.Id + '/' + item.Tables[0].IDTable;
      let message = 'Bàn ' + item.Tables[0]?.TableName + ' có ' + item.NewOrderLineCount + ' món chưa gửi bếp';

      let notification = {
        Id: item.Id,
        IDBranch: item.IDBranch,
        IDSaleOrder: item.Id,
        Type:'Order',
        Name:'Đơn hàng',
        Code: 'pos-order',
        Message: message, 
        Url: url,
        NewOrderLineCount : item.NewOrderLineCount,
        Watched: false,
      };
     await this.setNotifications(notification)
    }
  }

   async setNotifications(item,lasted = false) {
    let isExistedNoti =  this.notifications.some(
      (d) =>d.Id == item.Id &&  d.IDBranch == item.IDBranch &&    
        d.IDSaleOrder == item.IDSaleOrder &&
        d.Type == item.Type &&
        d.Name == item.Name &&
        d.Code == item.Code &&
        d.Message ==item.Message &&
        d.Url == item.Url &&
        !d.Watched)
    if(isExistedNoti) {
      if(lasted){
        let index =  this.notifications.findIndex((d) =>
          d.Id == item.Id &&
          d.IDBranch == item.IDBranch &&
          d.IDSaleOrder == item.IDSaleOrder &&
          d.Type == item.Type &&
          d.Name == item.Name &&
          d.Code == item.Code &&
          d.Message == item.Message &&
          d.Url ==item.Url &&
          !d.Watched)
        if(index != -1){
          this.notifications.splice(index, 1);
          this.notifications.unshift(item);
          await this.env.setStorage('Notifications', this.notifications);
        } 
      } 
    }
    else {
      this.notifications.unshift(item)
      await this.env.setStorage('Notifications', this.notifications);
    }
  

}


  goToNofication(i, j) {
    this.notifications[j].Watched = true;
    this.env.setStorage('Notifications', this.notifications);
    if (i.Url != null) {
      this.nav(i.Url, 'forward');
    }
    this.removeNotification(j);
  }

  removeNotification(j) {
    this.notifications.splice(j, 1);
    this.env.setStorage('Notifications', this.notifications);
  }

  exportPOSData() {
    this.query.SortBy = 'IDOrder_desc';

    if (this.query.Keyword.indexOf('-') != -1) {
      let dateParts = this.query.Keyword.split('-');
      let fromDate = new Date(
        dateParts[0].slice(2, 4) + '/' + dateParts[0].slice(0, 2) + '/' + dateParts[0].slice(4, 6),
      );
      let toDate = new Date(dateParts[1].slice(2, 4) + '/' + dateParts[1].slice(0, 2) + '/' + dateParts[1].slice(4, 6));
      let fromDateText = lib.dateFormat(fromDate);
      let toDateText = lib.dateFormat(toDate);

      let maxToDate = new Date(fromDate.setMonth(fromDate.getMonth() + 3));
      let maxToDateText = lib.dateFormat(maxToDate);

      if (toDateText > maxToDateText) {
        this.env.showMessage('Giới hạn tải xuống dữ liệu tối đa trong vòng 3 tháng!', 'danger', 5000);
        return;
      }
    }

    this.loadingController
      .create({
        cssClass: 'my-custom-class',
        message: 'Please wait for a few moments',
      })
      .then((loading) => {
        loading.present();
        this.commonService
          .connect('GET', 'SALE/Order/ExportPOSOrderList', this.query)
          .toPromise()
          .then((response: any) => {
            this.submitAttempt = false;
            if (loading) loading.dismiss();
            this.downloadURLContent(response);
          })
          .catch((err) => {
            if (err.message != null) {
              this.env.showMessage(err.error.ExceptionMessage, 'danger');
            } else {
              this.env.showMessage('Cannot extract data', 'danger');
            }
            this.submitAttempt = false;
            if (loading) loading.dismiss();
            this.refresh();
          });
      });
  }
}
