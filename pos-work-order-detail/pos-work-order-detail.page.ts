import { Component, DoCheck, HostListener } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { POS_KitchenProvider, SALE_OrderDetailProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { EnvService } from 'src/app/services/core/env.service';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { lib } from 'src/app/services/static/global-functions';
import { CommonService } from 'src/app/services/core/common.service';
import { POSWorkOrder, POSWorkOrderItem, POSWorkOrderZone } from '../_services/interface.model';
import { forEachChild } from 'typescript';
import { printData, PrintingService } from 'src/app/services/util/printing.service';
import { Subscription } from 'rxjs';
import { POSService } from '../_services/pos.service';

@Component({
	selector: 'app-pos-work-order-detail',
	templateUrl: 'pos-work-order-detail.page.html',
	styleUrls: ['pos-work-order-detail.page.scss'],
	standalone: false,
})
export class POSWorkOrderDetailPage extends PageBase implements DoCheck {
	_selectingZone = '0';
	_selectOrder = false;
	_selectItem = false;
	_toZoneId = '0';
	_fromZoneId = '0';
	_useKeyboard = false;
	_showReturnedColumn = true;
	currentNow = Date.now();
	eventSubscription: Subscription;
	Kitchens = [];
	KitchenNow: any;
	KitchenName: string;
	zones: POSWorkOrderZone[] = [];
	orderDetailStatusList = [];

	constructor(
		public posKitchen: POS_KitchenProvider,
		public commonService: CommonService,
		public orderDetailProvider: SALE_OrderDetailProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public popoverCtrl: PopoverController,
		public formBuilder: FormBuilder,
		public printingService: PrintingService,
		public posService: POSService,
	) {
		super();
		this.pageConfig.ShowRefresh = false;
		this.pageConfig.ShowHelp = false;
		this.pageConfig.isDetailPage = true;
	}

	preLoadData(event?: any): void {
		this.posKitchen.read().then((resp: any) => {
			this.Kitchens = resp['data'];
			this.KitchenNow = this.Kitchens.find((s) => s.Id === Number(this.id));
			this.KitchenName = this.KitchenNow?.Name || '';
		});
		Promise.all([
			this.env.getStatus('POSOrderDetail'),
		]).then((values) => {
			if (values[0]) {
				this.orderDetailStatusList = values[0];
			}
			super.preLoadData(event);
		});

		super.preLoadData(event);
	}

	ngOnInit() {
		this.eventSubscription = this.env.getEvents().subscribe((data: any) => {
			const eventCode = data.code || data.Code;
			if (!eventCode) return;

			if (eventCode.startsWith('signalR:')) {
				let value;
				try {
					value = JSON.parse(data.value);
				} catch (err) {
					return;
				}
				if (value.IDBranch != this.env.selectedBranch) return;

				switch (eventCode) {
					case 'signalR:POSOrderFromCustomer':
					case 'signalR:POSOrderFromStaff':
					case 'signalR:POSOrderPaymentUpdate':
					case 'signalR:POSOrderMergedFromStaff':
					case 'signalR:POSOrderSplittedFromStaff':
					case 'signalR:POSLockOrderFromStaff':
					case 'signalR:POSLockOrderFromCustomer':
					case 'signalR:POSUnlockOrderFromStaff':
					case 'signalR:POSUnlockOrderFromCustomer':
					case 'signalR:POSSupport':
					case 'signalR:POSCallToPay':
					case 'signalR:POSPaymentSuccess':
						this.refreshFromEvent();
						break;
				}
			}
		});

		super.ngOnInit();
	}

	ngOnDestroy() {
		this.eventSubscription?.unsubscribe();
		super.ngOnDestroy?.();
	}

	refreshFromEvent() {
		if (!this.orderList || this.orderList.length === 0) {
			this.loadData(null, true);
			return;
		}

		this.commonService.connect('GET', 'POS/WorkOrder/GetService/' + this.id, null).toPromise().then(
			(data: any) => {
				if (this.hasNewKitchenItems(this.orderList, data)) {
					this.orderList = data;
					this.loadedData();
				} else {
					console.log('No new kitchen items for work order', this.id);
				}
			}
		);
	}

	private hasNewKitchenItems(oldOrders: any[], newOrders: any[]): boolean {
		if (oldOrders.length != newOrders.length) {
			return true;
		}

		const existingLineIds = new Set<number>();
		oldOrders.forEach((order: any) => {
			order.OrderLines?.forEach((line: any) => {
				if (line.Id != null) existingLineIds.add(line.Id);
			});
		});

		return newOrders.some((order: any) => {
			return order.OrderLines?.some((line: any) => line.Id != null && !existingLineIds.has(line.Id));
		});
	}

	orderList = [];
	loadData(event?: null, forceReload?: boolean): void {
		forceReload = event === 'force';
		Promise.all([
			this.posService.getEnviromentDataSource(this.env.selectedBranch, forceReload),
			this.env.getStorage('POSQuantityConfig'),
			this.env.getStorage('POSTerminalConfig'),
		])
			.then((values) => {
				console.log('POS environment data loaded', this.posService.dataSource, this.posService.systemConfig);
			})
			.catch((err) => {
				console.log(err);
				this.env.showErrorMessage(err);

				this.loadedData(event);
			});

		this.commonService.connect('GET', 'POS/WorkOrder/GetService/' + this.id, null).toPromise().then(
			(data: any) => {
				console.log(data);
				this.orderList = data;
				this.loadedData(event);
			}
		);


	}

	loadedData(event?: any): void {
		this.zones = this.getZones();
		this.loadPermission();
		this.zones.forEach((zone) => (zone.orders = this.getOrders(this.orderList).filter((order) => order.status === zone.name)));
		super.loadedData(event);
	}

	getZones() {
		const listStatus = ['Waiting', 'Inprogress', 'Ready', 'Serving', 'Returned'];
		return listStatus
			.map((code, index) => {
				const status = this.orderDetailStatusList.find((status) => status.Code === code);
				if (!status) {
					return null;
				}
				return {
					id: (index + 1).toString(),
					name: status.Code,
					title: status.Name,
					color: status.Color,
					orders: [],
				};
			})
			.filter((zone): zone is POSWorkOrderZone => zone !== null);
	}

	loadPermission() {
		this._useKeyboard = this.pageConfig.canUseKeyboard;
	}

	@HostListener('document:keydown', ['$event'])
	handleKey(event: KeyboardEvent) {
		if (!this._useKeyboard || this.currentAlert) return;

		const key = event.key;
		const zone = this._selectingZone;

		// HANDLE ITEM
		if (this._selectItem) {
			if (key === '0') {
				this.backOrder();
				this.removeKeyItems();
			} else {
				this.changeStatusItems(key);
			}
			return;
		}

		// HANDLE ORDER
		if (this._selectOrder) {
			const orderActions: any = {
				'1': {
					'1': () => { if (this.pageConfig.canReceive) this.changeStatusItemInOrder('1', '2') },
					'2': () => { if (this.pageConfig.canReturn) this.changeStatusItemInOrder('1', '5') },
					'3': () => { if (this.pageConfig.canReceive) this.changeStatusOrder('1', '2') },
				},
				'2': {
					'1': () => { if (this.pageConfig.canReady) this.changeStatusItemInOrder('2', '3') },
				},
				'3': {
					'1': () => { if (this.pageConfig.canConfirm) this.changeStatusItemInOrder('3', '4') },
					// '2': () => this.changeStatusOrder('3', '4'),
				},
				'5': {
					'1': () => { if (this.pageConfig.canReorder) this.changeStatusItemInOrder('5', '1') },
				}
			};

			if (key === '0') return this.backOrder();

			orderActions[zone]?.[key]?.();
			return;
		}

		// HANDLE TOOLBAR
		if (zone === '9') {
			const toolbarActions: any = {
				'0': () => {
					this._hideOrderDetails = false;
					this.backZone();
				},
				'1': () => this.toggleFullscreen(),
				'2': () => this.hideOrderDetails(),
				'3': () => this.showReturnedColumn(),
				'4': () => this.useKeyboard(),
			};

			toolbarActions[key]?.();
			return;
		}

		// HANDLE SELECT ORDER IN ZONE
		if (['1', '2', '3', '5'].includes(zone)) {
			if (key === '0') return this.backZone();
			return this.selectOrder(key, zone);
		}

		// HANDLE SELECT ZONE
		switch (key) {
			case '1':
			case '2':
			case '3':
			case '5':
				this.selectZone(key);
				break;
			case '9':
				this.selectToolbar();
				break;
		}
	}

	private getOrders(data: any): POSWorkOrder[] {
		const statuses = this.zones.map((d: any) => d.name);

		const listPOSWorkOrder: POSWorkOrder[] = data.flatMap((order: any) => {
			const groups = Object.entries(
				order.OrderLines.reduce((acc: any, cur: any) => {
					// chỉ lấy status nằm trong statuses
					if (!statuses.includes(cur.Status)) return acc;

					const timeKey = Math.floor(new Date(cur.SavedTime).getTime() / 1000);
					const key = `${timeKey}_${cur.Status}`; // 👈 group theo time + status

					if (!acc[key]) acc[key] = [];
					acc[key].push(cur);

					return acc;
				}, {})
			);

			return groups.map(([key, items]: any) => {
				const [time, status] = key.split('_');

				return {
					id: order.Id,
					key: '0',
					table: order.Tables,
					status: status, // 👈 đúng status của group
					select: false,
					time: new Date(Number(time) * 1000).toISOString(),
					items: items.map((v: any) => ({
						IDItem: v.IDItem,
						Id: v.Id,
						key: '0',
						name: v.Name,
						qty: v.ShippedQuantity,
						code: v.Code,
					})),
				};
			});
		}).filter((f: any) => f.items.length > 0);

		return listPOSWorkOrder;
	}

	selectZone(zoneId: string) {
		this._selectingZone = zoneId;
		this.setKeyOrders(zoneId);
	}

	selectOrder(key: any, zoneId: string) {
		let zone = this.getZone(zoneId);
		if (!zone) return;
		if (zone?.orders.length === 0) return;
		this._selectingZone = zoneId;
		this._selectItem = false;

		this.zones.forEach(z => {
			z.orders.forEach(o => {
				o.select = false;
			});
		})

		if (this._useKeyboard) {
			zone.orders.forEach(o => {
				if (o.key === key) {
					o.select = true;
					this._selectOrder = true;
				} else {
					o.select = false;
				}
			});
		}
		else {
			zone.orders.forEach(o => {
				if (o.id === key.id && o.time === key.time) {
					o.select = true;
					this._selectOrder = true;
				} else {
					o.select = false;
				}
			});
		}
	}

	backOrder(event?: Event) {
		event?.stopPropagation();
		if (this._selectItem) {
			this._selectItem = false;

			this._toZoneId = '0';
			this._fromZoneId = '0';
		}
		else {
			this._selectOrder = false;

			this.zones.forEach((z) => z.orders.forEach(o => {
				o.select = false;
			}));
			if (!this._useKeyboard) {
				this._selectingZone = '0';
			}
		}
	}

	changeStatusItemInOrder(fromZoneId: string, toZoneId: string) {
		const order = this.getZone(fromZoneId).orders.find(o => o.select);
		if (!order) return;
		this._selectItem = true;
		this._fromZoneId = fromZoneId;
		this._toZoneId = toZoneId;
		if (this._useKeyboard) {
			this.setKeyItems(order);
		}
	}

	async changeStatusItems(key: string) {
		if (this._fromZoneId == '0' || this._toZoneId == '0') {
			return;
		}
		const fromZoneId = this._fromZoneId;
		const toZoneId = this._toZoneId;
		if (this._selectOrder) {
			const orderFrom = this.getZone(fromZoneId)?.orders.find(o => o.select);
			if (!orderFrom) return;

			let order: POSWorkOrder;
			const orderTo = this.getZone(toZoneId)?.orders.find(o => o.id === orderFrom.id && o.time == orderFrom.time);
			if (orderTo) {
				order = orderTo;
			}
			else {
				order = lib.cloneObject(this.getZone(fromZoneId)?.orders.find(o => o.select));
				if (!order) return;
				order.status = this.getZone(toZoneId).name;
				order.select = false;
				order.items = [];
			}

			let itemInOrderTo;
			let itemClone;
			if (this._useKeyboard) {
				itemClone = orderFrom.items.find((i: POSWorkOrderItem) => i.key === key)
			}
			else {
				itemClone = orderFrom.items.find((i: POSWorkOrderItem) => i.IDItem === key)
			}

			if (itemClone) {
				itemInOrderTo = lib.cloneObject(itemClone);
			}
			else {
				return;
			}

			if (!itemInOrderTo) return;
			itemInOrderTo.key = '0';
			order.items.push(itemInOrderTo);
			if (!orderTo)
				this.getZone(toZoneId)?.orders.push(order);

			let index;
			if (this._useKeyboard) {
				index = orderFrom.items.findIndex((i: POSWorkOrderItem) => i.key === key);
			}
			else {
				index = orderFrom.items.findIndex((i: POSWorkOrderItem) => i.IDItem === key);
			}
			if (index !== -1) {
				orderFrom.items.splice(index, 1);
			}

			let orderResult = [];
			this.removeOrder(fromZoneId);
			if (toZoneId == '2') {
				let _changeAllOfThisItem = false;
				this.getZone(fromZoneId)?.orders.forEach(o => {
					if (o.id == order.id && o.time == order.time) {
						return;
					}
					if (o.items.some(s => s.IDItem === itemInOrderTo.IDItem)) _changeAllOfThisItem = true;
				});

				let confirmed = false;
				if (_changeAllOfThisItem) {
					confirmed = await this.changeAllOfThisItem_Alert(itemInOrderTo.name);
				}

				if (confirmed) {
					orderResult = this.changeAllOfThisItem(itemInOrderTo.IDItem, order);
				}
			} else if (toZoneId == '3') {
				this.printReceipt(order);
			}

			let postDTO = { Id: itemInOrderTo.Id, Status: this.getZone(toZoneId).name, Code: itemInOrderTo.code };
			orderResult.push(postDTO);
			this.commonService.connect('POST', 'POS/WorkOrder/ChangeStatus', orderResult).toPromise().then();

			this.setKeyItems(orderFrom);
		}
	}

	changeAllOfThisItem(itemId: string, order: POSWorkOrder) {
		let orderList = [];
		this.getZone('1')?.orders.forEach(o => {
			if (o.id === order.id && o.time == order.time) {
				return;
			}
			o.items.forEach(i => {
				if (i.IDItem === itemId) {
					const orderWaiting = o;
					if (!orderWaiting) return;

					let order;
					const orderInProgress = this.getZone('2')?.orders.find(o => o.id == orderWaiting.id && o.time == orderWaiting.time);
					// console.log('orderInProgress', orderWaiting.id, orderInProgress);
					if (orderInProgress) {
						order = orderInProgress;
					}
					else {
						order = lib.cloneObject(o);
						if (!order) return;
						order.status = this.getZone('2').name;
						order.select = false;
						order.items = [];
					}

					const itemInprogress = lib.cloneObject(orderWaiting.items?.find((i: POSWorkOrderItem) => i.IDItem == itemId));
					if (!itemInprogress) return;
					itemInprogress.key = '0';
					order.items.push(itemInprogress);
					if (!orderInProgress)
						this.getZone('2')?.orders.push(order);

					const index = orderWaiting.items.findIndex((i: POSWorkOrderItem) => i.IDItem === itemId);
					if (index !== -1) {
						orderWaiting.items.splice(index, 1);
					}

					let postDTO = { Id: itemInprogress.Id, Status: this.getZone('2').name, Code: itemInprogress.code };
					orderList.push(postDTO);
				}
			});
		});

		this.removeOrder('1');
		return orderList;
	}

	changeStatusOrder(fromZoneId: string, toZoneId: string) {
		const orderWaiting = this.getZone(fromZoneId)?.orders.find(o => o.select);
		if (!orderWaiting) return;
		const order = lib.cloneObject(this.getZone(fromZoneId)?.orders.find(o => o.select));
		if (!order) return;

		let orderInProgress = this.getZone(toZoneId)?.orders.find(o => o.id === order.id);
		if (!orderInProgress) {
			order.status = this.getZone(toZoneId).name;
			this.getZone(toZoneId)?.orders.push(order);
			orderInProgress = order;
			orderWaiting.items = [];
		} else {
			order.items.forEach((i: POSWorkOrderItem) => {
				orderInProgress.items.push(i);
			});
			orderWaiting.items = [];
		}

		const orderResult = [];
		orderInProgress.items.forEach(i => {
			let postDTO = { Id: i.Id, Status: this.getZone(toZoneId).name, Code: i.code };
			orderResult.push(postDTO)
		});
		this.commonService.connect('POST', 'POS/WorkOrder/ChangeStatus', orderResult).toPromise().then();

		this.removeOrder(fromZoneId);
	}

	removeOrder(zoneId: string) {
		let zone = this.getZone(zoneId);
		if (!zone) return;
		zone.orders.forEach((order) => {
			if (order.items.length == 0) {
				const index = zone.orders.findIndex(o => o.id == order.id && o.time == order.time);

				if (index !== -1) {
					zone.orders.splice(index, 1);
				}

				this._selectOrder = false;
				this._selectItem = false;
				this._selectingZone = '0';
				this._fromZoneId = '0';
				this._fromZoneId = '0';
				if (this._useKeyboard)
					this.setKeyOrders(zoneId);
			}
		});
	}

	setKeyItems(order: POSWorkOrder) {
		if (this._selectItem) {
			order.items?.forEach((o, i) => {
				o.key = (i + 1).toString();
			});
		}
	}

	removeKeyItems() {
		const order = this.getZone(this._selectingZone)?.orders.find(o => o.select);
		if (!order) return
		order.items?.forEach((o, i) => {
			o.key = '0';
		});
	}

	setKeyOrders(zoneId: string) {
		if (this._useKeyboard) {
			if (this._selectingZone === zoneId) {
				this.getZone(zoneId).orders
					.forEach((o, i) => o.key = (i + 1).toString());
			} else {
				this.getZone(zoneId).orders
					.forEach((o, i) => o.select = false);
			}
		}
	}

	selectToolbar() {
		this._selectingZone = '9';
	}

	_hideOrderDetails = false;
	hideOrderDetails() {
		this._hideOrderDetails = !this._hideOrderDetails;
	}

	showReturnedColumn() {
		this._showReturnedColumn = !this._showReturnedColumn;
	}

	useKeyboard() {
		this._useKeyboard = !this._useKeyboard;
	}

	ngDoCheck() {
		this.currentNow = Date.now();
	}

	getZone(zoneId: string) {
		return this.zones.find(z => z.id === zoneId);
	}

	getTimeDiff(createdAt: Date | number) {
		const diff = this.currentNow - new Date(createdAt).getTime();

		const hours = Math.floor(diff / 3600000);
		let _hours = hours.toString().padStart(2, '0');
		const minutes = Math.floor((diff % 3600000) / 60000);
		let _minutes = minutes.toString().padStart(2, '0');
		const seconds = Math.floor((diff % 60000) / 1000);
		let _seconds = seconds.toString().padStart(2, '0');

		return `${_hours}:${_minutes}:${_seconds}`;
	}

	getDiffMinutes(createdAt: Date | number) {
		let diff = this.currentNow - new Date(createdAt).getTime();
		diff = Math.floor(diff / 60000);
		return diff;
	}

	backZone() {
		this._selectingZone = '0';
	}

	currentAlert: any = null;
	async changeAllOfThisItem_Alert(itemName: string): Promise<boolean> {
		return new Promise(async (resolve) => {
			this.currentAlert = await this.alertCtrl.create({
				header: 'Xác nhận',
				message: `Bạn có muốn tiếp nhận ${itemName} của các đơn khác không?`,
				buttons: [
					{
						text: '[1] Đồng ý',
						handler: () => resolve(true)  // Trả về true
					},
					{
						text: '[2] Hủy',
						handler: () => resolve(false) // Trả về false
					}
				]
			});

			// Xử lý phím tắt
			const keyHandler = (event: KeyboardEvent) => {
				if (event.key === '1') {
					this.currentAlert.dismiss();
					resolve(true);
				} else if (event.key === '2') {
					this.currentAlert.dismiss();
					resolve(false);
				}
			};

			// Lắng nghe phím khi alert mở
			setTimeout(() => {
				window.addEventListener('keydown', keyHandler);
			}, 50);

			// Gỡ bỏ lắng nghe phím khi alert đóng để tránh rò rỉ bộ nhớ
			this.currentAlert.onDidDismiss().then(() => {
				window.removeEventListener('keydown', keyHandler);
				this.currentAlert = null;
				// Nếu đóng bằng cách click ra ngoài (backdrop), mặc định là false
				resolve(false);
			});

			await this.currentAlert.present();
		});
	}

	toggleFullscreen() {
		const doc: any = document;
		const docEl: any = document.documentElement;

		if (
			!doc.fullscreenElement &&
			!doc.webkitFullscreenElement &&
			!doc.msFullscreenElement
		) {
			if (docEl.requestFullscreen) {
				docEl.requestFullscreen();
			} else if (docEl.webkitRequestFullscreen) {
				docEl.webkitRequestFullscreen();
			} else if (docEl.msRequestFullscreen) {
				docEl.msRequestFullscreen();
			}
		} else {
			if (doc.exitFullscreen) {
				doc.exitFullscreen();
			} else if (doc.webkitExitFullscreen) {
				doc.webkitExitFullscreen();
			} else if (doc.msExitFullscreen) {
				doc.msExitFullscreen();
			}
		}
	}

	printPrepare(content: HTMLElement | null, printers: any[], jobName = '') {
		if (!content) {
			return undefined;
		}

		let optionPrinters = printers.map((printer) => {
			return {
				printer: printer.Code,
				host: printer.Host,
				port: printer.Port,
				isSecure: printer.IsSecure,
				jobName: jobName ? jobName : `${printer.Code}-${this.item?.Id}`,
				copies: 1,
				duplex: 'duplex',
			};
		});
		let data: printData = {
			content: content.outerHTML,
			type: 'html',
			options: optionPrinters,
		};
		return data;
	}

	async printReceipt(order: POSWorkOrder): Promise<any> {
		const content = document.getElementById(`print-area-${order.id}`);
		if (!content) {
			console.error(`Không tìm thấy phần tử in cho order ${order.id}`);
			return Promise.resolve(null);
		}

		const listIDPrintKitchens = [this.KitchenNow.Id, 47];
		const listPrintKitchens = this.Kitchens.filter((k) => listIDPrintKitchens.includes(k.Id));

		let printJobs: printData[] = [];
		listPrintKitchens.forEach((kitchen) => {
			if (kitchen.IsPrintOneByOne) {
				if (!kitchen?._Printer) {
					console.warn(`Kitchen ${kitchen.Id} không có printer`);
					return;
				}

				const idJob = `${kitchen.Id}_${this.item?.Id} | ${new Date().toISOString()}`;
				const data = this.printPrepare(content as HTMLElement, [kitchen._Printer], idJob);
				if (data) {
					printJobs.push(data);
				}
			}
		})

		if (printJobs.length === 0) {
			console.warn('Không có job in hợp lệ');
			return Promise.resolve(null);
		}

		const results: any[] = [];
		for (const job of printJobs) {
			try {
				const result = await this.printingService.print([job]);
				results.push(result);
				if (result && Array.isArray(result) && result.length > 0) {
					console.log('🖨️ Print result for job:', result[0]);
				}
			} catch (error) {
				console.error('Print job failed:', error);
				results.push({ status: 'error', error });
			}
		}

		return results;
	}
}

