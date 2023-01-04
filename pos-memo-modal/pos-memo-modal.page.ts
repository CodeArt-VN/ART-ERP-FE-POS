import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { lib } from 'src/app/services/static/global-functions';



@Component({
    selector: 'app-pos-memo-modal',
    templateUrl: './pos-memo-modal.page.html',
    styleUrls: ['./pos-memo-modal.page.scss'],
})
export class POSMemoModalPage extends PageBase {
    @Input() selectedOrder;
    @Input() selectedLine;
    @Input() quickMemuList;
    GroupType;

    LineType;
    
    constructor(
        public pageProvider: SALE_OrderProvider,

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
        this.pageConfig.isShowFeature = true;
        this.pageConfig.pageName = 'POSQuickMemo';
        this.config.notFoundText = 'Không tìm thấy dữ liệu phù hợp...';
        this.config.clearAllText = 'Xóa hết';
    }



    loadData(event) {
        this.item = {
            Id: this.selectedLine.Id, 
            ItemName: this.selectedLine.ItemName,
            ItemCode: this.selectedLine.ItemCode,
            Remark: this.selectedLine.Remark
        };
        this.LineType = Array.from(this.item.ItemCode)[0];
        this.GroupType = [...new Set(this.quickMemuList.map(item => item.Type))];
        this.loadedData(event);
    }

    loadedData(event) {
        // console.log(this.quickMemuList);
        super.loadedData(event);
        if (this.LineType == 'B') {
            this.loadGroupType('Drink');
        }
        else if (this.LineType == 'F') {
            this.loadGroupType('Food');
        }
        else {
            this.loadGroupType('All');
        }
    }

    selectedGroupType = 'All';
    selectedMemoList = [];
    loadGroupType(g) {
        this.selectedGroupType = g;

        if (g == 'All') {
            this.selectedMemoList = this.quickMemuList;
            return;
        }

        this.selectedMemoList = this.quickMemuList.filter(d => d.Type == g);
    }
    
    passInRemark(value) {
        let string = this.item.Remark;
        if (typeof string === 'string') {
            let Remark = string.split(',');
            this.item.Remark = [];
            this.item.Remark = Remark;
        }
        else if (string == null) {
            string = [];
            this.item.Remark = [];
        }

        let index = string.indexOf(' '+value);
        if (index != -1) {
            this.item.Remark.splice(index,1);
            
            this.item.Remark = [...this.item.Remark];
            return
        }

        if (string == '') {
            this.item.Remark.push((' '+value).toString());
        }
        else {
            this.item.Remark = this.item.Remark.concat((' '+value).toString());
        }
        this.item.Remark = [...this.item.Remark];
    }

    applyRemark(apply = false) {
        if (apply) {
            if (this.item.Remark == '') {
                this.item.Remark = null;
            }
            this.modalController.dismiss([this.item.Remark, apply]);
        }
        else {
            this.modalController.dismiss([null, apply]);
        }
    }
}
