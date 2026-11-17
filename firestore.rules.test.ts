// Phase 0 Security Rules Verification Reference (Dirty Dozen Payloads)
// Designed for @firebase/rules-unit-testing against firestore.rules

export const dirtyDozenPayloads = [
  { name: 'Unauthenticated item read', path: 'workspaces/ws1/items/item1', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified email workspace create', path: 'workspaces/ws1', emailVerified: false, expected: 'PERMISSION_DENIED' },
  { name: 'PII leak on users/{uid}', actor: 'userB', path: 'users/userA', expected: 'PERMISSION_DENIED' },
  { name: 'Blanket list on workspaceInvites', actor: 'userC', path: 'workspaceInvites', expected: 'PERMISSION_DENIED' },
  { name: 'Shadow field isAdmin on item', payload: { isAdmin: true }, expected: 'PERMISSION_DENIED' },
  { name: 'Identity spoofing createdByUid', payload: { createdByUid: 'userB' }, expected: 'PERMISSION_DENIED' },
  { name: 'Self-join workspace without invite', path: 'workspaces/ws1/members/userC', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-workspace notification spam', path: 'users/userA/notifications/n1', expected: 'PERMISSION_DENIED' },
  { name: 'Path ID poisoning (>128 chars)', path: `workspaces/${'a'.repeat(200)}`, expected: 'PERMISSION_DENIED' },
  { name: 'Temporal forgery createdAt != request.time', payload: { createdAt: '2020-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED' },
  { name: 'Immutable createdByUid mutation on update', payload: { createdByUid: 'userB' }, expected: 'PERMISSION_DENIED' },
  { name: 'Array exhaustion checklist > 20', payload: { checklist: new Array(25).fill({ id: '1', text: 'x', done: false }) }, expected: 'PERMISSION_DENIED' }
];
