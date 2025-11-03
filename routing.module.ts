import { Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/app.guard';

export const POSRoutes: Routes = [
    
    { path: 'pos-order', loadChildren: () => import('./pos-order/pos-order.module').then(m => m.POSOrderPageModule), canActivate: [AuthGuard] },
    { path: 'pos-order/:id', loadChildren: () => import('./pos-order-detail/pos-order-detail.module').then(m => m.POSOrderDetailPageModule), canActivate: [AuthGuard] },
    { path: 'pos-order/:id/:table', loadChildren: () => import('./pos-order-detail/pos-order-detail.module').then(m => m.POSOrderDetailPageModule), canActivate: [AuthGuard] },
    { path: 'pos-work-order', loadChildren: () => import('./pos-work-order/pos-work-order.module').then(m => m.POSWorkOrderPageModule), canActivate: [AuthGuard] },
    { path: 'pos-terminal', loadChildren: () => import('./pos-terminal/pos-terminal.module').then(m => m.POSTerminalPageModule), canActivate: [AuthGuard] },
    { path: 'pos-terminal/:id', loadChildren: () => import('./pos-terminal-detail/pos-terminal-detail.module').then(m => m.POSTerminalDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'pos-kitchen', loadChildren: () => import('./pos-kitchen/pos-kitchen.module').then(m => m.POSKitchenPageModule), canActivate: [AuthGuard] },
    { path: 'pos-kitchen/:id', loadChildren: () => import('./pos-kitchen-detail/pos-kitchen-detail.module').then(m => m.POSKitchenDetailPageModule), canActivate: [AuthGuard] },
    { path: 'pos-memo', loadChildren: () => import('./pos-memo/pos-memo.module').then(m => m.POSMemoPageModule), canActivate: [AuthGuard] },
    { path: 'pos-memo/:id', loadChildren: () => import('./pos-memo-detail/pos-memo-detail.module').then(m => m.POSMemoDetailPageModule), canActivate: [AuthGuard] },
    { path: 'pos-menu', loadChildren: () => import('./pos-menu/pos-menu.module').then(m => m.POSMenuPageModule), canActivate: [AuthGuard] },
    { path: 'pos-menu/:id', loadChildren: () => import('./pos-menu-detail/pos-menu-detail.module').then(m => m.POSMenuDetailPageModule), canActivate: [AuthGuard] },
    { path: 'pos-table', loadChildren: () => import('./pos-table/pos-table.module').then(m => m.POSTablePageModule), canActivate: [AuthGuard] },
    { path: 'pos-table/:id', loadChildren: () => import('./pos-table-detail/pos-table-detail.module').then(m => m.POSTableDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'pos-table-group', loadChildren: () => import('./pos-table-group/pos-table-group.module').then(m => m.POSTableGroupPageModule), canActivate: [AuthGuard] },
    { path: 'pos-table-group/:id', loadChildren: () => import('./pos-table-group-detail/pos-table-group-detail.module').then(m => m.POSTableGroupDetailPageModule), canActivate: [AuthGuard] },
  
    { path: 'pos-welcome/:id', loadChildren: () => import('./pos-for-customer/welcome/pos-welcome.module').then(m => m.POSWelcomePageModule) },
    { path: 'pos-customer-order/:id/:table', loadChildren: () => import('./pos-for-customer/order/pos-customer-order.module').then(m => m.POSCustomerOrderPageModule) },
  
    { path: 'pos-booking', loadChildren: () => import('./pos-booking/pos-booking.module').then(m => m.PosBookingPageModule) },
    { path: 'pos-booking/:id', loadChildren: () => import('./pos-booking-detail/pos-booking-detail.module').then(m => m.PosBookingDetailPageModule) },
   
    { path: 'pos-shift/:id', loadChildren: () => import('./pos-shift-detail/pos-shift-detail.module').then(m => m.POSShiftDetailPageModule), canActivate: [AuthGuard] },
   
    { path: 'pos-config', loadChildren: () => import('../ADMIN/config/config.module').then(m => m.ConfigPageModule), canActivate: [AuthGuard] },


    // { path: 'pos-table', loadChildren: () => import('./pos-table/pos-table.module').then(m => m.TablePageModule), canActivate: [AuthGuard] },
    // { path: 'pos-menu', loadChildren: () => import('./pos-menu/pos-menu.module').then(m => m.TablePageModule), canActivate: [AuthGuard] },
  
];
