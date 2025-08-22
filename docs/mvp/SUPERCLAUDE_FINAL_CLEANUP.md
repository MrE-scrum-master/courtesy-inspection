# SuperClaude Final Cleanup Command

## Objective
Final sweep to ensure 100% consistency with our locked-in architecture and remove any lingering contradictions.

## The Locked-In Architecture (Reference: ARCHITECTURE_FINAL_DECISION.md)
- **ONE** Expo codebase (phone + iPad + web)
- **ONE** Railway API (no separate services)
- **ONE** Supabase backend
- **SMS with links only** (never full content)
- **6 weeks** timeline
- **$25-55/month** cost
- **~3,000 lines** of code

## Proposed SuperClaude Command

```bash
/sc:reconcile @docs/mvp --single-source ARCHITECTURE_FINAL_DECISION.md --validate --auto-cleanup
```

### Enhanced Version with Specific Targets

```bash
/sc:analyze @docs/mvp --think-hard --comprehensive
```

Then:

```bash
/sc:improve @docs/mvp --focus consistency --validate --loop --iterations 3
```

## Specific Cleanup Tasks

### Task 1: Remove All Legacy References
Search and destroy any mentions of:
- "12 weeks" or "3 months" (should be "6 weeks")
- "$200+/month" or higher costs (should be "$25-55/month")
- "Docker", "Kubernetes", "microservices"
- "complex architecture" or "enterprise-grade"
- "multiple codebases" or "separate applications"
- "full estimate in SMS" or SMS examples over 160 characters
- "VIN decoder API" (we use manual entry)
- "payment processing" in MVP (that's Phase 2)

### Task 2: Validate Consistency
Check that ALL files agree on:
- **Timeline**: 6 weeks (Week 1-2: Foundation, Week 3-4: Core, Week 5: iPad/Web, Week 6: SMS/Launch)
- **Cost**: $25-55/month breakdown (Supabase: $0, Railway: $0-5, SMS: $20-50)
- **Architecture**: Expo + Railway + Supabase ONLY
- **SMS**: Always shows short links (ci.link/xyz format)
- **Code Size**: ~3,000 lines (not 12,000)

### Task 3: Ensure Correct Terminology
Replace throughout:
- "web dashboard" → "Expo Web interface"
- "service advisor" → "shop manager"
- "separate frontend" → "single Expo app"
- "Node.js API" → "minimal Railway API"
- "complex" → "simple" or "straightforward"

### Task 4: Verify Key Files Match
These files MUST be consistent:
1. `ARCHITECTURE_FINAL_DECISION.md` (source of truth)
2. `FINAL_ARCHITECTURE_IPAD_WEB.md` 
3. `SMS_COST_OPTIMIZATION.md`
4. `BUILD_ORDER_SIMPLIFIED.md`
5. `STRIPPED_DOWN_MVP.md`
6. `README.md`

### Task 5: Check for Orphaned Concepts
Remove or update any mentions of:
- Customer portal (customers just get SMS)
- Service history tracking (Phase 2)
- Estimate builder (they paste from AllData)
- Redis caching
- WebSockets/real-time
- Email notifications
- OAuth/social login

### Task 6: Validate Examples
Ensure all code examples show:
- Supabase client usage (not custom auth)
- Short link generation (not full SMS content)
- Simple Express server (not complex architecture)
- Expo components (not separate web components)

## Quality Validation Checklist

After cleanup, run these checks:

```bash
# Search for contradictions
grep -r "12 weeks\|12-week\|3 months" docs/mvp/
grep -r "Docker\|Kubernetes\|microservice" docs/mvp/
grep -r "Vercel\|Next.js dashboard" docs/mvp/
grep -r "\$200\|\$300\|\$400" docs/mvp/  # Should only find old comparisons

# Verify correct patterns
grep -r "6 weeks\|6-week" docs/mvp/ | wc -l  # Should be many
grep -r "ci.link" docs/mvp/ | wc -l  # Should appear in examples
grep -r "Expo Web" docs/mvp/ | wc -l  # Should be consistent
```

## Special Focus Areas

### Files That Often Have Issues:
1. **README.md** - Often has old timeline/cost info
2. **API_SPECIFICATION_MVP.yaml** - May have complex endpoints
3. **DATABASE_SCHEMA_MVP.md** - Might show unnecessary tables
4. **TESTING_STRATEGY_MVP.md** - Could reference wrong architecture
5. **USER_ROLES_AND_PERMISSIONS.md** - May be too complex

### Files That Should Be Perfect (Use as Reference):
1. **ARCHITECTURE_FINAL_DECISION.md** - The law
2. **SMS_COST_OPTIMIZATION.md** - Correct SMS strategy
3. **SHOP_MANAGER_UI_SOLUTION.md** - Correct UI approach
4. **FINAL_ARCHITECTURE_IPAD_WEB.md** - Correct platform strategy

## Enhancement Options to Consider

Would you like to add any of these to the command?

### A. Deep Code Example Validation
```bash
--validate-code-examples --framework expo --pattern minimal
```

### B. Cost Calculation Verification
```bash
--verify-costs --max 55 --breakdown "supabase:0,railway:5,sms:50"
```

### C. Timeline Consistency Check
```bash
--verify-timeline --weeks 6 --phases "foundation:2,core:2,polish:2"
```

### D. Dependency Validation
```bash
--check-dependencies --allowed "expo,supabase,express,telnyx" --forbidden "next,redis,docker"
```

### E. Create Cleanup Report
```bash
--generate-report CLEANUP_REPORT.md --include-diffs
```

## What Would You Like to Add?

1. Should we add specific file priorities?
2. Include automated backup before changes?
3. Add specific regex patterns for better matching?
4. Include a final validation script?
5. Generate a before/after comparison?

Let me know what enhancements you'd like to add to make this cleanup thorough and final!