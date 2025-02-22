import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { POSMemoModalPage } from './pos-memo-modal.page';

describe('POSMemoModalPage', () => {
	let component: POSMemoModalPage;
	let fixture: ComponentFixture<POSMemoModalPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [POSMemoModalPage],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(POSMemoModalPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
