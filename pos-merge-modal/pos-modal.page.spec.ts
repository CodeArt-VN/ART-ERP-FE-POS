import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { POSMergeModalPage } from './pos-merge-modal.page';

describe('POSMergeModalPage', () => {
  let component: POSMergeModalPage;
  let fixture: ComponentFixture<POSMergeModalPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ POSMergeModalPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(POSMergeModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
