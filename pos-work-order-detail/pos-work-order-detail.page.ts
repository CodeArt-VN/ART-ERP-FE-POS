import { Component, DoCheck, HostListener } from '@angular/core';
import { PageBase } from 'src/app/page-base';
import { POS_KitchenProvider, SALE_OrderDetailProvider, SALE_OrderProvider, SYS_ConfigProvider } from 'src/app/services/static/services.service';
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
import { SYS_ConfigService } from 'src/app/services/custom/system-config.service';

@Component({
	selector: 'app-pos-work-order-detail',
	templateUrl: 'pos-work-order-detail.page.html',
	styleUrls: ['pos-work-order-detail.page.scss'],
	standalone: false,
})
export class POSWorkOrderDetailPage extends PageBase implements DoCheck {
	_selectZone = '0';
	_selectOrder = false;
	_selectItem = false;
	_toZoneId = '0';
	_fromZoneId = '0';
	_useKeyboard = false;
	_showReturnedColumn = true;
	selectingItem = false;
	actionMethod = '0';
	printZone = '0';
	currentNow = Date.now();
	eventSubscription: Subscription;
	Kitchens = [];
	KitchenNow: any;
	KitchenName: string;
	zones: POSWorkOrderZone[] = [];
	orderDetailStatusList = [];
	listItemsChange = [];
	isOpenConfigPOS = false;
	optionMethod: any = [];
	optionPrintStatus: any = [];
	workorderConfig: any = [];

	constructor(
		public posKitchenProvider: POS_KitchenProvider,
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
		public sys_ConfigProvider: SYS_ConfigProvider,
	) {
		super();
		this.pageConfig.ShowRefresh = false;
		this.pageConfig.ShowHelp = false;
		this.pageConfig.isDetailPage = true;
	}

	async preLoadData(event?: any): Promise<void> {
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
					case 'signalR:POSWorkOrderSave':
						this.refreshFromEvent();
						break;
					case 'signalR:POSWorkOrderUpdated':
						if (data.id != this.env.user.StaffID) {
							this.refreshFromEvent();
						}
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
			this.loadData(null);
			return;
		}

		this.commonService.connect('GET', 'POS/WorkOrder/GetService/' + this.id, null).toPromise().then(
			(data: any) => {
				if (this.hasNewKitchenItems(this.orderList, data)) {
					this.orderList = data;
					const orderActionSave = this.getZone(this._selectZone)?.orders.find((o: any) => o.select);
					this.loadedData();
					this.setKeyOrders(this._selectZone);
					const orderAction = this.getZone(this._selectZone)?.orders.find(o => o.id === orderActionSave.id && o.time === orderActionSave.time);
					if (orderAction)
						orderAction.select = true;
					this.setKeyItems(this.getZone(this._selectZone)?.orders.find(o => o.select));
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

		for (const order of oldOrders) {
			const newOrder = newOrders.find((o: any) => o.Id === order.Id);
			if (oldOrders != newOrders) {
				return true;
			}
		};

		// Build map of existing line IDs and their statuses
		const existingLines = new Map<number, string>();
		oldOrders.forEach((order: any) => {
			order.OrderLines?.forEach((line: any) => {
				if (line.Id != null) {
					existingLines.set(line.Id, line.Status);
				}
			});
		});

		// Check for new items or status changes
		newOrders.some((order: any) => {
			order.OrderLines?.some((line: any) => {
				if (line.Id == null) return true;

				const oldStatus = existingLines.get(line.Id);
				// New item (not in old orders) or status changed
				if (oldStatus === undefined) return true;
				if (oldStatus !== line.Status) return true;

				return false;
			});
		});
	}

	orderList = [];
	loadData(event?: null): void {
		const forceReload = event === 'force';

		// Chạy tuần tự: Gọi API lấy thông tin môi trường trước
		Promise.all([
			this.posService.getEnviromentDataSource(this.env.selectedBranch, forceReload),
			this.env.getStatus('POSOrderDetail'),
			this.env.getType('WorkOrderMethod', true),
			this.env.getType('WorkOrderPrintStatus', true),
			this.sys_ConfigProvider.read(this.env.selectedBranch),
			this.posKitchenProvider.read(),
		])
			.then((values: any) => {
				// console.log('POS environment data loaded', values);
				this.orderDetailStatusList = values[1];
				this.optionMethod = values[2];
				this.optionPrintStatus = values[3];
				this.workorderConfig = values[4].data;
				this.Kitchens = values[5].data;
				this.KitchenNow = this.Kitchens.find((s) => s.Id === Number(this.id));
				this.KitchenName = this.KitchenNow?.Name || '';

				this.loadConfig();

				// Sau khi hoàn thành, gọi API lấy danh sách order
				return this.commonService.connect('GET', 'POS/WorkOrder/GetService/' + this.id, null).toPromise();
			})
			.then((data: any) => {
				console.log('ListData', data);
				this.orderList = data;
				this.loadedData(event);
			})
			.catch((err) => {
				// console.log(err);
				this.env.showErrorMessage(err);
				this.loadedData(event);
			});
	}

	loadedData(event?: any): void {
		this.zones = this.getZones();
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

	loadConfig() {
		this.actionMethod = JSON.parse(this.workorderConfig.find((c) => c.Code == 'POSWorkOrderMethod').Value);
		this.printZone = JSON.parse(this.workorderConfig.find((c) => c.Code == 'POSWorkOrderPrintStatus').Value);
		this._useKeyboard = this.pageConfig.canUseKeyboard;
	}

	@HostListener('document:keydown', ['$event'])
	handleKey(event: KeyboardEvent) {
		if (!this._useKeyboard || this.currentAlert) return;

		const key = event.key;
		const zone = this._selectZone;

		// HANDLE ITEM
		if (this._selectItem) {
			if (key === '0') {
				this.backOrder();
				this.removeKeyItems();
			}
			else if (key === 'Enter') {
				if (this.actionMethod == '1')
					this.changeStatusSelectingItems(zone);
			}
			else {
				if (this.actionMethod == '0')
					this.changeStatusItem(key);
				else if (this.actionMethod == '1') {
					this.addListItemsChange(key);
				}
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
					'2': () => { if (this.pageConfig.canReturn) this.changeStatusItemInOrder('2', '5') },
				},
				'3': {
					'1': () => { if (this.pageConfig.canServe) this.changeStatusItemInOrder('3', '4') },
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
						select: false,
					})),
				};
			});
		}).filter((f: any) => f.items.length > 0);

		// Sắp xếp theo time từ nhỏ đến lớn (ascending)
		return listPOSWorkOrder.sort((a, b) => {
			return new Date(a.time).getTime() - new Date(b.time).getTime();
		});
	}

	selectZone(zoneId: string) {
		this._selectZone = zoneId;
		this.setKeyOrders(zoneId);
	}

	selectOrder(key: any, zoneId: string) {
		let zone = this.getZone(zoneId);
		if (!zone) return;
		if (zone?.orders.length === 0) return;
		this._selectZone = zoneId;

		this.zones.forEach(z => {
			z.orders.forEach(o => {
				o.select = false;
			});
		})


		let order: POSWorkOrder;
		if (this._useKeyboard) {
			zone.orders.forEach(o => {
				if (o.key === key) {
					o.select = true;
					this._selectOrder = true;
					order = o;
					if (this.actionMethod == '0') {
						this._selectItem = false;
					}
					else {
						this._selectItem = true;
						this.setKeyItems(order);
					}
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
					order = o;
					if (this.actionMethod == '0') {
						this._selectItem = false;
					}
					else {
						this._selectItem = true;
					}
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
			if (!this._useKeyboard) {
				this._selectOrder = false;

				this.zones.forEach((z) => z.orders.forEach(o => {
					o.select = false;
				}));
				this._selectZone = '0';
			}

			if (this.actionMethod == '1') {
				this._selectOrder = false;
				this.zones.forEach((z) => z.orders.forEach(o => {
					o.select = false;
				}));
			}
		}
		else {
			this._selectOrder = false;

			this.zones.forEach((z) => z.orders.forEach(o => {
				o.select = false;
			}));
			if (!this._useKeyboard) {
				this._selectZone = '0';
			}
		}

		this.listItemsChange = [];
	}

	changeStatusItemInOrder(fromZoneId: string, toZoneId: string) {
		event?.stopPropagation();
		const order = this.getZone(fromZoneId).orders.find(o => o.select);
		if (!order) return;
		this._selectItem = true;
		this._fromZoneId = fromZoneId;
		this._toZoneId = toZoneId;
		if (this._useKeyboard) {
			this.setKeyItems(order);
		}
	}

	async changeStatusSelectingItems(fromZoneId: string) {
		const toZoneId = (await this.changeStatusSelectingItem_Alert(fromZoneId)).toString();

		if (fromZoneId == '0' || toZoneId == '0') {
			return;
		}

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

			let orderResult = [];
			let listSplice = [];
			orderFrom.items.forEach((item) => {
				let itemInOrderTo;
				let itemClone;
				if (item.select) {
					itemClone = item;
					itemInOrderTo = lib.cloneObject(itemClone);
					if (!itemInOrderTo) return;
					itemInOrderTo.key = '0';
					order.items.push(itemInOrderTo);

					let index = orderFrom.items.findIndex((i: POSWorkOrderItem) => i.Id === item.Id);
					listSplice.push(index);

					let postDTO = { Id: itemInOrderTo.Id, Status: this.getZone(toZoneId).name, Code: itemInOrderTo.code };
					orderResult.push(postDTO);
				}
			});

			if (order.items.length > 0) {
				if (!orderTo)
					this.getZone(toZoneId)?.orders.push(order);
			}

			if (listSplice.length > 0) {
				for (let i = listSplice.length - 1; i >= 0; i--) {
					orderFrom.items.splice(listSplice[i], 1);
				}
			}

			this.removeOrder(fromZoneId);
			this.commonService.connect('POST', 'POS/WorkOrder/ChangeStatus', orderResult).toPromise().then();

			this.setKeyItems(orderFrom);
			this.listItemsChange = [];

			if (toZoneId == this.printZone) {
				this.printReceipt(order);
			}
		}
	}

	async changeStatusItem(key: string) {
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
			itemInOrderTo.select = true;
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

			if (toZoneId == this.printZone) {
				this.printReceipt(order);
			}
			this.removeOrder(fromZoneId);

			let orderResult = [];
			if (fromZoneId == '1') {
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
					itemInprogress.select = true;
					order.items.push(itemInprogress);
					if (!orderInProgress)
						this.getZone('2')?.orders.push(order);

					const index = orderWaiting.items.findIndex((i: POSWorkOrderItem) => i.IDItem === itemId);
					if (index !== -1) {
						orderWaiting.items.splice(index, 1);
					}
					this.printReceipt(order);
					let postDTO = { Id: itemInprogress.Id, Status: this.getZone('2').name, Code: itemInprogress.code };
					orderList.push(postDTO);
				}
			});
		});

		this.removeOrder('1');
		return orderList;
	}

	changeStatusOrder(fromZoneId: string, toZoneId: string) {
		event?.stopPropagation();
		const orderWaiting = this.getZone(fromZoneId)?.orders.find(o => o.select);
		if (!orderWaiting) return;
		const order = lib.cloneObject(this.getZone(fromZoneId)?.orders.find(o => o.select));
		if (!order) return;

		let orderInProgress = this.getZone(toZoneId)?.orders.find(o => o.id == order.id && o.time == order.time);
		if (!orderInProgress) {
			order.status = this.getZone(toZoneId).name;
			order.select = false;
			order.items.map((i: POSWorkOrderItem) => {
				i.select = true;
			});
			this.getZone(toZoneId)?.orders.push(order);
			orderInProgress = order;
			orderWaiting.items = [];
		} else {
			order.select = false;
			order.items.map((i: POSWorkOrderItem) => {
				i.select = true;
				orderInProgress.items.push(i);
			});
			orderWaiting.items = [];
		}

		if (toZoneId == this.printZone) {
			this.printReceipt(order);
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
		let listSplice = []
		zone.orders.forEach((order) => {
			if (order.items.length == 0) {
				const index = zone.orders.findIndex(o => o.id == order.id && o.time == order.time);
				listSplice.push(index);
			}
		});

		if (listSplice.length > 0) {
			for (let i = listSplice.length - 1; i >= 0; i--) {
				zone.orders.splice(listSplice[i], 1);
			}

			this._selectOrder = false;
			this._selectItem = false;
			this._selectZone = '0';
			this._fromZoneId = '0';
			this._fromZoneId = '0';
			if (this._useKeyboard)
				this.setKeyOrders(zoneId);
		}
	}

	setKeyItems(order: POSWorkOrder) {
		if (this._selectItem && this._useKeyboard) {
			order.items?.forEach((o, i) => {
				o.key = (i + 1).toString();
			});
		}
	}

	removeKeyItems() {
		const order = this.getZone(this._selectZone)?.orders.find(o => o.select);
		if (!order) return
		order.items?.forEach((o, i) => {
			o.key = '0';
		});
	}

	setKeyOrders(zoneId: string) {
		if (zoneId === '0') return;
		if (this._useKeyboard) {
			if (this._selectZone === zoneId) {
				this.getZone(zoneId).orders
					.forEach((o, i) => o.key = (i + 1).toString());
			} else {
				this.getZone(zoneId).orders
					.forEach((o, i) => o.select = false);
			}
		}
	}

	selectToolbar() {
		this._selectZone = '9';
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
		this._selectZone = '0';
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

	async changeStatusSelectingItem_Alert(fromZoneId: string): Promise<number> {
		return new Promise(async (resolve) => {
			// Translate all labels first
			const [cancelLabel, receiveLabel, returnLabel, readyLabel, serveLabel, reorderLabel] = await Promise.all([
				this.env.translateResource('[0] Cancel'),
				this.env.translateResource('[1] Receive'),
				this.env.translateResource('[2] Return'),
				this.env.translateResource('[1] Ready'),
				this.env.translateResource('[1] Serve'),
				this.env.translateResource('[1] Reorder'),
				this.env.translateResource('pos.alert.selection'),
				this.env.translateResource('pos.alert.choose_action')
			]);

			let keyHandler;
			let createButtons: any[] = [];

			// Luôn có button Cancel
			createButtons.push({
				text: cancelLabel,
				handler: () => resolve(0)
			});
			if (fromZoneId == '1') {
				// Thêm button Receive nếu có quyền
				if (this.pageConfig.canReceive) {
					createButtons.push({
						text: receiveLabel,
						handler: () => resolve(2)
					});
				}

				// Thêm button Return nếu có quyền
				if (this.pageConfig.canReturn) {
					createButtons.push({
						text: returnLabel,
						handler: () => resolve(5)
					});
				}

				this.currentAlert = await this.alertCtrl.create({
					header: 'Lựa chọn',
					message: 'Hãy chọn thao tác muốn thực hiện',
					buttons: createButtons,
				});

				// Xử lý phím tắt
				keyHandler = (event: KeyboardEvent) => {
					if (event.key === '1' && this.pageConfig.canReceive) {
						this.currentAlert.dismiss();
						resolve(2);
					} else if (event.key === '2' && this.pageConfig.canReturn) {
						this.currentAlert.dismiss();
						resolve(5);
					} else if (event.key === '0') {
						this.currentAlert.dismiss();
						resolve(0);
					}
				};
			}
			else if (fromZoneId == '2') {
				if (this.pageConfig.canReady) {
					createButtons.push({
						text: readyLabel,
						handler: () => resolve(3)
					});
				}

				if (this.pageConfig.canReturn) {
					createButtons.push({
						text: returnLabel,
						handler: () => resolve(5)
					});
				}

				this.currentAlert = await this.alertCtrl.create({
					header: 'Lựa chọn',
					message: 'Hãy chọn thao tác muốn thực hiện',
					buttons: createButtons,
				});

				// Xử lý phím tắt
				keyHandler = (event: KeyboardEvent) => {
					if (event.key === '1' && this.pageConfig.canReady) {
						this.currentAlert.dismiss();
						resolve(3);
					} else if (event.key === '2' && this.pageConfig.canReturn) {
						this.currentAlert.dismiss();
						resolve(5);
					} else if (event.key === '0') {
						this.currentAlert.dismiss();
						resolve(0);
					}
				};
			}
			else if (fromZoneId == '3') {
				if (this.pageConfig.canServe) {
					createButtons.push({
						text: serveLabel,
						handler: () => resolve(4)
					});
				}

				this.currentAlert = await this.alertCtrl.create({
					header: 'Lựa chọn',
					message: 'Hãy chọn thao tác muốn thực hiện',
					buttons: createButtons
				});

				// Xử lý phím tắt
				keyHandler = (event: KeyboardEvent) => {
					if (event.key === '1' && this.pageConfig.canServe) {
						this.currentAlert.dismiss();
						resolve(4);
					} else if (event.key === '0') {
						this.currentAlert.dismiss();
						resolve(0);
					}
				};
			} else if (fromZoneId == '5') {
				if (this.pageConfig.canReorder) {
					createButtons.push({
						text: reorderLabel,
						handler: () => resolve(1)
					});
				}

				this.currentAlert = await this.alertCtrl.create({
					header: 'Lựa chọn',
					message: 'Hãy chọn thao tác muốn thực hiện',
					buttons: [
						{
							text: "[1] Reorder",
							handler: () => resolve(1)
						},
						{
							text: '[0] Cancel',
							handler: () => resolve(0)
						}
					]
				});

				// Xử lý phím tắt
				keyHandler = (event: KeyboardEvent) => {
					if (event.key === '1' && this.pageConfig.canReorder) {
						this.currentAlert.dismiss();
						resolve(1);
					} else if (event.key === '0') {
						this.currentAlert.dismiss();
						resolve(0);
					}
				};
			}


			// Lắng nghe phím khi alert mở
			setTimeout(() => {
				window.addEventListener('keydown', keyHandler);
			}, 50);

			// Gỡ bỏ lắng nghe phím khi alert đóng để tránh rò rỉ bộ nhớ
			this.currentAlert.onDidDismiss().then(() => {
				window.removeEventListener('keydown', keyHandler);
				this.currentAlert = null;
				// Nếu đóng bằng cách click ra ngoài (backdrop), mặc định là false
				resolve(0);
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

	orderPrint: POSWorkOrder;
	async printReceipt(order: POSWorkOrder): Promise<any> {
		this.orderPrint = this.getPrintOrder(order);
		// Chờ DOM cập nhật sau khi gán orderPrint
		await new Promise(resolve => setTimeout(resolve, 0));
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

		this.orderPrint = null;
		return results;
	}

	getPrintOrder(order: POSWorkOrder) {
		if (order) {
			let result = lib.cloneObject(order);
			result.items = order.items.filter((i) => i.select);
			return result;
		}
		return null;
	}

	loadItems(zoneId: string, order: any) {
		let results = order.items;
		results.map((i) => {
			i.select = false;
		});

		if (order.select) {
			results.map((i) => {
				this.listItemsChange.forEach((i1) => {
					if (this._useKeyboard) {
						if (i.key == i1) {
							i.select = true;
						}
					} else {
						if (i.IDItem == i1) {
							i.select = true;
						}
					}
				})
			});
		}

		return results;
	}

	addListItemsChange(key: string) {
		let item;
		if (this._useKeyboard) {
			item = this.getZone(this._selectZone).orders.find((o) => o.select).items.find((i) => i.key == key)
			if (item) {
				const k = this.listItemsChange.includes(key);
				if (k) {
					const index = this.listItemsChange.findIndex(k => k == key)
					if (index !== -1) {
						this.listItemsChange.splice(index, 1)
					}
				}
				else {
					this.listItemsChange.push(key);
				}
			}
		}
		else {
			if (this._selectZone == '0') return;
			item = this.getZone(this._selectZone).orders.find((o) => o.select).items.find((i) => i.IDItem == key)
			if (item) {
				const k = this.listItemsChange.includes(key);
				if (k) {
					const index = this.listItemsChange.findIndex(k => k == key)
					if (index !== -1) {
						this.listItemsChange.splice(index, 1)
					}
				}
				else {
					this.listItemsChange.push(key);
				}
			}
		}
	}

	onMethodChange(e) {
		let config = this.workorderConfig.find((c) => c.Code == 'POSWorkOrderMethod');
		config.Value = JSON.stringify(this.optionMethod.Code);
		this.sys_ConfigProvider.save(config).then().catch((err) => {
			return;
		});
		this.actionMethod = this.optionMethod.Code;
	}

	onPrintStatusChange(e) {
		let config = this.workorderConfig.find((c) => c.Code == 'POSWorkOrderPrintStatus');
		config.Value = JSON.stringify(this.optionPrintStatus.Code);
		this.sys_ConfigProvider.save(config).then().catch((err) => {
			return;
		});
		this.printZone = this.optionPrintStatus.Code;
	}
}

