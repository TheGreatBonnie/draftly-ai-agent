# GitHub Integration

Draftly connects to your GitHub repositories via a GitHub App to trigger documentation generation from issues and monitor discussions. This guide covers installation, linking, and the review workflow.

## Installing the GitHub App

1. Go to **Settings** in the Draftly dashboard
2. Scroll to the **GitHub Integration** section
3. Click **Install GitHub App** — this opens GitHub's installation flow
4. Select the organization or personal account to install to
5. Choose which repositories to give Draftly access to
6. Authorize the installation
7. You'll be redirected back to Draftly with GitHub connected

### Required Permissions

The GitHub App requests these permissions:

| Permission | Access | Purpose |
|------------|--------|---------|
| Contents | Read | Access repository files for context |
| Issues | Read & Write | Create and update issues |
| Pull Requests | Read | Monitor PRs for documentation triggers |
| Metadata | Read | Access repository information |

### Authentication

Draftly uses two authentication methods:

- **GitHub App JWT** — For webhook verification and installation token generation
- **Personal Access Token (PAT)** — For direct API calls (comments, issue updates)

## Linking Repositories

After installing the GitHub App:

1. Go to **Settings** → **GitHub Integration**
2. You'll see a list of connected organizations/accounts
3. Each shows the number of linked repositories
4. Draftly automatically monitors repositories where the app is installed

### Issue-Triggered Pipelines

Draftly can generate documentation from GitHub issues:

1. Create an issue with a support question or documentation request
2. Add a label or comment mentioning Draftly
3. Draftly picks up the issue and starts the documentation pipeline
4. The generated doc is linked back to the issue

## Reviewing via Dashboard

GitHub-triggered documentation appears in the Draftly dashboard:

1. Go to **Dashboard** to see pending reviews
2. Click **Review** on any card to see the full document
3. Approve, request changes, or reject
4. Approved docs can be posted back as issue comments

## Webhook Verification

Draftly verifies all incoming webhooks using HMAC-SHA256 signatures:

- Slack webhooks: verified via signing secret
- GitHub webhooks: verified via HMAC-SHA256
- Clerk webhooks: verified via Svix

This ensures only legitimate events trigger documentation pipelines.

## Troubleshooting

### App not showing in repository settings

- Verify the GitHub App is installed in your organization
- Check that you selected the correct repositories during installation
- Re-install the app if needed (Settings → GitHub Integration → Reinstall)

### Issues not triggering pipelines

- Ensure the issue has the correct label or Draftly mention
- Check that the GitHub App has Issues permission
- Verify webhook delivery in GitHub Settings → Webhooks

### Documentation quality is low

- Add more context to the issue description
- Link related issues or PRs for additional context
- Improve your Knowledge Base with relevant documentation
