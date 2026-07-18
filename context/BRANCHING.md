# Branching Strategy

## Overview

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production-ready code | Production |
| `develop` | Staging/preview | Staging |
| `feature/*` | New features | None |
| `fix/*` | Bug fixes | None |

## Initial Setup

```bash
# Create develop branch
git checkout -b develop
git push -u origin develop
```

## Daily Workflow

### Start a Feature

```bash
git checkout develop
git checkout -b feature/add-auth
```

### Work on Feature

```bash
git add .
git commit -m "Add authentication"
git push -u origin feature/add-auth
```

### Create Pull Request

1. Push feature branch to remote
2. Create PR targeting `develop`
3. CI runs tests automatically
4. Merge PR → deploys to **staging**

### Promote to Production

1. Create PR from `develop` to `main`
2. CI runs tests automatically
3. Merge PR → deploys to **production**

## Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `chore/description` - Maintenance tasks
- `docs/description` - Documentation updates

## Commands Reference

```bash
# List branches
git branch -a

# Switch to branch
git checkout develop

# Delete local branch
git branch -d feature/old-feature

# Delete remote branch
git push origin --delete feature/old-feature

# Update develop from main
git checkout develop
git merge main
```
