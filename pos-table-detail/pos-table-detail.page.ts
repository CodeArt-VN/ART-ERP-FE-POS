import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, NavParams } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_TableGroupProvider, POS_TableProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import QRCode from 'qrcode';

@Component({
  selector: 'app-pos-table-detail',
  templateUrl: './pos-table-detail.page.html',
  styleUrls: ['./pos-table-detail.page.scss'],
})
export class POSTableDetailPage extends PageBase {
  tableGroupList = [];
  constructor(
    public pageProvider: POS_TableProvider,
    public tableGroupProvider: POS_TableGroupProvider,
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
      IDTableGroup: ['', Validators.required],
      Id: new FormControl({ value: '', disabled: true }),
      Code: [''],
      Name: ['', Validators.required],
      IsAllowMultipleOrder: [false],
      IsAllowCustomerOrder: [false],
    });

    // this.id = this.route.snapshot?.paramMap?.get('id');
    // this.id = typeof (this.id) == 'string' ? parseInt(this.id) : this.id;
  }

  preLoadData() {
    if (this.pageConfig.canEditFunction) {
      this.pageConfig.canEdit = true;
    }

    if (this.navParams) {
      this.items = JSON.parse(JSON.stringify(this.navParams.data.items));
      this.items.forEach((i) => {
        let prefix = '';
        for (let j = 1; j < i.level; j++) {
          prefix += '- ';
        }
        i.Name = prefix + i.Name;
      });

      this.item = JSON.parse(JSON.stringify(this.navParams.data.item));
      this.id = this.navParams.data.id;

      this.loadedData();
    }
  }

  loadedData(event?: any) {
    super.loadedData(event);
    let that = this;
    QRCode.toDataURL(
      'http://app.inholdings.vn/#/pos-welcome/' + this.item?.Id,
      {
        errorCorrectionLevel: 'M',
        version: 4,
        width: 500,
        scale: 20,
        type: 'image/webp',
      },
      function (err, url) {
        that.item.QRC = url;
      },
    );

    this.tableGroupProvider.read({ IDBranch: this.env.selectedBranch }).then((results: any) => {
      this.tableGroupList = results.data;
    });
  }

  async saveChange() {
    this.formGroup.controls.IDBranch.setValue(this.env.selectedBranch);
    super.saveChange();
  }
}
