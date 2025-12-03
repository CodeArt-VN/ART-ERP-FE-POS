import { Component, ChangeDetectorRef, Input, OnInit } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { SALE_OrderProvider } from 'src/app/services/static/services.service';
import { FormBuilder } from '@angular/forms';

@Component({
	selector: 'app-combo-modal',
	templateUrl: './combo-modal.page.html',
	styleUrls: ['./combo-modal.page.scss'],
	standalone: false,
})
export class ComboModalPage implements OnInit {
	@Input() item: any;
	basePrice: number = 0;
	selectedItems: any = {}; // { groupId: { itemId: quantity } }
	canEdit: boolean = true;
	constructor(
		public pageProvider: SALE_OrderProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public alertCtrl: AlertController,
		public navParams: NavParams,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController
	) {}

	ngOnInit() {
		// khởi tạo mỗi group
		for (const g of this.item._item?.Groups || []) {
			this.selectedItems[g.Id] = {};
			// set default Quantity cho item = 1 nếu muốn
			g.Items?.forEach((i) => (i.Quantity = i.Quantity || 1));
			this.item?.SubOrders?.forEach((sub) => {
				if (g.Items.some((i) => i.IDUoM === sub.IDUoM && i.IDItem === sub.IDItem) && !this.selectedItems[g.Id][sub.IDUoM]) {
					this.selectedItems[g.Id][sub.IDUoM] = sub.Quantity/this.item.Quantity;
				}
			});
		}
	}

	/** Kiểm tra item đã chọn chưa */
	isSelected(g, i) {
		return !!this.selectedItems[g.Id]?.[i.IDUoM];
	}

	toggleItem(g, i) {
		if (!this.selectedItems[g.Id]) this.selectedItems[g.Id] = {};

		if (g.AllowMultiple) {
			if (this.selectedItems[g.Id][i.IDUoM]) {
				delete this.selectedItems[g.Id][i.IDUoM];
			} else {
				if (g.MaxQuantity && this.getGroupTotalQty(g) >= g.MaxQuantity) return;
				this.selectedItems[g.Id][i.IDUoM] = 1;
			}
		} else {
			this.selectedItems[g.Id] = {};
			this.selectedItems[g.Id][i.IDUoM] = 1;
		}
	}
	incQty(i, g) {
		if (!this.isSelected(g, i)) return;
		this.selectedItems[g.Id][i.IDUoM]+= i.Quantity;
		const total = this.getGroupTotalQty(g);
		if ((g.MaxQuantity && total > g.MaxQuantity) || (i.MaxQuantity && this.selectedItems[g.Id][i.IDUoM] > i.MaxQuantity)){
			this.selectedItems[g.Id][i.IDUoM]-= i.Quantity;
		}
		
	}

	decQty(i, g) {
		if (!this.isSelected(g, i)) return;
		this.selectedItems[g.Id][i.IDUoM]-= i.Quantity;
		if (this.selectedItems[g.Id][i.IDUoM] <= 0) delete this.selectedItems[g.Id][i.IDUoM];
	}

	/** Tổng quantity trong group */
	getGroupTotalQty(g) {
		if (!this.selectedItems[g.Id]) return 0;
		return Object.values(this.selectedItems[g.Id]).reduce((a: number, b: any) => a + b, 0);
	}

	/** Validate group: min/max select, required */
	validateGroup(g): boolean {
		const selected = this.selectedItems[g.Id] || {};
		const itemKeys = Object.keys(selected);
		const totalQty = itemKeys.reduce((s, k) => s + selected[k], 0);

		// CASE 1 — Required: phải chọn ít nhất 1
		if (g.IsRequired && itemKeys.length === 0) return false;

		// CASE 2 — MinSelect: số item được chọn < min
		if (g.MinSelect && itemKeys.length < g.MinSelect) return false;

		// CASE 3 — MaxSelect: chọn nhiều hơn max
		if (g.MaxSelect && itemKeys.length > g.MaxSelect) return false;

		// CASE 4 — MaxQuantity của cả group
		if (g.MaxQuantity && totalQty > g.MaxQuantity) return false;

		// CASE 5 — kiểm tra từng item
		for (const itemId of itemKeys) {
			const qty = selected[itemId];

			const item = g.Items.find((i) => i.IDUoM == itemId);
			if (!item) continue;

			// Item max qty
			if (item.MaxQuantity && qty > item.MaxQuantity) return false;

			// Không cho 0 quantity
			if (qty <= 0) return false;
		}
		return true;
	}
	/** Đóng modal */
	closeModal() {
		this.modalController.dismiss();
	}

	/** Xác nhận selection */
	confirmSelection() {
		this.modalController.dismiss(this.selectedItems);
	}

	/** Disable checkbox nếu vượt max select hoặc max quantity group */
	disableCheckbox(g, i) {
		const groupTotal = this.getGroupTotalQty(g);
		if (g.MaxSelect > 0 && Object.keys(this.selectedItems[g.Id]).length >= g.MaxSelect && !this.isSelected(g, i)) return true;
		return g.MaxQuantity && groupTotal >= g.MaxQuantity && !this.isSelected(g, i);
	}
	getSelectedSingle(g) {
		if (!this.selectedItems[g.Id]) return null;
		const keys = Object.keys(this.selectedItems[g.Id]);
		if (!keys.length) return null;
		return +keys[0]; // ép kiểu sang number
	}
	onCheckboxChangeSingle(g, item, ev) {
		const isChecked = ev.detail.checked;

		// Bỏ hết lựa chọn cũ của group
		if (g.IsRequired && !isChecked) {
			ev.target.checked = true;
			return;
		} // không cho bỏ chọn nếu bắt buộc
		this.selectedItems[g.Id] = {};

		if (isChecked) {
			// Chọn item mới
			if (!g.AllowMultiple && item.MaxQuantity) this.selectedItems[g.Id][item.IDUoM] = item.Quantity;
			else this.selectedItems[g.Id][item.IDUoM] = 1; // hoặc default quantity
		} else delete this.selectedItems[g.Id];
		// Force UI update nếu cần
		this.selectedItems = { ...this.selectedItems };
	}
	isAllGroupsValid(): boolean {
		if (!this.item._item?.Groups) return true;

		for (const g of this.item._item.Groups) {
			if (!this.validateGroup(g)) return false;
		}
		return true;
	}

	get totalExtra() {
		let total = 0;

		for (const gId in this.selectedItems) {
			const group = this.selectedItems[gId];

			for (const uomId in group) {
				const qty = group[uomId];

				const groupObj = this.item._item.Groups.find((x) => x.Id == gId);
				if (!groupObj) continue;

				const itemObj = groupObj.Items.find((x) => x.IDUoM == uomId);
				if (!itemObj) continue;

				// Extra cho 1 item * qty
				total += (itemObj.ExtraPrice || 0) * qty;
			}
		}
		return total;
	}
	get finalTotal() {
		return this.item.UoMPrice + this.totalExtra;
	}
}
