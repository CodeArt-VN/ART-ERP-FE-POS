import { POS_Kitchen, POS_Menu, POS_MenuDetail, POS_Table, POS_TableGroup, SALE_Order, SALE_OrderDetail, SYS_Printer, SYS_Status, SYS_Type } from "../../models/model-list-interface";

export interface POS_DataSource {
	paymentStatusList: SYS_Status[];
	orderStatusList: SYS_Status[];
	orderDetailStatusList: SYS_Status[];

	paymentTypeList: SYS_Type[];

	orders: POS_Order[];
	tableGroups: TableGroup[];
	kitchens: Kitchen[];

	tableList : POS_Table[];
	menuList: Menu[];
	dealList: any[];

	
}

export interface Menu extends POS_Menu
{
	Items?: MenuDetail[]; // Danh sách items trong menu
}

export interface MenuDetail extends POS_MenuDetail
{
	ForeignName?: string;
	SalesUoM?: number;
	Price: number;

	IDSalesTaxDefinition?: number;
	SalesTaxPercent?: number;

	UoMs?: any[]; // Danh sách UoM của item không cần tạo interface
	BookedQuantity?: number
}

export interface TableGroup extends POS_TableGroup
{
	tables: POS_Table[];
}

export interface Kitchen extends POS_Kitchen
{
	_Printer: SYS_Printer;
}

export interface POS_Order extends SALE_Order
{	
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

export interface POS_OrderDetail extends SALE_OrderDetail
{
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

