import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { ModalController, NavController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';

@Component({
  selector: 'app-pos-invoice-modal',
  templateUrl: './pos-invoice-modal.page.html',
  styleUrls: ['./pos-invoice-modal.page.scss'],
})
export class POSInvoiceModalPage extends PageBase {
  IsShowSave = true;
  IsShowApply = false;
  IsShowSpinner = false;
  constructor(
    public pageProvider: CRM_ContactProvider,
    public env: EnvService,
    public navCtrl: NavController,

    public modalController: ModalController,
    public formBuilder: FormBuilder,
    public cdr: ChangeDetectorRef,
    public loadingController: LoadingController,
    public commonService: CommonService,
  ) {
    super();
    this.pageConfig.isDetailPage = true;

    this.formGroup = formBuilder.group({
      Id: [''],
      Name: ['', Validators.required],
      TaxCode: ['', Validators.required],
      CompanyName: ['', Validators.required],
      Email: ['', Validators.required],
      BillingAddress: ['', Validators.required],
    });
  }
  loadedData(event) {
    super.loadedData(event);
    if (!this.formGroup.invalid) {
      this.IsShowSave = false;
      this.IsShowApply = true;
    }
  }
  async saveChange() {
    if (this.formGroup.invalid) {
      return;
    }
    super.saveChange2();
    this.IsShowSave = false;
    this.IsShowApply = true;
  }
  Apply(apply = false) {
    if (apply) {
      this.modalController.dismiss(true);
    } else {
      this.modalController.dismiss();
    }
  }
  reset() {
    this.IsShowSave = true;
    this.IsShowApply = false;
    this.formGroup.reset();
  }
  changeTaxCode(event) {
    let value = event.target.value;
    this.IsShowSave = true;
    this.IsShowApply = false;
    this.formGroup.controls.CompanyName.patchValue('');
    this.formGroup.controls.BillingAddress.patchValue('');
    if (value.length > 9) {
      this.IsShowSpinner = true;
      Object.assign(this.query, { TaxCode: value });
      let apiPath = {
        method: 'GET',
        url: function () {
          return ApiSetting.apiDomain('CRM/Contact/SearchUnitInforByTaxCode');
        },
      };
      this.commonService
        .connect(apiPath.method, apiPath.url(), this.query)
        .toPromise()
        .then((result: any) => {
          this.patchValue(result);
          this.IsShowSpinner = false;
        })
        .catch((err) => {
          this.env.showTranslateMessage('Mã số thuế không hợp lệ!', 'danger');
          this.IsShowSpinner = false;
        });
    }
  }
  patchValue(data) {
    this.formGroup.controls.CompanyName.patchValue(data.TenChinhThuc);
    this.formGroup.controls.BillingAddress.patchValue(data.DiaChiGiaoDichChinh);
    this.formGroup.controls.CompanyName.markAsDirty();
    this.formGroup.controls.BillingAddress.markAsDirty();
  }
}
