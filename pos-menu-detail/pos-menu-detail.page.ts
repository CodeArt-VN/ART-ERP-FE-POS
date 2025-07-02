import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_KitchenProvider, POS_MenuDetailProvider, POS_MenuProvider, WMS_ItemProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';

@Component({
	selector: 'app-pos-menu-detail',
	templateUrl: './pos-menu-detail.page.html',
	styleUrls: ['./pos-menu-detail.page.scss'],
	standalone: false,
})
export class POSMenuDetailPage extends PageBase {
	kitchenList;
	menuDetailList;
	menuItemList = [];

	//removedItem
	removedItems = [];
	Image = 'assets/pos-icons/POS-Item-demo.png';
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
		public popoverCtrl: PopoverController
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.pageConfig.canEdit = true;
		this.id = this.route.snapshot?.paramMap?.get('id');
		this.id = typeof this.id == 'string' ? parseInt(this.id) : this.id;
		this.formGroup = formBuilder.group({
			IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: 0, disabled: true }),
			Code: [''],
			Name: ['', Validators.required],
			Sort: [''],

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
	preLoadData(event?: any): void {
		Promise.all([this.kitchenProvider.read({ IDBranch: this.env.selectedBranch,Skip: 0, Take: 5000, })]).then((values) => {
			this.kitchenList = values[0]['data'];
			super.preLoadData(event);
		});
	}
	// loadData(event) {
	// 	this.menuItemList = [];
	// 	Promise.all([this.kitchenProvider.read({ Skip: 0, Take: 5000 }), this.menuDetailProvider.read({ IDMenu: this.id, IsDisable: '' })]).then((values) => {
	// 		this.kitchenList = values[0]['data'];
	// 		this.menuDetailList = values[1]['data'];

	// 		let counter = 0;
	// 		this.menuDetailList.forEach((e) => {
	// 			Promise.all([this.itemProvider.search({ Id: e.IDItem, AllUoM: true }).toPromise()]).then((values) => {
	// 				let data = values[0][0];
	// 				if (data) {
	// 					this.menuItemList.push(data);
	// 				}

	// 				if (counter == this.menuDetailList.length - 1) {
	// 					super.loadData(event);
	// 				}
	// 				counter++;
	// 			});
	// 		});

	// 		if (this.menuDetailList.length == 0) {
	// 			super.loadData(event);
	// 		}
	// 	});
	// }

	loadedData(event) {
		this.setLines();
		this.itemSearch();
		super.loadedData(event);
		if (this.item.Image != null) {
			this.Image = environment.posImagesServer + this.item.Image;
		}
	}

	onFileSelected = (event) => {
		if (event.target.files.length == 0) {
			return;
		}
		let id = this.item.Id;
		let apiPath = {
			method: 'UPLOAD',
			url: function () {
				return ApiSetting.apiDomain('POS/Menu/UploadPOSMenuIcons/') + id;
			},
		};
		this.commonService.upload(apiPath, event.target.files[0]).then((result: any) => {
			if (result != null) {
				this.env.showMessage('upload thành công', 'success');
				this.Image = environment.posImagesServer + result;
			} else {
				this.env.showMessage('upload thất bại', 'success');
			}
		});
	};
	setLines() {
		this.formGroup.controls.Lines = new FormArray([]);

		if (this.item?.Lines?.length) {
			const sortedLines = this.item?.Lines?.slice().sort((a, b) => a.Sort - b.Sort);
			sortedLines.forEach((i) => {
				this.addItemLine(i);
				// this.toogleKitchenSet(i);
			});
		}

		let groups = <FormArray>this.formGroup.controls.Lines;
		groups.value.sort((a, b) => a.Sort - b.Sort);
		groups.controls.sort((a, b) => a.value['Sort'] - b.value['Sort']);
		this.formGroup.controls.Lines.patchValue(groups.value);
	}

	addItemLine(line) {
		// let data = this.item.Lines.find((d) => d.IDItem == line.Id);

		let searchInput$ = new Subject<string>();
		let groups = <FormArray>this.formGroup.controls.Lines;
		let group = this.formBuilder.group({
			_IDItemDataSource: this.buildSelectDataSource((term) => {
				return this.itemProvider.commonService.connect('GET', 'WMS/Item/SearchPOSItem', {
					SortBy: ['Id_desc'],
					Take: 20,
					Skip: 0,
					Term: term,
				});
			}),
			// _ItemSearchLoading: [false],
			// _ItemSearchInput: [searchInput$],
			// _ItemDataSource: [
			// 	searchInput$.pipe(
			// 		distinctUntilChanged(),
			// 		tap(() => group.controls._ItemSearchLoading.setValue(true)),
			// 		switchMap((term) =>
			// 			this.itemProvider.commonService.connect('GET', 'WMS/Item/SearchPOSItem', { Take: 20, Skip: 0, Keyword: term }).pipe(
			// 				catchError(() => of([])),
			// 				tap(() => group.controls._ItemSearchLoading.setValue(false))
			// 			)
			// 		)
			// 	),
			// ],
			_UoMs: [line.UoMs ? line.UoMs : ''],
			IDMenu: [this.id],
			Id: [line?.Id],
			Name: [line?.Name],
			Code: [line?.Code],
			IDItem: [line?.IDItem, Validators.required],
			IDKitchen: [line?.IDKitchen],
			IDUoM: [line?.UoMs?.find((d) => d.Id == line?.SalesUoM)?.Id || null],
			UoMPrice: [line?.UoMPrice],
			// Image: new FormControl({
			// 	value: data?.Image ? data.Image : '',
			// 	disabled: false,
			// }),
			// Quantity: [line.Quantity],
			// Remark: [line.Remark],
			Sort: [line?.Sort],
			IsDisabled: [line?.IsDisabled],
		});
		if(line?._Item) group.get('_IDItemDataSource').value.selected.push(line?._Item);
		group.get('_IDItemDataSource').value.initSearch();
		groups.push(group);
		// this.changedIDItem(group, line);
	}

	itemList$;
	itemListLoading = false;
	itemListInput$ = new Subject<string>();
	itemListSelected = [];
	itemSearch() {
		this.itemListLoading = false;
		this.itemList$ = concat(
			of(this.itemListSelected),
			this.itemListInput$.pipe(
				distinctUntilChanged(),
				tap(() => (this.itemListLoading = true)),
				switchMap((term) =>
					this.itemProvider.search({ Take: 20, Skip: 0, Term: term, AllUoM: true }).pipe(
						catchError(() => of([])), // empty list on error
						tap(() => (this.itemListLoading = false))
					)
				)
			)
		);
	}

	changedIDItem(group, e, submit = false) {
		if (e) {
			group.controls._UoMs.setValue(e.UoMs);
			group.controls.IDItem.setValue(e.Id);
			group.controls.IDItem.markAsDirty();
			if (e.SalesUoM) {
				group.controls.IDUoM.setValue(e.SalesUoM);
				group.controls.IDUoM.markAsDirty();
			}
			// group.controls.IDUoM.disable(); //Currently Disabled

			// this.changedIDUoM(group, e, submit);
		} else {
			group.controls.IDItem.setValue(null);
			group.controls.IDUoM.setValue(null);
		}
		if (submit) {
			this.saveChange2();
		}
	}

	saveItemChange(item) {
		let savingItem;
		let index = this.menuItemList.findIndex((i) => i.Id == item.Id);

		if (index == -1) {
			savingItem = {
				IDMenu: this.id,
				IDItem: item.Id,
				IDKitchen: null,
			};
		} else {
			let data = this.menuDetailList.find((d) => d.IDItem == item.Id);

			savingItem = {
				Id: data.Id,
				IDMenu: this.id,
				IDItem: item.Id,
				IDKitchen: data.IDKitchen,
			};
		}

		this.menuDetailProvider.save(savingItem).then((savedData: any) => {
			if (this.menuDetailList.findIndex((i) => i.Id == savedData.Id) == -1) {
				this.menuDetailList.push(savedData);
				let line = this.formGroup['controls']['Lines']['value'].find((l) => l.IDItem == savedData.IDItem);
				line.Id = savedData.Id;

				let index = this.formGroup['controls']['Lines']['value'].findIndex((l) => l.IDItem == savedData.IDItem);
				this.formGroup['controls']['Lines']['controls'][index]['controls']['Id'].setValue(savedData.Id);

				this.menuItemList.push(item);
			}
			this.env.showMessage('Saving completed!', 'success');
		});
	}

	toogleKitchenSet(group, kit?) {
		// let data = this.menuDetailList.find((d) => d.IDItem == item.Id);
		if (group.controls.IDKitchen.value == kit.Id) {
			group.controls.IDKitchen.setValue(null);
		} else group.controls.IDKitchen.setValue(kit.Id);
		group.controls.IDKitchen.markAsDirty();
		this.saveChange2();
	}
	lock(index) {
		let groups = <FormArray>this.formGroup.controls.Lines;
		let isDisable = !groups.controls[index]['controls'].IsDisabled.value;
		groups.controls[index]['controls'].IsDisabled.setValue(isDisable);

		this.menuDetailProvider.disable([{ Id: groups.controls[index]['controls'].Id.value }], isDisable).then((resp) => {
			console.log(resp);
			this.env.showMessage('Saved change!', 'success');
		});
	}
	removeItemLine(index, permanentlyRemove = true) {
		this.alertCtrl
			.create({
				header: 'Xóa sản phẩm',
				//subHeader: '---',
				message: 'Bạn có chắc muốn xóa sản phẩm này?',
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
							Ids.push({
								Id: groups.controls[index]['controls'].Id.value,
							});
							// this.removedItems.push({ Id: groups.controls[index]['controls'].Id.value });

							if (permanentlyRemove) {
								this.menuDetailProvider.delete(Ids).then((resp) => {
									groups.removeAt(index);
									this.env.showMessage('Deleted!', 'success');
								});
							}
						},
					},
				],
			})
			.then((alert) => {
				alert.present();
			});
	}

	doReorder(ev, groups) {
		groups = ev.detail.complete(groups);
		for (let i = 0; i < groups.length; i++) {
			const g = groups[i];
			g.controls.Sort.setValue(i + 1);
			g.controls.Sort.markAsDirty();
		}
		this.saveChange();
	}

	// saveImageURL(ev) {
	//     let i = ev.value;
	//     let savingItem = {
	//         Id: i.Id,
	//         Image: i.Image,
	//     };
	//     this.menuDetailProvider.save(savingItem).then((savedData: any) => {
	//         this.env.showTranslateMessage('Saving completed!' ,'success');
	//         this.submitAttempt = false;
	//     }).catch(err => {
	//         this.env.showTranslateMessage(err ,'danger');
	//         this.submitAttempt = false;
	//     })
	// }

	async saveChange() {
		super.saveChange2();
	}

	savedChange(savedItem = null, form = this.formGroup) {
		super.savedChange(savedItem, form);
		let groups = <FormArray>this.formGroup.controls.Lines;
		let idsBeforeSaving = new Set(groups.controls.map((g) => g.get('Id').value));
		this.item = savedItem;
		if (this.item.Lines?.length > 0) {
			let newIds = new Set(this.item.Lines.map((i) => i.Id));
			const diff = [...newIds].filter((item) => !idsBeforeSaving.has(item));
			if (diff?.length > 0) {
				groups.controls
					.find((d) => !d.get('Id').value)
					?.get('Id')
					.setValue(diff[0]);
			}
		}
	}
}
