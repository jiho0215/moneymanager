import { createHash } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = {
  request_id?: string;
  family_id_hash?: string;
  actor_role?: 'kid' | 'guardian' | 'anon' | 'system';
  action?: string;
  account_id?: string;
  week_num?: number;
  amount?: number;
  success?: boolean;
  error_code?: string;
  problem_id?: string;
  answer_correct?: boolean;
  attempt_number_this_week?: number;
  [key: string]: unknown;
};

export function hashFamilyId(familyId: string): string {
  return createHash('sha256').update(familyId).digest('hex').slice(0, 8);
}

function emit(level: LogLevel, message: string, fields: LogFields): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields: LogFields = {}) => emit('debug', message, fields),
  info: (message: string, fields: LogFields = {}) => emit('info', message, fields),
  warn: (message: string, fields: LogFields = {}) => emit('warn', message, fields),
  error: (message: string, fields: LogFields = {}) => emit('error', message, fields),
};

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
