import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_TableGroupProvider, POS_TableProvider,  } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import QRCode from 'qrcode';

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
    ) {
        super();
        this.pageConfig.isDetailPage = true;

        this.formGroup = formBuilder.group({
            IDBranch: [''],
            Id: new FormControl({ value: '', disabled: true }),
            Code: [''],
            Name: ['', Validators.required],
        });

        this.id = this.route.snapshot?.paramMap?.get('id');
        this.id = typeof (this.id) == 'string' ? parseInt(this.id) : this.id;
    }

    preLoadData(event) {
        this.posTableProvider.read({IDTableGroup: this.id}).then((results:any) =>{
            this.TableList = results.data;

            if (this.TableList) {

                this.TableList.forEach(t => {
                    QRCode.toDataURL('http://app.inholdings.vn/#/pos-welcome/' + t.Id, { errorCorrectionLevel: 'M', version: 3, width: 500, scale: 20, type: 'image/webp' }, function (err, url) {
                        t.QRC = url;
                    });
                });
            }

            super.preLoadData(event);
        });
    }

    segmentView = 's1';
    segmentChanged(ev: any) {
        this.segmentView = ev.detail.value;
    }

    async saveChange() {
        super.saveChange2();
    }
}
