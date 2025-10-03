export interface POSConfig
{
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
}