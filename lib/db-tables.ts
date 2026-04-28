export const TABLES = {
  users:          'usuarios',
  invoices:       'facturas',
  transfers:      'envios',
  deliveries:     'entregas',
  expenseReports: 'legalizaciones',
  expenses:       'gastos_generales',
  expenseGroups:  'gastos_grupos',
  botSessions:    'sesiones_bot',
} as const;

export type TableKey = keyof typeof TABLES;
