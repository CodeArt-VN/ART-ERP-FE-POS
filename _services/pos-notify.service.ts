import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EnvService } from 'src/app/services/core/env.service';
import { POSConfig, NotificationPayload, StoredNotification } from './interface.model';
import { lib } from 'src/app/services/static/global-functions';
import { dog } from 'src/environments/environment';
import { CommonService } from 'src/app/services/core/common.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';
enum NotificationType {
	Order = 'Order',
	Payment = 'Payment',
	Support = 'Support',
	CallToPay = 'CallToPay',
	LockOrder = 'LockOrder',
	UnlockOrder = 'UnlockOrder',
	SplitOrder = 'SplitOrder',
	MergeOrder = 'MergeOrder',
	PaymentSuccess = 'PaymentSuccess',
}

enum AudioType {
	Order = 'Order',
	Payment = 'Payment',
	CallToPay = 'CallToPay',
	Support = 'Support',
	PaymentSuccess = 'PaymentSuccess',
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

	constructor(
		private env: EnvService,
		private commonService: CommonService,
		private http: HttpClient
	) {
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
			case 'signalR:POSPaymentSuccess':
				this.handlePaymentSuccessEvent(value);
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

	private handlePaymentSuccessEvent(value: NotificationPayload): void {
		const tableName = value.Tables?.[0]?.TableName;
		const tableId = value.Tables?.[0]?.IDTable;
		const message = 'Đơn hàng ' + value.IDSaleOrder + ' thanh toán thành công';
		const messageValue = lib.DocTienBangChu(value.Amount);
		const messageTemplate = `Bàn ${tableName} đã thanh toán ${messageValue}`;
		this.createAndStoreNotification({
			orderId: value.IDSaleOrder,
			tableId,
			value,
			type: NotificationType.PaymentSuccess,
			name: 'Payment successful',
			audioType: AudioType.PaymentSuccess,
			message,
			showMessage: true,
			messageTemplate: messageTemplate,
			messageValue: messageValue,
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
			this.playAudio(audioType, messageTemplate);
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

	private playAudio(type: AudioType, text?: string): void {
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

		if (type == AudioType.PaymentSuccess && text && this.systemConfig.POSIsReadTheAmount) {
			// Gọi API với responseType: 'blob' để nhận audio binary data
			const url = (environment.appDomain + 'api/JOBS/TextToSpeech/' + encodeURIComponent(text));
			const headers = new HttpHeaders({
				'App-Version': environment.appVersion,
			});
			
			this.http.get(url, { 
				headers: headers, 
				responseType: 'blob' 
			}).toPromise()
			.then((blob: Blob) => {
				const audioUrl = URL.createObjectURL(blob);
				audio.src = audioUrl;
				audio.load();
				
				// Handle autoplay policy on mobile - play() may fail silently
				const playPromise = audio.play();
				if (playPromise !== undefined) {
					playPromise.catch(error => {
						dog && console.warn('⚠️ Audio autoplay prevented:', error);
						// Fallback: try to play after user interaction
					});
				}
				
				// Clean up object URL after audio finishes playing
				audio.addEventListener('ended', () => {
					URL.revokeObjectURL(audioUrl);
				}, { once: true });
			}).catch(err => {
				dog && console.error('❌ Failed to get text-to-speech audio:', err);
				// Fallback to default audio if TTS fails
				if (this.systemConfig.POSAudioIncomingPayment) {
					audio.src = this.systemConfig.POSAudioIncomingPayment;
					audio.load();
					audio.play().catch(e => dog && console.warn('⚠️ Fallback audio play failed:', e));
				}
			});
		} else {
			if (audio.src) {
				audio.load();
				audio.play().catch(error => {
					dog && console.warn('⚠️ Audio autoplay prevented:', error);
				});
			}
		}
	}

	toVietnamese(num: number): string {
		if (!num) num = 100000;
		const ChuSo = [' không', ' một', ' hai', ' ba', ' bốn', ' năm', ' sáu', ' bảy', ' tám', ' chín'];
		const Tien = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ', ' tỷ tỷ'];

		function doc3so(baso: number): string {
			let tram = Math.floor(baso / 100);
			let chuc = Math.floor((baso % 100) / 10);
			let donvi = baso % 10;
			let ketqua = '';

			if (tram === 0 && chuc === 0 && donvi === 0) return '';
			if (tram !== 0) {
				ketqua += ChuSo[tram] + ' trăm';
				if (chuc === 0 && donvi !== 0) ketqua += ' linh';
			}
			if (chuc !== 0 && chuc !== 1) {
				ketqua += ChuSo[chuc] + ' mươi';
			}
			if (chuc === 1) ketqua += ' mười';
			switch (donvi) {
				case 1:
					if (chuc !== 0 && chuc !== 1) ketqua += ' mốt';
					else ketqua += ChuSo[donvi];
					break;
				case 5:
					if (chuc === 0) ketqua += ChuSo[donvi];
					else ketqua += ' lăm';
					break;
				default:
					if (donvi !== 0) ketqua += ChuSo[donvi];
					break;
			}
			return ketqua;
		}

		if (num === 0) return 'Không đồng';

		let so = num;
		let i = 0;
		let ketqua = '';
		let tmp = '';

		while (so > 0) {
			const baso = so % 1000;
			so = Math.floor(so / 1000);
			tmp = doc3so(baso);
			if (tmp !== '') ketqua = tmp + Tien[i] + ketqua;
			i++;
		}

		return (ketqua.trim() + ' đồng').replace(/\s+/g, ' ').trim();
	}

	readText(text: string) {
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = 'vi-VN'; // tiếng Việt
		utterance.rate = 1; // tốc độ đọc (1 = bình thường)
		utterance.pitch = 1; // độ cao giọng
		speechSynthesis.speak(utterance);
	}
}
