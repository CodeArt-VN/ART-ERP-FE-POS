import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, LoadingController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl, FormArray, FormGroup } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { lib } from 'src/app/services/static/global-functions';
import { TranslateService } from '@ngx-translate/core';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';
import { POS_ForCustomerProvider } from 'src/app/services/custom.service';
import { POSCustomerMemoModalPage } from '../memo/pos-memo-modal.page';
import { POSForCustomerPaymentModalPage } from '../payment/pos-payment-modal.page';

@Component({
    selector: 'app-pos-customer-order',
    templateUrl: './pos-customer-order.page.html',
    styleUrls: ['./pos-customer-order.page.scss'],
})
export class POSCustomerOrderPage extends PageBase {
    ImagesServer = environment.posImagesServer;
    AllSegmentImage = environment.posImagesServer + 'Uploads/POS/Menu/Icons/All.png'; //All category image;
    segmentView = 'all';
    AllowSendOrder = false;
    idTable: any; //Default table
    Table:any;
    menuList = [];
    IDBranch = null;
    dealList = [];
    statusList; //Show on bill
    noLockStatusList = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered'];
    printData = {
        undeliveredItems: [], //To track undelivered items to the kitchen
        printDate: null,
        currentBranch: null,
        selectedTables: [],
    }
    constructor(
        public pageProvider: POS_ForCustomerProvider,
        public env: EnvService,
        public navCtrl: NavController,
        public route: ActivatedRoute,
        public modalController: ModalController,
        public popoverCtrl: PopoverController,
        public alertCtrl: AlertController,
        public formBuilder: FormBuilder,
        public cdr: ChangeDetectorRef,
        public loadingController: LoadingController,
        public commonService: CommonService,
        public translate: TranslateService
    ) {
        super();
        this.pageConfig.isDetailPage = true;
        this.pageConfig.isShowFeature = false;
        this.pageConfig.canEdit = true;
        this.idTable = this.route.snapshot?.paramMap?.get('table');
        this.idTable = typeof (this.idTable) == 'string' ? parseInt(this.idTable) : this.idTable;
        this.formGroup = formBuilder.group({
            Id: new FormControl({ value: 0, disabled: true }),
            Code: [],
            Name: [],
            Remark: [],
            OrderLines: this.formBuilder.array([]),
            DeletedLines: [[]],
            Additions: this.formBuilder.array([]),
            Deductions: this.formBuilder.array([]),
            Tables: [[this.idTable]],
            IDBranch: [''],         
            IDOwner: [-1],
            IDContact: [-1],
            IDAddress: [-1],
            IDType: [293],
            IDStatus: [101],           
            Type: ['POSOrder'],
            SubType: ['TableService'],
            Status: new FormControl({ value: 'New', disabled: true }),          
            IDTable: [this.idTable],
            IsCOD: [],
            IsInvoiceRequired: [],
            NumberOfGuests : [1],
            InvoicDate: new FormControl({ value: null, disabled: true }),
            InvoiceNumber: new FormControl({ value: null, disabled: true }),

            IsDebt: new FormControl({ value: null, disabled: true }),
            Debt: new FormControl({ value: null, disabled: true }),
            IsPaymentReceived: new FormControl({ value: null, disabled: true }),
            Received: new FormControl({ value: null, disabled: true }),
            ReceivedDiscountFromSalesman: new FormControl({ value: null, disabled: true }),
        })
        Object.assign(this.query, {IDTable: this.idTable});
    }
    ngOnInit() {
        this.pageConfig.subscribePOSOrderPaymentUpdate = this.env.getEvents().subscribe((data) => {            
			switch (data.Code) {
				case 'app:POSOrderPaymentUpdate':
					this.refresh();
					break;
            }
        });
        this.pageConfig.subscribePOSOrderCustomer = this.env.getEvents().subscribe((data) => {         
			switch (data.Code) {
				case 'app:POSOrderFromStaff':
					this.notify(data.Data);
					break;
            }
        });
        super.ngOnInit();
    }
    private notify(data){
        if(this.item.Id == data.id){
            this.refresh();
        }
    }
    ngOnDestroy() {
        this.pageConfig?.subscribePOSOrderPaymentUpdate?.unsubscribe(); 
        this.pageConfig?.subscribePOSOrderCustomer?.unsubscribe(); 
        super.ngOnDestroy();
    }
    segmentChanged(ev: any) {
        this.segmentView = ev;
    }
    preLoadData(event?: any): void {
        let forceReload = event === 'force';
        this.AllowSendOrder = false;      
        Promise.all([         
            this.env.getStatus('POSOrder'),           
            this.getMenu(),  
            this.getTable(),
            this.getDeal(),
        ]).then((values: any) => { 
            this.statusList = values[0];    
            this.menuList = values[1]; 
            this.Table = values[2];    
            this.dealList = values[3];        
            super.preLoadData(event);
        }).catch(err => {           
            this.loadedData(event);
        })
    }
    jumpToItem(line) {
        let element = document.getElementById('item' + line.IDItem);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add('blink');
            setTimeout(() => {
                element.classList.remove('blink');
            }, 2000);
        }
    }
    loadedData(event?: any, ignoredFromGroup?: boolean): void {
        
        super.loadedData(event, ignoredFromGroup);      
        if (!this.item?.Id) {
            this.formGroup.controls.IDBranch.patchValue(this.Table.IDBranch); 
            Object.assign(this.item, this.formGroup.getRawValue()); 
            this.env.getStorage("OrderLines"+this.idTable).then(result=>{
                if(result?.length>0){
                    this.item.OrderLines = result;
                    this.patchOrderValue();
                    this.loadOrder();
                    this.loadInfoOrder();
                    this.setOrderValue(this.item);
                }
                else {
                    this.setOrderValue(this.item);
                    this.AllowSendOrder = false;      
                }
            });
        }   
        else {
            this.patchOrderValue();
        }       
        
        this.loadOrder();
        
        this.loadInfoOrder();
        
       
    }
    private UpdatePrice(){
        
        this.dealList.forEach(d=>{                     
            this.menuList.forEach(m=>{                             
                let index = m.Items.findIndex(i=>i.SalesUoM == d.IDItemUoM);
                if(index != -1){ 
                    let idexUom =  m.Items[index].UoMs.findIndex(u=>u.Id == d.IDItemUoM);                    
                    let newPrice = d.Price;
                    if(d.IsByPercent == true){
                        newPrice = d.OriginalPrice - (d.OriginalPrice * d.DiscountByPercent/100);
                    }      
                    m.Items[index].UoMs[idexUom].PriceList.find(p=>p.Type=="SalePriceList").NewPrice = newPrice;  
                   
                    if(d.MaxPerOrder != null){
                        m.Items[index].UoMs[idexUom].MaxPerOrder = d.MaxPerOrder;
                    }               
                }
            });
        })           
    }
    
    private loadOrder() {
        this.printData.undeliveredItems = [];       
        this.printData.printDate = lib.dateFormat(new Date(), "hh:MM dd/mm/yyyy");

        this.item._Locked = !this.pageConfig.canEdit ? false : this.noLockStatusList.indexOf(this.item.Status) == -1;
        this.printData.currentBranch = this.env.branchList.find(d => d.Id == this.item.IDBranch);

        if (this.item._Locked) {
            this.pageConfig.canEdit = false;
            this.formGroup?.disable();
        }
        
        this.UpdatePrice();
        this.calcOrder();       
        

    }
    private patchOrderValue() {
        this.formGroup?.patchValue(this.item);
        this.patchOrderLinesValue();
        console.log(this.getDirtyValues(this.formGroup));
    }
    private patchOrderLinesValue() {
        this.formGroup.controls.OrderLines = new FormArray([]);
        if (this.item.OrderLines?.length) {
            for (let i of this.item.OrderLines) {
                this.addOrderLine(i);
            }
        }
    }
    refresh(event?: any): void {
        this.preLoadData('force');
    }
    private getMenu() {
        let apiPath = {
            method: "GET",
            url: function(){return ApiSetting.apiDomain("POS/ForCustomer/Menu")}  
        };  
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(), this.query).toPromise()
					.then((result: any) => {					
						resolve(result);
					})
					.catch(err => {						
						reject(err);
					});
        });
    }
    private getTable() {
        let apiPath = {
            method: "GET",
            url: function(id){return ApiSetting.apiDomain("POS/ForCustomer/Table/") + id}  
        };  
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(this.idTable), this.query).toPromise()
					.then((result: any) => {					
						resolve(result);
					})
					.catch(err => {						
						reject(err);
					});
        });
    }
    private getDeal(){
        let apiPath = {
            method: "GET",
            url: function(){return ApiSetting.apiDomain("POS/ForCustomer/Deal")}  
        };  
        return new Promise((resolve, reject) => {          
            this.commonService.connect(apiPath.method, apiPath.url(),this.query).toPromise()
					.then((result: any) => {					
						resolve(result);
					})
					.catch(err => {						
						reject(err);
					});
        });
    }

    async addToCart(item, idUoM, quantity = 1, IsUpdate = false) {     
        if (this.submitAttempt) {

            let element = document.getElementById('item' + item.Id);
            if (element) {
                element = element.parentElement;
                element.classList.add('shake');
                setTimeout(() => {
                    element.classList.remove('shake');
                }, 400);
            }


            return;
        }       

        if (!this.pageConfig.canEdit) {
            this.env.showTranslateMessage('Đơn hàng đã khóa, không thể chỉnh sửa hoặc thêm món!', 'warning');
            return;
        }

        if (!item.UoMs.length) {
            this.env.showAlert('Sản phẩm này không có đơn vị tính! Xin vui lòng liên hệ quản lý để thêm giá sản phẩm.');
            return;
        }

        let uom = item.UoMs.find(d => d.Id == idUoM);
        let price = uom.PriceList.find(d => d.Type == 'SalePriceList');            
        let line = this.item.OrderLines.find(d => d.IDUoM == idUoM); //Chỉ update số lượng của các line tình trạng mới (chưa gửi bếp)                
        
        if (!line) {                                     
            line = {
                IDOrder: this.item.Id,
                Id: 0,
                Type: 'TableService',
                Status: 'New',

                IDItem: item.Id,
                IDTax: item.IDSalesTaxDefinition,
                TaxRate: item.SaleVAT,
                IDUoM: idUoM,
                UoMPrice: price.Price,  

                Quantity: 1,              
                IDBaseUoM: idUoM,
                UoMSwap: 1,
                UoMSwapAlter: 1,
                BaseQuantity: 0,               
                ShippedQuantity: 0,

                Remark: null,
                IsPromotionItem: false,
                IDPromotion: null
            };
            if(price.NewPrice){                
                line.UoMPrice = price.NewPrice;
            }  
            this.calcOrderLine(line);          
            this.item.OrderLines.push(line);  
                      
            this.addOrderLine(line);         
            this.setOrderValue({ OrderLines: [line] });
            if(this.id==0){
                this.env.setStorage("OrderLines"+this.idTable,this.item.OrderLines);
            }
        }
        else {
            if ((line.Quantity) > 0 && (line.Quantity + quantity) < line.ShippedQuantity) {
                this.env.showAlert("Vui lòng liên hệ nhân viên để được hỗ trợ ",item.Name+" đã chuyển bếp "+line.ShippedQuantity+" "+ line.UoMName,"Thông báo");
            }
            else if ((line.Quantity + quantity) > 0) {
                
                line.Quantity += quantity;
                this.calcOrderLine(line);
                this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                if(this.id==0){
                    this.env.setStorage("OrderLines"+this.idTable,this.item.OrderLines);
                }
            }
            else {
                this.env.showPrompt('Bạn chắc muốn bỏ sản phẩm này khỏi giỏ hàng?', item.Name, 'Xóa sẩn phẩm').then(_ => {
                    let tempQty = line.Quantity;
                    tempQty += quantity;
                    if (tempQty == 0 && this.item.OrderLines.length == 1) {
                        this.env.showMessage('Đơn hàng phải có ít nhất 1 sản phẩm!','warning');
                        return;
                    }
                    line.Quantity += quantity;
                    this.calcOrderLine(line);
                    this.loadInfoOrder();
                    this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Quantity: line.Quantity }] });
                    if(this.id==0){
                        this.env.setStorage("OrderLines"+this.idTable,this.item.OrderLines);
                    }
                }).catch(_ => { });
            }
             
        }
    }
    calcOrderLine(line){
        line._serviceCharge = 0;
        if (this.item.IDBranch == 174 //W-Cafe
            || this.item.IDBranch == 17 //The Log
            || (this.item.IDBranch == 416) //Gem Cafe && set menu  && line._item.IDMenu == 218
        ) {
            line._serviceCharge = 5;
        }                      
        line.OriginalTotalBeforeDiscount = line.Quantity * line.UoMPrice;
        line.OriginalPromotion = parseFloat(line.OriginalPromotion) || 0;
        line.OriginalDiscount1 = parseFloat(line.OriginalDiscount1) || 0;
        line.OriginalDiscount2 = parseFloat(line.OriginalDiscount2) || 0;
        line.OriginalDiscountByOrder = parseFloat(line.OriginalDiscountByOrder) || 0;
        line.OriginalDiscountByItem = line.OriginalDiscount1 + line.OriginalDiscount2;
        line.OriginalDiscountByGroup = line.OriginalPromotion/100 * line.OriginalTotalBeforeDiscount;
        line.OriginalDiscountByLine = line.OriginalDiscountByItem + line.OriginalDiscountByGroup;
        line.OriginalTotalDiscount = line.OriginalDiscountByOrder + line.OriginalDiscountByLine;
        

        line.OriginalTotalAfterDiscount = line.OriginalTotalBeforeDiscount -  line.OriginalTotalDiscount;
        line.OriginalTax = line.OriginalTotalAfterDiscount*line.TaxRate/100;
        line.OriginalTotalAfterTax = line.OriginalTotalAfterDiscount +  line.OriginalTax;

        line.OriginalDiscountFromSalesman = parseFloat(line.OriginalDiscountFromSalesman) || 0;
        
        line.CalcOriginalTotalAdditions =  line.OriginalTotalAfterDiscount * (line._serviceCharge / 100) * (1 + line.TaxRate / 100);
        line.CalcTotalOriginal  = line.OriginalTotalAfterTax + line.CalcOriginalTotalAdditions;                   
        line._OriginalTotalAfterDiscountFromSalesman = line.CalcTotalOriginal - line.OriginalDiscountFromSalesman;   
        this.calcOrder();     
    }
    private addOrderLine(line) {
        let groups = <FormArray>this.formGroup.controls.OrderLines;
        let group = this.formBuilder.group({
            IDOrder: [line.IDOrder],
            Id: new FormControl({ value: line.Id, disabled: true }),

            Type: [line.Type],
            Status: new FormControl({ value: line.Status, disabled: true }),

            IDItem: [line.IDItem, Validators.required],
            IDTax: [line.IDTax],
            TaxRate: [line.TaxRate],

            IDUoM: [line.IDUoM, Validators.required],
            UoMPrice: [line.UoMPrice],

            Quantity: [line.Quantity, Validators.required],
            IDBaseUoM: [line.IDBaseUoM],
            UoMSwap: [line.UoMSwap],
            UoMSwapAlter: [line.UoMSwapAlter],
            BaseQuantity: [line.BaseQuantity],

            ShippedQuantity: [line.ShippedQuantity],
            Remark: new FormControl({ value: line.Remark, disabled: true }),

            IsPromotionItem: [line.IsPromotionItem],
            IDPromotion: [line.IDPromotion],


        });
        groups.push(group);
    }
    setOrderValue(data) {
        this.AllowSendOrder = true;
        for (const c in data) {
            if (c == 'OrderLines' || c == 'OrderLines') {
                let fa = <FormArray>this.formGroup.controls.OrderLines;

                for (const line of data[c]) {
                    let idx = -1;
                    if (c == 'OrderLines') {
                        idx = this.item[c].findIndex(d => d.Id == line.Id && d.IDUoM == line.IDUoM);
                    }

                    //Remove Order line
                    if (line.Quantity < 1) {
                        if (line.Id) {
                            let deletedLines = this.formGroup.get('DeletedLines').value;
                            deletedLines.push(line.Id);
                            this.formGroup.get('DeletedLines').setValue(deletedLines);
                            this.formGroup.get('DeletedLines').markAsDirty();
                        }
                        
                        this.item.OrderLines.splice(idx, 1);
                        
                        fa.removeAt(idx);
                    }
                    //Update 
                    else {
                        
                        let cfg = <FormGroup>fa.controls[idx];

                        for (const lc in line) {
                            let fc = <FormControl>cfg.controls[lc];
                            if (fc) {
                                fc.setValue(line[lc]);
                                fc.markAsDirty();
                            }
                        }
                    }


                }
            }
            else {
                
                let fc = <FormControl>this.formGroup.controls[c];
                if (fc) {
                    fc.setValue(data[c]);
                    fc.markAsDirty();
                }
            }

        }
        this.loadInfoOrder();
        this.calcOrder();      
    }
    sendOrder(){
        this.saveChange();    
        this.AllowSendOrder = false;             
    }
    async saveChange() {
        let submitItem = this.getDirtyValues(this.formGroup);
        console.log(submitItem);
        this.saveChange2();
    }
    savedChange(savedItem?: any, form?: FormGroup<any>): void {
        if (savedItem) {
            let message = "Đặt hàng thành công";
            if(this.id!=0){
                message = "cập nhật thành công";
            }
            this.env.setStorage("OrderLines"+this.idTable,[]);
            this.env.showTranslateMessage(message, 'success');
            if (form.controls.Id && savedItem.Id && form.controls.Id.value != savedItem.Id)
                form.controls.Id.setValue(savedItem.Id);

            if (this.pageConfig.isDetailPage && form == this.formGroup && this.id == 0) {
                this.id = savedItem.Id;
                let newURL = '#/pos-customer-order/' + savedItem.Id + '/' + this.idTable;
                history.pushState({}, null, newURL);
            }

            this.item = savedItem;
            //this.env.setStorage("IDOrder",{Id:this.item.Id});
            //this.env.setStorage("IDOrders",{Id:this.item.Id,Status:this.item.Status});
        }      
        this.loadedData();
        this.submitAttempt = false;
    }
    private calcOrder() {
        this.item._TotalQuantity = this.item.OrderLines?.map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
        this.item._TotalShipedQuantity = this.item.OrderLines?.map(x => x.ShippedQuantity).reduce((a, b) => (+a) + (+b), 0);
        
        this.item.OriginalTotalBeforeDiscount = 0;
        this.item.OriginalTotalDiscount = 0;
        this.item.OriginalTax = 0;
        this.item.OriginalTotalAfterTax = 0;
        this.item.CalcOriginalTotalAdditions = 0;
        this.item.CalcTotalOriginal = 0;
        this.item.OriginalDiscountFromSalesman = 0;     
        this.item._OriginalTotalAfterDiscountFromSalesman = 0;
        
        for (let line of this.item.OrderLines) {            
            this.item.OriginalTotalBeforeDiscount += line.OriginalTotalBeforeDiscount; 
            this.item.OriginalTotalDiscount += line.OriginalTotalDiscount;           
            this.item.OriginalTax += line.OriginalTax;           
            this.item.OriginalTotalAfterTax += line.OriginalTotalAfterTax;
            this.item.CalcOriginalTotalAdditions += line.CalcOriginalTotalAdditions; 
            this.item.CalcTotalOriginal += line.CalcTotalOriginal ;    
            this.item.OriginalDiscountFromSalesman += line.OriginalDiscountFromSalesman; 
            this.item._OriginalTotalAfterDiscountFromSalesman += line._OriginalTotalAfterDiscountFromSalesman;
        }
        this.item.Debt = (this.item.CalcTotalOriginal-this.item.OriginalDiscountFromSalesman) - this.item.Received;  
    }
    loadInfoOrder(){
        for (let line of this.item.OrderLines) {
            for (let m of this.menuList)
                    for (let mi of m.Items) {
                        if (mi.Id == line.IDItem) {
                            mi.BookedQuantity = this.item.OrderLines.filter(x => x.IDItem == line.IDItem).map(x => x.Quantity).reduce((a, b) => (+a) + (+b), 0);
                            line._item = mi;
                        }
                    }

                line._background = { 'background-image': 'url("' + environment.posImagesServer + ((line._item && line._item.Image) ? line._item.Image : 'assets/pos-icons/POS-Item-demo.png') + '")' };
            }
        
    }
    async processPayments() {
        const modal = await this.modalController.create({
            component: POSForCustomerPaymentModalPage,
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-change-table',
            componentProps: {
                item: this.item,
            }
        });
        await modal.present();
        const { data , role } = await modal.onWillDismiss();     
    }
    async openQuickMemo(line) {
        if (this.submitAttempt) return;

        const modal = await this.modalController.create({
            component: POSCustomerMemoModalPage,
            id: 'POSMemoModalPage',
            swipeToClose: true,
            backdropDismiss: true,
            cssClass: 'modal-quick-memo',
            componentProps: {
                item: JSON.parse(JSON.stringify(line))
            }
        });
        await modal.present();
        const { data, role } = await modal.onWillDismiss();

        if (role == 'confirm') {
            line.Remark = data ? data.toString() : null;
            this.setOrderValue({ OrderLines: [{ Id: line.Id, IDUoM: line.IDUoM, Remark: line.Remark }] });           
        }
    }

    search(ev) {
        var val = ev.target.value.toLowerCase();
        if (val == undefined) {
            val = '';
        }
        if (val.length > 2 || val == '') {
            this.query.Keyword = val;                  
        }

    }
}
