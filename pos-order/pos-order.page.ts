import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { POS_MenuProvider, POS_TableGroupProvider, POS_TableProvider, SALE_OrderProvider, SYS_ConfigProvider } from 'src/app/services/static/services.service';
import { POSSplitModalPage } from '../pos-split-modal/pos-split-modal.page';
import { POSMergeModalPage } from '../pos-merge-modal/pos-merge-modal.page';
import { Location } from '@angular/common';
import { POSChangeTableModalPage } from '../pos-change-table-modal/pos-change-table-modal.page';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { POSCancelModalPage } from '../pos-cancel-modal/pos-cancel-modal.page';
import { POSNotifyModalPage } from 'src/app/modals/pos-notify-modal/pos-notify-modal.page';
import { PromotionService } from 'src/app/services/custom/promotion.service';

import { POSOrderService } from '../pos-order.service';
import { POSService } from '../pos.service';
import { dog } from 'src/environments/environment';
import { ShiftDetailPage } from '../../HRM/shift-detail/shift-detail.page';
import { POSShiftDetailPage } from '../pos-shift-detail/pos-shift-detail.page';
import { POS_ShiftPService } from '../services/pos-shift-service';

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
	systemConfig: any = {};
	constructor(
		public posService: POSService,
		public posShiftService: POS_ShiftPService,
		public pageProvider: SALE_OrderProvider,
		public posOrderService: POSOrderService,
		private tableGroupProvider: POS_TableGroupProvider,
		private tableProvider: POS_TableProvider,
		private sysConfigProvider: SYS_ConfigProvider,
		private promotionService: PromotionService,

		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location,
		public commonService: CommonService
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
		// Subscribe to POSOrderService reactive state
		this.posOrderService.orders$.subscribe((orders) => {
			this.updateOrderCountersFromService(orders);
		});

		this.posOrderService.isLoading$.subscribe((loading) => {
			console.log('🔄 POSOrderService loading state:', loading);
		});

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

				case 'app:POSPaymentSuccess':
					this.notifyPaymentSuccess(data);
					break;
			}
		});
		this.posShiftService.pageConfig = this.pageConfig;
		this.posShiftService.initShift();
		super.ngOnInit();
	}

	openShift() {
		this.posShiftService.openShiftModal();
	}

	private notifyPaymentSuccess(data) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			let message = 'Đơn hàng ' + value.IDSaleOrder + ' thanh toán thành công';
			this.env.showMessage('Đơn hàng ' + value.IDSaleOrder +' thanh toán thành công', 'success');
			let url = 'pos-order/' + data.id;
			let notification = {
				Id: value.Id,
				IDBranch: value.IDBranch,
				IDSaleOrder: value.IDSaleOrder,
				Type: 'Payment',
				Name: 'Thanh toán thành công',
				Code: 'pos-order',
				Message: message,
				Url: url,
				Watched: false,
			};

			this.setNotifications(notification, true);
			this.refresh();
		}
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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
			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
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

			// Use service notification handling instead of manual refresh
			this.posOrderService.handleOrderUpdateNotification(data.id);
		}
	}

	private playAudio(type) {
		let audio = new Audio();
		if (type == 'Order') {
			audio.src = this.systemConfig['POSAudioOrderUpdate'];
		} else if (type == 'CallToPay') {
			audio.src = this.systemConfig['POSAudioCallToPay'];
		} else if (type == 'Payment') {
			audio.src = this.systemConfig['POSAudioIncomingPayment'];
		} else if (type == 'Support') {
			audio.src = this.systemConfig['POSAudioCallStaff'];
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
		let forceReload = event === 'force';
		this.posService
			.getEnviromentDataSource(this.env.selectedBranch, forceReload)
			.then(() => {
				this.tableGroupList = this.posService.dataSource?.tableGroups || [];
				dog && console.log('POSOrderPage: PreLoadData dataSource', this.posService.dataSource);
			})
			.finally(() => {
				super.preLoadData(event);
			});

		console.log('🔄 POSOrderPage: PreLoadData triggered', { event });

		let sysConfigQuery = ['POSAudioCallStaff', 'POSAudioCallToPay', 'POSAudioOrderUpdate', 'POSAudioIncomingPayment'];
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
			dog && console.log('POSOrderPage: PreLoadData tableGroupList', this.tableGroupList);
			this.soStatusList = values[1];

			this.pageConfig.systemConfig = { IsAutoSave: false };

			this.systemConfig = {};

			values[2]['data'].forEach((e) => {
				if ((e.Value == null || e.Value == 'null') && e._InheritedConfig) {
					e.Value = e._InheritedConfig.Value;
				}
				this.systemConfig[e.Code] = JSON.parse(e.Value);
			});

			// Service handles all data initialization internally
			super.preLoadData(event);
		});
	} /**
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
	} /**
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
				SortBy: 'ModifiedDate_desc', // Sort by modified date
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
							TotalAfterTax: serverOrder.TotalAfterTax || serverOrder.CalcTotalOriginal || 0,
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
					total: serverResult.data.length,
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
				paginated: paginatedOrders.length,
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
					if (this.items.findIndex((d) => d.Id === firstRow.Id) === -1) {
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
	 * Apply client-side filters to orders (enhanced)
	 */
	private applyClientFilters(orders: any[]): any[] {
		return orders.filter((order) => {
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

			// Filter by date range
			if (this.query.CreatedDateFrom || this.query.CreatedDateTo) {
				const orderDate = new Date(order.CreatedDate);

				if (this.query.CreatedDateFrom) {
					const fromDate = new Date(this.query.CreatedDateFrom);
					if (orderDate < fromDate) {
						return false;
					}
				}

				if (this.query.CreatedDateTo) {
					const toDate = new Date(this.query.CreatedDateTo);
					toDate.setHours(23, 59, 59, 999); // End of day
					if (orderDate > toDate) {
						return false;
					}
				}
			}

			// Filter by table if provided
			if (this.query.IDTable) {
				const hasTable = order.Tables?.some((table) => table.IDTable === this.query.IDTable || table.TableId === this.query.IDTable);
				if (!hasTable) {
					return false;
				}
			}

			// Enhanced keyword search
			if (this.query.Keyword) {
				const keyword = this.query.Keyword.toLowerCase();

				// Special handling for date format search (MMDDYY-MMDDYY)
				if (keyword.indexOf('-') !== -1 && keyword.length <= 13) {
					// Date range search format
					return true; // Let date range filter handle this
				}

				// Multi-field text search
				const searchableText = [
					order.Code,
					order.Id?.toString(),
					order.Remark,
					order.CustomerName,
					order.CustomerPhone,
					order.TotalAfterTax?.toString(),
					order.Tables?.map((t) => t.TableName)?.join(' '),
				]
					.filter((text) => text)
					.join(' ')
					.toLowerCase();

				// Support multiple keywords with space separator
				const keywords = keyword.split(' ').filter((k) => k.trim());
				return keywords.every((k) => searchableText.includes(k));
			}

			return true;
		});
	}

	/**
	 * Apply client-side sorting to orders (enhanced)
	 */
	private applyClientSorting(orders: any[]): any[] {
		return orders.sort((a, b) => {
			// Parse sort criteria from query
			if (this.query.SortBy) {
				const [field, direction] = this.query.SortBy.split('_');
				const isDesc = direction === 'desc';

				let aValue, bValue;

				switch (field) {
					case 'Id':
					case 'IDOrder':
						aValue = a.Id || 0;
						bValue = b.Id || 0;
						break;
					case 'CreatedDate':
						aValue = new Date(a.CreatedDate || 0).getTime();
						bValue = new Date(b.CreatedDate || 0).getTime();
						break;
					case 'ModifiedDate':
						aValue = new Date(a.ModifiedDate || 0).getTime();
						bValue = new Date(b.ModifiedDate || 0).getTime();
						break;
					case 'TotalAfterTax':
						aValue = a.TotalAfterTax || 0;
						bValue = b.TotalAfterTax || 0;
						break;
					case 'Status':
						aValue = a.Status || '';
						bValue = b.Status || '';
						break;
					case 'Code':
						aValue = a.Code || '';
						bValue = b.Code || '';
						break;
					default:
						// Default to Id
						aValue = a.Id || 0;
						bValue = b.Id || 0;
				}

				// Compare values
				let comparison = 0;
				if (typeof aValue === 'string') {
					comparison = aValue.localeCompare(bValue);
				} else {
					comparison = aValue - bValue;
				}

				return isDesc ? -comparison : comparison;
			}

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
				if (this.items.findIndex((d) => d.Id === firstRow.Id) === -1) {
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
	 * Update order counters from service reactive state
	 */
	private updateOrderCountersFromService(orders: any[]): void {
		if (!orders) return;

		// Apply same filtering as current items
		const filteredOrders = this.applyClientFilters(orders);

		// Update counters based on filtered orders (same logic as loadedData)
		this.orderCounter = 0;
		this.numberOfGuestCounter = 0;

		filteredOrders.forEach((order) => {
			const isLocked = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'].indexOf(order.Status) == -1;
			if (!isLocked) {
				this.orderCounter++;
				this.numberOfGuestCounter += order.NumberOfGuests || 0;
			}
		});

		console.log('🔢 Updated counters from service:', {
			orderCounter: this.orderCounter,
			numberOfGuestCounter: this.numberOfGuestCounter,
			totalOrders: orders.length,
			filteredOrders: filteredOrders.length,
		});
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
					lastUpdated: systemHealth.storageInfo.lastUpdated,
				},
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

	/**
	 * Refresh method - Service-based implementation
	 * Compatible with existing calls but uses POSOrderService
	 */
	async refresh(event?: any): Promise<void> {
		console.log('🔄 POSOrderPage: Refresh triggered via service', { event });

		try {
			// Force refresh from server
			await this.posOrderService.ensureDataIsUpToDate(true);

			// Trigger search to update displayed items
			this.loadData('search');

			console.log('✅ Service-based refresh completed');
		} catch (error) {
			console.error('❌ Service refresh failed, falling back to parent:', error);
			// Fallback to original refresh mechanism
			super.refresh();
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

		// Handle split completion via service
		if (data && data.success) {
			console.log('✅ Split order completed:', data);
			// Force refresh from server to get updated split orders
			await this.posOrderService.ensureDataIsUpToDate(true);
		} else if (data && data.orderId) {
			// If only orderId is provided, trigger notification handling
			this.posOrderService.handleOrderUpdateNotification(data.orderId);
		}
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

		// Handle merge completion via service
		if (data && data.success) {
			console.log('✅ Merge orders completed:', data);
			// Force refresh from server to get updated merged order
			await this.posOrderService.ensureDataIsUpToDate(true);
		} else if (data && data.orderId) {
			// If only orderId is provided, trigger notification handling
			this.posOrderService.handleOrderUpdateNotification(data.orderId);
		}
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

		// Handle table change completion via service
		if (data && data.success) {
			console.log('✅ Table change completed:', data);
			// Force refresh from server to get updated order
			await this.posOrderService.ensureDataIsUpToDate(true);
		} else if (data && data.orderId) {
			// If only orderId is provided, trigger notification handling
			this.posOrderService.handleOrderUpdateNotification(data.orderId);
		}
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
				.then(async (_) => {
					if (this.submitAttempt == false) {
						this.submitAttempt = true;

						try {
							// Use POSOrderService for cancellation with fallback
							const orderIds = this.selectedItems.map((m) => m.Id);
							console.log('🚫 Cancelling orders via POSOrderService:', { orderIds, cancelData });

							// Try service first (if cancel method exists)
							let success = false;
							try {
								// For now, fallback to original API since service doesn't have cancelOrder method yet
								cancelData.Type = 'POSOrder';
								cancelData.Ids = orderIds;

								await this.pageProvider.commonService.connect('POST', 'SALE/Order/CancelOrders/', cancelData).toPromise();

								success = true;
								console.log('✅ Orders cancelled successfully');
							} catch (serviceError) {
								console.error('❌ Service cancellation failed:', serviceError);
								throw serviceError;
							}

							if (success) {
								// Trigger data refresh via service
								await this.posOrderService.ensureDataIsUpToDate(true);

								// Publish event for other components
								let publishEventCode = this.pageConfig.pageName;
								if (publishEventCode) {
									this.env.publishEvent({
										Code: publishEventCode,
									});
								}

								// Navigate back
								this.nav('/pos-order', 'forward');
							}
						} catch (error) {
							console.error('❌ Failed to cancel orders:', error);
							this.env.showMessage('Không thể hủy đơn hàng. Vui lòng thử lại.', 'danger');
						} finally {
							this.submitAttempt = false;
						}
					}
				})
				.catch((_) => {});
		}
	}

	interval = null;
	ionViewDidEnter() {
		if (!this.interval) {
			this.interval = setInterval(() => {
				// Auto-refresh disabled since service handles sync automatically
				// this.refresh();
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

	async exportPOSData() {
		console.log('📤 Starting POS data export...');
		this.query.SortBy = 'IDOrder_desc';

		// Validate date range for export
		if (this.query.Keyword && this.query.Keyword.indexOf('-') !== -1) {
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

		const loading = await this.loadingController.create({
			cssClass: 'my-custom-class',
			message: 'Đang xuất dữ liệu...',
		});

		try {
			await loading.present();

			// First try to get data from service (if available locally)
			console.log('🔍 Checking local data availability...');
			const localOrders = await this.posOrderService.getAllOrders();
			const filteredOrders = this.applyClientFilters(localOrders);

			// If we have sufficient local data and query is simple, use it
			if (filteredOrders.length > 0 && this.canUseLocalDataForExport()) {
				console.log('✅ Using local data for export:', { count: filteredOrders.length });

				// Generate export from local data
				const exportData = this.prepareExportData(filteredOrders);
				this.downloadExportData(exportData);
			} else {
				// Fallback to server export API
				console.log('🌐 Falling back to server export...');
				const response: any = await this.commonService.connect('GET', 'SALE/Order/ExportPOSOrderList', this.query).toPromise();

				this.downloadURLContent(response);
			}

			console.log('✅ Export completed successfully');
		} catch (error) {
			console.error('❌ Export failed:', error);

			if (error.message != null) {
				this.env.showMessage(error.error?.ExceptionMessage || 'Lỗi xuất dữ liệu', 'danger');
			} else {
				this.env.showMessage('Cannot extract data', 'danger');
			}
		} finally {
			this.submitAttempt = false;
			if (loading) loading.dismiss();
		}
	}

	/**
	 * Check if local data can be used for export (simple queries only)
	 */
	private canUseLocalDataForExport(): boolean {
		// Only use local data for simple queries without complex server-side processing
		return !this.query.ComplexFilter && !this.query.GroupBy && !this.query.AggregateFields;
	}

	/**
	 * Prepare export data from local orders
	 */
	private prepareExportData(orders: any[]): any {
		return {
			data: orders.map((order) => ({
				Id: order.Id,
				Code: order.Code,
				Status: order.Status,
				CreatedDate: order.CreatedDate,
				TotalAfterTax: order.TotalAfterTax,
				CustomerName: order.CustomerName,
				Tables: order.Tables?.map((t) => t.TableName).join(', ') || '',
			})),
			filename: `POS_Orders_${new Date().toISOString().split('T')[0]}.csv`,
		};
	}

	/**
	 * Download export data (CSV format)
	 */
	private downloadExportData(exportData: any): void {
		if (exportData.data && exportData.data.length > 0) {
			// Generate CSV content
			const headers = Object.keys(exportData.data[0]);
			const csvContent = [headers.join(','), ...exportData.data.map((row) => headers.map((header) => `"${row[header] || ''}"`).join(','))].join('\n');

			// Create and download file
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = exportData.filename;
			link.click();

			console.log('📁 Local export downloaded:', exportData.filename);
		}
	}
}
