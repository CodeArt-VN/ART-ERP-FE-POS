import { Injectable } from '@angular/core';
import { EnvService } from 'src/app/services/core/env.service';
import { NavController } from '@ionic/angular';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';

@Injectable({
	providedIn: 'root',
})
export class POSNotifyService {
	notifications = [];

	constructor(
		private env: EnvService,
		private navCtrl: NavController,
		private pageProvider: SALE_OrderProvider
	) {}

	async handleEvent(data: any, currentItem: any, currentTable: number, loadDataCallback: Function) {
		//Check if form is dirty - this should be handled by caller
		console.log('received event:', data);

		switch (data.code) {
			case 'app:POSOrderPaymentUpdate':
				return this.handlePaymentEvent(data, currentItem, loadDataCallback);
			case 'app:POSOrderFromCustomer':
				return this.handleOrderEvent(data, currentItem, loadDataCallback);
			case 'app:POSLockOrderFromStaff':
			case 'app:POSLockOrderFromCustomer':
				return this.handleLockOrderEvent(data, currentTable, loadDataCallback);
			case 'app:POSUnlockOrderFromStaff':
			case 'app:POSUnlockOrderFromCustomer':
				return this.handleUnlockOrderEvent(data, currentTable, loadDataCallback);
			case 'app:POSSupport':
				return this.handleSupportEvent(data);
			case 'app:POSCallToPay':
				return this.handleCallToPayEvent(data);
			case 'app:notifySplittedOrderFromStaff':
				return this.handleSplittedOrderEvent(data, currentTable, loadDataCallback);
			case 'app:POSOrderMergedFromStaff':
				return this.handleMergedOrderEvent(data, currentTable, loadDataCallback);
			case 'app:networkStatusChange':
				return this.handleNetworkChangeEvent(data, currentItem, loadDataCallback);
			case 'app:POSOrderFromStaff':
				return this.handleOrderFromStaffEvent(data, currentTable, loadDataCallback);
			case 'app:POSPaymentSuccess':
				this.handlePaymentSuccessEvent(data, currentTable, loadDataCallback);
				break;
		}
	}

	private handlePaymentEvent(data: any, currentItem: any, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		if (value.IDSaleOrder == currentItem?.Id) {
			loadDataCallback();
		} else {
			this.getStorageNotifications();
		}
	}

	private async handlePaymentSuccessEvent(data: any, currentItem: any, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			let message = 'Đơn hàng ' + value.IDSaleOrder + ' thanh toán thành công';
			this.env.showMessage('Đơn hàng ' + value.IDSaleOrder + ' thanh toán thành công', 'success');
			let url = 'pos-order/' + value.IDSaleOrder;
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
			await this.setNotifications(notification, true);
			if (data.id == currentItem?.Id) {
				loadDataCallback();
			}
		}
	}

	private async handleOrderEvent(data: any, currentItem: any, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
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
			await this.setNotifications(notification, true);
		}
		if (data.id == currentItem?.Id) {
			loadDataCallback();
		}
	}

	private handleOrderFromStaffEvent(data: any, currentTable: number, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(currentTable);
		if (index != -1) {
			loadDataCallback();
		} else {
			this.getStorageNotifications();
		}
	}

	private handleLockOrderEvent(data: any, currentTable: number, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(currentTable);
		if (index != -1) {
			loadDataCallback();
		} else {
			this.getStorageNotifications();
		}
	}

	private handleUnlockOrderEvent(data: any, currentTable: number, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(currentTable);
		if (index != -1) {
			loadDataCallback();
		} else {
			this.getStorageNotifications();
		}
	}

	private handleSupportEvent(data: any) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu phục vụ';
			this.env.showMessage('Khách bàn {{value}} yêu cầu phục vụ', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;
			let notification = {
				Id: value.Id,
				IDBranch: value.IDBranch,
				IDSaleOrder: value.IDSaleOrder,
				Type: 'Support',
				Name: 'Yêu cầu phục vụ',
				Code: 'pos-order',
				Message: message,
				Url: url,
				Watched: false,
			};
			this.setNotifications(notification, true);
		}
	}

	private handleCallToPayEvent(data: any) {
		const value = JSON.parse(data.value);
		if (this.env.selectedBranch == value.IDBranch) {
			let message = 'Khách bàn ' + value.Tables[0].TableName + ' yêu cầu tính tiền';
			this.env.showMessage('Khách bàn {{value}} yêu cầu tính tiền', 'warning', value.Tables[0].TableName);
			let url = 'pos-order/' + data.id + '/' + value.Tables[0].IDTable;

			let notification = {
				Id: value.Id,
				IDBranch: value.IDBranch,
				IDSaleOrder: value.IDSaleOrder,
				Type: 'Support',
				Name: 'Yêu cầu tính tiền',
				Code: 'pos-order',
				Message: message,
				Url: url,
				Watched: false,
			};
			this.setNotifications(notification, true);
		}
	}

	private handleSplittedOrderEvent(data: any, currentTable: number, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(currentTable);
		if (index != -1) {
			this.env.showMessage('The order has been split.', 'warning');
			loadDataCallback();
		} else {
			this.getStorageNotifications();
		}
	}

	private handleMergedOrderEvent(data: any, currentTable: number, loadDataCallback: Function) {
		const value = JSON.parse(data.value);
		let index = value.Tables.map((t) => t.IDTable).indexOf(currentTable);
		if (index != -1) {
			this.env.showMessage('The order has been merged.', 'warning');
			loadDataCallback();
		} else {
			this.getStorageNotifications();
		}
	}

	private handleNetworkChangeEvent(data: any, currentItem: any, loadDataCallback: Function) {
		if (data.status.connected) {
			if (currentItem.Id) {
				this.pageProvider.commonService
					.connect('GET', 'SALE/Order/CheckPOSModifiedDate', {
						IDOrder: currentItem.Id,
					})
					.toPromise()
					.then((lastModifiedDate) => {
						if (lastModifiedDate > currentItem.ModifiedDate) {
							this.env.showMessage('Order information has changed, the order will be updated.', 'danger');
							loadDataCallback();
						}
					})
					.catch((err) => {
						console.log(err);
					});
			}
		}
	}

	async getStorageNotifications() {
		await this.env.getStorage('Notifications').then(async (result) => {
			if (result?.length > 0) {
				this.notifications = [...result.filter((n) => !n.Watched && n.IDBranch == this.env.selectedBranch)];
				let a = this.notifications;
				console.log(a);
			}
		});
	}

	async setNotifications(item: any, lasted = false) {
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

	async goToNotification(i: any, j: number, currentItem: any, loadDataCallback: Function, navBackCallback: Function, navCallback: Function) {
		this.notifications[j].Watched = true;
		this.env.setStorage('Notifications', this.notifications);
		if (i.Url != null) {
			if (i.IDSaleOrder == currentItem.Id) {
				loadDataCallback();
			} else {
				await navBackCallback();
				navCallback(i.Url, 'forward');
			}
			this.removeNotification(j);
		}
	}

	removeNotification(j: number) {
		this.notifications.splice(j, 1);
		this.env.setStorage('Notifications', this.notifications);
	}
}
