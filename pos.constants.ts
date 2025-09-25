export class POSConstants {
    // Order Status Lists
    static readonly NO_LOCK_STATUS_LIST = ['New', 'Confirmed', 'Scheduled', 'Picking', 'Delivered', 'TemporaryBill'];
    static readonly NO_LOCK_LINE_STATUS_LIST = ['New', 'Waiting'];
    static readonly CHECK_DONE_LINE_STATUS_LIST = ['Done', 'Canceled', 'Returned'];
    
    // Event Codes
    static readonly EVENT_CODES = {
        POS_ORDER_PAYMENT_UPDATE: 'app:POSOrderPaymentUpdate',
        POS_ORDER_FROM_CUSTOMER: 'app:POSOrderFromCustomer', 
        POS_LOCK_ORDER_FROM_STAFF: 'app:POSLockOrderFromStaff',
        POS_LOCK_ORDER_FROM_CUSTOMER: 'app:POSLockOrderFromCustomer',
        POS_UNLOCK_ORDER_FROM_STAFF: 'app:POSUnlockOrderFromStaff',
        POS_UNLOCK_ORDER_FROM_CUSTOMER: 'app:POSUnlockOrderFromCustomer',
        POS_SUPPORT: 'app:POSSupport',
        POS_CALL_TO_PAY: 'app:POSCallToPay',
        NOTIFY_SPLITTED_ORDER_FROM_STAFF: 'app:notifySplittedOrderFromStaff',
        POS_ORDER_MERGED_FROM_STAFF: 'app:POSOrderMergedFromStaff',
        NETWORK_STATUS_CHANGE: 'app:networkStatusChange',
        POS_ORDER_FROM_STAFF: 'app:POSOrderFromStaff'
    };

    // Order Status Values
    static readonly ORDER_STATUS = {
        NEW: 'New',
        CONFIRMED: 'Confirmed', 
        SCHEDULED: 'Scheduled',
        PICKING: 'Picking',
        DELIVERED: 'Delivered',
        DONE: 'Done',
        TEMPORARY_BILL: 'TemporaryBill',
        CANCELED: 'Canceled',
        DEBT: 'Debt'
    };

    // Order Line Status Values  
    static readonly ORDER_LINE_STATUS = {
        NEW: 'New',
        WAITING: 'Waiting',
        PREPARING: 'Preparing',
        READY: 'Ready', 
        SERVING: 'Serving',
        DONE: 'Done',
        CANCELED: 'Canceled',
        RETURNED: 'Returned'
    };

    // API Endpoints
    static readonly API_ENDPOINTS = {
        CANCEL_ORDERS: 'SALE/Order/CancelOrders/',
        CANCEL_REDUCE_ORDER_LINES: 'SALE/Order/CancelReduceOrderLines/',
        CHECK_POS_MODIFIED_DATE: 'SALE/Order/CheckPOSModifiedDate',
        CHECK_POS_NEW_ORDER_LINES: 'SALE/Order/CheckPOSNewOrderLines/',
        TOGGLE_BILL_STATUS: 'SALE/Order/toggleBillStatus/',
        UPDATE_POS_ORDER_DISCOUNT: 'SALE/Order/UpdatePosOrderDiscount/',
        INCOMING_PAYMENT_DETAIL: 'BANK/IncomingPaymentDetail',
        DELETE_VOUCHER: 'PR/Program/DeleteVoucher/',
        APPLIED_PROGRAM_IN_SALE_ORDER: 'PR/Program/AppliedProgramInSaleOrder'
    };

    // Order Types
    static readonly ORDER_TYPES = {
        POS_ORDER: 'POSOrder',
        TABLE_SERVICE: 'TableService'
    };

    // Notification Types
    static readonly NOTIFICATION_TYPES = {
        ORDER: 'Order',
        SUPPORT: 'Support', 
        REMIND_ORDER: 'Remind order',
        PAYMENT: 'Payment'
    };

    // Branch Codes with Service Charge
    static readonly SERVICE_CHARGE_BRANCHES = [174, 17, 765, 416, 864];
    static readonly SERVICE_CHARGE_BRANCH_CODE = '145';
    static readonly SERVICE_CHARGE_RATE = 5;

    // Print Settings
    static readonly PRINT_SETTINGS = {
        ERROR_CORRECTION_LEVEL: 'H',
        QR_VERSION: 10,
        QR_WIDTH: 150,
        QR_SCALE: 1,
        QR_TYPE: 'image/jpeg'
    };

    // Kitchen Query Types
    static readonly KITCHEN_QUERY = {
        ALL: 'all'
    };

    // Default Values
    static readonly DEFAULTS = {
        QUANTITY: 1,
        NUMBER_OF_GUESTS: 1,
        DEBOUNCE_DELAY: 1000,
        AUTO_SAVE_DELAY: 1000
    };

    // Walk-in Customer ID
    static readonly WALK_IN_CUSTOMER_ID = 922;

    // Payment Status
    static readonly PAYMENT_STATUS = {
        SUCCESS: 'Success',
        PROCESSING: 'Processing'
    };
}
