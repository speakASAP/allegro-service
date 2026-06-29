export type ScriptMode = 'audit' | 'dry-run' | 'apply';

export type ScriptSafetyOptions = {
  taskId?: string;
  mode: ScriptMode;
  mutates: boolean;
  mutatesLocalAllegroProjection?: boolean;
  mutatesCatalog?: boolean;
  mutatesWarehouse?: boolean;
  mutatesOrders?: boolean;
  mutatesAllegro?: boolean;
  mutatesBizBox?: boolean;
  forwardsOrders?: boolean;
  writesAllowed?: string[];
  writesForbidden?: string[];
  confirmation?: {
    flag: string;
    expected?: string;
    satisfied: boolean;
  };
};

export function buildScriptSafety(options: ScriptSafetyOptions): Record<string, unknown> {
  return {
    taskId: options.taskId || 'TASK-010',
    mode: options.mode,
    mutates: options.mutates,
    mutatesLocalAllegroProjection: Boolean(options.mutatesLocalAllegroProjection),
    mutatesCatalog: Boolean(options.mutatesCatalog),
    mutatesWarehouse: Boolean(options.mutatesWarehouse),
    mutatesOrders: Boolean(options.mutatesOrders),
    mutatesAllegro: Boolean(options.mutatesAllegro),
    mutatesBizBox: Boolean(options.mutatesBizBox),
    forwardsOrders: Boolean(options.forwardsOrders),
    writesAllowed: options.writesAllowed || [],
    writesForbidden: options.writesForbidden || [],
    confirmation: options.confirmation || null,
  };
}

export function requireBooleanConfirmation(satisfied: boolean, message: string): void {
  if (!satisfied) throw new Error(message);
}

export function requireExactConfirmation(received: string | undefined, expected: string, flag: string): void {
  if (received !== expected) {
    throw new Error(`Refusing to apply without ${flag} ${expected}. Run dry-run first and record owner approval before applying.`);
  }
}

export function redactedError(error: unknown): Record<string, unknown> {
  const anyError = error as any;
  return {
    status: 'error',
    message: anyError?.message || String(error),
    httpStatus: anyError?.status || null,
  };
}
