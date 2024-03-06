import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { ModalController, NavController, LoadingController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-pos-contact-modal',
  templateUrl: './pos-contact-modal.page.html',
  styleUrls: ['./pos-contact-modal.page.scss'],
})
export class POSContactModalPage extends PageBase {
  IsBtnNew = true;
  IsBtnApply = false;
  constructor(
    public pageProvider: CRM_ContactProvider,
    public env: EnvService,
    public navCtrl: NavController,

    public modalController: ModalController,
    public formBuilder: FormBuilder,
    public cdr: ChangeDetectorRef,
    public loadingController: LoadingController,
  ) {
    super();
    this.id = 0;

    this.pageConfig.isDetailPage = true;

    this.formGroup = formBuilder.group({
      Id: [''],
      WorkPhone: ['', Validators.required],
      Name: ['', Validators.required],
      Address: this.formBuilder.group({
        Id: [''],
        Phone1: [''],
        Contact: [''],
      }),
    });
    console.log(this.item);
  }

  savedChange(event): void {
    super.savedChange(event);
    this.pageProvider.getAnItem(this.item.Id).then((result) => {
      this.item = {
        Address: result['Address'],
        Code: result['Code'],
        IDAddress: result['Address'].Id,
        Id: result['Id'],
        Name: result['Name'],
        WorkPhone: result['WorkPhone'],
      };
      this.IsBtnApply = true;
      this.IsBtnNew = false;
    });
  }

  async saveChange() {
    if (this.formGroup.invalid) {
      return;
    }
    let WorkPhone = this.formGroup.controls.WorkPhone.value;
    let Name = this.formGroup.controls.Name.value;
    this.formGroup.controls.Address['controls'].Phone1.patchValue(WorkPhone);
    this.formGroup.controls.Address['controls'].Contact.patchValue(Name);
    this.formGroup.controls.Address['controls'].Phone1.markAsDirty();
    this.formGroup.controls.Address['controls'].Contact.markAsDirty();
    this.formGroup.controls.Address.markAsDirty();

    this.pageProvider.read({ WorkPhone_eq: WorkPhone }).then((results: any) => {
      if (results['data'].length > 0) {
        this.env.showTranslateMessage('Khách hàng đã tồn tại', 'warning');
        this.IsBtnApply = true;
        this.IsBtnNew = false;
        this.formGroup.controls.Name.patchValue(results['data'][0].Name);

        this.item = {
          Code: results['data'][0].Code,
          Address: results['data'][0].Addresses[0],
          IDAddress: results['data'][0].Addresses[0].Id,
          Id: results['data'][0].Id,
          Name: results['data'][0].Name,
          WorkPhone: results['data'][0].WorkPhone,
        };

        return false;
      } else {
        super.saveChange2();
      }
    });
  }
  Apply(apply = false) {
    if (apply) {
      this.modalController.dismiss(this.item);
    } else {
      this.modalController.dismiss();
    }
  }
  reset() {
    this.IsBtnApply = false;
    this.IsBtnNew = true;
    this.formGroup.reset();
  }
}
