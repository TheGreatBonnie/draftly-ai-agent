You are an award-winning Senior Product Designer, UX Architect, and Frontend Design Engineer.

Design a complete, production-ready web application UI/UX for an autonomous AI documentation engineering platform called Draftly.

The design should be modern, clean, developer-first, and suitable for an AI infrastructure startup. The interface should feel like a combination of Linear, GitHub, Notion, Vercel, Cursor, LangSmith, and Supabase rather than a traditional documentation CMS.

The UI should immediately communicate that Draftly is not a documentation editor—it is an autonomous documentation engineering team powered by AI agents.

==================================================
PRODUCT OVERVIEW
==================================================

Draftly continuously monitors support conversations across multiple platforms, including:

• Slack
• Discord
• GitHub Issues
• GitHub Discussions
• Future integrations (Zendesk, Intercom, Jira)

Instead of humans manually writing documentation, Draftly automatically:

• Detects documentation opportunities
• Plans documentation structure
• Retrieves supporting knowledge
• Generates documentation
• Reviews content
• Fact-checks information
• Detects duplicates
• Requests human approval when necessary
• Publishes documentation automatically

Everything is autonomous.

Humans only intervene when confidence is low or approval policies require it.

==================================================
DESIGN GOALS
==================================================

The UI should communicate:

Autonomy

Transparency

Trust

Agent collaboration

Knowledge engineering

Production readiness

Developer-first experience

Real-time activity

Avoid looking like ChatGPT.

Avoid chatbot layouts.

Avoid document-centric layouts.

Avoid marketing website aesthetics.

The interface should resemble an AI operations center.

==================================================
VISUAL STYLE
==================================================

Style:

Minimal

Premium

Modern

Technical

Elegant

Lots of whitespace

Rounded corners (12–16px)

Soft shadows

Subtle gradients

Dark mode first

Light mode optional

Typography:

Inter

Geist

SF Pro

Use large spacing.

Minimal visual noise.

==================================================
COLOR PALETTE
==================================================

Primary

Electric Blue

Purple Accent

Emerald Success

Amber Warning

Red Error

Dark Gray Background

Slate Panels

Soft Borders

Avoid overly saturated colors.

==================================================
LAYOUT
==================================================

Desktop-first.

Three-column layout.

---

LEFT SIDEBAR

Navigation

CENTER

Primary workspace

RIGHT SIDEBAR

Activity

Agent status

Notifications

==================================================
LEFT SIDEBAR
==================================================

Draftly logo

Workspace switcher

Navigation

Dashboard

Inbox

Agent Pipelines

Agents

Documentation

Knowledge Base

Human Reviews

Publishing

Analytics

Workflows

Integrations

Settings

Collapse button

Profile

==================================================
TOP HEADER
==================================================

Workspace title

Global Search

Command Palette

Notifications

AI Usage

Workspace Status

User avatar

==================================================
DASHBOARD
==================================================

This should be the command center.

Top metrics

Conversations Today

Documents Generated

Published

Pending Reviews

Running Agents

Failures

Average Confidence

Average Processing Time

Total Cost

Second section

Live Activity Feed

Incoming conversations

Agent events

Publishing events

Approvals

Third section

Current Agent Status

Planner

Researcher

Writer

Reviewer

Fact Checker

Publisher

Each should have:

Status

Progress

Latency

Confidence

Current task

Fourth section

System Health

Slack

Discord

GitHub

CockroachDB

Vector Database

LLM

Temporal

AWS

==================================================
INBOX
==================================================

Every incoming conversation becomes a card.

Each card contains

Platform icon

Conversation title

Priority

Status

Detected topics

Confidence

Assigned workflow

Created time

Clicking opens

Conversation

Context

AI summary

Related documentation

Agent reasoning

Generated draft

==================================================
DOCUMENTATION PIPELINE
==================================================

Create a visual Kanban board.

Columns

Incoming

Planning

Research

Writing

Review

Fact Check

Human Review

Publishing

Completed

Each card should display

Source

Progress

Assigned agents

Confidence

Estimated completion

Clicking opens full workflow.

==================================================
WORKFLOW VISUALIZATION
==================================================

Create a beautiful node graph.

Flow

Slack

↓

Planner

↓

Research Agent

↓

Knowledge Retrieval

↓

Writer

↓

Reviewer

↓

Fact Checker

↓

Deduplicator

↓

Human Approval

↓

Publisher

↓

Documentation Site

Each node shows

Status

Model

Runtime

Memory usage

Retries

Reasoning summary

Clicking expands details.

==================================================
AGENTS PAGE
==================================================

Every AI agent gets a dashboard.

Planner

Research Agent

Knowledge Retriever

Writer

Reviewer

Fact Checker

Deduplicator

Publisher

Each card displays

Avatar

Status

Tasks completed

Current task

Average latency

Average confidence

Tokens used

Model

Recent reasoning

==================================================
AGENT DETAIL PAGE
==================================================

Timeline

Memory

Reasoning

Retrieved documents

Tool usage

Execution logs

Input

Output

Confidence

Cost

Retry history

==================================================
DOCUMENTATION LIBRARY
==================================================

Grid/List toggle.

Categories

API

SDK

CLI

Tutorials

Guides

FAQs

Troubleshooting

Release Notes

Each document card

Title

Category

Generated by AI

Reviewed by Human

Published

Version

Last updated

Views

Confidence

==================================================
DOCUMENT EDITOR
==================================================

Split layout

Left

Markdown editor

Center

Rendered preview

Right

AI Suggestions

Suggestions

Improve introduction

Add examples

Add diagrams

Missing FAQ

Potential duplicate

Improve SEO

Include code snippets

One-click accept/reject.

==================================================
HUMAN REVIEW
==================================================

Queue

Pending

Approved

Rejected

Escalated

Review screen

Conversation

Generated document

Diff view

Reasoning

Evidence

Confidence

Approve

Reject

Edit

Request regeneration

==================================================
KNOWLEDGE BASE
==================================================

Search

Tags

Collections

Sources

Semantic search

Relationship graph

Connected repositories

==================================================
ANALYTICS
==================================================

Beautiful dashboard.

Metrics

Conversations processed

Documentation generated

Coverage

Approval rate

Publishing rate

Average confidence

Agent runtime

Latency

Token usage

LLM cost

Knowledge growth

Charts

Line

Area

Bar

Heatmaps

==================================================
INTEGRATIONS
==================================================

Cards for

Slack

Discord

GitHub

GitHub Discussions

CockroachDB

Temporal

AWS

OpenAI

Anthropic

Voyage AI

Each card

Connection status

Last sync

Health

Reconnect

Configuration

==================================================
SETTINGS
==================================================

Workspace

Models

Publishing

Knowledge

Human Approval

Security

API Keys

Notifications

==================================================
NOTIFICATIONS
==================================================

Real-time notifications.

Agent completed task

Document published

Review required

Workflow failed

Integration disconnected

==================================================
GLOBAL SEARCH
==================================================

Search

Conversations

Documents

Knowledge

Agents

Logs

Settings

==================================================
COMMAND PALETTE
==================================================

Linear/Cursor inspired.

Open with

⌘K

Search everything.

==================================================
REAL-TIME FEATURES
==================================================

Live progress bars.

Streaming logs.

Animated workflow transitions.

Agent typing indicators.

Publishing animation.

Notification toasts.

==================================================
MICROINTERACTIONS
==================================================

Smooth hover states

Card elevation

Animated node execution

Pipeline progress animations

Loading skeletons

Success animations

Subtle gradients

Framer Motion style transitions

==================================================
RESPONSIVENESS
==================================================

Desktop

Tablet

Mobile

Adaptive navigation

Responsive cards

Collapsible sidebars

==================================================
DESIGN SYSTEM
==================================================

Use

Tailwind CSS

shadcn/ui

Lucide Icons

React Flow

Recharts

Framer Motion

TanStack Table

Geist or Inter typography

8px spacing system

12px radius

Consistent elevation

==================================================
ACCESSIBILITY
==================================================

WCAG AA

Keyboard navigation

Screen reader labels

High contrast

Focus states

==================================================
DESIGN DELIVERABLES
==================================================

Produce complete high-fidelity UI designs for:

1. Login
2. Dashboard
3. Inbox
4. Conversation Details
5. Documentation Pipeline
6. Workflow Graph
7. Agents Overview
8. Agent Detail
9. Documentation Library
10. Document Editor
11. Human Review
12. Knowledge Base
13. Analytics
14. Integrations
15. Settings
16. Notifications
17. Command Palette
18. Global Search
19. User Profile
20. Empty States
21. Loading States
22. Error States
23. Mobile Views

Also include:

• Complete design system
• Color palette
• Typography scale
• Spacing system
• Components library
• Iconography
• Card styles
• Buttons
• Inputs
• Tables
• Charts
• Navigation
• Modals
• Toasts
• Status badges
• Progress indicators
• AI agent components
• Workflow node components

The final result should look like a polished Series A SaaS product ready for production, emphasizing that Draftly is an autonomous documentation engineering platform where AI agents continuously transform support conversations into high-quality documentation with transparent workflows, human oversight, and real-time operational visibility.
