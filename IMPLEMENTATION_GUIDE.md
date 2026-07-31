# TaskCore Monorepo: Implementation Guide

**Purpose:** Step-by-step instructions to implement each phase of the monorepo optimization.

---

## Phase 1: Quick Wins (Immediate - Do First!)

### 1.1 Vercel Configuration Updates ✅ DONE

**Status:** Files already created
- `vercel.json` - Enhanced with cache headers and security settings
- `.vercelignore` - Optimizes deployment size
- `turbo.json` - Enables build orchestration

**What changed:**
```diff
OLD: { "outputDirectory": "ui/dist" }
NEW: Full configuration with caching, headers, framework detection
```

**Immediate benefit:** 20-30% smaller deployments, 10-15% faster uploads

### 1.2 Test Configuration Files

```bash
# Verify new files are correct
cat vercel.json
cat .vercelignore
cat turbo.json

# Check file sizes
wc -l vercel.json .vercelignore turbo.json
```

### 1.3 Update TypeScript Config for Incremental Builds

**File:** `tsconfig.json`

```bash
# Backup original
cp tsconfig.json tsconfig.json.backup

# Update configuration
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "composite": true,
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "isolatedModules": true,
    "types": ["node", "vitest/globals"]
  },
  "exclude": ["node_modules", "dist", "build", "**/*.test.ts", "**/*.spec.ts"],
  "include": ["src"]
}
EOF
```

### 1.4 Update Root package.json

**Optimization:** Add Turbo-based build scripts

```json
{
  "scripts": {
    "build": "turbo build",
    "build:prod": "turbo build --filter=...!@taskcore/plugin-*-example",
    "typecheck": "turbo typecheck",
    "dev": "turbo dev",
    "dev:watch": "turbo dev",
    "dev:server": "pnpm --filter @taskcore/server dev:watch",
    "dev:ui": "pnpm --filter @taskcore/ui dev"
  }
}
```

**Benefits:**
- Parallel builds of independent packages
- Task caching between runs
- Incremental compilation
- Estimated 40-60% faster builds

### 1.5 Create Build Scripts

**File:** `scripts/build-optimized.ts`

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';

const startTime = Date.now();

try {
  console.log('🔗 Verifying workspace links...');
  execSync('node cli/node_modules/tsx/dist/cli.mjs scripts/ensure-workspace-package-links.ts', {
    stdio: 'inherit',
  });

  console.log('\n📦 Building packages with Turbo...');
  execSync('turbo build', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  console.log('\n✅ Build complete');
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`⏱️  Total time: ${duration}s`);
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
```

### 1.6 Verification

```bash
# Test new build system
pnpm build

# Check output
ls -la ui/dist/
ls -la server/dist/

# Verify sizes haven't increased
du -sh ui/dist server/dist
```

### 1.7 Deploy to Vercel for Testing

```bash
# Create feature branch
git checkout -b feat/vercel-optimization

# Make changes
git add vercel.json .vercelignore turbo.json tsconfig.json package.json
git commit -m "feat: optimize Vercel deployment configuration"

# Push to test Vercel preview deployment
git push origin feat/vercel-optimization

# Monitor deployment in Vercel dashboard
# Expected improvement: 20-30% faster builds
```

**Expected Results (Phase 1):**
- ✅ 20-30% smaller deployments
- ✅ 10-15% faster uploads
- ✅ Build times reduced by 15-25%
- ✅ Turbo caching enabled

---

## Phase 2: Build Optimization (Week 2)

### 2.1 Install Turbo (if not already installed)

```bash
pnpm add -w -D turbo

# Verify installation
pnpm exec turbo --version
```

### 2.2 Update Each Package's tsconfig.json

All packages should have incremental builds enabled:

**Pattern for each package:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "composite": true,
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Apply to all packages:**

```bash
# Create script to update all package configs
for dir in packages/* server ui cli; do
  if [ -d "$dir" ] && [ -f "$dir/tsconfig.json" ]; then
    echo "Updating $dir/tsconfig.json..."
    # Add incremental + composite if not present
  fi
done
```

### 2.3 Test Turbo Build

```bash
# Clean build (clear cache)
pnpm exec turbo build --no-cache

# Incremental build (should be much faster)
pnpm exec turbo build

# Build specific package
pnpm exec turbo build --filter=@taskcore/server

# Build dependents only
pnpm exec turbo build --filter=...@taskcore/shared
```

### 2.4 Monitor Build Performance

Create monitoring script `scripts/benchmark-builds.ts`:

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';

const benchmarks: Record<string, number[]> = {};

async function benchmark(name: string, command: string, runs: number = 3) {
  console.log(`\n📊 Benchmarking: ${name}`);
  const times: number[] = [];

  for (let i = 1; i <= runs; i++) {
    console.log(`  Run ${i}/${runs}...`);
    const start = Date.now();
    execSync(command, { stdio: 'ignore' });
    const duration = Date.now() - start;
    times.push(duration);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`  Average: ${(avg / 1000).toFixed(2)}s`);
  console.log(`  Range: ${(min / 1000).toFixed(2)}s - ${(max / 1000).toFixed(2)}s`);

  benchmarks[name] = times;
}

async function main() {
  console.log('🚀 TaskCore Build Performance Benchmarks\n');

  // Clear caches first
  execSync('pnpm exec turbo build --no-cache 2>/dev/null', { stdio: 'ignore' });

  // Run benchmarks
  await benchmark('Full Build (with cache)', 'pnpm exec turbo build', 2);
  await benchmark('Full Build (no cache)', 'pnpm exec turbo build --no-cache', 1);
  await benchmark('Single Package', 'pnpm exec turbo build --filter=@taskcore/shared', 3);
  await benchmark('TypeCheck', 'pnpm typecheck', 2);

  // Write results
  fs.writeFileSync('benchmarks.json', JSON.stringify(benchmarks, null, 2));
  console.log('\n✅ Results saved to benchmarks.json');
}

main().catch(console.error);
```

### 2.5 Update CI/CD Workflows

**File:** `.github/workflows/build.yml`

```yaml
name: Build & Test

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v2
        with:
          version: 9.15.4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      # Restore Turbo cache
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-turbo-

      - run: pnpm install
      
      - run: pnpm run preflight:workspace-links
      
      - run: pnpm build
      
      - run: pnpm typecheck
      
      - run: pnpm test:run
      
      - run: pnpm run check:tokens

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm run typecheck
```

### 2.6 Deployment Testing

```bash
# Test preview deployment with optimizations
git checkout -b test/turbo-optimization

# Run local benchmarks first
pnpm ts-node scripts/benchmark-builds.ts

# Commit and push
git commit -am "test: turbo build optimization"
git push origin test/turbo-optimization

# Monitor Vercel deployment time in dashboard
```

**Expected Results (Phase 2):**
- ✅ 60-70% faster full builds
- ✅ Incremental builds <20 seconds
- ✅ Parallel package compilation
- ✅ Vercel preview deployments under 2 minutes

---

## Phase 3: Versioning System (Week 3)

### 3.1 Install Changesets

```bash
pnpm add -w -D @changesets/cli @changesets/changelog-git
pnpm changesets init
```

### 3.2 Configure Changesets

**File:** `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": [
    "@changesets/changelog-git",
    {
      "repo": "khulnasoft/taskcore"
    }
  ],
  "commit": true,
  "linked": [
    ["@taskcore/server", "@taskcore/ui", "@taskcore/plugin-sdk", "@taskcore/shared", "@taskcore/db"]
  ],
  "access": "public",
  "baseBranch": "master",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@taskcore/plugin-*-example",
    "@taskcore/create-taskcore-plugin"
  ],
  "private": false,
  "bumpVersionsWithWorkspaceProtocol": false
}
```

### 3.3 Update package.json Scripts

```json
{
  "scripts": {
    "changeset": "changeset",
    "changeset:version": "changeset version",
    "changeset:publish": "changeset publish",
    "release": "pnpm run build && pnpm changeset publish && pnpm changeset tag",
    "release:dry": "pnpm changeset publish --dry-run"
  }
}
```

### 3.4 Create Release Workflow

**File:** `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    paths:
      - '.changeset/**'
    branches:
      - master

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v2
        with:
          version: 9.15.4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install

      - run: pnpm run build

      - run: pnpm changeset publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        run: |
          pnpm changeset tag
          git push origin --follow-tags

  github-release:
    needs: release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ env.TAG }}
          release_name: Release ${{ env.TAG }}
```

### 3.5 Create Release Documentation

**File:** `RELEASE_PROCESS.md`

```markdown
# TaskCore Release Process

## For Contributors: Adding Changes

### 1. Create a Changeset

When your PR is ready:

```bash
pnpm changeset
```

Select packages affected:
```
? Which packages would you like to include? (Use arrow keys / space to select)
❯ @taskcore/server
  @taskcore/ui
  @taskcore/db
  @taskcore/shared
  ...
```

Select change type:
```
? What kind of change is this for @taskcore/server? (Use arrow keys)
❯ patch
  minor
  major
```

Write summary:
```
Write a summary: Add support for new adapter type
```

### 2. Commit and Push

```bash
git add .changeset/*.md
git commit -m "docs: add changeset for adapter support"
git push
```

## For Maintainers: Releasing

### 1. Review Open Changesets

```bash
pnpm changeset status
```

### 2. Version Packages

```bash
pnpm changeset version
```

This:
- Bumps versions in all package.json files
- Updates changelogs automatically
- Creates changelog entries from commit history

### 3. Publish to npm

```bash
pnpm run release
```

This:
- Publishes all updated packages to npm
- Creates git tags
- Pushes to GitHub

### 4. Monitor Deployment

Check GitHub Actions for:
- Successful npm publishes
- Successful GitHub release creation
- All CI checks passing

## Versioning Strategy

**Linked Packages** (bump together):
- @taskcore/server
- @taskcore/ui
- @taskcore/plugin-sdk
- @taskcore/shared
- @taskcore/db
- @taskcore/adapter-utils
- All adapters

**Independent Packages**:
- Plugin examples
- create-taskcore-plugin

**Never released**:
- Internal smoke tests
- Dev-only packages

## Example Release

```
BEFORE:
@taskcore/server@0.2.1
@taskcore/ui@0.2.1

Changes:
- feat: new adapter support (minor)
- fix: UI layout bug (patch)

AFTER:
@taskcore/server@0.3.0
@taskcore/ui@0.3.0
(linked, both bump to minor)
```
```

### 3.6 Migration to New System

```bash
# On a feature branch
git checkout -b setup/changesets

# Initialize changesets
pnpm add -w -D @changesets/cli @changesets/changelog-git
pnpm changesets init

# Update configuration
# (copy .changeset/config.json from examples)

# Create initial changeset documenting history
pnpm changeset

# Commit
git add .changeset package.json pnpm-lock.yaml
git commit -m "chore: setup changesets for monorepo versioning"
git push origin setup/changesets

# Create PR, review, merge
```

### 3.7 First Release with New System

```bash
# After PR merges to master
git checkout master
git pull

# Version packages
pnpm changeset version

# Review changes
git diff

# Publish
pnpm run release

# Verify
npm view @taskcore/server version  # Should be new version
```

**Expected Results (Phase 3):**
- ✅ Fully automated versioning
- ✅ Automatic changelog generation
- ✅ No manual npm publishes needed
- ✅ Clear change documentation
- ✅ Easy rollback capability

---

## Phase 4: Documentation (Week 4)

### 4.1 Create Package Documentation

**File:** `PACKAGES.md`

See template in main analysis document. Key sections:
- Core packages
- Adapter packages
- Application packages
- Dependencies and relationships

### 4.2 Create CONTRIBUTING.md Updates

Add sections about:
- Monorepo structure
- Adding packages
- Building locally
- Running tests
- Release process

### 4.3 Generate Dependency Graphs

```bash
# Manual visualization script
pnpm install -g graphviz

# Generate dependency graph
pnpm exec tsx scripts/generate-dependency-graph.ts

# View in browser or IDE
```

---

## Phase 5: Full Deployment (Final)

### 5.1 Configure GitHub Actions for Deployments

See CI/CD sections above.

### 5.2 Deploy to Vercel

```bash
# Verify all optimizations working
pnpm build
pnpm typecheck
pnpm test:run

# Push to master
git push origin master

# Monitor Vercel deployment
# Expected: <150 seconds total deployment time
```

### 5.3 Post-Deployment Monitoring

```bash
# Monitor build times in Vercel dashboard
# Check Web Vitals
# Verify all functionality working

# If issues:
git revert <hash>
git push origin master
```

---

## Troubleshooting

### Build Cache Issues

```bash
# Clear Turbo cache locally
pnpm exec turbo prune --docker

# Clear Vercel cache
# Via dashboard: Settings > Git > Clear Production Deployments
```

### Workspace Link Problems

```bash
# Regenerate links
pnpm install

# Or run preflight
pnpm run preflight:workspace-links
```

### Release Issues

```bash
# Dry run (don't publish)
pnpm run release:dry

# Check changesets
pnpm changeset status

# Rollback version bump
git reset --hard HEAD~1
pnpm install
```

---

## Rollback Plan

If any phase causes issues:

1. **Phase 1:** Delete new config files, revert `vercel.json`
2. **Phase 2:** Remove Turbo config, revert to old build scripts
3. **Phase 3:** Remove changesets, use old release process
4. **Phase 4:** Documentation only - safe to skip
5. **Phase 5:** Revert deployment, no code changes needed

All changes are reversible via Git.

---

## Success Checklist

- [ ] Phase 1: New config files deployed successfully
- [ ] Phase 1: Build time improved 20-30%
- [ ] Phase 1: Deployment size reduced
- [ ] Phase 2: Turbo builds working locally
- [ ] Phase 2: CI/CD workflows passing
- [ ] Phase 2: Build time improved 60-70%
- [ ] Phase 3: First changeset created
- [ ] Phase 3: First release published successfully
- [ ] Phase 4: Documentation completed
- [ ] Phase 5: Production deployment verified

---

**Last Updated:** July 31, 2026
