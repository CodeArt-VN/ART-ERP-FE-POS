import { Component } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_MemoProvider } from 'src/app/services/static/services.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';



@Component({
    selector: 'app-pos-cusotmer-memo-modal',
    templateUrl: './pos-memo-modal.page.html',
    styleUrls: ['./pos-memo-modal.page.scss'],
})
export class POSCustomerMemoModalPage extends PageBase {
    Remark;
    GroupType;
    LineType;
    selectedGroupType = 'All';
    memoList = [];

    constructor(    
        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,
        public modalController: ModalController,
        public alertCtrl: AlertController,
        public navParams: NavParams,
        public loadingController: LoadingController,
        public commonService: CommonService,
    ) {
        super();
        this.pageConfig.isShowFeature = true;
        

    }

    preLoadData(event?: any): void {
        let forceReload = event === 'force';
        Promise.all([
            this.getMeno(forceReload)
        ]).then((values: any) => {
            this.items = values[0];
            this.GroupType = [...new Set(this.items.map(item => item.Type))];
            this.LineType = Array.from(this.item._item.Code)[0];
            this.loadedData();
        })
    }

    loadedData() {
        this.Remark = this.item.Remark;
        super.loadedData();

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

    refresh(event?: any): void {
        this.preLoadData('force');
    }

    loadGroupType(g) {
        this.selectedGroupType = g;

        if (g == 'All') {
            this.memoList = this.items;
            return;
        }

        this.memoList = this.items.filter(d => d.Type == g);
    }

    addRemark(value) {
        if (this.item._Locked) {
            this.env.showTranslateMessage('erp.app.pages.pos.pos-memo-modal.item-locked', 'warning');
        }

        let string = this.Remark;

        if (typeof string === 'string') {
            let Remark = string.split(',');
            this.Remark = [];
            this.Remark = Remark;
        }
        else if (string == null) {
            string = [];
            this.Remark = [];
        }

        let index = string.indexOf(' ' + value);
        if (index != -1) {
            this.Remark.splice(index, 1);

            this.Remark = [...this.Remark];
            return
        }

        if (string == '') {
            this.Remark.push((' ' + value).toString());
        }
        else {
            this.Remark = this.Remark.concat((' ' + value).toString());
        }
        this.Remark = [...this.Remark];
    }

    dismiss(submit = false) {
        return this.modalController.dismiss(this.Remark, (submit ? 'confirm' : 'cancel'), 'POSMemoModalPage');
    }


    private getMeno(forceReload) {
        return new Promise((resolve, reject) => {
            this.env.getStorage('memoList' + this.env.selectedBranch).then(data => {
                if (!forceReload && data) {
                    resolve(data);
                }
                else {
                    let apiPath = {
                        method: "GET",
                        url: function(){return ApiSetting.apiDomain("POS/ForCustomer/Memo")}  
                    };  
                    Object.assign(this.query, {IDTable: 401});                  
                    this.commonService.connect(apiPath.method, apiPath.url(),this.query).toPromise()
					.then((result: any) => {	                      
                        this.env.setStorage('memoList' + this.env.selectedBranch, result);				
						resolve(result);
					})
					.catch(err => {						
						reject(err);
					});
                }
            }).catch(err => {
                reject(err);
            });
        });
    }
}
