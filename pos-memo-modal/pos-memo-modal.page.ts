import { Component } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_MemoProvider } from 'src/app/services/static/services.service';

@Component({
  selector: 'app-pos-memo-modal',
  templateUrl: './pos-memo-modal.page.html',
  styleUrls: ['./pos-memo-modal.page.scss'],
})
export class POSMemoModalPage extends PageBase {
  Remark;
  GroupType;
  LineType;
  selectedGroupType = 'All';
  memoList = [];

  constructor(
    public pageProvider: POS_MemoProvider,

    public env: EnvService,
    public navCtrl: NavController,
    public route: ActivatedRoute,
    public modalController: ModalController,
    public alertCtrl: AlertController,
    public navParams: NavParams,
    public loadingController: LoadingController,
  ) {
    super();
    this.pageConfig.isShowFeature = true;
  }

  preLoadData(event?: any): void {
    let forceReload = event === 'force';
    Promise.all([this.getMeno(forceReload)]).then((values: any) => {
      this.items = values[0];
      this.GroupType = [...new Set(this.items.map((item) => item.Type))];
      this.LineType = Array.from(this.item._item.Code)[0];
      this.loadedData();
    });
  }

  loadedData() {
    this.Remark = this.item.Remark;
    super.loadedData();

    if (this.LineType == 'B') {
      this.loadGroupType('Drink');
    } else if (this.LineType == 'F') {
      this.loadGroupType('Food');
    } else {
      this.loadGroupType('All');
    }
  }

  refresh(event?: any): void {
    this.preLoadData('force');
  }

  loadGroupType(g) {
    this.selectedGroupType = g;

    if (g == 'All') {
      this.memoList = this.items;
      return;
    }

    this.memoList = this.items.filter((d) => d.Type == g);
  }

  addRemark(value) {
    if (this.item._Locked) {
      this.env.showMessage('Sản phẩm này đã khóa.', 'warning');
    }

    let string = this.Remark;

    if (typeof string === 'string') {
      let Remark = string.split(',');
      this.Remark = [];
      this.Remark = Remark;
    } else if (string == null) {
      string = [];
      this.Remark = [];
    }

    let index = string.indexOf(' ' + value);
    if (index != -1) {
      this.Remark.splice(index, 1);

      this.Remark = [...this.Remark];
      return;
    }

    if (string == '') {
      this.Remark.push((' ' + value).toString());
    } else {
      this.Remark = this.Remark.concat((' ' + value).toString());
    }
    this.Remark = [...this.Remark];
  }

  dismiss(submit = false) {
    return this.modalController.dismiss(this.Remark, submit ? 'confirm' : 'cancel', 'POSMemoModalPage');
  }

  private getMeno(forceReload) {
    return new Promise((resolve, reject) => {
      this.env
        .getStorage('memoList' + this.env.selectedBranch)
        .then((data) => {
          if (!forceReload && data) {
            resolve(data);
          } else {
            this.pageProvider
              .read({ IDBranch: this.env.selectedBranch })
              .then((resp) => {
                let memoList = resp['data'];
                this.env.setStorage('memoList' + this.env.selectedBranch, memoList);
                resolve(memoList);
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
}
