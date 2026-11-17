# Security Specification — Hamahangi (هماهنگی)

## 1. Data Invariants
1. User PII (`users/{userId}`) is strictly owner-only; no blanket reads or collection listing allowed.
2. A `WorkspaceMember` document can only be created by the workspace creator (`inviteId == 'creator'` with atomic `existsAfter` check on the workspace) or by an authenticated user whose verified email matches a `pending` `WorkspaceInvite` for that workspace.
3. A `UserMembership` document can only be created atomically alongside a `workspaces/{workspaceId}/members/{userId}` document (`existsAfter`).
4. All `WorkspaceItem` documents (meetings, tasks, events) live under `workspaces/{workspaceId}/items/{itemId}` and require verified membership in `workspaces/{workspaceId}/members/{request.auth.uid}`.
5. `UserNotification` documents can only be created by the user themselves or by another current member of the same `workspaceId` (`exists` check on both sender and target member documents).
6. All `createdAt` and `updatedAt` timestamps must equal `request.time`. All IDs match `^[a-zA-Z0-9_\-]+$` and are `<= 128` characters.
7. Immutable ownership/audit fields (`uid`, `ownerUid`, `workspaceId`, `createdByUid`, `createdAt`) cannot be modified on update.

## 2. Dirty Dozen Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write** on `/workspaces/ws1/items/item1`.
2. **Unverified email write** (`email_verified: false`) creating a workspace.
3. **PII Leak**: User B reading `/users/userA`.
4. **Blanket Invite Scraping**: User C listing `/workspaceInvites` without filtering by `invitedEmail == userC.email`.
5. **Ghost Field / Shadow Update**: Member adding `{ isAdmin: true }` on `WorkspaceItem` create or update.
6. **Identity Spoofing**: User A creating a `WorkspaceItem` with `createdByUid: "userB"`.
7. **Self-Joining Without Invite**: User C creating `/workspaces/ws1/members/userC` with a fabricated `inviteId`.
8. **Cross-Workspace Notification Spam**: Non-member User C writing to `/users/userA/notifications/notif1`.
9. **Path ID Poisoning**: Creating a document with 300-character ID or invalid characters (`../hack`).
10. **Temporal Forgery**: Creating a `Workspace` with a backdated client timestamp (`createdAt != request.time`).
11. **Terminal State Bypass**: Rewriting immutable `createdByUid` or `workspaceId` on `WorkspaceItem` update.
12. **Array Exhaustion**: Sending `checklist` or `confirmedUids` with > 20 / > 25 entries.
