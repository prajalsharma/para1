---
active: true
iteration: 2
max_iterations: 40
completion_promise: "COMPLETE"
started_at: "2026-02-16T23:12:10Z"
---

You are starting with NO prior context.

You must fully understand the project from the repository itself.
Do NOT assume any previous instructions.

--------------------------------------------------
PROJECT SUMMARY (AUTHORITATIVE)
--------------------------------------------------

This app is an allowance-style wallet using Para.

There are TWO user flows:
1) Parent
2) Child

Both flows MUST work.

Para is the wallet provider.
Para enforces permissions server-side.

--------------------------------------------------
CORE REQUIREMENTS
--------------------------------------------------

PARENT FLOW:
- Parent signs in with Para
- Parent creates a wallet
- Parent creates a child wallet using Para APIs
- Parent configures child permissions during setup

CHILD FLOW:
- Child signs in with Para
- Child loads their REAL Para wallet
- Child can open wallet UI (send / receive)
- Child actions are restricted by Para permissions
- Child UI is read-only regarding permissions

--------------------------------------------------
CHILD PERMISSIONS (DISPLAY ONLY)
--------------------------------------------------

Child UI must display EXACTLY:

"You can:
- Transact only on Base
- Send transactions up to  USDC"

REMOVE:
- Any mention of merchants
- Any mention of "permissions are set by Para"
- Any parent-centric copy in child UI

--------------------------------------------------
PERMISSIONS MODEL (STRICT)
--------------------------------------------------

- Permissions are implemented using Para Policies
- Policies are sent to Para during wallet creation
- Enforcement is done by Para backend
- Client-side checks are UX only

NO:
- Mock enforcement
- Hardcoded limits without policy
- Dummy data

--------------------------------------------------
CRITICAL BUG TO FIX (ROOT CAUSE)
--------------------------------------------------

Browser error seen previously:

"@celo/utils/lib/ecies is not available in browser"

This MUST be fixed by:

- Identifying the import chain that brings @celo/utils into the client
- Removing Node-only crypto from ALL browser bundles
- Moving offending code to server-only code
- NOT polyfilling
- NOT suppressing errors
- NOT disabling security

After fix, this error must NOT appear anywhere.

--------------------------------------------------
API & ERROR HANDLING RULES
--------------------------------------------------

- ALL API routes must return valid JSON
- No HTML or plain text responses
- No JSON.parse errors in browser
- Errors must be fixed, not hidden

--------------------------------------------------
REAL DRY-RUN REQUIREMENT
--------------------------------------------------

You MUST perform a real dry run using Para APIs:

- Create a real parent user
- Create a real parent wallet
- Create a real child wallet
- Log in as child
- Open wallet UI
- Sign a real message or transaction
- Attempt a disallowed transaction and confirm Para blocks it

NO mocks.
NO placeholders.
NO fake addresses.

--------------------------------------------------
VERIFICATION (MANDATORY)
--------------------------------------------------

Before finishing, verify ALL:

1) Parent login works locally
2) Parent login works on Vercel
3) Child login works locally
4) Child login works on Vercel
5) Child wallet address is real and unique
6) Child UI shows correct permission copy
7) Para blocks disallowed actions
8) Allowed actions succeed
9) No @celo/utils or Node crypto in browser bundle
10) No white screen
11) No hidden errors
12) No dummy data

--------------------------------------------------
FAIL CONDITIONS
--------------------------------------------------

Do NOT finish if ANY are true:

- Parent flow broken
- Child flow broken
- Permissions incorrect
- Mock data present
- Node-only libs in browser
- Errors hidden instead of fixed

--------------------------------------------------
OUTPUT REQUIREMENTS
--------------------------------------------------

When finished output:

[promise]COMPLETE[/promise]

Then ALSO include:

PARENT FLOW TESTING
- Exact steps to test parent flow

CHILD FLOW TESTING
- Exact steps to test child flow

ROOT CAUSE FIX SUMMARY
- What caused the @celo/utils issue
- Where it was imported
- How it was removed
- How to verify it is gone

--------------------------------------------------
MAX ITERATIONS 40
COMPLETION PROMISE COMPLETE
