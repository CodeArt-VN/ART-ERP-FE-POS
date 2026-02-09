import {
	BRA_Branch,
	POS_Kitchen,
	POS_Menu,
	POS_MenuDetail,
	POS_Table,
	POS_TableGroup,
	SALE_Order,
	SALE_OrderDetail,
	SYS_Printer,
	SYS_Status,
	SYS_Type,
} from '../../../models/model-list-interface';

export interface POSServiceData {
	DataSources: POSDataSource;
	SystemConfig: POSConfig;
}

export interface POSDataSource {
	paymentStatusList: SYS_Status[];
	orderStatusList: SYS_Status[];
	orderDetailStatusList: SYS_Status[];

	paymentTypeList: SYS_Type[];

	orders: POS_Order[];
	tableGroups: TableGroup[];
	kitchens: Kitchen[];

	tableList: POS_Table[];
	menuList: Menu[];
	dealList: any[];
	branchInfo?: BRA_Branch;
}

export interface Menu extends POS_Menu {
	Items?: MenuDetail[]; // Danh sách items trong menu
}

export interface MenuDetail extends POS_MenuDetail {
	ForeignName?: string;
	SalesUoM?: number;
	Price: number;
	IDKitchens: string;
	IDSalesTaxDefinition?: number;
	SalesTaxPercent?: number;
	Groups?: any[];
	BOMs?: any[];
	UoMs?: any[]; // Danh sách UoM của item không cần tạo interface
	BookedQuantity?: number;
}

export interface TableGroup extends POS_TableGroup {
	tables: POS_Table[];
}

export interface Kitchen extends POS_Kitchen {
	_Printer: SYS_Printer;
}

export interface POS_Order extends SALE_Order {
	_TotalQuantity?: number; //Show on the cart
	IDTable?: number; // Table reference for POS orders

	//Print properties
	AdditionsAmount?: number; //Show SC on the bill
	AdditionsTax?: number; //Show SC on the bill
	OriginalTotalDiscountPercent?: number; //Show SC on the bill
	OriginalTaxPercent?: number; //Show SC on the bill
	CalcOriginalTotalAdditionsPercent?: number; //Show SC on the bill
	AdditionsAmountPercent?: number; //Show SC on the bill
	OriginalDiscountFromSalesmanPercent?: number; //Show SC on the bill

	OrderLines?: POS_OrderDetail[];
}

export interface POS_OrderDetail extends SALE_OrderDetail {
	_serviceCharge: number;
	ItemName?: string;
	Notes?: string;
	IDWarehouse?: number;
}

// ========================
// New Architecture Interfaces
// ========================

export interface CartItem extends POS_OrderDetail {
	Code: string;
	IDItem: number;
	ItemName: string;
	Quantity: number;
	UoMPrice: number;
	TotalBeforeDiscount: number;
	TotalDiscount: number;
	TotalAfterDiscount: number;
	Notes: string;
	IsDeleted: boolean;
	IDOrder: number;
	IDUoM: number;
	IDWarehouse: number;
}

export interface CartState {
	items: CartItem[];
	subtotal: number;
	totalDiscount: number;
	total: number;
	guests: number;
	table: number;
	notes: string;
	customerName: string;
	customerPhone: string;
	customerEmail: string;
}

export interface POSState {
	orders: POS_Order[];
	currentOrder: POS_Order | null;
	cart: CartState;
	isLoading: boolean;
	error: string | null;
	lastSyncTime: Date | null;
	lanConnected: boolean;
}

export interface Discount {
	id: string;
	code: string;
	name: string;
	type: 'percentage' | 'fixed';
	value: number;
	minimumAmount: number;
	maximumDiscount: number;
	isActive: boolean;
	applicableItems?: number[];
	applicableCategories?: number[];
}

export interface Promotion {
	id: string;
	code: string;
	name: string;
	description: string;
	discountType: 'percentage' | 'fixed';
	discountValue: number;
	minimumOrderAmount: number;
	maximumDiscount: number;
	startDate: Date;
	endDate: Date;
	isActive: boolean;
	conditions: {
		applicableDays?: string[];
		applicableHours?: { start: string; end: string };
		usageLimit?: number;
		userGroups?: string[];
	};
}

export interface POSNotification {
	id: string;
	type: string;
	timestamp: Date;
	data: any;
	source: string;
	priority: 'low' | 'medium' | 'high';
	isRead: boolean;
}

export interface NotificationPayload {
	IDBranch: number;
	IDSaleOrder?: number;
	IDTable?: number;
	TableName?: string;
	Amount?: number;
	IDStaff?: number;
	Tables?: Array<{ TableName: string; IDTable: number }>;
}

export interface StoredNotification {
	Id: number | null;
	IDBranch: number;
	IDSaleOrder: number;
	Type: string;
	Name: string;
	Code: string;
	Message: string;
	Url: string;
	Watched?: boolean;
}

export interface LANConnectionStatus {
	isConnected: boolean;
	lastPing: Date | null;
	latency: number;
	nodeCount: number;
	networkQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface CartFormData {
	guests: number;
	table: number;
	notes: string;
	customerName: string;
	customerPhone: string;
	customerEmail: string;
}

export interface BusinessPartner {
	Id: number;
	Code: string;
	Name: string;
	WorkPhone: string | null;
	IsStaff: boolean;
	IDAddress: number;
	Address: Address;
	Status: 'Approved' | 'Pending' | 'Rejected' | string;
}

export interface Address {
	Id: number;
	AddressLine1: string;
	AddressLine2: string | null;
	Ward: string | null;
	District: string | null;
	Province: string | null;
	Country: string | null;
	Contact: string;
	Phone1: string;
	Phone2: string | null;
}

export interface POSConfig {
	IsAutoSave: boolean;
	SODefaultBusinessPartner: BusinessPartner;
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
	POSIsReadTheAmount: boolean;
	POSPrintingFontSize: number;
	POSIsShowMenuInMultiline: boolean;
	POSVirtualKeyboardQuantity: boolean;
	POSAllowDecimalQuantity: boolean;

	// QR Code Payment
	BKIncomingDefaultBankName?: any;
	BKIncomingDefaultBankAccount?: string;
	BKIncomingQRPrefix?: string;
	BKIncomingQRSuffix?: string;
	ZPIsActive: boolean;
	EDCCVCB_IsActive: boolean;
	BillHeaderTitle: string;
	BillHeaderLine1: string;
	BillHeaderLine2: string;
	BillFooterLine1: string;
	BillFooterLine2: string;
	BillLogo: string;
}
