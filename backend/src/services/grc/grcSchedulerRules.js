function retryBackoffSeconds(attempt, baseSeconds = 30, maxSeconds = 3600) {
  const safeAttempt = Math.max(1, Number(attempt) || 1);
  return Math.min(maxSeconds, baseSeconds * (2 ** (safeAttempt - 1)));
}

function schedulerWindow(date = new Date(), minutes = 5) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) throw new Error('GRC_SCHEDULER_DATE_INVALID');
  const size = Math.max(1, Number(minutes) || 5);
  value.setUTCSeconds(0, 0);
  value.setUTCMinutes(Math.floor(value.getUTCMinutes() / size) * size);
  return value.toISOString();
}

function escalationStages({ dueAt, now = new Date(), policy, status }) {
  if (['resolved', 'completed', 'approved', 'verified', 'closed'].includes(String(status || '').toLowerCase())) return ['resolved'];
  if (['cancelled', 'canceled', 'superseded', 'archived'].includes(String(status || '').toLowerCase())) return ['cancelled'];
  const due = new Date(dueAt);
  const current = new Date(now);
  if (Number.isNaN(due.getTime()) || Number.isNaN(current.getTime())) return [];
  const hours = (current.getTime() - due.getTime()) / 3_600_000;
  const stages = [];
  if (hours >= -Number(policy.prior_notice_hours || 0)) stages.push('prior_notice');
  if (hours >= 0) stages.push('overdue');
  if (hours >= Number(policy.first_escalation_hours || 0)) stages.push('escalation_1');
  if (hours >= Number(policy.second_escalation_hours || 0)) stages.push('escalation_2');
  return stages;
}

function occurrenceKey(scheduleId, dueAt) {
  return `${scheduleId}:${new Date(dueAt).toISOString()}`;
}

module.exports = { escalationStages, occurrenceKey, retryBackoffSeconds, schedulerWindow };
