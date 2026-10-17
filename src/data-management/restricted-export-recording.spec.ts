import { ServiceUnavailableException } from '@nestjs/common';
import { DataManagementController } from './data-management.controller';
import { DataManagementService } from './data-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_MESSAGES } from '../common/i18n/error-messages';

// §21 (8.8 roster 2026-10-15, VT contacts 2026-10-16, fail-closed 2026-10-17):
// every download of the restricted VT files is recorded in the export history
// before the file is streamed, and a download whose record cannot be written
// is refused.
describe('restricted VT exports are recorded on every download, or refused', () => {
    const routes = [
        ['postExportVtRosterCsv', 'ROSTER_CSV', 'streamVtRosterCsv'],
        ['postExportVtRosterSav', 'ROSTER_SAV', 'streamVtRosterSav'],
        ['postExportVtContactCsv', 'CONTACT_CSV', 'streamVtContactCsv'],
        ['postExportVtContactSav', 'CONTACT_SAV', 'streamVtContactSav'],
    ] as const;
    const req = { user: { id: 'u-1', role: 'ADMIN_ONEFOP' } };

    function controllerWith(record: jest.Mock, stream: string, calls: string[]) {
        const service = {
            recordRestrictedExport: record,
            logExport: jest.fn(),
            [stream]: jest.fn(async () => { calls.push('stream'); }),
        };
        return { service, controller: new DataManagementController(service as unknown as DataManagementService) };
    }

    it.each(routes)('%s records %s before streaming', async (handler, format, stream) => {
        const calls: string[] = [];
        const record = jest.fn(async () => { calls.push('record'); });
        const { service, controller } = controllerWith(record, stream, calls);

        await (controller as any)[handler]({ region: 'Littoral' }, {} as any, req);

        expect(record).toHaveBeenCalledWith('u-1', format, {
            filters: { region: 'Littoral', entityType: 'VOCATIONAL_TRAINING' },
        });
        expect(calls).toEqual(['record', 'stream']);
        // The best-effort logger is not what guards these files.
        expect(service.logExport).not.toHaveBeenCalled();
    });

    it.each(routes)('%s streams nothing when the record cannot be written', async (handler, _format, stream) => {
        const calls: string[] = [];
        const record = jest.fn().mockRejectedValue(new ServiceUnavailableException('x'));
        const { service, controller } = controllerWith(record, stream, calls);

        await expect((controller as any)[handler]({}, {} as any, req)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect((service as any)[stream]).not.toHaveBeenCalled();
    });

    describe('DataManagementService.recordRestrictedExport', () => {
        function serviceWith(create: jest.Mock) {
            const service = new DataManagementService({ auditLog: { create } } as unknown as PrismaService);
            const error = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
            return { service, error };
        }

        it('writes the export-history row', async () => {
            const create = jest.fn().mockResolvedValue({});
            const { service } = serviceWith(create);

            await service.recordRestrictedExport('u-1', 'CONTACT_SAV', { filters: { region: 'Centre' } });

            expect(create).toHaveBeenCalledWith({
                data: {
                    userId: 'u-1',
                    action: 'DATA_EXPORT',
                    resourceType: 'DIFFUSION',
                    resourceId: 'submissions',
                    details: { format: 'CONTACT_SAV', filters: { region: 'Centre' } },
                },
            });
        });

        it('refuses with 503 and logs when the write fails', async () => {
            const { service, error } = serviceWith(jest.fn().mockRejectedValue(new Error('pool exhausted')));

            await expect(service.recordRestrictedExport('u-1', 'ROSTER_CSV')).rejects.toBeInstanceOf(ServiceUnavailableException);
            expect(error).toHaveBeenCalledWith(expect.stringContaining('Restricted export refused, not recorded (format ROSTER_CSV, user u-1)'));
        });

        it('refuses when the request carries no user, since nothing could be recorded', async () => {
            const create = jest.fn();
            const { service } = serviceWith(create);

            await expect(service.recordRestrictedExport(undefined, 'ROSTER_SAV')).rejects.toBeInstanceOf(ServiceUnavailableException);
            expect(create).not.toHaveBeenCalled();
        });

        it('answers in French or English', async () => {
            const { service } = serviceWith(jest.fn().mockRejectedValue(new Error('down')));
            const thrown = await service.recordRestrictedExport('u-1', 'ROSTER_CSV').catch((e) => e);
            const entry = ERROR_MESSAGES.find((m) => m.fr === thrown.message);
            expect(entry?.en).toBe('The download could not be recorded; try again in a moment.');
        });
    });

    it('other exports keep best-effort logging: a failed write is logged, not thrown', async () => {
        const create = jest.fn().mockRejectedValue(new Error('pool exhausted'));
        const service = new DataManagementService({ auditLog: { create } } as unknown as PrismaService);
        const error = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

        await expect(service.logExport('u-1', 'CSV', {})).resolves.toBeUndefined();
        expect(error).toHaveBeenCalledWith(expect.stringContaining('Export not recorded (format CSV, user u-1)'));
    });
});
