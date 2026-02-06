import { Component, ElementRef, Input, ViewChild } from '@angular/core';

@Component({
	selector: 'app-bill-template',
	templateUrl: './bill-template.component.html',
	styleUrls: ['./bill-template.component.scss'],
	standalone: false,
})
export class BillTemplateComponent {
	@Input() item: any;
	@Input() printData: any;
	@Input() pageConfig: any;
	@Input() billId: any;
	@Input() kitchenQuery: any = 'all';
	@Input() cashierName = '';
	@Input() kitchens: any[] = [];
	@Input() paymentList: any[] = [];
	@Input() vietQrCode: string;
	@Input() isCompleteLoaded = false;
	@Input() promotionAppliedPrograms: any[] = [];

	@ViewChild('bill', { static: false }) billRef: ElementRef;

	groupedOrderLines = [];
	private _lastGroupedKey: string = null;

	get billElement(): ElementRef {
		return this.billRef;
	}

	getBillNativeElement(): HTMLElement | null {
		return this.billRef?.nativeElement || null;
	}

	getBillHtml(): string {
		return this.billRef?.nativeElement?.outerHTML || '';
	}

	static buildPreviewCss(fontSize: number): string {
		const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 12;
		return `
			html,body{margin:0;padding:0}
			*,*::before,*::after{box-sizing:border-box}
			body{font-size:${safeFontSize}px; padding:10px;background-color:#ffff}
			.bold{font-weight:bold}
			.bill,.sheet{color:#000;font-size:1em;max-width:100%}
			.bill{display:block;overflow:hidden !important}
			.bill .sheet{box-shadow:none !important;margin:0;overflow:hidden;position:relative;box-sizing:border-box;page-break-after:always;font-family:"Times New Roman", Times, serif;font-size:0.72em;background:#fff}
			.bill .sheet .page-footer,.bill .sheet .page-footer-space{height:10mm}
			.bill .sheet table{page-break-inside:auto;width:100%;border-collapse:collapse;font-size:1em;table-layout:fixed}
			.bill .sheet table tr{page-break-inside:avoid;page-break-after:auto}
			.bill td,.bill th{overflow-wrap:anywhere;word-break:break-word}
			.bill .header,.bill .message,.bill .text-center{text-align:center}
			.bill .header span{display:inline-block;width:100%}
			.bill .header .logo img{max-width:8.33em;max-height:4.17em}
			.bill .header .brand,.bill .items .quantity{font-weight:700}
			.bill .header .address{font-size:80%;font-style:italic}
			.bill .table-info,.bill .table-info-top{border-top:solid;margin:5px 0;padding:5px 8px;border-width:1px 0}
			.bill .items{margin:5px 0;padding-left:8px;padding-right:8px}
			.bill .items tr td{border-bottom:1px dashed #ccc;padding-bottom:5px}
			.bill .items .name{font-size:1em;width:100%;padding-top:5px;padding-bottom:2px !important;border:none !important}
			.bill .items tr.subOrder td{border-bottom:none !important}
			.bill .items tr.subOrder.isLast td{border-bottom:1px dashed #ccc !important;padding-bottom:5px}
			.bill .items tr:last-child td{border:none !important}
			.bill .items tr.subOrder.isLast:last-child td{border:none !important}
			.bill .items .total,.bill .text-right{text-align:right}
			.bill .message{padding-left:8px;padding-right:8px}
			.page-footer-space{margin-top:10px}
			.bill .table-info-top td{padding-top:5px}
			.bill .items{--col-name:18%;--col-price:20%;--col-qty:12%;--col-discount:20%;--col-total:30%}
			.bill .items.items-kitchen{--col-name:70%;--col-price:30%}
			.bill .items table tr{display:flex;flex-wrap:wrap;width:100%}
			.bill .items table tr>td{flex:0 1 auto}
			.bill .items table tr>td:first-child{min-width:var(--col-name)}
			.bill .items table tr>td:nth-child(2){min-width:var(--col-price)}
			.bill .items table tr>td:nth-child(3){min-width:var(--col-qty)}
			.bill .items table tr>td:nth-child(4){min-width:var(--col-discount)}
			.bill .items table tr>td:nth-child(5){min-width:var(--col-total);flex:1 1 auto}
			.bill .items.items-kitchen table tr>td:nth-child(2){flex:1 1 auto}
			.bill .items td.name[colspan]{min-width:100%;max-width:100%}
			.bill .items table tr.small>td:nth-child(n+2){white-space:nowrap;word-break:normal;overflow-wrap:normal}
			.bill .items .total span,.bill .items .od-price span,.bill .items .quantity span{white-space:nowrap;word-break:normal;overflow-wrap:normal}
			.bill .text-right span{white-space:nowrap;word-break:normal;overflow-wrap:normal}
			.bill .invoice-container{font-family:Arial, Helvetica, sans-serif;font-size:12px}
			.bill .invoice-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
			.bill .header-left{flex:1 1 auto}
			.bill .header-right{flex:0 0 140px;text-align:right}
			.bill .store-name{font-size:18px;font-weight:700}
			.bill .store-address,.bill .store-phone{font-size:12px}
			.bill .invoice-title{font-size:36px;font-weight:800;line-height:1.1;margin:6px 0}
			.bill .invoice-meta{margin:4px 0 6px 0;font-size:13px}
			.bill .meta-label{font-weight:700;margin-right:6px}
			.bill .meta-sep{margin:0 6px}
			.bill .invoice-for{margin-top:6px;font-size:12px}
			.bill .customer-name{font-size:16px;font-weight:700;margin-top:2px}
			.bill .customer-company{font-size:12px}
			.bill .qr-box{background:#d9d9d9;padding:8px;text-align:center}
			.bill .qr-text{font-size:11px;line-height:1.2;margin-bottom:6px}
			.bill .qr-image img{max-width:100px;max-height:100px}
			.bill .qr-placeholder{height:100px;display:flex;align-items:center;justify-content:center;font-weight:700}
			.bill .invoice-code{margin-top:6px;font-weight:700}
			.bill .invoice-bill{margin-top:2px}
			.bill .divider{border-top:1px solid #999;margin:8px 0}
			.bill .items-table,.bill .discount-table,.bill .summary-table{width:100%;border-collapse:collapse}
			.bill .items-table{table-layout:fixed}
			.bill .items-table th{font-weight:700;text-align:left;padding:6px 2px;border-bottom:1px solid #999;word-break:break-word}
			.bill .items-table td{padding:4px 2px;vertical-align:top}
			.bill .items-table tbody tr+tr td{border-top:1px solid #eee}
			.bill .items-table .item-row-name td{border-top:none}
			.bill .items-table .item-row-values td{border-top:none;padding-top:0}
			.bill .items-table .item-row-name td{padding-bottom:2px}
			.bill .items-table .col-name{width:42%}
			.bill .items-table .col-empty{width:42%}
			.bill .items-table .col-qty{width:16%;text-align:right;white-space:nowrap}
			.bill .items-table .col-price{width:21%;text-align:right;white-space:nowrap}
			.bill .items-table .col-total{width:21%;text-align:right;white-space:nowrap}
			.bill .item-name{display:flex;gap:6px}
			.bill .item-index{min-width:18px}
			.bill .item-sub{font-size:11px;color:#444;margin-left:18px}
			.bill .section-title{font-weight:700;margin:4px 0}
			.bill .discount-table td{padding:4px}
			.bill .discount-table tr+tr td{border-top:1px solid #eee}
			.bill .discount-table .col-amount{text-align:right;width:30%}
			.bill .payments-table{width:100%;border-collapse:collapse}
			.bill .payments-table td{padding:4px}
			.bill .payments-table tr+tr td{border-top:1px solid #eee}
			.bill .payment-qr{text-align:center}
			.bill .payment-qr-title{font-weight:700;margin-top:4px}
			.bill .payment-qr-sub{font-size:11px;margin-bottom:6px}
			.bill .payment-qr-box{height:140px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center}
			.bill .payment-qr-placeholder{font-weight:700}
			.bill .summary-table td{padding:2px 4px}
			.bill .summary-table .label{text-align:left;color:#333;padding-right:12px}
			.bill .summary-table .value{text-align:right;font-weight:700}
			.bill .summary-table .summary-total .value{font-size:14px}
			.bill .summary-table .summary-grand .value{font-size:15px}
			.bill .footer-notes{text-align:center;font-size:11px;line-height:1.4}
			.bill .ad-section{display:flex;border:1px solid #ccc;margin-top:10px}
			.bill .ad-left{flex:1 1 auto;min-height:60px;display:flex;align-items:center;justify-content:center}
			.bill .ad-right{flex:0 0 120px;background:#d9d9d9;display:flex;align-items:center;justify-content:center}
			.bill .ad-grid{display:flex;border:1px solid #ccc;margin-top:10px}
			.bill .ad-grid-left{flex:0 0 100px;background:#d9d9d9;display:flex;align-items:center;justify-content:center}
			.bill .ad-grid-center{flex:1 1 auto;padding:8px;text-align:left}
			.bill .ad-grid-title{font-weight:700}
			.bill .ad-grid-body{margin-top:4px;font-size:11px}
			.bill .ad-grid-right{flex:0 0 100px;background:#d9d9d9;display:flex;align-items:center;justify-content:center}
		`;
	}

	getPreviewCss(fontSize: number): string {
		return BillTemplateComponent.buildPreviewCss(fontSize);
	}

	// Group and sum identical OrderLines (same IDItem + IDUoM) to make bill printing more concise
	// Only applies to TemporaryBill and Done to avoid affecting other printing purposes
	getGroupedOrderLinesForPrint() {
		if (!this.isCompleteLoaded) return;
		if (!this.item?.OrderLines?.length) return [];

		// For non-bill printing keep original list
		if (this.item.Status !== 'TemporaryBill' && this.item.Status !== 'Done') {
			return this.item.OrderLines;
		}

		// Build a lightweight key to detect meaningful changes (status + line code/qty/price)
		const key =
			this.item.Status + '|' + (this.item.OrderLines || []).map((l) => `${l.Code || l.Id || l.IDItem}_${l.Quantity || 0}_${Math.round((l.UoMPrice || 0) * 100)}`).join('|');

		if (this._lastGroupedKey === key && this.groupedOrderLines && this.groupedOrderLines.length) {
			return this.groupedOrderLines;
		}

		this._lastGroupedKey = key;
		const groupedMap = new Map<string, any>();

		for (const line of this.item.OrderLines) {
			let mapKey = `${line.IDItem}_${line.IDUoM}`;
			if (groupedMap.has(mapKey) && line.SubItems?.length > 0) {
				mapKey += `_${line.SubItems.map((s) => `${s.IDItem}_${s.IDUoM}`).join('_')}`;
				groupedMap.set(mapKey, { ...line, SubItems: line.SubItems ? [...line.SubItems] : [] });
			} else if (groupedMap.has(mapKey)) {
				const existing = groupedMap.get(mapKey);
				existing.Quantity += line.Quantity || 0;
				existing.OriginalTotalDiscount += line.OriginalTotalDiscount || 0;
				existing.OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount || 0;
				existing.OriginalTotalAfterDiscount += line.OriginalTotalAfterDiscount || 0;
				existing.OriginalTax += line.OriginalTax || 0;

				if (existing.Quantity > 0) {
					existing.UoMPrice = existing.OriginalTotalBeforeDiscount / existing.Quantity;
				}
			} else {
				groupedMap.set(mapKey, { ...line, SubItems: line.SubItems ? [...line.SubItems] : [] });
			}
		}

		this.groupedOrderLines = Array.from(groupedMap.values());
		return this.groupedOrderLines;
	}
}





