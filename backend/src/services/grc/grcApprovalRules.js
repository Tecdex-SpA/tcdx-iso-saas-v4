const APPROVAL_MODES = new Set(['simple', 'sequential', 'parallel', 'quorum', 'unanimous']);
const APPROVAL_DECISIONS = new Set(['pending', 'approved', 'rejected', 'returned', 'reopened']);

function uniqueDecisions(approvals = []) {
  const byReviewer = new Map();
  for (const approval of approvals) {
    const key = approval.assigned_reviewer_id || approval.reviewer_id || approval.acted_by;
    if (key) byReviewer.set(String(key), approval);
  }
  return [...byReviewer.values()];
}

function expectedApprovers(config = {}) {
  const steps = Array.isArray(config.steps) ? config.steps : [];
  const users = Array.isArray(config.user_ids) ? config.user_ids : [];
  return Math.max(Number(config.required_count) || 0, steps.length, users.length, 1);
}

function evaluateApproval({ mode, approvals = [], quorum, config = {} }) {
  if (!APPROVAL_MODES.has(mode)) throw new Error('WORKFLOW_APPROVAL_MODE_INVALID');
  const decisions = uniqueDecisions(approvals);
  const rejected = decisions.find(item => item.decision === 'rejected');
  if (rejected) return { outcome: 'rejected', complete: false, approved: 0, required: 0 };
  const returned = decisions.find(item => item.decision === 'returned');
  if (returned) return { outcome: 'returned', complete: false, approved: 0, required: 0 };

  const approved = decisions.filter(item => item.decision === 'approved');
  const expected = expectedApprovers(config);
  if (mode === 'simple') {
    return { outcome: approved.length >= 1 ? 'approved' : 'pending', complete: approved.length >= 1, approved: approved.length, required: 1 };
  }
  if (mode === 'quorum') {
    const required = Math.max(1, Number(quorum || config.quorum) || 1);
    return { outcome: approved.length >= required ? 'approved' : 'pending', complete: approved.length >= required, approved: approved.length, required };
  }
  if (mode === 'unanimous' || mode === 'parallel') {
    return { outcome: approved.length >= expected ? 'approved' : 'pending', complete: approved.length >= expected, approved: approved.length, required: expected };
  }

  const steps = Array.isArray(config.steps) && config.steps.length
    ? [...config.steps].sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no))
    : Array.from({ length: expected }, (_, index) => ({ sequence_no: index + 1 }));
  let nextSequence = null;
  for (const step of steps) {
    const accepted = approved.some(item => Number(item.sequence_no) === Number(step.sequence_no));
    if (!accepted) {
      nextSequence = Number(step.sequence_no);
      break;
    }
  }
  return {
    outcome: nextSequence === null ? 'approved' : 'pending',
    complete: nextSequence === null,
    approved: approved.length,
    required: steps.length,
    nextSequence,
  };
}

function assertApprovalActor({ mode, config = {}, userId, role, sequenceNo }) {
  if (!APPROVAL_MODES.has(mode)) throw new Error('WORKFLOW_APPROVAL_MODE_INVALID');
  const steps = Array.isArray(config.steps) ? config.steps : [];
  if (mode === 'sequential' && steps.length) {
    const step = steps.find(item => Number(item.sequence_no) === Number(sequenceNo));
    if (!step) throw new Error('WORKFLOW_APPROVAL_SEQUENCE_INVALID');
    if (step.user_id && String(step.user_id) !== String(userId)) throw new Error('WORKFLOW_APPROVER_DENIED');
    if (step.role && String(step.role) !== String(role)) throw new Error('WORKFLOW_APPROVER_DENIED');
  }
  const users = Array.isArray(config.user_ids) ? config.user_ids.map(String) : [];
  const roles = Array.isArray(config.roles) ? config.roles.map(String) : [];
  if (users.length && !users.includes(String(userId))) throw new Error('WORKFLOW_APPROVER_DENIED');
  if (roles.length && !roles.includes(String(role))) throw new Error('WORKFLOW_APPROVER_DENIED');
}

module.exports = {
  APPROVAL_DECISIONS,
  APPROVAL_MODES,
  assertApprovalActor,
  evaluateApproval,
  expectedApprovers,
};
