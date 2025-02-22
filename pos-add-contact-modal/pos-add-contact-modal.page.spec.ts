import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { POSAddContactModalPage } from './pos-add-contact-modal.page';

describe('POSAddContactModalPage', () => {
	let component: POSAddContactModalPage;
	let fixture: ComponentFixture<POSAddContactModalPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [POSAddContactModalPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(POSAddContactModalPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
