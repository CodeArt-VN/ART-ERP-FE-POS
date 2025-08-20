import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { EnvService } from 'src/app/services/core/env.service';
import { PrintingService } from 'src/app/services/printing.service';
import { POSService } from './pos.service';

interface JobTracker {
	job: any;
	status: 'pending' | 'success' | 'failed';
	items: any[];
	timestamp: number;
	error?: string;
}

interface PrintEvent {
	type: 'job_started' | 'job_success' | 'job_failed' | 'batch_complete';
	jobId?: string;
	data?: any;
	timestamp: number;
}

@Injectable({
	providedIn: 'root',
})
export class POSPrintService implements OnDestroy {

	private printJobTracking = new Map<string, JobTracker>();
	private eventSubject = new Subject<PrintEvent>();
	private destroy$ = new Subject<void>();

	constructor(
		private env: EnvService,
		private printingService: PrintingService,
		private posService: POSService
	) {}

	get events$(): Observable<PrintEvent> {
		return this.eventSubject.asObservable();
	}

	async sendKitchen(
		item: any, 
		orderLines: any[], 
		setKitchenID: Function, 
		setItemQuery: Function, 
		setOrderValue: Function
	): Promise<boolean> {
		try {
			console.log('🚀 === SEND KITCHEN START ===');
			this.emitEvent('job_started', undefined, { orderId: item.Id });

			this.printJobTracking.clear();

			const undeliveredItems = this.getUndeliveredItems(orderLines);
			if (undeliveredItems.length === 0) {
				this.env.showMessage('No new products need to be sent!', 'success');
				return true;
			}

			const printJobs = await this.createPrintJobs(undeliveredItems, item, setKitchenID, setItemQuery);
			if (printJobs.length === 0) {
				return true;
			}

			this.setupJobTracking(printJobs);
			const success = await this.executeJobs(printJobs, setOrderValue);

			this.emitEvent('batch_complete', undefined, { success });
			console.log('✅ === SEND KITCHEN COMPLETE ===');
			return success;

		} catch (error) {
			console.error('💥 Error in sendKitchen:', error);
			this.env.showMessage('System error occurred!', 'danger');
			return false;
		}
	}

	private async executeJobs(printJobs: any[], setOrderValue: Function): Promise<boolean> {
		const promises = printJobs.map(job => this.executeJob(job, setOrderValue));
		
		try {
			await Promise.all(promises);
			// Chỉ xử lý failed jobs nếu thực sự có failed jobs
			const hasFailedJobs = this.hasFailedJobs();
			if (hasFailedJobs) {
				console.log('⚠️ Some jobs failed, handling failed jobs...');
				await this.handleFailedJobs(setOrderValue);
			} else {
				console.log('✅ All jobs completed successfully!');
			}
			return true;
		} catch (error) {
			console.error('❌ Some jobs failed with exceptions:', error);
			await this.handleFailedJobs(setOrderValue);
			return false;
		}
	}

	private hasFailedJobs(): boolean {
		const allJobs = Array.from(this.printJobTracking.values());
		const failedJobs = allJobs.filter(t => t.status === 'failed');
		
		console.log('🔍 Job Status Summary:');
		allJobs.forEach(job => {
			console.log(`  - Job ${job.job.IDJob}: ${job.status}${job.error ? ' (' + job.error + ')' : ''}`);
		});
		
		console.log(`📊 Total: ${allJobs.length}, Failed: ${failedJobs.length}`);
		return failedJobs.length > 0;
	}

	private async executeJob(job: any, setOrderValue: Function): Promise<void> {
		const tracker = this.printJobTracking.get(job.IDJob);
		if (!tracker) return;

		try {
			console.log(`🖨️ Executing print job: ${job.IDJob}`);
			const result = await this.printingService.print([job]);
			
			// Kiểm tra kết quả print thực tế
			if (this.isPrintResultSuccess(result)) {
				await this.handleJobSuccess(job.IDJob, result, setOrderValue);
			} else {
				throw new Error(`Print failed: ${this.getPrintErrorMessage(result)}`);
			}
		} catch (error: any) {
			console.error(`❌ Print job ${job.IDJob} failed:`, error);
			tracker.status = 'failed';
			tracker.error = error.message;
			this.emitEvent('job_failed', job.IDJob, { error: error.message });
			throw error; // Re-throw để executeJobs biết có lỗi
		}
	}

	private isPrintResultSuccess(result: any): boolean {
		if (!result || !Array.isArray(result) || result.length === 0) {
			console.log('❌ Print result empty or invalid');
			return false;
		}

		const printResult = result[0];
		//console.log('🔍 Checking print result:', printResult);
		
		// Kiểm tra trường hợp có Success/Failed count
		if (typeof printResult?.Success === 'number' && typeof printResult?.Failed === 'number') {
			const isSuccess = printResult.Success > 0 && printResult.Failed === 0;
			console.log(`📊 Print stats - Success: ${printResult.Success}, Failed: ${printResult.Failed}, Result: ${isSuccess}`);
			return isSuccess;
		}
		
		// Kiểm tra các trường hợp thành công khác
		if (printResult?.success === true) {
			console.log('✅ Print success flag is true');
			return true;
		}
		if (printResult?.status === 'success') {
			console.log('✅ Print status is success');
			return true;
		}
		if (printResult?.code === 200) {
			console.log('✅ Print code is 200');
			return true;
		}
		
		// Kiểm tra lỗi rõ ràng
		if (printResult?.error) {
			console.log('❌ Print result has error:', printResult.error);
			return false;
		}
		
		if (printResult?.status === 'error' || printResult?.status === 'failed') {
			console.log('❌ Print status indicates failure:', printResult.status);
			return false;
		}

		// Không có thông tin rõ ràng thì coi như thất bại (safer approach)
		console.log('⚠️ Print result unclear, assuming FAILURE for safety:', printResult);
		return false;
	}

	private getPrintErrorMessage(result: any): string {
		if (!result || result.length === 0) return 'No print result returned';
		
		const printResult = result[0];
		
		// Trường hợp có Success/Failed count
		if (typeof printResult?.Success === 'number' && typeof printResult?.Failed === 'number') {
			return `Print failed - Success: ${printResult.Success}, Failed: ${printResult.Failed}`;
		}
		
		return printResult?.error || printResult?.message || 'Unknown print error';
	}

	private async handleJobSuccess(jobId: string, result: any, setOrderValue: Function): Promise<void> {
		const tracker = this.printJobTracking.get(jobId);
		if (!tracker) return;

		tracker.status = 'success';
		console.log(`✅ Job ${jobId} SUCCESS`);

		const updateLines = tracker.items.map(item => ({
			Id: item.Id,
			Code: item.Code,
			ShippedQuantity: item.Quantity,
			IDUoM: item.IDUoM,
			Status: 'Serving'
		}));

		try {
			await setOrderValue({ OrderLines: updateLines, Status: 'Scheduled' }, false, true);
			
			const itemNames = tracker.items.map(item => item._item?.Name || item.Code).join(', ');
			this.env.showMessage(`✓ Sent to kitchen: ${itemNames}`, 'success');
			this.emitEvent('job_success', jobId, { items: tracker.items.length });

		} catch (error) {
			console.error(`Failed to update items for job ${jobId}:`, error);
			this.env.showMessage(`Print OK but update failed: ${tracker.items.map(i => i.Code).join(', ')}`, 'warning');
		}
	}

	private async handleFailedJobs(setOrderValue?: Function): Promise<void> {
		const failedJobs = Array.from(this.printJobTracking.values()).filter(t => t.status === 'failed');
		
		if (failedJobs.length === 0) {
			console.log('✅ No failed jobs to handle');
			return;
		}

		console.log(`🔧 Handling ${failedJobs.length} failed jobs:`);
		failedJobs.forEach(job => {
			console.log(`  - ${job.job.IDJob}: ${job.error || 'Unknown error'}`);
		});

		const allFailedItems = failedJobs.reduce((acc, job) => {
			acc.push(...job.items);
			return acc;
		}, [] as any[]);

		try {
			await this.env.showPrompt(
				`${failedJobs.length} print jobs failed. Mark items as serving anyway?`,
				'',
				'Print Failed!',
				'Mark as Serving',
				'Keep Status'
			);

			// User đồng ý - thực hiện force update
			const forceUpdateLines = allFailedItems.map(item => ({
				Id: item.Id,
				Code: item.Code,
				ShippedQuantity: item.Quantity,
				IDUoM: item.IDUoM,
				Status: 'Serving'
			}));

			// Force update với setOrderValue function nếu có
			if (setOrderValue) {
				try {
					console.log('🔄 Force updating items to Serving status...');
					await setOrderValue({ OrderLines: forceUpdateLines, Status: 'Scheduled' }, false, true);
					this.env.showMessage(`✓ Marked ${allFailedItems.length} items as serving`, 'success');
					
					// Clear failed jobs after successful force update
					for (let [jobId, job] of this.printJobTracking.entries()) {
						if (job.status === 'failed') {
							this.printJobTracking.delete(jobId);
						}
					}
				} catch (updateError) {
					console.error('❌ Failed to force update database:', updateError);
				}
			} else {
				console.warn('⚠️ Cannot force update items - setOrderValue function not available in this context');
				console.log('📝 Items that should be force updated:', forceUpdateLines);
				this.env.showMessage('Cannot update items - missing database function', 'warning');
			}

		} catch (error) {
			const failedItemNames = allFailedItems.map(item => item._item?.Name || item.Code).join(', ');
			this.env.showMessage(`Items not sent: ${failedItemNames}`, 'warning');
		}
	}

	private getUndeliveredItems(orderLines: any[]): any[] {
		const undeliveredItems: any[] = [];
		
		orderLines.forEach((line) => {
			line._undeliveredQuantity = line.Quantity - line.ShippedQuantity;
			line._IDKitchen = line._item?.IDKitchen;
			
			if (line.Remark) {
				line.Remark = line.Remark.toString();
			}
			
			if (line._undeliveredQuantity > 0) {
				undeliveredItems.push(line);
			}
		});

		console.log('📦 Undelivered items:', undeliveredItems.length);
		return undeliveredItems;
	}

	private async createPrintJobs(
		undeliveredItems: any[], 
		item: any, 
		setKitchenID: Function, 
		setItemQuery: Function
	): Promise<any[]> {
		const printJobs = [];
		const kitchenGroups = this.groupItemsByKitchen(undeliveredItems);
		
		for (const [kitchenId, items] of kitchenGroups.entries()) {
			const kitchen = this.posService.dataSource.kitchens.find(k => k.Id === Number(kitchenId));
			
			if (!kitchen || !kitchen._Printer) {
				console.log(`⚠️ Kitchen/Printer not found for ID: ${kitchenId}`);
				continue;
			}

			const jobs = await this.createJobsForKitchen(kitchen, items, item, setKitchenID, setItemQuery);
			printJobs.push(...jobs);
		}

		return printJobs;
	}

	private groupItemsByKitchen(items: any[]): Map<string, any[]> {
		const groups = new Map<string, any[]>();
		
		items.forEach(item => {
			const kitchenId = item._IDKitchen;
			if (!groups.has(kitchenId)) {
				groups.set(kitchenId, []);
			}
			groups.get(kitchenId)!.push(item);
		});

		return groups;
	}

	private async createJobsForKitchen(
		kitchen: any, 
		items: any[], 
		orderItem: any, 
		setKitchenID: Function, 
		setItemQuery: Function
	): Promise<any[]> {
		const jobs = [];
		await setKitchenID(kitchen.Id);

		if (kitchen.IsPrintList) {
			const jobName = `${kitchen.Id}_${orderItem?.Id}_LIST_${Date.now()}`;
			const content = this.getPrintContent('bill');
			const job = this.createPrintJob(content, kitchen._Printer, jobName, items);
			jobs.push(job);
		}

		if (kitchen.IsPrintOneByOne) {
			for (const item of items) {
				await setItemQuery(item.IDItem);
				const jobName = `${kitchen.Id}_${orderItem?.Id}_${item.Code}_${Date.now()}`;
				const content = this.getPrintContent(`bill-item-each-${item.Id}`);
				const job = this.createPrintJob(content, kitchen._Printer, jobName, [item]);
				jobs.push(job);
			}
		}

		return jobs;
	}

	private getPrintContent(elementId: string): string {
		const element = document.getElementById(elementId);
		return element?.outerHTML || '';
	}

	private createPrintJob(content: string, printer: any, jobName: string, items: any[]): any {
		return {
			content: content,
			type: 'html' as const,
			options: [{
				printer: printer.Code,
				host: printer.Host,
				port: printer.Port,
				isSecure: printer.IsSecure,
				jobName: jobName
			}],
			IDJob: jobName,
			_items: items
		};
	}

	private setupJobTracking(printJobs: any[]): void {
		printJobs.forEach(job => {
			this.printJobTracking.set(job.IDJob, {
				job: job,
				status: 'pending',
				items: job._items || [],
				timestamp: Date.now()
			});
		});
	}

	private emitEvent(type: PrintEvent['type'], jobId?: string, data?: any): void {
		this.eventSubject.next({
			type,
			jobId,
			data,
			timestamp: Date.now()
		});
	}

	async sendPrint(
		item: any, 
		defaultPrinter: any[], 
		setKitchenID: Function, 
		setItemQuery: Function, 
		Status?: string
	): Promise<boolean> {
		if (!defaultPrinter?.length) {
			this.env.showMessage('Printer not configured!', 'warning');
			return false;
		}

		try {
			if (Status) item.Status = Status;
			
			await setKitchenID('all');
			await setItemQuery('all');

			const content = this.getPrintContent('bill');
			const job = this.createPrintJob(content, defaultPrinter[0], `receipt_${item.Id}_${Date.now()}`, []);
			
			await this.printingService.print([job]);
			return true;
		} catch (error) {
			console.error('Receipt print failed:', error);
			return false;
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		this.eventSubject.complete();
	}
}