import { ChangeDetectorRef, Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, SALE_OrderDetailProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import {CdkDragDrop, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';


@Component({
    selector: 'app-pos-kitchen-dashboard',
    templateUrl: 'pos-kitchen-dashboard.page.html',
    styleUrls: ['pos-kitchen-dashboard.page.scss']
})
export class POSKitchenDashboardPage extends PageBase {
    tableGroupList = [];
    tableList = [];
    statusList = [];
    orderDetailStatusList = [];

    noLockStatusList = [];
    posOrderTypeList = 'TableService';

    printData = {
        undeliveredItems: [], //To track undelivered items to the kitchen
        printDate: null,
        currentBranch: null,
        selectedTables: [],
    }

    constructor(
        public pageProvider: SALE_OrderDetailProvider,
        public tableGroupProvider: POS_TableGroupProvider,
        public tableProvider: POS_TableProvider,
        public menuProvider: POS_MenuProvider,
        public modalController: ModalController,
		public popoverCtrl: PopoverController,
        public alertCtrl: AlertController,
        public loadingController: LoadingController,
        public cdr: ChangeDetectorRef,
        public formBuilder: FormBuilder,
        public env: EnvService,
        public navCtrl: NavController,
        public location: Location,
    ) {
        super();
        this.pageConfig;
        this.formGroup = formBuilder.group({
            Id: [''],
            IDItem: [''],
            ItemName: [''],
            ItemCode: [''],
            Type: [''],
            Status: [''],
            ModifiedBy: [''],
            ModifiedDate: ['']
        });
    }

    preLoadData(event?: any): void {
        Promise.all([
            this.tableGroupProvider.read(),
            this.tableProvider.read({Take: 5000}),
            this.env.getStatus("POSOrder"),
            this.env.getStatus("POSOrderDetail"),
            this.menuProvider.read()
        ]).then(values => {
            this.tableGroupList = values[0]['data'];
            this.tableList = values[1]['data'];
            this.statusList =  values[2];
            this.orderDetailStatusList = values[3];
            this.env.setStorage('menuList' + this.env.selectedBranch, values[4]['data']);
            this.tableGroupList.forEach(g => {
                g.TableList = this.tableList.filter(d => d.IDTableGroup == g.Id);
            });
            this.env.setStorage('tableGroup' + this.env.selectedBranch, this.tableGroupList);

            this.query.Type = this.posOrderTypeList;
            this.query.SortBy = 'IDOrder_desc'
            this.query.Status = JSON.stringify(this.orderDetailStatusList.map(i => i.Code));

            super.preLoadData(event);
        });
    }

    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        super.loadedData(event, ignoredFromGroup);
        this.items;
        this.item;

        this.sortItemByStatus();
    }

    sortItemByStatus() {
        for (let s of this.orderDetailStatusList) {
            s.ItemList = [];
            for (let i of this.items) {
                if (i.Status == s.Code) {
                    s.ItemList.push(i);
                }
            }
        }
    }

    showDetail(i:any) {
        if (i) {
            this.item = i;
        }
        else {
            this.item = null;
        }
    }

    prevStatus() {
        if (this.item) {
            let currentStatusIdx = this.orderDetailStatusList.findIndex(d => d.Code == this.item.Status);
            if (currentStatusIdx == 0) {
                return; // first Status
            }
            else {
                let newStatus = this.orderDetailStatusList[currentStatusIdx-1];
                this.item.Status = newStatus.Code;
                this.formGroup.patchValue(this.item);
                this.formGroup.controls.Status.patchValue(newStatus.Code);
                this.formGroup.controls.Status.markAsDirty();
                this.saveChange();
            }
        }
    }

    nextStatus() {
        if (this.item) {
            let currentStatusIdx = this.orderDetailStatusList.findIndex(d => d.Code == this.item.Status);
            if (currentStatusIdx == this.orderDetailStatusList.length) {
                return; // first Status
            }
            else {
                let newStatus = this.orderDetailStatusList[currentStatusIdx+1];
                this.item.Status = newStatus.Code;
                this.formGroup.patchValue(this.item);
                this.formGroup.controls.Status.patchValue(newStatus.Code);
                this.formGroup.controls.Status.markAsDirty();
                this.saveChange();
            }
        }
    }

    print() {

    }

  
    drop(event: CdkDragDrop<string[]>, statusGroup) {
        statusGroup;
        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
            //Flow xử lý kéo thả trong cùng 1 loại trạng thái
            // Nếu cùng vị trí >> Không làm gì hết
            // Nếu Kéo thả vị trí >> Update số thứ tự sort
            // Cho phép bấm kéo giữ để xem chi tiết đơn hàng
        }
        else {
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex,
            );
            
            statusGroup.ItemList.forEach(i => {
                if (i.Status != statusGroup.Code) {
                    this.formGroup.patchValue(i);
                    this.formGroup.controls.Status.patchValue(statusGroup.Code);
                    this.formGroup.controls.Status.markAsDirty();
                    this.saveChange();
                }
            });

            this.env.showMessage('Đã chuyển trạng thái thành ' + statusGroup.Name, statusGroup.Color, 1000);
            //Flow xử lý kéo thả sang 1 trạng thái mới
            // Nếu kéo sang trạng thái mới, gắn trạng thái mới cho OrderDetail >> Cập nhật trạng thái
            // Nếu kéo xong, lưu thành công. >> Hiển thị trạng thái
        }
    }

    async saveChange() {
        let submitItem = this.getDirtyValues(this.formGroup);
        console.log(submitItem);
        this.submitAttempt = false;
        this.saveChange2();
    }

    savedChange(savedItem?: any, form?: FormGroup<any>): void { 
        //Do Nothing;
        if (savedItem) {
            this.submitAttempt = false;
        }
    }

}
