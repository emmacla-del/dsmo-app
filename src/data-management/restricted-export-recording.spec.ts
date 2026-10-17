import { DataManagementController } from './data-management.controller';
import { DataManagementService } from './data-management.service';
import { PrismaService } from '../prisma/prisma.service';

// §21 (2026-10-15 roster, 2026-10-16 contacts): every download of the
// restricted VT files is recorded in the export history, before the file is
// streamed. These pin that for the four download routes.
describe('restricted VT exports are recorded on every download', () => {
    const routes = [
        ['postExportVtRosterCsv', 'ROSTER_CSV', 'streamVtRosterCsv'],
        ['postExportVtRosterSav', 'ROSTER_SAV', 'streamVtRosterSav'],
        ['postExportVtContactCsv', 'CONTACT_CSV', 'streamVtContactCsv'],
        ['postExportVtContactSav', 'CONTACT_SAV', 'streamVtContactSav'],
    ] as const;

    it.each(routes)('%s records %s before streaming', async (handler, format, stream) => {
        const calls: string[] = [];
        const service = {
            logExport: jest.fn(() => { calls.push('log'); return Promise.resolve(); }),
            [stream]: jest.fn(async () => { calls.push('stream'); }),
        };
        const controller = new DataManagementController(service as unknown as DataManagementService);
        const req = { user: { id: 'u-1', role: 'ADMIN_ONEFOP' } };

        await (controller as any)[handler]({ region: 'Littoral' }, {} as any, req);

        expect(service.logExport).toHaveBeenCalledWith('u-1', format, {
            filters: { region: 'Littoral', entityType: 'VOCATIONAL_TRAINING' },
        });
        expect(calls).toEqual(['log', 'stream']);
    });

    it('logs an error when the record cannot be written, and does not throw', async () => {
        const create = jest.fn().mockRejectedValue(new Error('pool exhausted'));
        const service = new DataManagementService({ auditLog: { create } } as unknown as PrismaService, {} as any, {} as any);
        const error = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

        await expect(service.logExport('u-1', 'ROSTER_CSV', {})).resolves.toBeUndefined();

        expect(error).toHaveBeenCalledWith(expect.stringContaining('Export not recorded (format ROSTER_CSV, user u-1)'));
    });
});
