/**
 * Turn a failed generation into something true for the reader and something diagnosable in the log.
 *
 * THE RULE HERE IS THAT RETRY ADVICE ONLY APPEARS WHEN RETRYING CAN WORK. The placeholder this
 * replaces said "please regenerate the report" unconditionally. On 2026-08-06 that was printed
 * eleven times against an exhausted credit balance, where regenerating was guaranteed to fail
 * again, and it sent Rory looking for a bug in the generator instead of at the billing page.
 *
 * Telling someone to retry a thing that cannot succeed is worse than saying nothing, because they
 * believe you and spend their time on it.
 */
export function describeGenerationFailure(err: unknown): { log: string; reader: string } {
  const status = typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status?: unknown }).status)
    : undefined;
  const raw = err instanceof Error ? err.message : String(err);

  // Anthropic returns 400 + this phrase when the account is out of credit. It is not a bug, it is
  // not transient, and no amount of regenerating fixes it — so the reader is pointed at the one
  // thing that does.
  if (/credit balance is too low/i.test(raw)) {
    return {
      log: `out of API credit (${status ?? 'no status'})`,
      reader: 'This section needs the AI service, and the account it runs on is out of credit. Top up the API balance and generate the report again — until then every AI section will fail the same way.',
    };
  }
  if (status === 401 || status === 403 || /authentication|api key/i.test(raw)) {
    return {
      log: `auth rejected (${status})`,
      reader: 'This section needs the AI service and the app was not able to sign in to it. This is a configuration problem on our side, not something regenerating will fix.',
    };
  }
  if (status === 429 || /rate.?limit/i.test(raw)) {
    return {
      log: `rate limited (${status})`,
      reader: 'Too many sections were requested at once and the AI service asked us to slow down. Wait a minute and generate the report again, or choose a shorter report.',
    };
  }
  if (status === 529 || status === 503 || /overloaded/i.test(raw)) {
    return {
      log: `upstream overloaded (${status})`,
      reader: 'The AI service was busy when this section was written. Generating the report again usually works.',
    };
  }
  if (/abort|timeout|timed out/i.test(raw)) {
    return {
      log: 'timed out after 240s',
      reader: 'This section took too long to write and was stopped. A shorter report, or fewer sections, will usually finish.',
    };
  }
  return {
    log: `unexpected: ${raw.slice(0, 300)}`,
    reader: 'This section could not be written. The reason has been recorded in the server log; if it happens again the log will say why.',
  };
}
