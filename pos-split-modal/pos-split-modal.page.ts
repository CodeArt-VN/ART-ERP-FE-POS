import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { NavController, ModalController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import {
  CRM_ContactProvider,
  POS_TableGroupProvider,
  POS_TableProvider,
  SALE_OrderDetailProvider,
  SALE_OrderProvider,
  WMS_ItemProvider,
} from 'src/app/services/static/services.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { NgSelectConfig } from '@ng-select/ng-select';
import { concat, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-pos-split-modal',
  templateUrl: './pos-split-modal.page.html',
  styleUrls: ['./pos-split-modal.page.scss'],
})
export class POSSplitModalPage extends PageBase {
  @Input() selectedOrder;
  @Input() orders;
  initContactsIds = [];
  initOrderedTables = [];
  initOrderedContacts = [];
  tables = [];
  currentTable;

  constructor(
    public pageProvider: SALE_OrderProvider,
    public orderDetailProvider: SALE_OrderDetailProvider,
    public contactProvider: CRM_ContactProvider,
    public itemProvider: WMS_ItemProvider,

    public tableGroupProvider: POS_TableGroupProvider,
    public tableProvider: POS_TableProvider,

    public env: EnvService,
    public navCtrl: NavController,
    public route: ActivatedRoute,

    public modalController: ModalController,
    public alertCtrl: AlertController,
    public navParams: NavParams,
    public formBuilder: FormBuilder,
    public cdr: ChangeDetectorRef,
    public loadingController: LoadingController,
    private config: NgSelectConfig,
  ) {
    super();
    this.pageConfig.isDetailPage = false;
    this.pageConfig.pageName = 'SplitSaleOrder';
    this.config.notFoundText = 'Không tìm thấy dữ liệu phù hợp...';
    this.config.clearAllText = 'Xóa hết';
  }

  loadData(event) {
    this.tableProvider.read({ IsDeleted: false }).then((result: any) => {
      this.tables = result.data;
      let currentTableIndex = this.tables.findIndex((d) => d.Id == this.selectedOrder.Tables[0]);
      //this.tables.splice(currentTableIndex, 1);
    });

    if (!this.selectedOrder) {
      this.selectedOrder = this.orders[0];
      this.orders.forEach((o) => {
        if (o.Status.Status == 'New' || o.Status.Status == 'Picking' || o.Status.Status == 'Delivered') {
          if (this.initOrderedContacts.findIndex((f) => f.Id == o.IDContact) == -1) {
            this.initOrderedContacts.push({
              Id: o.IDContact,
              IDAdress: o.IDAddress,
              Name: o.CustomerName,
              WorkPhone: o.WorkPhone,
              AddressLine1: o.AddressLine1,
            });
          }

          this.initOrderedTables.push({
            Id: o.Tables[0],
            Name: o.TableName,
          });

          let currentTableIndex = this.tables.findIndex((d) => d.Id == o.Tables[0]);
          if (currentTableIndex != -1) {
            this.tables.splice(currentTableIndex, 1);
          }
        }
      });
    }

    this.tableProvider.getAnItem(this.selectedOrder.Tables[0]).then((value) => {
      this.currentTable = value;

      this.item = { Id: this.selectedOrder.Id, SplitedOrders: [] };
      this.item.SplitedOrders.push({
        isFirst: true,
        IDContact: this.selectedOrder.IDContact,
        IDAddress: this.selectedOrder.IDAddress,
        ContactName: this.selectedOrder._Customer.Name,
        IDTable: this.selectedOrder.Tables[0],
        IDType: 293,
        TableName: this.selectedOrder._Tables[0].Name,
        Type: this.selectedOrder.Type,
        SubType: this.selectedOrder.SubType,
        Status: this.selectedOrder.Status,
      });
      this.item.SplitedOrders.push({
        isFirst: false,
        IDContact: null,
        IDAddress: null,
        ContactName: null,
        IDTable: null,
        IDType: 293,
        TableName: null,
        Type: this.selectedOrder.Type,
        SubType: this.selectedOrder.SubType,
        Status: this.selectedOrder.Status,
      });

      this.initOrderedContacts.push({
        Id: this.selectedOrder.IDContact,
        IDAddress: this.selectedOrder.IDAddress,
        Name: this.selectedOrder._Customer.Name,
        WorkPhone: this.selectedOrder._Customer.WorkPhone,
        AddressLine1: this.selectedOrder._Customer.Address.AddressLine1,
      });

      this.contactListSelected.push({
        Id: this.selectedOrder.IDContact,
        IDAddress: this.selectedOrder.IDAddress,
        Name: this.selectedOrder._Customer.Name,
        WorkPhone: this.selectedOrder._Customer.WorkPhone,
        AddressLine1: this.selectedOrder._Customer.Address.AddressLine1,
      });

      if (this.initOrderedTables.findIndex((f) => f.Id == this.currentTable.Id) == -1) {
        this.initOrderedTables.push({
          Id: this.selectedOrder.Tables[0],
          Name: this.selectedOrder._Tables[0].Name,
        });
      }

      this.orderDetailProvider.read({ IDOrder: this.selectedOrder.Id }).then((result: any) => {
        this.items = result.data;
        this.item.SplitedOrders[0].OrderLines = JSON.parse(JSON.stringify(this.items));
        this.item.SplitedOrders[1].OrderLines = JSON.parse(JSON.stringify(this.items));

        this.calcOrders();

        this.loadedData(event);

        let ids = this.items.map((i) => i.IDItem);

        if (ids.length) {
          this.itemProvider
            .search({
              IgnoredBranch: true,
              Id: JSON.stringify(ids),
            })
            .toPromise()
            .then((result: any) => {
              result.forEach((i) => {
                if (this.itemListSelected.findIndex((d) => d.Id == i.Id) == -1) {
                  this.itemListSelected.push(i);
                }
                let lines = this.items.filter((d) => d.IDItem == i.Id);
                lines.forEach((line) => {
                  line._itemData = i;
                });
              });
            })
            .finally(() => {
              this.itemSearch();
            });
        } else {
          this.itemSearch();
        }
      });
    });
  }

  loadedData(event) {
    this.contactSearch();
    this.tableSearch();
    super.loadedData(event);
    console.log(this.selectedOrder);
  }
  generateUniqueNames(orders) {
    var counts = {};
    var result = [];
    for (var i = 0; i < orders.length; i++) {
      var order = orders[i];
      if (order.TableName in counts) {
        counts[order.TableName]++;
        result.push(order.TableName + '-' + counts[order.TableName]);
      } else {
        counts[order.TableName] = 1;
        result.push(order.TableName);
      }
    }
    for (var j = 0; j < result.length; j++) {
      if (result[j] in counts && counts[result[j]] > 1) {
        var count = counts[result[j]];
        var baseName = result[j].replace(/-\d+$/, '');
        for (var k = 1; k <= count; k++) {
          var newName = baseName + '-' + k;
          if (result.indexOf(newName) === -1) {
            result[j] = newName;
            counts[newName] = counts[result[j]];
            delete counts[result[j]];
            break;
          }
        }
      }
    }
    return result;
  }

  contactList$;
  contactListLoading = false;
  contactListInput$ = new Subject<string>();
  contactListSelected = [];
  contactSelected = null;
  contactSearch() {
    this.contactListLoading = false;
    this.contactList$ = concat(
      of(this.contactListSelected),
      this.contactListInput$.pipe(
        distinctUntilChanged(),
        tap(() => (this.contactListLoading = true)),
        switchMap((term) =>
          this.contactProvider
            .search({
              Take: 20,
              Skip: 0,
              SkipMCP: true,
              Term: term ? term : 'BP:' + this.item.IDContact,
            })
            .pipe(
              catchError(() => of([])), // empty list on error
              tap(() => (this.contactListLoading = false)),
            ),
        ),
      ),
    );
  }

  tableList$;
  tableListLoading = false;
  tableListInput$ = new Subject<string>();
  tableListSelected = [];
  tableSelected = null;
  tableSearch() {
    this.tableListLoading = false;
    this.tableList$ = concat(
      //of(this.tableListSelected),
      this.tableListInput$.pipe(
        distinctUntilChanged(),
        tap(() => (this.tableListLoading = true)),
        switchMap((term) =>
          this.tableProvider
            .search({
              Take: 20,
              Skip: 0,
              Name: term ? term : this.currentTable.Id,
            })
            .pipe(
              catchError(() => of([])), // empty list on error
              tap(() => (this.tableListLoading = false)),
            ),
        ),
      ),
    );
  }

  itemList$;
  itemListLoading = false;
  itemListInput$ = new Subject<string>();
  itemListSelected = [];

  itemSearch() {
    this.itemListLoading = false;
    this.itemList$ = concat(
      of(this.itemListSelected),
      this.itemListInput$.pipe(
        distinctUntilChanged(),
        tap(() => (this.itemListLoading = true)),
        switchMap((term) =>
          this.itemProvider.search({ Take: 20, Skip: 0, Term: term }).pipe(
            catchError(() => of([])), // empty list on error
            tap(() => (this.itemListLoading = false)),
          ),
        ),
      ),
    );
  }

  splitOrder() {
    return new Promise((resolve, reject) => {
      if (!this.item.Ids.length || !this.item.IDContact) {
        this.env.showTranslateMessage('Please check the invoice to combine and select customer', 'warning');
      } else if (this.submitAttempt == false) {
        this.submitAttempt = true;
        if (!this.item.IDBranch) {
          this.item.IDBranch = this.env.selectedBranch;
        }

        this.pageProvider.commonService
          .connect('POST', 'SALE/Order/MergeOrders/', this.item)
          .toPromise()
          .then((savedItem: any) => {
            this.env.showTranslateMessage('Saving completed!', 'warning');
            resolve(savedItem.Id);
            this.submitAttempt = false;
            this.closeModalView();
          })
          .catch((err) => {
            this.env.showTranslateMessage('Cannot save, please try again!', 'danger');
            this.cdr.detectChanges();
            this.submitAttempt = false;
            reject(err);
          });
      }
    });
  }

  changedIDContact(i, o) {
    if (i) {
      this.contactSelected = i;
      if (this.contactListSelected.findIndex((d) => d.Id == i.Id) == -1) {
        this.contactListSelected.push(i);
        this.contactSearch();
      }
      o.ContactName = i.Name;
      o.IDAddress = i.IDAddress;
    }
    this.checkValid();
  }

  changedIDTable(i, o) {
    if (i) {
      this.tableSelected = i;
      if (this.tableListSelected.findIndex((d) => d.Id == i.Id) == -1) {
        this.tableListSelected.push(i);
        this.tableSearch();
      }
      o.TableName = i.Name;
    }
    this.checkValid();
  }
  checkTableStatus(o) {}

  segmentView = 's1';
  segmentChanged(ev: any) {
    this.segmentView = ev.detail.value;
  }

  addSplitedOrder() {
    this.item.SplitedOrders.push({
      isFirst: false,
      IDContact: null,
      IDAddress: null,
      ContactName: null,
      IDTable: null,
      IDType: 293,
      TableName: null,
      Type: this.selectedOrder.Type,
      SubType: this.selectedOrder.SubType,
      Status: this.selectedOrder.Status,
      OrderLines: JSON.parse(JSON.stringify(this.items)),
    });
    this.calcOrders();
    this.checkValid();
  }

  removeSplitedOrder(o) {
    const index = this.item.SplitedOrders.indexOf(o);
    if (index > -1) {
      this.item.SplitedOrders.splice(index, 1);
    }
    this.calcOrders();
    this.checkValid();
  }

  calcOrders() {
    this.items.forEach((i) => {
      i.splitDetail = [];
      for (let j = 0; j < this.item.SplitedOrders.length; j++) {
        const o = this.item.SplitedOrders[j];
        i.splitDetail.push(o.OrderLines.find((d) => d.Id == i.Id));
      }
    });

    this.items.forEach((i) => {
      let order = i.splitDetail[0];
      let props = [
        'Quantity',
        'ShippedQuantity',
        'OriginalDiscount1',
        'OriginalDiscount2',
        'OriginalDiscountFromSalesman',
      ];
      props.forEach((prop) => {
        this.checkOriginal(i, order, prop);
      });
    });
  }

  changedCalc(originalRow, editingRow, prop) {
    let maxValue = originalRow[prop];
    let cValue = editingRow[prop];
    if (cValue > maxValue) {
      editingRow[prop] = maxValue;
      cValue = maxValue;
    }
    if (editingRow['Quantity'] == originalRow['Quantity']) {
      let props = [
        'Quantity',
        'ShippedQuantity',
        'OriginalDiscount1',
        'OriginalDiscount2',
        'OriginalDiscountFromSalesman',
      ];
      props.forEach((prop) => {
        editingRow[prop] = originalRow[prop];
      });
    }

    this.calcOrderLine(editingRow);

    this.items.forEach((i) => {
      let order = i.splitDetail[0];
      let props = [
        'Quantity',
        'ShippedQuantity',
        'OriginalDiscount1',
        'OriginalDiscount2',
        'OriginalDiscountFromSalesman',
      ];
      props.forEach((prop) => {
        this.checkOriginal(i, order, prop);
      });
    });
    this.checkValid();
  }

  checkOriginal(originalRow, editingRow, prop) {
    let maxValue = originalRow[prop];
    let cValue = editingRow[prop];
    if (cValue > maxValue) {
      editingRow[prop] = maxValue;
      cValue = maxValue;
    }

    this.calcOrderLine(editingRow);

    let remain = maxValue - cValue;

    let ortherOrder = originalRow.splitDetail.filter((d) => d != editingRow);

    for (let i = 0; i < ortherOrder.length; i++) {
      const orderLine = ortherOrder[i];

      if (i == ortherOrder.length - 1) {
        orderLine[prop] = remain;
      }

      if (remain - orderLine[prop] <= 0) {
        orderLine[prop] = remain;
      }

      remain = remain - orderLine[prop];
      this.calcOrderLine(orderLine);
    }
  }

  isCanSplit = false;
  checkValid() {
    this.isCanSplit = true;

    for (let i = 0; i < this.item.SplitedOrders.length; i++) {
      const o = this.item.SplitedOrders[i];
      if (!o.IDContact) {
        this.isCanSplit = false;
        break;
      }

      if (!o.IDTable) {
        this.isCanSplit = false;
        break;
      }

      let totalQty = 0;
      for (let j = 0; j < o.OrderLines.length; j++) {
        const l = o.OrderLines[j];
        totalQty += l.Quantity;
      }
      if (totalQty == 0) {
        this.isCanSplit = false;
        break;
      }
    }

    this.isCanSplit;
  }

  calcOrderLine(line) {
    line.UoMPrice = line.IsPromotionItem ? 0 : parseInt(line.UoMPrice) || 0;
    line.BuyPrice = parseInt(line.BuyPrice) || 0;

    if (line.ShippedQuantity != 0) {
      line.Quantity = line.ShippedQuantity = parseInt(line.Quantity) || 0;
    } else {
      line.Quantity = parseInt(line.Quantity) || 0;
    }
    line.OriginalDiscount1 = line.IsPromotionItem ? 0 : parseInt(line.OriginalDiscount1) || 0;
    line.OriginalDiscount2 = line.IsPromotionItem ? 0 : parseInt(line.OriginalDiscount2) || 0;
    line.OriginalDiscountFromSalesman = line.IsPromotionItem ? 0 : parseInt(line.OriginalDiscountFromSalesman) || 0;

    // if (!line.IsPromotionItem && line.OriginalDiscount1 > 0 && line.OriginalDiscount1 < 1000) {
    //     line.OriginalDiscount1 = line.OriginalDiscount1 * 1000;
    // }
    // if (!line.IsPromotionItem && line.OriginalDiscount2 > 0 && line.OriginalDiscount2 < 1000) {
    //     line.OriginalDiscount2 = line.OriginalDiscount2 * 1000;
    // }
    // if (!line.IsPromotionItem && line.OriginalDiscountFromSalesman > 0 && line.OriginalDiscountFromSalesman < 1000) {
    //     line.OriginalDiscountFromSalesman = line.OriginalDiscountFromSalesman * 1000;
    // }

    if (!line.IsPromotionItem && line.OriginalDiscount2 > (line.UoMPrice - line.BuyPrice) * line.Quantity) {
      line.OriginalDiscount2 = (line.UoMPrice - line.BuyPrice) * line.Quantity;
    }

    line.OriginalTotalBeforeDiscount = line.UoMPrice * line.Quantity;
    line.OriginalDiscountByItem = line.OriginalDiscount1 + line.OriginalDiscount2;

    if (line.OriginalDiscountByItem > line.OriginalTotalBeforeDiscount) {
      line.OriginalDiscount1 = 0;
      line.OriginalDiscount2 = 0;
      line.OriginalDiscountByItem = 0;
    }

    line.OriginalDiscountByGroup = 0;
    line.OriginalDiscountByLine = line.OriginalDiscountByItem + line.OriginalDiscountByGroup;
    line.OriginalDiscountByOrder = 0;
    line.OriginalTotalDiscount = line.OriginalDiscountByLine + line.OriginalDiscountByOrder;

    line.OriginalTotalAfterDiscount = line.OriginalTotalBeforeDiscount - line.OriginalTotalDiscount;
    line.OriginalTax = line.OriginalTotalAfterDiscount * (line.TaxRate / 100.0);
    line.OriginalTotalAfterTax = line.OriginalTotalAfterDiscount + line.OriginalTax;

    if (line.OriginalDiscountFromSalesman > line.OriginalTotalAfterTax) {
      line.OriginalDiscountFromSalesman = line.OriginalTotalAfterTax;
    }

    line.ProductWeight = line._ProductWeight * line.Quantity || 0;
    line.ProductDimensions = line._ProductDimensions * line.Quantity || 0;
  }

  splitSaleOrder() {
    let publishEventCode = this.pageConfig.pageName;

    return new Promise((resolve, reject) => {
      if (!this.isCanSplit) {
        this.env.showTranslateMessage('Please check customer name and order must have at least 01 item.', 'warning');
      } else if (this.submitAttempt == false) {
        this.submitAttempt = true;

        if (!this.item.IDBranch) {
          this.item.IDBranch = this.env.selectedBranch;
        }

        this.pageProvider.commonService
          .connect('POST', 'SALE/Order/SplitPosOrder/', this.item)
          .toPromise()
          .then((savedItem: any) => {
            if (publishEventCode) {
              this.env.publishEvent({ Code: publishEventCode });
            }
            this.env.showTranslateMessage('Saving completed!', 'success');
            resolve(true);
            this.submitAttempt = false;

            this.closeModalView();
          })
          .catch((err) => {
            this.env.showTranslateMessage('Cannot save, please try again!', 'danger');
            this.cdr?.detectChanges();
            this.submitAttempt = false;
            reject(err);
          });
      }
    });
  }

  closeModalView() {
    this.modalController.dismiss();
  }
}
