import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { POSWelcomePage } from './pos-welcome.page';
import { TranslateModule } from '@ngx-translate/core';
import { ShareDirectivesModule } from 'src/app/directives/share-directives.module';

@NgModule({
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [IonicModule, CommonModule, FormsModule, TranslateModule, ShareDirectivesModule, RouterModule.forChild([{ path: '', component: POSWelcomePage }])],
	declarations: [POSWelcomePage],
})
export class POSWelcomePageModule {}
