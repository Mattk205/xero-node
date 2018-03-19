
import * as fs from 'fs';
import * as path from 'path';
import { AccountingAPIClient } from '../AccountingAPIClient';
import { createSingleInvoiceRequest, createMultipleInvoiceRequest } from './request-body/invoice.request.examples';
import { getPrivateConfig, setJestTimeout } from './helpers/integration.helpers';
import { InvoicesResponse } from '../AccountingAPI-types';

describe('Invoices endpoint', () => {

	let xero: AccountingAPIClient;

	let invoiceIdsToArchive: string[] = [];
	const tmpDownloadFile = path.resolve(__dirname, './temp_result.pdf');

	beforeAll(async () => {
		setJestTimeout();
		const config = getPrivateConfig();
		xero = new AccountingAPIClient(config);
	});

	// TODO: we don't ever delete invoices from Xero, so let's limit the number we create... but we need an id to retrieve in the next test
	it('create single', async () => {
		const response = await xero.invoices.create(createSingleInvoiceRequest);

		collectInvoicesToArchive(response);

		expect(response.Invoices.length).toBe(1);
		expect(response.Invoices[0].InvoiceID).toBeTruthy();
	});

	// skip: we don't ever delete invoices from Xero, so let's limit the number we create
	it.skip('create multiple', async () => {
		const response = await xero.invoices.create(createMultipleInvoiceRequest);

		collectInvoicesToArchive(response);

		expect(response.Invoices.length).toBe(createMultipleInvoiceRequest.Invoices.length);
		expect(response.Invoices[0].InvoiceID).toBeTruthy();
		expect(response.Invoices[1].InvoiceID).toBeTruthy();
	});

	it('get all', async () => {
		const response = await xero.invoices.get();

		expect(response).toBeDefined();
		expect(response.Id).toBeTruthy();
		expect(response.Invoices.length).toBeGreaterThanOrEqual(invoiceIdsToArchive.length);
		expect(response.Invoices[0].InvoiceID).toBeTruthy();
	});

	it('get single', async () => {
		const response = await xero.invoices.get({ InvoiceID: await invoiceIdThatExists() });

		expect(response).toBeDefined();
		expect(response.Id).toBeTruthy();
		expect(response.Invoices).toHaveLength(1);
		expect(response.Invoices[0].InvoiceID).toBe(await invoiceIdThatExists());
	});

	it('get single as pdf', async () => {
		const response = await xero.invoices.savePDF({ InvoiceID: await invoiceIdThatExists(), savePath: tmpDownloadFile });

		expect(response).toBeUndefined();
		const invoiceBuffer = fs.readFileSync(tmpDownloadFile);
		expect(invoiceBuffer.byteLength).toBeGreaterThan(3000); // Let's hope all PDFs are bigger than 3000B
	});

	describe('Invalid requests', () => {
		it('creating an invalid invoice', async () => {
			const createInvalidInvoiceRequest = { ...createSingleInvoiceRequest, ...{ Type: 'ImNotARealType' } };

			const response = await xero.invoices.create(createInvalidInvoiceRequest);

			collectInvoicesToArchive(response);

			expect(response.Invoices).toHaveLength(1);
			expect(response.Invoices[0].HasErrors).toBeTruthy();
			expect(response.Invoices[0].ValidationErrors.length).toBeGreaterThanOrEqual(1);
		});
	});

	afterAll(async () => {
		// delete the file
		fs.unlinkSync(tmpDownloadFile);

		// archive the invoices
		const updateRequestBody = invoiceIdsToArchive.map((invoiceId) => ({ InvoiceID: invoiceId, Status: 'DELETED' }));
		await xero.invoices.updateMultiple(updateRequestBody);
	});

	function collectInvoicesToArchive(response: InvoicesResponse) {
		invoiceIdsToArchive = invoiceIdsToArchive.concat(response.Invoices.map((invoice) => invoice.InvoiceID));
	}

	async function invoiceIdThatExists() {
		const getResponse = await xero.invoices.get();
		if (getResponse.Invoices.length > 0) {
			return getResponse.Invoices[0].InvoiceID;
		} else {
			const createResponse = await xero.invoices.create(createSingleInvoiceRequest);
			return createResponse.Invoices[0].InvoiceID;
		}
	}
});
