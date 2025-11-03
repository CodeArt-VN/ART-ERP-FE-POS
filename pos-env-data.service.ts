import { Injectable } from '@angular/core';
import { EnvService } from 'src/app/services/core/env.service';
import { POS_KitchenProvider, POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider } from 'src/app/services/static/services.service';
import { environment } from 'src/environments/environment.prod';

@Injectable({
	providedIn: 'root',
})
export class POSEnviromentDataService {
	constructor(
		public env: EnvService,
		public menuProvider: POS_MenuProvider,
		public kitchenProvider: POS_KitchenProvider,
		public tableGroupProvider: POS_TableGroupProvider,
		public tableProvider: POS_TableProvider
	) {}

	public getMenu(forceReload) {
		return new Promise((resolve, reject) => {
			this.env
				.getStorage('menuList' + this.env.selectedBranch)
				.then((data) => {
					if (!forceReload && data) {
						resolve(data);
					} else {
						this.menuProvider
							.read({ IDBranch: this.env.selectedBranch })
							.then((resp) => {
								let menuList = resp['data'];
								menuList.forEach((m: any) => {
									m.menuImage = environment.posImagesServer + (m.Image ? m.Image : 'assets/pos-icons/POS-Item-demo.png');
									m.Items.forEach((i) => {
										i.imgPath = environment.posImagesServer + (i.Image ? i.Image : 'assets/pos-icons/POS-Item-demo.png');
									});
								});
								this.env.setStorage('menuList' + this.env.selectedBranch, menuList);
								resolve(menuList);
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

	public getTable(forceReload) {
		return new Promise((resolve, reject) => {
			this.getTableGroupTree(forceReload)
				.then((data: any) => {
					let tableList = [];

					data.forEach((g) => {
						tableList.push({
							Id: 0,
							Name: g.Name,
							levels: [],
							disabled: true,
						});
						g.TableList.forEach((t) => {
							tableList.push({
								Id: t.Id,
								Name: t.Name,
								levels: [{}],
							});
						});
					});

					resolve(tableList);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	private getTableGroupTree(forceReload) {
		return new Promise((resolve, reject) => {
			this.env
				.getStorage('tableGroup' + this.env.selectedBranch)
				.then((data) => {
					if (!forceReload && data) {
						resolve(data);
					} else {
						let query = { IDBranch: this.env.selectedBranch };
						Promise.all([this.tableGroupProvider.read(query), this.tableProvider.read(query)])
							.then((values) => {
								let tableGroupList = values[0]['data'];
								let tableList = values[1]['data'];

								tableGroupList.forEach((g) => {
									g.TableList = tableList.filter((d) => d.IDTableGroup == g.Id);
								});
								this.env.setStorage('tableGroup' + this.env.selectedBranch, tableGroupList);
								resolve(tableGroupList);
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

	public getDeal(query = null) {
			return new Promise((resolve, reject) => {
				this.menuProvider.commonService
					.connect('GET', 'PR/Deal/ForPOS', query)
					.toPromise()
					.then((result: any) => {
						resolve(result);
					})
					.catch((err) => {
						reject(err);
					});
			});
		}
}
