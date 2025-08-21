import { POS_Kitchen, POS_Menu, POS_Table, POS_TableGroup, SALE_Order, SALE_OrderDetail, SYS_Printer, SYS_Status, SYS_Type } from "../../models/model-list-interface";

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
	Items?: any;
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
	
	
}

