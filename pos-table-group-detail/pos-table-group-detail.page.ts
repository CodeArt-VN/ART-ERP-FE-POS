import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, NavParams } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_TableGroupProvider, POS_TableProvider,  } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';

@Component({
    selector: 'app-pos-table-group-detail',
    templateUrl: './pos-table-group-detail.page.html',
    styleUrls: ['./pos-table-group-detail.page.scss'],
})
export class POSTableGroupDetailPage extends PageBase {
    TableList = [];
    constructor(
        public pageProvider: POS_TableGroupProvider,
        public posTableProvider: POS_TableProvider,
        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,
        public alertCtrl: AlertController,
        public formBuilder: FormBuilder,
        public cdr: ChangeDetectorRef,
        public loadingController: LoadingController,
        public commonService: CommonService,        
        public modalController: ModalController,
        public navParams: NavParams,
    ) {
        super();
        this.pageConfig.isDetailPage = true;

        this.formGroup = formBuilder.group({
            IDBranch: [this.env.selectedBranch],
            Id: new FormControl({ value: '', disabled: true }),
            Code: [''],
            Name: ['', Validators.required],
        });

    }
    

    preLoadData(event) {
        if (this.navParams) {
            this.id = this.navParams.data.id;                
        }
         super.preLoadData()
    }

    async saveChange() {
        this.formGroup.controls.IDBranch.setValue(this.env.selectedBranch);
        super.saveChange2();
    }
}
