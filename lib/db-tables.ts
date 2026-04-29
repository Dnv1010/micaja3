export const TABLES = {
  users:          'users',
  invoices:       'invoices',
  transfers:      'transfers',
  deliveries:     'deliveries',
  expenseReports: 'expense_reports',
  expenses:       'expenses',
  expenseGroups:  'expense_groups',
  botSessions:    'bot_sessions',
} as const;

export type TableKey = keyof typeof TABLES;
