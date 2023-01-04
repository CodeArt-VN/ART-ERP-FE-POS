import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { POSSplitModalPage } from './pos-split-modal.page';

describe('POSSplitModalPage', () => {
  let component: POSSplitModalPage;
  let fixture: ComponentFixture<POSSplitModalPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ POSSplitModalPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(POSSplitModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
