import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { POSPaymentModalPage } from './pos-payment-modal.page';

describe('POSPaymentModalPage', () => {
  let component: POSPaymentModalPage;
  let fixture: ComponentFixture<POSPaymentModalPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ POSPaymentModalPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(POSPaymentModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
