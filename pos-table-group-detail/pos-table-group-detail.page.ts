import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, NavParams } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { HRM_StaffProvider, POS_TableGroupProvider, POS_TableGroupStaffProvider, POS_TableProvider,  } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
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
        public posTableGroupStaffProvider: POS_TableGroupStaffProvider,
        public staffProvider: HRM_StaffProvider,
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
            IDBranch: [''],
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

    loadedData(event?: any) {
        super.loadedData(event);
        this.item.IDStaff = this.item?.StaffList?.map(i => i.Id);
        this.staffListSelected = this.item.StaffList;
        this.staffSearch();
    }

    segmentView = 's1';
    segmentChanged(ev: any) {
        this.segmentView = ev.detail.value;
    }

    staffList$
    staffListLoading = false;
    staffListInput$ = new Subject<string>();
    staffListSelected = [];
    staffSelected = null;
    staffSearch() {
        this.staffListLoading = false;
        this.staffList$ = concat(
            of(this.staffListSelected),
            this.staffListInput$.pipe(
                distinctUntilChanged(),
                tap(() => this.staffListLoading = true),
                switchMap(term => this.staffProvider.search({ Take: 20, Skip: 0, SkipMCP: true, Term: term ? term : 'BP:'+  this.item.IDStaff?.[0] }).pipe(
                    catchError(() => of([])), // empty list on error
                    tap(() => this.staffListLoading = false)
                ))

            )
        );
    }

    changedIDStaff(i) {
        this.item.IDStaff;
        debugger
        if (i) {
            this.staffSelected = i;
            if (this.staffListSelected.findIndex(d => d.Id == i.Id) == -1) {
                this.staffListSelected.push(i);
                this.staffSearch();
            }
        }

        let dataSaving = {
            Ids: [],
            IDTableGroup: 0
        };

        dataSaving.Ids = this.item.IDStaff;
        dataSaving.IDTableGroup = this.item.Id;

        return new Promise((resolve, reject) => {
            debugger
            this.commonService.connect("POST", "POS/TableGroup/UpdateStaffs/", dataSaving).toPromise().then((savedItem: any) => { 
                this.env.showTranslateMessage('erp.app.pages.pos.pos-order.message.save-complete','success');
                resolve(savedItem);
                this.submitAttempt = false;
            }).catch(err => {
                this.env.showTranslateMessage('erp.app.pages.pos.pos-order.merge.message.can-not-save','danger');
                this.cdr.detectChanges();
                this.submitAttempt = false;
                reject(err);
            });
        })
    }

    async saveChange() {
        this.formGroup.controls.IDBranch.setValue(this.env.selectedBranch);
        super.saveChange2();
    }
}
