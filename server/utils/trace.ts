import crypto from 'crypto';

export function isTraceEnabled(): boolean {
  const env = process.env.TRACE;
  return env === 'true' || env === '1';
}

export function generateCorrelationId(): string {
  return crypto.randomBytes(2).toString('hex');
}

export function logTrace(correlationId: string, stage: string, details: string) {
  if (!isTraceEnabled()) return;
  const paddedStage = stage.padEnd(12, ' ');
  console.log(`[trace ${correlationId}] ${paddedStage} ${details}`);
}
