import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { POSChangeTableModalPage } from './pos-change-table-modal.page';

describe('POSChangeTableModalPage', () => {
	let component: POSChangeTableModalPage;
	let fixture: ComponentFixture<POSChangeTableModalPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [POSChangeTableModalPage],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(POSChangeTableModalPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
