import { Component, ChangeDetectorRef, ViewChild } from '@angular/core';
import { NavController, LoadingController, AlertController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_KitchenProvider, POS_MenuDetailProvider, POS_MenuProvider, WMS_ItemProvider } from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
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
	Image;
	noImage = environment.posImagesServer + 'assets/pos-icons/POS-Item-demo.png';

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
			DeletedLines: [[]],
		});
	}
	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}
	preLoadData(event?: any): void {
		Promise.all([this.kitchenProvider.read({ IDBranch: this.env.selectedBranch, Skip: 0, Take: 5000 })]).then((values) => {
			this.kitchenList = values[0]['data'];
			super.preLoadData(event);
		});
	}

	loadedData(event) {
		super.loadedData(event);
		this.setLines();
		if (this.item.Image != null) {
			this.Image = environment.posImagesServer + this.item.Image;
		}
	}

	@ViewChild('uploadImage') uploadImage: any;
	uploadContext = {
		isParent: true,
		id: null,
	};
	onClickUpload(isParent: boolean, id: number) {
		this.uploadContext = { isParent, id };
		this.uploadImage.nativeElement.value = ''; // reset
		this.uploadImage.nativeElement.click();
	}

	onFileSelected = (event) => {
		if (event.target.files.length == 0 && !this.uploadContext) {
			return;
		}

		let apiDomain = this.uploadContext.isParent ? 'POS/Menu/UploadPOSMenuIcons/' : 'POS/Menu/UploadPOSMenuDetailIcons/';
		let id = this.uploadContext.id;
		let apiPath = {
			method: 'UPLOAD',
			url: function () {
				return ApiSetting.apiDomain(apiDomain) + id;
			},
		};

		this.commonService.upload(apiPath, event.target.files[0]).then((result: any) => {
			if (result != null) {
				this.env.showMessage('upload thành công', 'success');
				const envImage = environment.posImagesServer + result;
				if (this.uploadContext.isParent) {
					this.Image = envImage;
				} else {
					let groups = <FormArray>this.formGroup.controls.Lines;
					let group = groups.controls.find((g) => g.get('Id').value == id);
					if (group) {
						group.get('Image').setValue(envImage);
						//group.get('Image').markAsDirty();
					}
				}
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
		let groups = <FormArray>this.formGroup.controls.Lines;
		let group = this.formBuilder.group({
			_IDItemDataSource: this.buildSelectDataSource((term) => {
				return this.pageProvider.commonService.connect('GET', 'POS/Menu/ItemSearch/',{
					// IsVendorSearch: this._IDVendor ? true : false,
					IsSalesItem: true,
					SortBy: ['Id_desc'],
					Take: 20,
					Skip: 0,
					Term: term,
				});
			}),

			IDMenu: [this.id],
			Id: [line?.Id],
			Name: [line?.Name],
			Code: [line?.Code],
			IDItem: [line?.IDItem, Validators.required],
			IDKitchen: [line?.IDKitchen],
			IDKitchens: [line?.IDKitchens],
			IDKitchenArray: [line?.IDKitchens ?[].concat(JSON.parse(line.IDKitchens)):[]],

			Sort: [line?.Sort],
			IsChecked: [false],
			IsDisabled: [line?.IsDisabled],
			Image: environment.posImagesServer + [line?.Image],
		});
		if (line?._Item) group.get('_IDItemDataSource').value.selected.push(line?._Item);
		group.get('_IDItemDataSource').value.initSearch();
		groups.push(group);
		// this.changedIDItem(group, line);
	}

	toogleKitchenSet(group, kit?) {
		// let data = this.menuDetailList.find((d) => d.IDItem == item.Id);
		let ids = group.value.IDKitchenArray;
		if(ids.includes(kit?.Id)){
			ids = ids.filter(d=> d != kit?.Id);
		}
		else ids.push(kit?.Id);
		group.controls.IDKitchenArray.setValue(ids);
		group.controls.IDKitchens.setValue(JSON.stringify(ids));
		group.controls.IDKitchens.markAsDirty();
		this.saveChange2();
	}
	isHaveKitchen(g,id){
		return g.value.IDKitchenArray.includes(id);
	}
	lock(g) {
		let groups = <FormArray>this.formGroup.controls.Lines;
		let isDisable = !g.controls.IsDisabled.value;
		g.controls.IsDisabled.setValue(isDisable);

		this.menuDetailProvider.disable([{ Id: g.controls.Id.value }], isDisable).then((resp) => {
			console.log(resp);
			this.env.showMessage('Saved change!', 'success');
		});
	}

	removeLine(index) {
		let groups = <FormArray>this.formGroup.controls.Lines;
		let group = groups.controls[index];
		if (group.get('Id').value) {
			this.env
				.showPrompt('Bạn có chắc muốn xóa sản phẩm?', null, 'Xóa sản phẩm')
				.then((_) => {
					let Ids = [];
					Ids.push(groups.controls[index].get('Id').value);
					// this.removeItem.emit(Ids);
					if (Ids && Ids.length > 0) {
						this.formGroup.get('DeletedLines').setValue(Ids);
						this.formGroup.get('DeletedLines').markAsDirty();
						//this.item.DeletedLines = Ids;
						this.saveChange().then((_) => {
							Ids.forEach((id) => {
								let index = groups.controls.findIndex((x) => x.get('Id').value == id);
								if (index >= 0) groups.removeAt(index);
							});
						});
					}
				})
				.catch((_) => {});
		} else groups.removeAt(index);
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
			if (diff?.length == 1) {
				groups.controls
					.find((d) => !d.get('Id').value)
					?.get('Id')
					.setValue(diff[0]);
			} else if (diff?.length > 1) {
				this.loadedData(null);
			}
		}
	}
	selectedLines = new FormArray([]);
	isAllChecked = false;
	toggleSelectAll() {
		this.isAllChecked = !this.isAllChecked;
		if (!this.pageConfig.canEdit) return;
		let groups = <FormArray>this.formGroup.controls.Lines;
		if (!this.isAllChecked) {
			this.selectedLines = new FormArray([]);
		}
		groups.controls.forEach((i) => {
			i.get('IsChecked').setValue(this.isAllChecked);
			i.get('IsChecked').markAsPristine();

			if (this.isAllChecked) this.selectedLines.push(i);
		});
	}
	removeSelectedItems() {
		let groups = <FormArray>this.formGroup.controls.Lines;
		if (this.selectedLines.controls.some((g) => g.get('Id').value)) {
			this.env
				.showPrompt({ code: 'ACTION_DELETE_MESSAGE', value: { value: this.selectedLines.length } }, null, {
					code: 'ACTION_DELETE_MESSAGE',
					value: { value: this.selectedLines.length },
				})
				.then((_) => {
					let Ids = this.selectedLines.controls.map((fg) => fg.get('Id').value);
					// this.removeItem.emit(Ids);
					if (Ids && Ids.length > 0) {
						this.formGroup.get('DeletedLines').setValue(Ids);
						this.formGroup.get('DeletedLines').markAsDirty();
						//this.item.DeletedLines = Ids;
						this.saveChange().then((_) => {
							Ids.forEach((id) => {
								let index = groups.controls.findIndex((x) => x.get('Id').value == id);
								if (index >= 0) groups.removeAt(index);
							});
						});
					}
					this.selectedLines = new FormArray([]);
				})
				.catch((_) => {});
		} else if (this.selectedLines.controls.length > 0) {
			this.selectedLines.controls
				.map((fg) => fg.get('Id').value)
				.forEach((id) => {
					let index = groups.controls.findIndex((x) => x.get('Id').value == id);
					if (index >= 0) groups.removeAt(index);
				});
			this.selectedLines = new FormArray([]);
		} else {
			this.env.showMessage('Please select at least one item to remove', 'warning');
		}
	}

	changeSelection(i, e = null) {
		if (i.get('IsChecked').value) {
			this.selectedLines.push(i);
		} else {
			let index = this.selectedLines.getRawValue().findIndex((d) => d.Id == i.get('Id').value);
			this.selectedLines.removeAt(index);
		}
		i.get('IsChecked').markAsPristine();
	}
}
