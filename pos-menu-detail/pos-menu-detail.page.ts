import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_KitchenProvider, POS_MenuDetailProvider, POS_MenuProvider, WMS_ItemProvider,  } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { FileUploader } from 'ng2-file-upload';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-pos-menu-detail',
    templateUrl: './pos-menu-detail.page.html',
    styleUrls: ['./pos-menu-detail.page.scss'],
})
export class POSMenuDetailPage extends PageBase {

    kitchenList;
    menuDetailList;
    menuItemList = [];

    //removedItem
    removedItems = [];
    Image = "assets/pos-icons/POS-Item-demo.png";
    constructor(
        public pageProvider: POS_MenuProvider,
        public menuDetailProvider: POS_MenuDetailProvider,
        public itemProvider: WMS_ItemProvider,
        public kitchenProvider: POS_KitchenProvider,
        
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
        this.pageConfig.canEdit = true;
        this.id = this.route.snapshot?.paramMap?.get('id');
        this.id = typeof (this.id) == 'string' ? parseInt(this.id) : this.id;
        this.formGroup = formBuilder.group({
            IDBranch: [this.env.selectedBranch],
            Id: new FormControl({ value: 0, disabled: true }),
            Code: [''],
            Name: ['', Validators.required],
            Sort: [''],

            _Item: new FormControl({ value: '', disabled: false }),
            // Id: new FormControl({ value: 0, disabled: true }),
            IDItem: [''],

            // Type: [''],
            // Quantity: [''],
            // IDWarehouse: [''],
            // IDPriceList: [''],
            // IDStdCostPriceList: [''],
            // BatchSize: [''],

            IsDisabled: [false],
            Lines: this.formBuilder.array([]),
        });      
    }
    segmentView = 's1';
    segmentChanged(ev: any) {
        this.segmentView = ev.detail.value;
    }

    loadData(event) {
        this.menuItemList = [];
        Promise.all([
            this.kitchenProvider.read({ Skip: 0, Take: 5000}),
            this.menuDetailProvider.read({IDMenu: this.id, IsDeleted: false})
        ]).then(values => {
            this.kitchenList = values[0]['data'];
            this.menuDetailList = values[1]['data'];

            let counter = 0;
            this.menuDetailList.forEach(e => {

                Promise.all([
                    this.itemProvider.search({Id: e.IDItem, IsDeleted: false, AllUoM: true}).toPromise()
                ]).then(values => { 
                    
                    let data = values[0][0];
                    if (data) {
                        this.menuItemList.push(data);
                    }

                    if (counter == this.menuDetailList.length - 1) {
                        super.loadData(event);
                    }
                    counter++;
                })
            });

            if (this.menuDetailList.length == 0) {
                super.loadData(event);
            }
        });
    }


    loadedData(event) {
        this.setLines();
        this.itemSearch();
        super.loadedData(event);
        if(this.item.Image!= null){
            this.Image = environment.appDomain + this.item.Image;
        }
    }
    onFileSelected = (event) =>{
        if (event.target.files.length == 0){
            return;  
        }
        let id = this.item.Id;    
        let apiPath = {
            method: "UPLOAD",
            url: function(){return ApiSetting.apiDomain("POS/Menu/UploadPOSMenuIcons/") + id} 
        };            
        this.commonService.upload(apiPath,event.target.files[0]).then((result:any)=>{
            if(result!=null){
                this.env.showTranslateMessage('upload thành công','success');
                this.Image = environment.appDomain + result;
            }else{
                this.env.showTranslateMessage('upload thất bại','success');
            }
        });
    }
    setLines() {
        this.formGroup.controls.Lines = new FormArray([]);
        
        if (this.menuItemList.length) {
            this.menuItemList.forEach(i => {
                this.addItemLine(i);
                this.toogleKitchenSet(i);
            });
        }

        let groups = <FormArray>this.formGroup.controls.Lines;
        groups.value.sort((a, b) => a.Sort - b.Sort);
        groups.controls.sort((a, b) => a.value['Sort'] - b.value['Sort']);
        this.formGroup.controls.Lines.patchValue(groups.value);
    }

    addItemLine(line) {
        
        let stdCost = 0;
        if (line.UoMs) {
            let sUoM = line.UoMs.find(d => d.Id == line.IDUoM);
            let cost = sUoM?.PriceList.find(d => d.Type == 'StdCostPriceList');
            if (cost)
                stdCost = cost.Price;
        }

        let data = this.menuDetailList.find(d => d.IDItem == line.Id);

        let searchInput$ = new Subject<string>();
        let groups = <FormArray>this.formGroup.controls.Lines;
        let group = this.formBuilder.group({
            _ItemSearchLoading: [false],
            _ItemSearchInput: [searchInput$],
            _ItemDataSource: [searchInput$.pipe(distinctUntilChanged(),
                tap(() => group.controls._ItemSearchLoading.setValue(true)),
                switchMap(term => this.itemProvider.search({ Take: 20, Skip: 0, Keyword: term})
                    .pipe(catchError(() => of([])), tap(() => group.controls._ItemSearchLoading.setValue(false))))
            )],
            _UoMs: [line.UoMs ? line.UoMs : ''],
            _Item: [line, Validators.required],



            StdCost: new FormControl({ value: stdCost, disabled: true }),
            // TotalPrice: new FormControl({ value: 0, disabled: true }),
            // TotalStdCost: new FormControl({ value: 0, disabled: true }),

            IDMenu: [this.id],
            Id: [data ? data.Id : 0],
            Name: [line.Name ? line.Name : line._Item?.Name],
            IDItem: [line.Id, Validators.required],
            IDKitchen: [data ? data.IDKitchen : null],
            IDUoM: new FormControl({ value: line.SalesUoM, required: false, disabled: false }),
            UoMPrice: [line.UoMPrice],
            Image: new FormControl({ value: data?.Image ? data.Image : '', disabled: false }),
            // Quantity: [line.Quantity],
            // Remark: [line.Remark],
            Sort: [data ? data.Sort : null],
        });

        groups.push(group);
        this.changedIDItem(group, line);
    }


    itemList$
    itemListLoading = false;
    itemListInput$ = new Subject<string>();
    itemListSelected = [];
    itemSearch() {
        this.itemListLoading = false;
        this.itemList$ = concat(
            of(this.itemListSelected),
            this.itemListInput$.pipe(
                distinctUntilChanged(),
                tap(() => this.itemListLoading = true),
                switchMap(term => this.itemProvider.search({ Take: 20, Skip: 0, Term: term, AllUoM: true}).pipe(
                    catchError(() => of([])), // empty list on error
                    tap(() => this.itemListLoading = false)
                ))

            )
        );
    }

    changedIDItem(group, e, submit = false) {

        if (e) {

            group.controls._UoMs.setValue(e.UoMs);
            group.controls.IDItem.setValue(e.Id);
            group.controls.IDItem.markAsDirty();
            group.controls.IDUoM.setValue(e.SalesUoM);

            if (this.pageConfig.canEdit) {
                group.controls._Item.enable();
                group.controls.IDUoM.enable();
                group.controls.Image.enable();
            }
            else {
                group.controls._Item.disable();
                group.controls.IDUoM.disable();
                group.controls.Image.disable();
            }

            // group.controls.IDUoM.disable(); //Currently Disabled

            this.changedIDUoM(group, e, submit);
        }
    }

    changedIDUoM(group, e, submit) {
        let selectedUoM = group.controls._UoMs.value.find(d => d.Id == group.controls.IDUoM.value);
        if (selectedUoM) {
            let cost = selectedUoM.PriceList.find(d => d.Type == 'StdCostPriceList');
            if (cost) {
                group.controls.StdCost.setValue(cost.Price);
            }
            else {
                group.controls.StdCost.setValue(0);
            }

            let price = selectedUoM.PriceList.find(d => d.Type == 'PriceList');
            if (price) {
                group.controls.UoMPrice.setValue(price.Price);
            }
            else {
                group.controls.UoMPrice.setValue(0);
            }

            group.controls.UoMPrice.markAsDirty();

            if (submit) this.saveItemChange(e);
        }
    }

    async saveItemChange(item) {
        
        let savingItem;
        let index = this.menuItemList.findIndex(i => i.Id == item.Id);

        if (index == -1) {
            savingItem = {
                IDMenu: this.id,
                IDItem: item.Id,
                IDKitchen: null,
            };
        }
        else {
            let data = this.menuDetailList.find(d => d.IDItem == item.Id);

            savingItem = {
                Id: data.Id,
                IDMenu: this.id,
                IDItem: item.Id,
                IDKitchen: data.IDKitchen,
            };
        }

        this.menuDetailProvider.save(savingItem).then((savedData: any) => {
            if (this.menuDetailList.findIndex(i => i.Id == savedData.Id) == -1) {
                this.menuDetailList.push(savedData);
                let line = this.formGroup['controls']['Lines']['value'].find(l => l.IDItem == savedData.IDItem);
                line.Id = savedData.Id;

                let index = this.formGroup['controls']['Lines']['value'].findIndex(l => l.IDItem == savedData.IDItem);
                this.formGroup['controls']['Lines']['controls'][index]['controls']['Id'].setValue(savedData.Id);
                
                this.menuItemList.push(item);
            }
            this.env.showTranslateMessage('erp.app.app-component.page-bage.save-complete','success');
        });

    }

    toogleKitchenSet(item, kit?) {

        let data = this.menuDetailList.find(d => d.IDItem == item.Id);

        if (kit) {
            let line = this.formGroup['controls']['Lines']['value'].find(l => l.IDItem == data.IDItem);

            if (line.IDKitchen != kit.Id) {
                line.IDKitchen = kit.Id;
                data.IDKitchen = kit.Id;
    
                let savingItem = {
                    Id: data.Id,
                    IDMenu: this.id,
                    IDItem: item.Id,
                    IDKitchen: data.IDKitchen,
                };
    
                this.menuDetailProvider.save(savingItem).then((savedData: any) => {
                    if (this.menuDetailList.findIndex(i => i.Id == savedData.Id) == -1) {
                        this.menuDetailList.push(savedData);
                    }
                    this.env.showTranslateMessage('erp.app.app-component.page-bage.save-complete','success');
                }).catch(err => {
                    this.env.showTranslateMessage(err, 'danger');
                })
            }
            else { // Unselect
                line.IDKitchen = null;
                data.IDKitchen = null;

                let savingItem = {
                    Id: data.Id,
                    IDMenu: this.id,
                    IDItem: item.Id,
                    IDKitchen: null,
                };

                this.menuDetailProvider.save(savingItem).then((savedData: any) => {
                    if (this.menuDetailList.findIndex(i => i.Id == savedData.Id) == -1) {
                        this.menuDetailList.push(savedData);
                    }
                    this.env.showTranslateMessage('erp.app.app-component.page-bage.save-complete','success');
                }).catch(err => {
                    this.env.showTranslateMessage(err, 'danger');
                });
            }
        }
    }

    removeItemLine(index, permanentlyRemove = true) {
        
        this.alertCtrl.create({
            header: 'Xóa sản phẩm',
            //subHeader: '---',
            message: 'Bạn chắc muốn xóa sản phẩm này?',
            buttons: [
                {
                    text: 'Không',
                    role: 'cancel',
                },
                {
                    text: 'Đồng ý xóa',
                    cssClass: 'danger-btn',
                    handler: () => {
                        let groups = <FormArray>this.formGroup.controls.Lines;
                        let Ids = [];
                        Ids.push({ Id: groups.controls[index]['controls'].Id.value });
                        // this.removedItems.push({ Id: groups.controls[index]['controls'].Id.value });

                        if(permanentlyRemove)
                        {
                            this.menuDetailProvider.delete(Ids).then(resp => {
                                groups.removeAt(index);
                                this.env.showTranslateMessage('erp.app.pages.product.bill-of-material.message.delete-complete','success');
                            });
                        }
                    }
                }
            ]
        }).then(alert => {
            alert.present();
        })
    }

    doReorder(ev, groups) {
        groups = ev.detail.complete(groups);
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            g.controls.Sort.setValue(i+1);
            g.controls.Sort.markAsDirty();
        }

        let counter = 0;
        let max = this.formGroup.controls.Lines.value.length;
        this.submitAttempt = true;

        this.formGroup.controls.Lines.value.forEach(i => {
            let savingItem = {
                Id: i.Id,
                Sort: i.Sort,
            };
            this.menuDetailProvider.save(savingItem).then((savedData: any) => {

                if (counter == max - 1) {
                    this.env.showTranslateMessage('erp.app.app-component.page-bage.save-complete' ,'success');
                    this.submitAttempt = false;
                }
                counter++;
            }).catch(err => {
                this.env.showTranslateMessage(err ,'danger');
                this.submitAttempt = false;
            });
        });
    }

    // saveImageURL(ev) {
    //     let i = ev.value;
    //     let savingItem = {
    //         Id: i.Id,
    //         Image: i.Image,
    //     };
    //     this.menuDetailProvider.save(savingItem).then((savedData: any) => { 
    //         this.env.showTranslateMessage('erp.app.app-component.page-bage.save-complete' ,'success');
    //         this.submitAttempt = false;
    //     }).catch(err => {
    //         this.env.showTranslateMessage(err ,'danger');
    //         this.submitAttempt = false;
    //     })
    // }

    async saveChange() {
        super.saveChange2();
    }
}
