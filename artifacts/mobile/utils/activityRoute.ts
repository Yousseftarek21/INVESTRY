// Where a tap on an activity entry goes — the same for the push itself
// (useNotificationTapRouting) and its row in Notification History.
// entityId is the id the entry was logged with: a loan for loan_*, a unit
// for rental_unit_added / lease_added.
export function activityRoute(type: string, entityId?: string | null): string | { pathname: string; params: Record<string, string> } {
  switch (type) {
    case 'cash_added':
    case 'cash_edited':
      return '/cash-accounts';
    case 'holding_added':
    case 'holding_edited':
      return '/(tabs)/holdings';
    case 'holding_sold':
      return '/sold-holdings';
    case 'income_added':
    case 'income_edited':
    case 'income_collected':
      return '/recurring-income';
    case 'rental_unit_added':
    case 'lease_added':
      return entityId ? { pathname: '/rental-unit', params: { unitId: entityId } } : '/rentals';
    case 'rental_added':
    case 'rental_edited':
      return '/rentals';
    case 'loan_added':
    case 'loan_payment':
    case 'loan_paid_off':
      return entityId ? { pathname: '/loan-detail', params: { loanId: entityId } } : '/loans';
    case 'dividend_added':
      return '/dividends';
    default:
      return '/notifications';
  }
}
