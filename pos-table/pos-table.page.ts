import { Component} from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { POS_TableGroupProvider, POS_TableProvider } from 'src/app/services/static/services.service';
import { POSTableDetailPage } from '../pos-table-detail/pos-table-detail.page';
import { POSTableGroupDetailPage } from '../pos-table-group-detail/pos-table-group-detail.page';

@Component({
    selector: 'app-pos-table',
    templateUrl: 'pos-table.page.html',
    styleUrls: ['pos-table.page.scss']
})


export class POSTablePage extends PageBase {
    tableGroupList = [];
    tableList = [];
   
    calendarHeatmapData: any = {};
  ListOfAllEvents;
  pageData: any = {};
 
    constructor(
        public pageProvider: POS_TableProvider,
        public tableGroupProvider: POS_TableGroupProvider,
        public modalController: ModalController,
		public popoverCtrl: PopoverController,
        public alertCtrl: AlertController,
        public loadingController: LoadingController,
        public env: EnvService,
        public navCtrl: NavController,
        
    ) {
        super()    
    }

    preLoadData(event?: any): void{
        this.query.IDBranch = this.env.selectedBranch;
        this.query.Take = 5000;
        Promise.all([
            this.tableGroupProvider.read({IDBranch: this.env.selectedBranch})
        ]).then(values => {
            this.tableGroupList = values[0]['data'];
        });
        super.preLoadData(event);
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        this.tableGroupList.forEach(g => {
            g.TableList = this.items.filter(d => d.IDTableGroup == g.Id);
        });

        super.loadedData(event, ignoredFromGroup);
    }

    
    deleteitem(item:any,isgrouptable?: boolean){
        if (this.pageConfig.canDelete) {
            this.alertCtrl.create({
                header: 'Xóa' + (item.Name ? ' ' + item.Name : ''),
                //subHeader: '---',
                message: 'Bạn chắc muốn xóa' + (item.Name ? ' ' + item.Name : '') + '?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                        }
                    },
                    {
                        text: 'Đồng ý xóa',
                        cssClass: 'danger-btn',
                        handler: () => {
                            let ltitem = this.items
                            if(isgrouptable){
                                
                                this.tableGroupProvider.delete(item).then(() => {
                                    this.env.showTranslateMessage('erp.app.app-component.page-bage.delete-complete','success');
                                    this.env.publishEvent({ Code: this.pageConfig.pageName });
                                    ltitem.removeChild(item)
    
                                }).catch(err => {
                                    
                                })
                            }else{
                                this.pageProvider.delete(item).then(() => {
                                    this.env.showTranslateMessage('erp.app.app-component.page-bage.delete-complete','success');
                                    this.env.publishEvent({ Code: this.pageConfig.pageName });
                                    ltitem.removeChild(item)
    
                                }).catch(err => {
                                    
                                })
                            }
                            
                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
    }
    async showModalTable(i:any){
             const modal = await this.modalController.create({            
                component: POSTableDetailPage,
                componentProps: {
                    items : this.items,
                    item: i,
                    id: i.Id
                },
            });
            
            await modal.present();  
            this.preLoadData();
    }
    async showModalTableGroup(i:any){
        const modal1 = await this.modalController.create({            
                component: POSTableGroupDetailPage,
                componentProps: {
                    item: i,
                    id: i.Id
                },
            });
            await modal1.present();  
            this.preLoadData();
    }

    add(idTableGroup?:any,isgrouptable?: boolean) {
        let newItem = {
            Id: 0,
            IsDisabled: false,
            IDTableGroup:idTableGroup
        };
        if(isgrouptable){
            this.showModalTableGroup(newItem)
        }else{
            this.showModalTable(newItem)
        }
    }

    removeSelectedItems(): void {
        super.removeSelectedItems();
        this.loadedData();
    }
   
}
