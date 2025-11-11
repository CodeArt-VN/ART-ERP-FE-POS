import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { EnvService } from 'src/app/services/core/env.service';
import { POSConfig, NotificationPayload, StoredNotification } from './interface.model';
import { lib } from 'src/app/services/static/global-functions';
import { dog } from 'src/environments/environment';

enum NotificationType {
	Order = 'Order',
	Payment = 'Payment',
	Support = 'Support',
	CallToPay = 'CallToPay',
	LockOrder = 'LockOrder',
	UnlockOrder = 'UnlockOrder',
	SplitOrder = 'SplitOrder',
	MergeOrder = 'MergeOrder',
}

enum AudioType {
	Order = 'Order',
	Payment = 'Payment',
	CallToPay = 'CallToPay',
	Support = 'Support',
}

interface SignalREvent {
	code: string;
	value: string;
	id: number;
}

@Injectable({
	providedIn: 'root',
})
export class POSNotifyService {
	subscriptions: Subscription[] = [];
	systemConfig: POSConfig = null;
	notifications: StoredNotification[] = [];

	constructor(private env: EnvService) {
		this.subscriptions.push(
			this.env.getEvents().subscribe((data: SignalREvent) => {
				this.handleSignalREvent(data);
			})
		);

		setTimeout(() => {
			this.getNotifications();
		}, 100);
	}

	private handleSignalREvent(data: SignalREvent): void {
		if (!data.code?.startsWith('signalR:')) return;
		if (data.id == this.env.user.StaffID) return; // Bypass notify to self

		const value: NotificationPayload = JSON.parse(data.value);
		if (this.env.selectedBranch != value.IDBranch) return; // Bypass notify to other branches

		switch (data.code) {
			case 'signalR:POSOrderFromCustomer':
				this.notifyOrder(value);
				break;
			case 'signalR:POSOrderPaymentUpdate':
				this.notifyPayment(value);
				break;
			case 'signalR:POSSupport':
				this.notifySupport(value);
				break;
			case 'signalR:POSCallToPay':
				this.notifyCallToPay(value);
				break;
			case 'signalR:POSLockOrderFromStaff':
				this.notifyLockOrderFromStaff(value);
				break;
			case 'signalR:POSLockOrderFromCustomer':
				this.notifyLockOrderFromCustomer(value);
				break;
			case 'signalR:POSUnlockOrderFromStaff':
				this.notifyUnlockOrderFromStaff(value);
				break;
			case 'signalR:POSUnlockOrderFromCustomer':
				this.notifyUnlockOrderFromCustomer(value);
				break;
			case 'signalR:POSOrderSplittedFromStaff':
				this.notifySplittedOrderFromStaff(value);
				break;
			case 'signalR:POSOrderMergedFromStaff':
				this.notifyMergedOrderFromStaff(value);
				break;
			case 'signalR:POSOrderFromStaff':
				this.notifyOrderFromStaff(value);
				break;
			default:
				break;
		}
	}

	getNotifications(): void {
		this.env.getStorage('Notifications').then((result) => {
			if (result?.length > 0) {
				this.notifications = result.filter((n) => !n.Watched && n.IDBranch == this.env.selectedBranch);
			}
		});
	}

	unsubscribeAll(): void {
		this.subscriptions.forEach((sub) => sub.unsubscribe());
	}

	private notifyPayment(value: NotificationPayload): void {
		if (value.IDStaff == 0) {
			const message = `Khách hàng bàn ${value.TableName} thanh toán online ${lib.currencyFormat(value.Amount)} cho đơn hàng #${value.IDSaleOrder}`;
			this.createAndStoreNotification({
				orderId: value.IDSaleOrder,
				tableId: value.IDTable,
				value,
				type: NotificationType.Payment,
				name: 'Thanh toán',
				message,
				audioType: AudioType.Payment,
			});
		}
	}

	private notifyOrder(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Khách bàn ${tableName} Gọi món`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Order,
			name: 'Đơn hàng',
			message,
			audioType: AudioType.Order,
		});
	}

	private notifySupport(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Khách bàn ${tableName} yêu cầu phục vụ`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Yêu cầu phục vụ',
			message,
			audioType: AudioType.Support,
		});
	}

	private notifyCallToPay(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Khách bàn ${tableName} yêu cầu tính tiền`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Yêu cầu tính tiền',
			message,
			audioType: AudioType.Support,
		});
	}

	private notifyLockOrderFromStaff(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Nhân viên đã khóa đơn bàn ${tableName}`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Khóa đơn hàng',
			message,
			audioType: AudioType.Order,
			showMessage: true,
		});
	}

	private notifyLockOrderFromCustomer(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Khách bàn ${tableName} đã khóa đơn`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Khóa đơn hàng',
			message,
			audioType: AudioType.Order,
			showMessage: true,
			messageTemplate: 'Khách bàn {{value}} đã khóa đơn',
			messageValue: tableName,
		});
	}

	private notifyUnlockOrderFromStaff(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Nhân viên đã mở đơn bàn ${tableName}`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Mở khóa đơn hàng',
			message,
			audioType: AudioType.Order,
			showMessage: true,
		});
	}

	private notifyUnlockOrderFromCustomer(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Khách bàn ${tableName} đã mở đơn`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Mở khóa đơn hàng',
			message,
			audioType: AudioType.Order,
			showMessage: true,
			messageTemplate: 'Khách bàn {{value}} đã mở đơn',
			messageValue: tableName,
		});
	}

	private notifySplittedOrderFromStaff(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Nhân viên đã chia đơn bàn ${tableName}`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Chia đơn hàng',
			message,
			audioType: AudioType.Order,
			showMessage: true,
			messageTemplate: 'Nhân viên đã chia đơn bàn {{value}}',
			messageValue: tableName,
		});
	}

	private notifyOrderFromStaff(value: NotificationPayload): void {
		dog && console.log('🔔 Staff added items to order:', value);

		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Nhân viên đã thêm món mới đơn bàn ${tableName}`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Thêm món',
			message,
			audioType: AudioType.Order,
			showMessage: true,
		});
	}

	private notifyMergedOrderFromStaff(value: NotificationPayload): void {
		dog && console.log('🔔 Staff merged orders:', value);

		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = `Nhân viên đã gộp đơn bàn ${tableName}`;

		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.Support,
			name: 'Gộp đơn hàng',
			message,
			audioType: AudioType.Order,
			showMessage: true,
			messageTemplate: 'Nhân viên đã gộp đơn bàn {{value}}',
			messageValue: tableName,
		});
	}

	private createAndStoreNotification(config: {
		orderId: number;
		tableId: number;
		value: NotificationPayload;
		type: NotificationType;
		name: string;
		message: string;
		audioType?: AudioType;
		showMessage?: boolean;
		messageTemplate?: string;
		messageValue?: string;
	}): void {
		const { orderId, tableId, value, type, name, message, audioType, showMessage = true, messageTemplate, messageValue } = config;

		if (audioType) {
			this.playAudio(audioType);
		}

		if (showMessage) {
			if (messageTemplate && messageValue) {
				this.env.showMessage(messageTemplate, 'warning', messageValue);
			} else {
				this.env.showMessage(message, 'warning');
			}
		}

		const url = `pos-order/${orderId}/${tableId}`;
		const notification: StoredNotification = {
			Id: null,
			IDBranch: value.IDBranch,
			IDSaleOrder: orderId,
			Type: type,
			Name: name,
			Code: 'pos-order',
			Message: message,
			Url: url,
		};

		this.setNotifications(notification, true);
	}

	private async setNotifications(item: StoredNotification, lasted = false): Promise<void> {
		const isExistedNoti = this.notifications.some((d) => this.isSameNotification(d, item));

		if (isExistedNoti && lasted) {
			const index = this.notifications.findIndex((d) => this.isSameNotification(d, item));
			if (index !== -1) {
				this.notifications.splice(index, 1);
				this.notifications.unshift(item);
				await this.env.setStorage('Notifications', this.notifications);
			}
		} else if (!isExistedNoti) {
			this.notifications.unshift(item);
			await this.env.setStorage('Notifications', this.notifications);
		}
	}

	private isSameNotification(d: StoredNotification, item: StoredNotification): boolean {
		return (
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
	}

	private playAudio(type: AudioType): void {
		const audio = new Audio();
		switch (type) {
			case AudioType.Order:
				audio.src = this.systemConfig.POSAudioOrderUpdate;
				break;
			case AudioType.CallToPay:
				audio.src = this.systemConfig.POSAudioCallToPay;
				break;
			case AudioType.Payment:
				audio.src = this.systemConfig.POSAudioIncomingPayment;
				break;
			case AudioType.Support:
				audio.src = this.systemConfig.POSAudioCallStaff;
				break;
		}
		if (audio.src) {
			audio.load();
			audio.play();
		}
	}
}
