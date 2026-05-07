export const TABLES = {
  users:          'users',
  invoices:       'invoices',
  transfers:      'transfers',
  expenseReports: 'expense_reports',
  expenses:       'expenses',
  expenseGroups:  'expense_groups',
  botSessions:    'bot_sessions',
} as const;

export type TableKey = keyof typeof TABLES;
