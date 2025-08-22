# SuperClaude Build-Ready Cleanup Command

## Objective
Prepare documentation and codebase for FLAWLESS first-time implementation. Zero confusion, zero rework, zero debates.

## The Build-Ready Standard
- Every file tells the SAME story
- Every example WORKS as written
- Every decision is FINAL
- Every number MATCHES
- Every timeline is REALISTIC

## Enhanced SuperClaude Command

```bash
/sc:analyze @docs --ultrathink --scope project --focus implementation-readiness
```

Then execute:

```bash
/sc:improve @docs --think-hard --validate --safe-mode --loop --iterations 5 --focus build-ready
```

With these specific enhancements:

## 🎯 ENHANCEMENT 1: Implementation-Ready Documentation

### Task: Create Missing Implementation Files
```bash
/sc:task "Create implementation checklist" --output IMPLEMENTATION_CHECKLIST.md
```

Should contain:
- [ ] Day 1: What to install/setup
- [ ] Day 2-5: Exact order of building
- [ ] Week 1-6: Daily checkpoints
- [ ] Go/No-go decision points
- [ ] Common pitfalls and solutions

### Task: Validate All Code Examples
```bash
/sc:validate @docs/mvp --code-examples --runnable
```

Check that:
- Every code snippet has correct imports
- Package versions match MODERN_TECH_STACK_2025.md
- Supabase client initialization is consistent
- Railway deployment examples work
- SMS examples use actual Telnyx format

## 🎯 ENHANCEMENT 2: Remove ALL Ambiguity

### Task: Eliminate Choice Paralysis
Search and fix:
- "you could..." → "do this:"
- "consider..." → "use:"
- "maybe..." → DELETE
- "alternatively..." → Pick ONE way
- "or" → Choose the winner
- "various options" → ONE option

### Task: Lock Down Stack Versions
```bash
/sc:reconcile --verify-versions --source MODERN_TECH_STACK_2025.md
```

Ensure EVERYWHERE shows:
- Node.js: 24.0.0 (not 22!)
- Expo SDK: 52.0.0
- React Native: 0.75.x
- React: 18.3.x
- TypeScript: 5.5.x
- Supabase JS: 2.45.0

## 🎯 ENHANCEMENT 3: Build Order Precision

### Task: Create Day-by-Day Build Plan
```bash
/sc:task "Generate daily build plan" --output BUILD_DAILY_PLAN.md
```

Structure:
```
Day 1: Setup (2 hours)
- [ ] Create Supabase project (10 min)
- [ ] Create Railway project (5 min)
- [ ] Initialize Expo app (10 min)
- [ ] Test all connections (30 min)

Day 2: Database Schema
- [ ] Run schema.sql in Supabase
- [ ] Test RLS policies
- [ ] Create test data
```

### Task: Remove Conflicting Build Orders
Ensure ONLY ONE build path:
- Remove BUILD_ORDER.md (old 12-week version)
- Keep BUILD_ORDER_SIMPLIFIED.md as BUILD_ORDER_FINAL.md
- Update all references

## 🎯 ENHANCEMENT 4: Code Template Generation

### Task: Create Starter Templates
```bash
/sc:task "Generate starter code templates" --output-dir templates/
```

Create:
```
templates/
├── supabase-schema.sql      # Ready to paste
├── railway-server.js         # Complete server
├── expo-app-config.json      # Correct config
├── env-example               # All needed vars
└── package-files/            # Exact package.jsons
```

## 🎯 ENHANCEMENT 5: Dependency Lock

### Task: Create Forbidden List
```bash
/sc:validate @docs --forbidden-packages "next,redis,docker,kubernetes,vercel,aws-sdk,firebase"
```

If found, REMOVE or replace with:
- next → expo
- redis → none (not needed)
- docker → Railway handles it
- aws-sdk → supabase storage
- firebase → supabase

### Task: Create Allowed List
```bash
/sc:validate @docs --required-packages "expo,@supabase/supabase-js,express"
```

ONLY these packages allowed in examples.

## 🎯 ENHANCEMENT 6: Cost Guard Rails

### Task: Validate ALL Cost References
```bash
/sc:validate @docs --cost-limit 55 --cost-breakdown "supabase:0,railway:5,sms:50"
```

Any mention of costs must:
- Show monthly total ≤ $55
- Include breakdown
- Reference SMS link savings (66%)
- Note "free tier" where applicable

## 🎯 ENHANCEMENT 7: Architecture Diagrams

### Task: Standardize ALL Diagrams
```bash
/sc:reconcile @docs --diagrams --template ARCHITECTURE_FINAL_DECISION.md
```

Every architecture diagram must show:
```
Expo App (Phone/iPad/Web)
    ↓
Railway API (Minimal)
    ↓
Supabase (Everything)
```

Remove diagrams showing:
- Multiple services
- Separate web apps
- Complex flows
- Microservices

## 🎯 ENHANCEMENT 8: Pre-Build Validation Script

### Task: Create Validation Script
```bash
/sc:task "Create pre-build validation" --output scripts/validate-ready.js
```

```javascript
// scripts/validate-ready.js
const checks = [
  'Supabase project exists',
  'Railway project exists',
  'Expo SDK 52 installed',
  'Node 24 installed',
  'All env vars set',
  'Schema.sql ready',
  'No conflicting packages'
];

checks.forEach(check => {
  if (!validate(check)) {
    console.error(`❌ Failed: ${check}`);
    process.exit(1);
  }
});
console.log('✅ Ready to build!');
```

## 🎯 ENHANCEMENT 9: Remove Phase 2 Confusion

### Task: Clearly Mark MVP vs Future
```bash
/sc:improve @docs/mvp --add-headers "<!-- MVP ONLY - DO NOT BUILD YET -->" --pattern "Phase 2|future|eventually|later"
```

Add clear markers:
- 🚀 **MVP**: Build this now
- 📦 **Phase 2**: Ignore until profitable
- ❌ **Never**: Deprecated approach

## 🎯 ENHANCEMENT 10: Success Criteria

### Task: Create Clear Success Metrics
```bash
/sc:task "Define success criteria" --output SUCCESS_METRICS.md
```

Week 1 Success:
- [ ] Auth works
- [ ] Database connected
- [ ] Basic API running

Week 2 Success:
- [ ] Can create inspection
- [ ] Photos upload

[etc...]

## 🔒 FINAL LOCKDOWN

### Task: Make Decisions Immutable
```bash
/sc:task "Lock architecture decisions" --immutable
```

Add to every decision doc:
```markdown
---
STATUS: FINAL - LOCKED
CHANGES: NOT ALLOWED
BUILD: THIS EXACT SPEC
DEBATES: OVER
---
```

## 📊 Validation Report

After cleanup, generate:
```bash
/sc:task "Generate build-readiness report" --output BUILD_READY_REPORT.md
```

Report should confirm:
- [ ] Zero conflicting information
- [ ] All code examples tested
- [ ] All versions specified
- [ ] All costs under $55/month
- [ ] Timeline exactly 6 weeks
- [ ] No "maybe" or "consider"
- [ ] No Phase 2 features in MVP
- [ ] Package.json files ready
- [ ] Schema.sql ready
- [ ] Server.js template ready

## 🚀 The Ultimate Test

Can a developer who has NEVER seen this project:
1. Read ARCHITECTURE_FINAL_DECISION.md
2. Follow BUILD_ORDER_FINAL.md
3. Build the EXACT system we designed
4. In EXACTLY 6 weeks
5. For EXACTLY $25-55/month
6. With ZERO architecture decisions needed

If not, keep cleaning.

## Execute This Command With:
- Maximum depth (--ultrathink)
- Safety mode (--safe-mode)
- Multiple iterations (--loop --iterations 5)
- Full validation (--validate)
- Evidence generation (--generate-report)

The goal: Documentation so clean that building is just typing, not thinking.