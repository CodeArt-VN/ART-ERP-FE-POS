import { Injectable } from '@angular/core';
import { EnvService } from 'src/app/services/core/env.service';
@Injectable({
	providedIn: 'root',
})
export class POSNotifyService {

	constructor(
		private env: EnvService
	) {}

}
