export interface POSConfig {
	IsAutoSave: boolean;
	SODefaultBusinessPartner: number;
	IsUseIPWhitelist: boolean;
	IPWhitelistInput: string;
	IsRequireOTP: boolean;
	POSLockSpamPhoneNumber: boolean;
	LeaderMachineHost: string;
	POSSettleAtCheckout: boolean;
	POSHideSendBarKitButton: boolean;
	POSEnableTemporaryPayment: boolean;
	POSEnablePrintTemporaryBill: boolean;
	POSAutoPrintBillAtSettle: boolean;
	POSDefaultPaymentProvider: string;
	POSTopItemsMenuIsShow: boolean;
	POSTopItemsMenuNumberOfItems: number;
	POSTopItemsMenuNumberOfDays: number;
	POSTopItemsMenuNotIncludedItemIds: string;
	POSAudioOrderUpdate: string;
	POSAudioIncomingPayment: string;
	POSAudioCallToPay: string;
	POSAudioCallStaff: string;
	POSServiceCharge: number;
	POSIsShowItemImage: boolean;
	POSBillQRPaymentMethod: string;

	// QR Code Payment
	BKIncomingDefaultBankName?: any;
	BKIncomingDefaultBankAccount?: string;
	BKIncomingQRPrefix?: string;
	BKIncomingQRSuffix?: string;
}
