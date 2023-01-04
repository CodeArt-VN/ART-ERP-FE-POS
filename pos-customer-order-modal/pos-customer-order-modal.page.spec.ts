import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { POSCustomerOrderModalPage } from './pos-customer-order-modal.page';

describe('POSCustomerOrderModalPage', () => {
  let component: POSCustomerOrderModalPage;
  let fixture: ComponentFixture<POSCustomerOrderModalPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ POSCustomerOrderModalPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(POSCustomerOrderModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
