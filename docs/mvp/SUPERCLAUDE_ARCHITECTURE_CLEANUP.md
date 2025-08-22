# SuperClaude Command: Architecture Cleanup & Crystallization

## Objective
Ensure our winning iPad-first/Expo Web strategy is properly documented and all conflicting approaches are removed.

## The Winning Strategy to Crystallize

### ✅ What We're Building (KEEP/UPDATE)
1. **One Expo codebase** that runs on:
   - Phone (mechanics doing inspections)
   - iPad (shop managers doing SMS/communications)
   - Web (same iPad UI in browser for desktop use)

2. **SMS with short links** strategy:
   - Never send full content in SMS (expensive)
   - Always send short links (ci.link/xyz) 
   - Links go to beautiful HTML reports on Railway
   - Saves 66% on SMS costs

3. **No separate web dashboard**:
   - Shop managers use iPad app or Expo Web
   - Same UI, same codebase
   - "A little clunky on web is fine"

4. **Simple deployment**:
   - Railway serves API + HTML reports + short links
   - Supabase for database/auth/storage
   - No Vercel, no complex hosting

### ❌ What to REMOVE/SCRUB
1. **Separate Next.js dashboard** (except minimal SMS pages if absolutely needed)
2. **Complex web-specific UI** 
3. **Vercel hosting** references
4. **Sending full estimates in SMS** (always use links)
5. **Mobile-only approach** (must support iPad/Web)
6. **Desktop-first web app** (iPad-first that works on web)
7. **Multiple codebases** approach
8. **Expensive SMS practices** (multi-segment messages)

## Proposed SuperClaude Command

```bash
/sc:analyze @docs/mvp --focus architecture --comprehensive
```

Then:

```bash
/sc:improve @docs/mvp --focus consistency --loop
```

With these specific instructions:

### Task 1: Find and Update All Architecture References
Search for and update all files that mention:
- Web dashboard → Update to "iPad-first Expo app that also runs on web"
- Separate frontend/backend → Update to "unified Expo + Railway"
- SMS content → Update to "SMS with short links"
- Vercel → Remove completely (already done)
- Next.js dashboard → Update to "Expo Web" or remove
- Desktop web app → Update to "iPad-optimized Expo Web"

### Task 2: Ensure Consistency Across These Key Files
1. `FINAL_ARCHITECTURE_IPAD_WEB.md` - This is the source of truth
2. `SMS_COST_OPTIMIZATION.md` - Link strategy is canon
3. `BUILD_ORDER_SIMPLIFIED.md` - Must reflect single codebase
4. `PRAGMATIC_ARCHITECTURE.md` - Update to iPad-first approach
5. `STRIPPED_DOWN_MVP.md` - Ensure it shows Expo Web capability
6. `MODERN_TECH_STACK_2025.md` - Verify Expo Web is mentioned

### Task 3: Create/Update a Single Source of Truth
Create or update: `ARCHITECTURE_FINAL_DECISION.md` that clearly states:
- One Expo codebase (phone + iPad + web)
- SMS always uses short links
- Railway serves everything (API + reports + links)
- Shop managers use iPad app or Expo Web (not separate dashboard)
- Total: ~3,000 lines of code, $25-55/month

### Task 4: Remove Conflicting Information
Find and fix any mentions of:
- Building two separate UIs
- Complex desktop web applications
- Sending full content via SMS
- Using multiple hosting platforms
- Shop manager needing special interface (they use same app with more permissions)

### Task 5: Update Build Order
Ensure `BUILD_ORDER_SIMPLIFIED.md` shows:
- Week 1-4: Core mobile app
- Week 5: Add iPad/Web responsive layouts
- Week 6: SMS with links + HTML reports
- NOT: Separate web dashboard build

## Quality Checks After Running

The documentation should clearly communicate:
1. **One codebase** via Expo (not multiple apps)
2. **iPad-first** design that works on web (not mobile-only or desktop-first)
3. **SMS links** not content (save 66% on costs)
4. **Railway + Supabase** only (no Vercel, no complex hosting)
5. **3,000 lines** of code total (not 12,000)
6. **$25-55/month** operating cost

## Alternative Command Approach

If you prefer a more targeted approach:

```bash
/sc:reconcile @docs/mvp --focus architecture --single-source FINAL_ARCHITECTURE_IPAD_WEB.md --validate
```

This would:
- Use `FINAL_ARCHITECTURE_IPAD_WEB.md` as the source of truth
- Find all conflicts with other docs
- Reconcile differences
- Validate consistency

## What Do You Think?

Should we:
1. Add any specific files to check?
2. Include more specific search/replace patterns?
3. Focus on certain directories more than others?
4. Add validation that our 6-week timeline is consistent?
5. Ensure cost calculations all match ($25-55/month)?

Let me know what enhancements you'd like to add to this command!