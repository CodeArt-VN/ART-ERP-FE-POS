import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, POS_TableProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ApiSetting } from 'src/app/services/static/api-setting';



@Component({
    selector: 'app-pos-change-table-modal',
    templateUrl: './pos-change-table-modal.page.html',
    styleUrls: ['./pos-change-table-modal.page.scss'],
})
export class POSChangeTableModalPage extends PageBase {
    @Input() selectedOrder;
    @Input() orders;
    currentTable;
    newTable = {
        Id: null,
        IDTable: new Number()
    };
    orderSaving;
    occupiedTable;
    occupiedTableList = [];
    initContactsIds = [];
    initTablesIds = [];
    orderedTables = [];
    tables = [];
    checkBillStatus = ["Splitted","Merged","Done","Cancelled"];
    checkSplitMergeStatus = ["Splitted","Merged"];
    isMerging = false;
    buttonText = 'Chuyển bàn';

    constructor(
        public pageProvider: SALE_OrderProvider,
        public contactProvider: CRM_ContactProvider,
        public tableProvider: POS_TableProvider,

        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,

        public modalController: ModalController,
        public alertCtrl: AlertController,
        public navParams: NavParams,
        public formBuilder: FormBuilder,
        public cdr: ChangeDetectorRef,
        public loadingController: LoadingController,
        private config: NgSelectConfig
    ) {
        super();
        this.pageConfig.isDetailPage = false;
        this.pageConfig.pageName = 'Change table';
        this.config.notFoundText = 'Không tìm thấy dữ liệu phù hợp...';
        this.config.clearAllText = 'Xóa hết';
        this.query.Type = "POSOrder";
        this.query.Status = "New";
        this.query.Take = 500;
    }



    loadData(event) {

        this.orders.forEach(o => {
            if (this.orderedTables.findIndex(d => d.Id == o.Tables[0]) == -1) {
                this.orderedTables.push({
                    Id: o.Tables[0],
                    Name: o._Tables[0].Name,
                });
            }
        });

        this.tableProvider.read({IsDeleted: false}).then((result: any) => {
            this.tables = result.data;
            let currentTableIndex = this.tables.findIndex(d => d.Id == this.selectedOrder.Tables[0]);
            //this.tables.splice(currentTableIndex, 1);
        })

        this.tableProvider.getAnItem(this.selectedOrder.Tables[0]).then(value => {
            this.currentTable = value; 
            super.loadData(event);
        });

        this.item = { Ids: [], Id: this.selectedOrder.Id, IDContact: this.selectedOrder.IDContact, IDTable: this.selectedOrder.Tables[0]};
        this.item.Ids.push(this.selectedOrder.Id);

        if (this.selectedOrder) {
            this.initContactsIds.push(this.selectedOrder.IDContact);
            this.initTablesIds.push(this.selectedOrder.Tables[0]);
        }
    }

    loadedData(event) {
        this.orders.forEach(tb => {
            this.occupiedTableList.push((tb.Tables).toString());
        });
        this.occupiedTable = this.occupiedTableList.toString();

        if (this.initContactsIds.length) {
            this.contactProvider.read({ Id: JSON.stringify(this.initContactsIds), IsDeleted: false}).then((contacts: any) => {
                this.contactSelected = contacts.data[0];
                this.item.IDContact = this.contactSelected.Id;
                contacts.data.forEach(contact => {
                    if (contact && this.contactListSelected.findIndex(d => d.Id == contact.Id) == -1) {
                        this.contactListSelected.push({ Id: contact.Id, Code: contact.Code, Name: contact.Name, WorkPhone: contact.WorkPhone, AddressLine1: contact.AddressLine1 });
                    }
                });


            }).finally(() => {
                this.contactSearch();
                this.cdr.detectChanges();
            });
        }
        else {
            this.contactSearch();
        }

        super.loadedData(event);
        console.log(this.orders);
    }

    contactList$
    contactListLoading = false;
    contactListInput$ = new Subject<string>();
    contactListSelected = [];
    contactSelected = null;
    contactSearch() {
        this.contactListLoading = false;
        this.contactList$ = concat(
            of(this.contactListSelected),
            this.contactListInput$.pipe(
                distinctUntilChanged(),
                tap(() => this.contactListLoading = true),
                switchMap(term => this.contactProvider.search({ Take: 20, Skip: 0, SkipMCP: true, Term: term ? term : 'BP:'+  this.item.IDContact }).pipe(
                    catchError(() => of([])), // empty list on error
                    tap(() => this.contactListLoading = false)
                ))

            )
        );
    }

    // tableList$
    // tableListLoading = false;
    // tableListInput$ = new Subject<string>();
    // tableListSelected = [];
    // tableSelected = null;
    // tableSearch() {
    //     this.tableListLoading = false;
    //     this.tableList$ = concat(
    //         of(this.tableListSelected),
    //         this.tableListInput$.pipe(
    //             distinctUntilChanged(),
    //             tap(() => this.tableListLoading = true),
    //             switchMap(term => this.tableProvider.search({ Take: 20, Skip: 0, Name: term ? term : this.currentTable.Name }).pipe(
    //                 catchError(() => of([])), // empty list on error
    //                 tap(() => this.tableListLoading = false)
    //             ))
    //         )
    //     );
    // }

    changedIDTableFrom(i) {     
        console.log(this.item);
        
        if (i) {
            console.log(this.orders.find(f=>f.Tables[0] = i.Id));
            
            this.selectedOrder = this.orders.find(f=>f.Tables[0] = i.Id);
            this.selectedOrder.TableName = i.Name;
            
            console.log(this.selectedOrder);
        }
    }

    changedIDTableTo(i) {
        if (i) {
            if (this.orderedTables.findIndex(d => d.Id == i.Id) != -1) {
                this.alertCtrl.create({
                    header: 'Gộp bàn',
                    //subHeader: '---',
                    message: 'Bàn đang chọn đã có khách, bạn có muốn thực hiện gộp bàn?',
                    buttons: [
                        {
                            text: 'Không',
                            role: 'cancel',
                            handler: () => {
                                //this.selectedItems = this.selectedItems.filter(i => (i.Status == 'ARInvoiceApproved'));
                                this.newTable.Id = null; //Set back to null
                            }
                        },
                        {
                            text: 'Đồng ý',
                            cssClass: 'success-btn',
                            handler: () => {
                                this.isMerging = true;
                                this.buttonText='Gộp bàn';

                                let bindOrder;
                                this.item.Ids = [];
                                this.item.Ids.push(this.selectedOrder.Id);
                                this.orders.forEach(e => {
                                    let temp = [];                                    
                                    if(this.checkBillStatus.indexOf(e._Status.Code) == -1) { 
                                        temp.push(e);
                                    }

                                    temp.forEach(t => {
                                        if(t.Tables.indexOf(i.Id) != -1) { 
                                            bindOrder = t.Id;
                                            this.item.Ids.push(bindOrder);
                                            return;
                                        }
                                    });
                                });
                                this.item.Ids;
                            }
                        }
                    ]
                }).then(alert => {
                    alert.present();
                })
            }
            else{
                this.isMerging = false;
                this.buttonText='Chuyển bàn';
            }
        }
        else {
            this.isMerging = false;
            this.buttonText='Chuyển bàn';
        }
    }


    changeTable() {
        if (this.isMerging) {
            this.mergeSaleOrders();
        }
        else {
            this.pageConfig.isDetailPage = true; //important
            this.pageProvider.getAnItem(this.selectedOrder.Id).then(data => {
                this.orderSaving = data;
                this.orderSaving.Tables = [this.newTable.Id];

                return new Promise((resolve, reject) => {
                    this.pageProvider.save(this.orderSaving).then((savedItem: any) => { 
                        this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');
                        resolve(savedItem.Id);
                        this.submitAttempt = false;
                        this.closeModalView();
                    }).catch(err => {
                        this.pageConfig.isDetailPage = false;
                        this.env.showTranslateMessage('erp.app.pages.pos.pos-order.merge.message.can-not-save','danger');
                        this.cdr.detectChanges();
                        this.submitAttempt = false;
                        reject(err);
                    });
                })
            });
        }
    }

    mergeSaleOrders() {
        let apiPath = {
            method: "POST",
            url: function () { return ApiSetting.apiDomain("SALE/Order/MergePosOrders/") }
        };

        return new Promise((resolve, reject) => {
            if (!this.item.Ids.length || !this.item.IDContact) {
                this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.check-merge-invoice-select-customer','warning');
            }
            else if (this.submitAttempt == false) {
                this.submitAttempt = true;


                if (!this.item.IDBranch) {
                    this.item.IDBranch = this.env.selectedBranch;
                }
                this.item.Type = "POSOrder";
                this.item.Status =  "New";  
                this.item.IDTable = this.newTable.Id;
                this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), this.item).toPromise()
                    .then((savedItem: any) => {
                        this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');
                        resolve(savedItem.Id);
                        this.submitAttempt = false;
                        this.closeModalView();

                    }).catch(err => {
                        this.env.showTranslateMessage('erp.app.pages.pos.pos-order.merge.message.can-not-save','danger');
                        this.cdr.detectChanges();
                        this.submitAttempt = false;
                        reject(err);
                    });
            }
        });

    }

    changedIDContact(i) {
        if (i) {
            this.contactSelected = i;
            if (this.contactListSelected.findIndex(d => d.Id == i.Id) == -1) {
                this.contactListSelected.push(i);
                this.contactSearch();
            }

        }

    }

    closeModalView() {
        this.modalController.dismiss();
    }

}
