import { CompanyRegistrationFieldsDto } from './register-company.dto';

/**
 * POST /auth/admin/register-company — a staff member registering a declarant
 * on its behalf (a field visit, a phone call, a walk-in at the delegation).
 *
 * Phase 2 of docs/plans/territorial-admin-monitoring.md. The body is the
 * public registration body minus `password`: the server generates a temporary
 * password and returns it to the acting admin once, the same way
 * adminCreateMinefopUser does. Nothing here carries the registration method or
 * the attributing admin — both are taken from the authenticated actor, never
 * from the request, so a caller cannot claim a method or an author it does not
 * have (DECISION 1 resolves the method to the single value 'ASSISTED').
 */
export class AssistedRegistrationDto extends CompanyRegistrationFieldsDto {}
