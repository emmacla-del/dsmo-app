/** Whether this account may hold an authenticated session (JWT / login). */
export function canEstablishSession(user: {
  role: string;
  status: string;
  isActive: boolean;
}): boolean {
  if (!user.isActive || user.status === 'REJECTED') return false;
  if (user.status === 'ACTIVE') return true;
  return (
    user.role === 'COMPANY' &&
    (user.status === 'PENDING_APPROVAL' || user.status === 'COMPLEMENTS_REQUESTED')
  );
}
