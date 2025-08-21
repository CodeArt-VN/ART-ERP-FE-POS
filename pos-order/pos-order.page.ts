import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import {
	POS_BillTableProvider,
	POS_MenuProvider,
	POS_TableGroupProvider,
	POS_TableProvider,
	SALE_OrderProvider,
	SYS_ConfigProvider,
} from 'src/app/services/static/services.service';
import { POSSplitModalPage } from '../pos-split-modal/pos-split-modal.page';
import { POSMergeModalPage } from '../pos-merge-modal/pos-merge-modal.page';
import { Location } from '@angular/common';
import { POSChangeTableModalPage } from '../pos-change-table-modal/pos-change-table-modal.page';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { environment } from 'src/environments/environment';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import { POSNotifyModalPage } from 'src/app/modals/pos-notify-modal/pos-notify-modal.page';
import { PromotionService } from 'src/app/services/promotion.service';
import { POSOrderService } from '../pos-order.service';

@Component({
	selector: 'app-pos-order',
	templateUrl: 'pos-order.page.html',
	styleUrls: ['pos-order.page.scss'],
	standalone: false,
})
export class POSOrderPage extends PageBase {
	tableGroupList = [];
	soStatusList = [];
	noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered']; //NewConfirmedScheduledPickingDeliveredSplittedMergedDebtDoneCanceled
	segmentView = 'all';
	orderCounter = 0;
	numberOfGuestCounter = 0;
	notifications = [];
	constructor(
		public pageProvider: SALE_OrderProvider,
		public tableGroupProvider: POS_TableGroupProvider,
		public tableProvider: POS_TableProvider,
		public menuProvider: POS_MenuProvider,
		public modalController: ModalController,
		public sysConfigProvider: SYS_ConfigProvider,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location,
		public commonService: CommonService,
		public promotionService: PromotionService,
		public posOrderService: POSOrderService
	) {
		super();
		this.pageConfig.isShowFeature = true;
		
		this.pageConfig.ShowAdd = false;
		this.pageConfig.ShowSearch = false;
		this.pageConfig.ShowImport = false;
		this.pageConfig.ShowExport = false;
		this.pageConfig.ShowArchive = false;
	}
	ngOnInit() {
		this.pageConfig.subscribePOSOrder = this.env.getEvents().subscribe((data) => {
			switch (data.code) {
				case 'app:POSOrderFromCustomer':
					this.notifyOrder(data);
					break;
				case 'app:POSOrderPaymentUpdate':
					this.notifyPayment(data);
					break;
				case 'app:POSSupport':
					this.notifySupport(data);
					break;
				case 'app:POSCallToPay':
					this.notifyCallToPay(data);
					break;
				case 'app:POSLockOrderFromStaff':
					this.notifyLockOrderFromStaff(data);
					break;
				case 'app:POSLockOrderFromCustomer':
					this.notifyLockOrderFromCustomer(data);
					break;
				case 'app:POSUnlockOrderFromStaff':
					this.notifyUnlockOrderFromStaff(data);
					break;
				case 'app:POSUnlockOrderFromCustomer':
					this.notifyUnlockOrderFromCustomer(data);
					break;
				case 'app:POSOrderSplittedFromStaff':
					this.notifySplittedOrderFromStaff(data);
					break;
				case 'app:POSOrderMergedFromStaff':
					this.notifyMergedOrderFromStaff(data);
					break;
				case 'app:POSOrderFromStaff':
					this.notifyOrderFromStaff(data);
					break;
			}
		});

		super.ngOnInit();
	}

	private notifyPayment(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch && value.IDStaff == 0) {
			this.playAudio('Payment');

			let message = 'Khách hàng bàn ' + value.TableName + ' thanh toán online ' + lib.currencyFormat(value.Amount) + ' cho đơn hàng #' + value.IDSaleOrder;
			this.env.showMessage(message, 'warning');
			let url = 'pos-order/' + value.IDSaleOrder + '/' + value.IDTable;

			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: value.IDSaleOrder,
				Type: 'Payment',
				Name: 'Thanh toán',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);
		}
	}
	private notifyOrder(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			this.playAudio('Order');
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' Gọi món';
			this.env.showMessage(message, 'warning');
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Order',
				Name: 'Đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifySupport(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			this.playAudio('Support');
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu phục vụ';
			this.env.showMessage(message, 'warning');
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Support',
				Name: 'Yêu cầu phục vụ',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifyCallToPay(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			this.playAudio('Support');
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu tính tiền';
			this.env.showMessage(message, 'warning');
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Support',
				Name: 'Yêu cầu tính tiền',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifyLockOrderFromStaff(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			// this.playAudio('Order');
			// let message = 'Nhân viên đã khóa đơn bàn ' + value.Tables[0].TableName;
			// this.env.showMessage('Nhân viên đã khóa đơn bàn {{value}}', 'warning', value.Tables[0].TableName);
			// let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			// let notification = {
			// 	Id: null,
			// 	IDBranch: value.IDBranch,
			// 	IDSaleOrder: data.id,
			// 	Type: 'Support',
			// 	Name: 'Khóa đơn hàng',
			// 	Code: 'pos-order',
			// 	Message: message,
			// 	Url: url,
			// };
			// this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifyLockOrderFromCustomer(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			this.playAudio('Order');
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' đã khóa đơn';
			this.env.showMessage('Khách bàn {{value}} đã khóa đơn', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Support',
				Name: 'Khóa đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifyUnlockOrderFromStaff(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			// this.playAudio('Order');
			// let message = 'Nhân viên đã mở đơn bàn ' + value.Tables[0].TableName;
			// this.env.showMessage('Nhân viên đã mở đơn bàn {{value}}', 'warning', value.Tables[0].TableName);
			// let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
			// let notification = {
			// 	Id: null,
			// 	IDBranch: value.IDBranch,
			// 	IDSaleOrder: data.id,
			// 	Type: 'Support',
			// 	Name: 'Mở khóa đơn hàng',
			// 	Code: 'pos-order',
			// 	Message: message,
			// 	Url: url,
			// };
			// this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifyUnlockOrderFromCustomer(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			this.playAudio('Order');
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' đã mở đơn';
			this.env.showMessage('Khách bàn {{value}} đã mở đơn', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Support',
				Name: 'Mở khóa đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifySplittedOrderFromStaff(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			this.playAudio('Order');
			let message = 'Nhân viên đã chia đơn bàn ' + value.Tables[0].TableName;
			this.env.showMessage('Nhân viên đã chia đơn bàn {{value}}', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Support',
				Name: 'Chia đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);

			this.refresh();
		}
	}

	private notifyOrderFromStaff(data) {
		const value = JSON.parse(data.value);
		console.log(value);

		if (this.env.selectedBranch == value.IDBranch) {
			// this.playAudio('Order');
			// let message = 'Nhân viên đã thêm món mới đơn bàn ' + value.Tables[0].TableName;
			// // this.env.showMessage('Nhân viên đã thêm món mới đơn bàn {{value}}', 'warning', value.Tables[0].TableName);
			// let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
			// let notification = {
			// 	Id: null,
			// 	IDBranch: value.IDBranch,
			// 	IDSaleOrder: data.id,
			// 	Type: 'Support',
			// 	Name: 'Thêm món',
			// 	Code: 'pos-order',
			// 	Message: message,
			// 	Url: url,
			// };
			// this.setNotifications(notification, true);
			this.refresh();
		}
	}

	private notifyMergedOrderFromStaff(data) {
		const value = JSON.parse(data.value);
		console.log(value);

		if (this.env.selectedBranch == value.IDBranch) {
			this.playAudio('Order');
			let message = 'Nhân viên đã gộp đơn bàn ' + value.Tables[0].TableName;
			this.env.showMessage('Nhân viên đã gộp đơn bàn {{value}}', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			let notification = {
				Id: null,
				IDBranch: value.IDBranch,
				IDSaleOrder: data.id,
				Type: 'Support',
				Name: 'Gộp đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
			};
			this.setNotifications(notification, true);

			this.refresh();
		}
	}

	private playAudio(type) {
		let audio = new Audio();
		if (type == 'Order') {
			audio.src = this.pageConfig.systemConfig['POSAudioOrderUpdate'];
		} else if (type == 'CallToPay') {
			audio.src = this.pageConfig.systemConfig['POSAudioCallToPay'];
		} else if (type == 'Payment') {
			audio.src = this.pageConfig.systemConfig['POSAudioIncomingPayment'];
		} else if (type == 'Support') {
			audio.src = this.pageConfig.systemConfig['POSAudioCallStaff'];
		}
		if (audio.src) {
			audio.load();
			audio.play();
		}
	}

	ngOnDestroy() {
		this.pageConfig?.subscribePOSOrder?.unsubscribe();
		super.ngOnDestroy();
	}
	preLoadData(event?: any): void {
		console.log('🔄 POSOrderPage: PreLoadData triggered', { event });
		
		let sysConfigQuery = ['POSAudioCallStaff', 'POSAudioCallToPay', 'POSAudioOrderUpdate', 'POSAudioIncomingPayment'];
		let forceReload = event === 'force';
		this.query.Type = 'POSOrder';
		this.query.Status = JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']);
		this.query.IDBranch = this.env.selectedBranch;

		if (!this.sort.Id) {
			this.sort.Id = 'Id';
			this.sortToggle('Id', true);
		}
		
		Promise.all([
			this.getTableGroupTree(forceReload),
			this.env.getStatus('POSOrder'),
			this.sysConfigProvider.read({
				Code_in: sysConfigQuery,
				IDBranch: this.env.selectedBranch,
			}),
		]).then((values: any) => {
			this.tableGroupList = values[0];
			this.soStatusList = values[1];
			this.pageConfig.systemConfig = {};
			values[2]['data'].forEach((e) => {
				if ((e.Value == null || e.Value == 'null') && e._InheritedConfig) {
					e.Value = e._InheritedConfig.Value;
				}
				this.pageConfig.systemConfig[e.Code] = JSON.parse(e.Value);
			});
			
			// Service handles all data initialization internally
			super.preLoadData(event);
		});
	}	/**
	 * Initialize POS Order data - sync from server if needed
	 */
	private async initializePOSOrderData(forceReload: boolean = false): Promise<void> {
		try {
			console.log('🔄 Initializing POS Order data...', { forceReload });
			
			// Let POSOrderService handle the fetch logic
			await this.posOrderService.ensureDataIsUpToDate(forceReload);
			
			console.log('✅ POS Order data initialization completed');
		} catch (error) {
			console.error('❌ Failed to initialize POS Order data:', error);
		}
	}	/**
	 * Fetch orders from server with smart date filtering
	 */
	private async fetchOrdersFromServer(forceReload: boolean = false): Promise<void> {
		try {
			// Get last fetch timestamp
			const lastFetchKey = `pos_orders_last_fetch_${this.env.selectedBranch}`;
			let lastFetchTime: string | null = await this.env.getStorage(lastFetchKey);
			
			// If force reload or never fetched, get data from 7 days ago
			let modifiedDateFrom: string;
			if (forceReload || !lastFetchTime) {
				const sevenDaysAgo = new Date();
				sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
				modifiedDateFrom = sevenDaysAgo.toISOString();
				console.log('🔄 First time or force reload - fetching from 7 days ago');
			} else {
				// Fetch from last sync time with small overlap (5 minutes back)
				const lastFetch = new Date(lastFetchTime);
				lastFetch.setMinutes(lastFetch.getMinutes() - 5); // 5 minutes overlap
				modifiedDateFrom = lastFetch.toISOString();
				console.log('🔄 Incremental fetch from last sync time:', modifiedDateFrom);
			}

			// Build server query with date filters
			const serverQuery = {
				Type: 'POSOrder',
				Status: this.query.Status || JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']),
				IDBranch: this.env.selectedBranch,
				ModifiedDateFrom: modifiedDateFrom,
				ModifiedDateTo: new Date().toISOString(), // Until now
				Take: 1000, // Get more data for sync
				Skip: 0,
				SortBy: 'ModifiedDate_desc' // Sort by modified date
			};
			
			console.log('� Fetching orders with query:', serverQuery);

			// Fetch from server using original pageProvider
			const serverResult: any = await this.pageProvider.read(serverQuery, true);
			
			if (serverResult && serverResult.data && serverResult.data.length > 0) {
				console.log('✅ Fetched from server:', serverResult.data.length, 'orders');
				
				// Process each order
				let newOrdersCount = 0;
				let updatedOrdersCount = 0;
				
				for (const serverOrder of serverResult.data) {
					try {
						// Check if order exists locally
						const existingOrder = await this.posOrderService.getOrder(serverOrder.Code || `ORD-${serverOrder.Id}`);
						
						// Transform server order to match POS_Order interface
						const posOrder = {
							...serverOrder,
							Code: serverOrder.Code || `ORD-${serverOrder.Id}`,
							OrderDate: serverOrder.OrderDate || serverOrder.CreatedDate,
							OrderLines: serverOrder.OrderLines || [],
							TotalBeforeDiscount: serverOrder.TotalBeforeDiscount || 0,
							TotalDiscount: serverOrder.TotalDiscount || 0,
							TotalAfterDiscount: serverOrder.TotalAfterDiscount || serverOrder.CalcTotalOriginal || 0,
							Tax: serverOrder.Tax || 0,
							TotalAfterTax: serverOrder.TotalAfterTax || serverOrder.CalcTotalOriginal || 0
						};
						
						if (existingOrder) {
							// Update existing order
							await this.posOrderService.updateOrder(posOrder.Code, posOrder);
							updatedOrdersCount++;
						} else {
							// Create new order
							await this.posOrderService.createOrder(posOrder);
							newOrdersCount++;
						}
					} catch (saveError) {
						console.warn('⚠️ Failed to save server order to local:', saveError);
					}
				}
				
				console.log('✅ Orders synced:', { 
					new: newOrdersCount, 
					updated: updatedOrdersCount, 
					total: serverResult.data.length 
				});
			} else {
				console.log('ℹ️ No new/updated orders found on server');
			}
			
			// Update last fetch timestamp
			const currentTime = new Date().toISOString();
			await this.env.setStorage(lastFetchKey, currentTime);
			console.log('✅ Updated last fetch time:', currentTime);
			
		} catch (error) {
			console.error('❌ Failed to fetch from server:', error);
			throw error;
		}
	}

	loadData(event?: any): void {
		console.log('🔄 POSOrderPage: Loading data using POSOrderService', { event, query: this.query });
		
		if (this.pageConfig.isEndOfData) {
			console.log('ℹ️ End of data reached, skipping load');
			this.loadedData(event);
			return;
		}

		this.parseSort();

		// Simply delegate to service - let service handle all sync logic
		if (event === 'search') {
			// Search mode - reset data and search from beginning
			this.loadDataFromService(0, true, event);
		} else {
			// Pagination mode - append data
			const skip = this.items.length;
			this.loadDataFromService(skip, false, event);
		}
	}

	private async loadDataFromService(skip: number, isSearch: boolean, event?: any): Promise<void> {
		try {
			console.log('📊 Loading orders from POSOrderService', { skip, isSearch });

			// Service handles all sync logic internally
			const allOrders = await this.posOrderService.getAllOrders();
			
			// Apply client-side filters to local data
			let filteredOrders = this.applyClientFilters(allOrders);

			// Apply client-side sorting
			filteredOrders = this.applyClientSorting(filteredOrders);

			// Apply pagination
			const take = this.query.Take || 100;
			const paginatedOrders = filteredOrders.slice(skip, skip + take);
			
			console.log('✅ Orders processed:', { 
				total: allOrders.length, 
				filtered: filteredOrders.length, 
				paginated: paginatedOrders.length 
			});

			// Handle results
			if (paginatedOrders.length === 0) {
				this.pageConfig.isEndOfData = true;
			}

			if (isSearch) {
				this.items = paginatedOrders;
			} else {
				if (paginatedOrders.length > 0) {
					const firstRow = paginatedOrders[0];
					if (this.items.findIndex(d => d.Id === firstRow.Id) === -1) {
						this.items = [...this.items, ...paginatedOrders];
					}
				}
			}

			// Check if we have more data
			if (skip + take >= filteredOrders.length) {
				this.pageConfig.isEndOfData = true;
			}

			this.loadedData(event);
			
		} catch (error) {
			console.error('❌ Failed to load orders from service:', error);
			
			// Fallback to original provider
			this.fallbackToOriginalProvider(skip, isSearch, event);
		}
	}

	/**
	 * Apply client-side filters to orders
	 */
	private applyClientFilters(orders: any[]): any[] {
		return orders.filter(order => {
			// Filter by branch
			if (this.env.selectedBranch && order.IDBranch !== this.env.selectedBranch) {
				return false;
			}
			
			// Filter by status
			if (this.query.Status) {
				try {
					const statusArray = JSON.parse(this.query.Status);
					if (!statusArray.includes(order.Status)) {
						return false;
					}
				} catch (e) {
					if (this.query.Status !== order.Status) {
						return false;
					}
				}
			}
			
			// Filter by keyword if provided
			if (this.query.Keyword) {
				const keyword = this.query.Keyword.toLowerCase();
				return (
					order.Code?.toLowerCase().includes(keyword) ||
					order.Id?.toString().includes(keyword) ||
					order.Remark?.toLowerCase().includes(keyword)
				);
			}
			
			return true;
		});
	}

	/**
	 * Apply client-side sorting to orders
	 */
	private applyClientSorting(orders: any[]): any[] {
		return orders.sort((a, b) => {
			// Default sort by Id descending (newest first)
			return (b.Id || 0) - (a.Id || 0);
		});
	}

	/**
	 * Fallback to original provider when service fails
	 */
	private async fallbackToOriginalProvider(skip: number, isSearch: boolean, event?: any): Promise<void> {
		console.log('🔄 Falling back to pageProvider...');
		try {
			const fallbackQuery = { ...this.query, Skip: skip };
			const result: any = await this.pageProvider.read(fallbackQuery, this.pageConfig.forceLoadData);
			
			if (result.data.length === 0) {
				this.pageConfig.isEndOfData = true;
			}
			
			if (isSearch) {
				this.items = result.data;
			} else if (result.data.length > 0) {
				const firstRow = result.data[0];
				if (this.items.findIndex(d => d.Id === firstRow.Id) === -1) {
					this.items = [...this.items, ...result.data];
				}
			}
			
			console.log('✅ Fallback load completed');
		} catch (fallbackError) {
			console.error('❌ Fallback also failed:', fallbackError);
			this.env.showMessage('Cannot load orders. Please try again.', 'danger');
		}
		
		this.loadedData(event);
	}

	loadedData(event?: any): void {
		this.orderCounter = 0;
		this.numberOfGuestCounter = 0;
		this.checkTable(null, 0); //reset table status
		this.items.forEach((o) => {
			o._Locked = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'].indexOf(o.Status) == -1;
			o._Status = this.soStatusList.find((d) => d.Code == o.Status);
			o._Tables = [];
			if (!o._Locked) {
				this.orderCounter++;
				this.numberOfGuestCounter = this.numberOfGuestCounter + o.NumberOfGuests;
			}

			if (!o.Tables) o.Tables = [];
			o.Tables.forEach((tid) => {
				this.checkTable(o, tid);
			});
		});

		super.loadedData(event);
		this.env.getStorage('Notifications').then((result) => {
			if (result?.length > 0) {
				this.notifications = result.filter((n) => !n.Watched && n.IDBranch == this.env.selectedBranch);
			}
		});
		this.CheckPOSNewOrderLines();
		this.promotionService.getPromotions();
		
		// Debug: Log data status
		this.debugDataStatus();
	}

	/**
	 * Debug method to check data status
	 */
	private async debugDataStatus(): Promise<void> {
		try {
			const localOrders = await this.posOrderService.getAllOrders();
			const systemHealth = this.posOrderService.getSystemHealth();
			
			console.log('🔍 POS Order Data Status:', {
				localOrdersCount: localOrders.length,
				displayedItemsCount: this.items.length,
				query: this.query,
				systemHealth: {
					ordersCount: systemHealth.storageInfo.ordersCount,
					cacheStats: systemHealth.cacheStats,
					lastUpdated: systemHealth.storageInfo.lastUpdated
				}
			});
			
			// Show in console for debugging
			if (localOrders.length > 0) {
				console.log('📋 Sample local orders:', localOrders.slice(0, 3));
			}
			if (this.items.length > 0) {
				console.log('📋 Sample displayed items:', this.items.slice(0, 3));
			}
		} catch (error) {
			console.error('❌ Debug data status failed:', error);
		}
	}

	private CheckPOSNewOrderLines() {
		this.pageProvider.commonService
			.connect('GET', 'SALE/Order/CheckPOSNewOrderLines/', this.query)
			.toPromise()
			.then(async (results: any) => {
				if (results) {
					let orderNotification = this.notifications.filter(
						(d) => !results.map((s) => s.Id).includes(d.IDSaleOrder) && (d.Type == 'Remind order' || d.Type == 'Order') && d.Code == 'pos-order'
					);
					orderNotification.forEach((o) => {
						let index = this.notifications.indexOf(o);
						this.notifications.splice(index, 1);
					});
					await results.forEach(async (r) => {
						// kiểm tra noti cũ có số order line chưa gửi bếp khác với DB thì update
						let oldNotis = this.notifications.filter((n) => n.IDSaleOrder == r.Id && n.Type == 'Remind order' && n.Code == 'pos-order');
						await oldNotis.forEach(async (oldNoti) => {
							if (oldNoti.NewOrderLineCount != r.NewOrderLineCount) {
								let index = this.notifications.indexOf(oldNoti);
								this.notifications.splice(index, 1);
							}
						});
					});
					this.setNotifiOrder(results);
				}
			})
			.catch((err) => {
				if (err.message != null) {
					this.env.showMessage(err.message, 'danger');
				}
			});
	}

	checkTable(o, tid) {
		for (let g of this.tableGroupList) {
			for (let t of g.TableList) {
				if (!o && !tid) t._Orders = [];

				if (t.Id == tid) {
					o._Tables.push(t);

					if (!o._Locked) {
						let order = {
							_Status: o._Status,
							Id: o.Id,
							OrderDate: o.OrderDate,
							NumberOfGuests: o.NumberOfGuests,
							CalcTotalOriginal: o.CalcTotalOriginal,
							Debt: o.Debt,
							Order: o,
						};
						t._Orders.push(order);
					}
				}
			}
		}
	}

	// nav('/pos-order/'+od.Id+'/'+t.Id,'back')

	filter(type = null) {
		if (type == 'search') {
			this.selectedItems = [];
			if (this.query.Id?.length > 2 || !this.query.Id) {
				this.query.Skip = 0;
				this.pageConfig.isEndOfData = false;
				this.loadData('search');
			}
		} else {
			this.query.Status = this.query.Status == '' ? JSON.stringify(['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill']) : '';
			super.refresh();
		}
	}

	refresh(event?: any): void {
		console.log('🔄 POSOrderPage: Refresh triggered', { event });
		
		// Service will handle all sync logic internally when we call loadData
		if (event === true || event === 'force') {
			this.preLoadData('force');
		} else {
			super.refresh();
		}
	}

	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	async splitPOSBill() {
		if (this.selectedItems.length > 0) {
			if (this.noLockStatusList.indexOf(this.selectedItems[0].Status) == -1) {
				this.env.showMessage('Your selected order cannot be split. Please choose draft, new, pending for approval or disaaproved order', 'warning');
				return;
			}
		}

		const modal = await this.modalController.create({
			component: POSSplitModalPage,
			backdropDismiss: false,
			cssClass: 'modal90',
			componentProps: {
				selectedOrder: this.selectedItems[0],
				orders: this.items,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();

		this.selectedItems = [];
		this.refresh();
	}

	async mergePOSBills() {
		let itemsCanNotProcess = this.selectedItems.filter((i) => this.noLockStatusList.indexOf(i.Status) == -1);
		if (itemsCanNotProcess.length) {
			this.env.showMessage('Your selected invoices cannot be combined. Please select new or disapproved invoice', 'warning');
			return;
		}

		const modal = await this.modalController.create({
			component: POSMergeModalPage,

			backdropDismiss: false,
			cssClass: 'modal-merge-orders',
			componentProps: {
				selectedOrders: this.selectedItems,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();

		this.selectedItems = [];
		this.refresh();
	}

	async changeTable(i) {
		console.log('changeTable');

		if (i && i.Id) {
			this.selectedItems.push(i);
		}
		let itemsCanNotProcess = this.selectedItems.filter((i) => this.noLockStatusList.indexOf(i.Status) == -1);
		if (itemsCanNotProcess.length) {
			this.env.showMessage('Your selected invoices cannot be combined. Please select new or disapproved invoice', 'warning');
			return;
		}

		const modal = await this.modalController.create({
			component: POSChangeTableModalPage,
			backdropDismiss: false,
			cssClass: 'modal-change-table',
			componentProps: {
				selectedOrder: this.selectedItems[0],
				orders: this.items,
			},
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();

		this.selectedItems = [];
		this.refresh();
	}

	async openCancellationReason(order = null) {
		if (this.submitAttempt) return;

		if (order) {
			this.selectedItems = [order];
		}

		const modal = await this.modalController.create({
			component: POSCancelModalPage,
			id: 'POSCancelModalPage',
			backdropDismiss: true,
			cssClass: 'modal-cancellation-reason',
			componentProps: { item: {} },
		});
		modal.present();

		const { data, role } = await modal.onWillDismiss();

		if (role == 'confirm') {
			let cancelData: any = { Code: data.Code };
			if (cancelData.Code == 'Other') {
				cancelData.Remark = data.CancelNote;
			}

			this.env
				.showPrompt('Bạn có chắc muốn hủy đơn hàng này?', null, 'Hủy đơn hàng')
				.then((_) => {
					let publishEventCode = this.pageConfig.pageName;
					if (this.submitAttempt == false) {
						this.submitAttempt = true;
						cancelData.Type = 'POSOrder';
						cancelData.Ids = this.selectedItems.map((m) => m.Id);
						this.pageProvider.commonService
							.connect('POST', 'SALE/Order/CancelOrders/', cancelData)
							.toPromise()
							.then(() => {
								if (publishEventCode) {
									this.env.publishEvent({
										Code: publishEventCode,
									});
								}
								this.loadData();
								this.submitAttempt = false;
								this.nav('/pos-order', 'forward');
							})
							.catch((err) => {
								this.submitAttempt = false;
							});
					}
				})
				.catch((_) => {});
		}
	}

	interval = null;
	ionViewDidEnter() {
		if (!this.interval) {
			this.interval = setInterval(() => {
				//this.refresh();
			}, 15000);
		}
	}

	ionViewWillLeave() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
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
	async showNotify() {
		const modal = await this.modalController.create({
			component: POSNotifyModalPage,
			canDismiss: true,
			backdropDismiss: true,
			cssClass: 'modal-notify',
			componentProps: {
				item: this.notifications,
			},
		});

		await modal.present();
		const { data, role } = await modal.onWillDismiss();
		if (data) {
			this.notifications = data;
		}
	}

	async setNotifiOrder(items) {
		for (let item of items) {
			let url = 'pos-order/' + item.Id + '/' + item.Tables[0].IDTable;
			let message = 'Bàn ' + item.Tables[0]?.TableName + ' có ' + item.NewOrderLineCount + ' món chưa gửi bếp';

			let notification = {
				Id: item.Id,
				IDBranch: item.IDBranch,
				IDSaleOrder: item.Id,
				Type: 'Remind order',
				Name: 'Đơn hàng',
				Code: 'pos-order',
				Message: message,
				Url: url,
				NewOrderLineCount: item.NewOrderLineCount,
				Watched: false,
			};
			await this.setNotifications(notification);
		}
	}

	async setNotifications(item, lasted = false) {
		let isExistedNoti = this.notifications.some(
			(d) =>
				d.Id == item.Id &&
				d.IDBranch == item.IDBranch &&
				d.IDSaleOrder == item.IDSaleOrder &&
				d.Type == item.Type &&
				d.Name == item.Name &&
				d.Code == item.Code &&
				d.Message == item.Message &&
				d.Url == item.Url &&
				!d.Watched
		);
		if (isExistedNoti) {
			if (lasted) {
				let index = this.notifications.findIndex(
					(d) =>
						d.Id == item.Id &&
						d.IDBranch == item.IDBranch &&
						d.IDSaleOrder == item.IDSaleOrder &&
						d.Type == item.Type &&
						d.Name == item.Name &&
						d.Code == item.Code &&
						d.Message == item.Message &&
						d.Url == item.Url &&
						!d.Watched
				);
				if (index != -1) {
					this.notifications.splice(index, 1);
					this.notifications.unshift(item);
					await this.env.setStorage('Notifications', this.notifications);
				}
			}
		} else {
			this.notifications.unshift(item);
			await this.env.setStorage('Notifications', this.notifications);
		}
	}

	goToNofication(i, j) {
		this.notifications[j].Watched = true;
		this.env.setStorage('Notifications', this.notifications);
		if (i.Url != null) {
			this.nav(i.Url, 'forward');
		}
		this.removeNotification(j);
	}

	removeNotification(j) {
		this.notifications.splice(j, 1);
		this.env.setStorage('Notifications', this.notifications);
	}

	exportPOSData() {
		this.query.SortBy = 'IDOrder_desc';

		if (this.query.Keyword.indexOf('-') != -1) {
			let dateParts = this.query.Keyword.split('-');
			let fromDate = new Date(dateParts[0].slice(2, 4) + '/' + dateParts[0].slice(0, 2) + '/' + dateParts[0].slice(4, 6));
			let toDate = new Date(dateParts[1].slice(2, 4) + '/' + dateParts[1].slice(0, 2) + '/' + dateParts[1].slice(4, 6));
			let fromDateText = lib.dateFormat(fromDate);
			let toDateText = lib.dateFormat(toDate);

			let maxToDate = new Date(fromDate.setMonth(fromDate.getMonth() + 3));
			let maxToDateText = lib.dateFormat(maxToDate);

			if (toDateText > maxToDateText) {
				this.env.showMessage('Giới hạn tải xuống dữ liệu tối đa trong vòng 3 tháng!', 'danger', 5000);
				return;
			}
		}

		this.loadingController
			.create({
				cssClass: 'my-custom-class',
				message: 'Please wait for a few moments',
			})
			.then((loading) => {
				loading.present();
				this.commonService
					.connect('GET', 'SALE/Order/ExportPOSOrderList', this.query)
					.toPromise()
					.then((response: any) => {
						this.submitAttempt = false;
						if (loading) loading.dismiss();
						this.downloadURLContent(response);
					})
					.catch((err) => {
						if (err.message != null) {
							this.env.showMessage(err.error.ExceptionMessage, 'danger');
						} else {
							this.env.showMessage('Cannot extract data', 'danger');
						}
						this.submitAttempt = false;
						if (loading) loading.dismiss();
						this.refresh();
					});
			});
	}
}
