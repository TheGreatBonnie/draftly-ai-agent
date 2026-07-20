#!/usr/bin/env python3
"""
One-time script to sync Clerk organization and user data into the local DB.
Run with: python -m scripts.sync_clerk_org <clerk_org_id> <org_name> [clerk_user_id]

Example:
    python -m scripts.sync_clerk_org org_abc123 "My Org"
    python -m scripts.sync_clerk_org org_abc123 "My Org" user_def456
"""
import asyncio
import sys

from src.database import close_pool, get_pool, fetch_all, fetch_one, execute


async def main():
    if len(sys.argv) < 3:
        print("Usage: python -m scripts.sync_clerk_org <clerk_org_id> <org_name> [clerk_user_id]")
        sys.exit(1)

    clerk_org_id = sys.argv[1]
    org_name = sys.argv[2]
    clerk_user_id = sys.argv[3] if len(sys.argv) > 3 else None

    await get_pool()

    # 1. Ensure clerk_org_id column exists
    try:
        await execute("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_org_id STRING")
        print("  ✓ clerk_org_id column exists")
    except Exception as e:
        print(f"  ! Could not add column: {e}")

    # 2. Create or update organization
    existing = await fetch_one(
        "SELECT id::text FROM organizations WHERE clerk_org_id = $1",
        clerk_org_id,
    )
    if existing:
        org_id = existing["id"]
        print(f"  ✓ Organization already exists: id={org_id}")
    else:
        existing_by_name = await fetch_one(
            "SELECT id::text FROM organizations WHERE name = $1", org_name,
        )
        if existing_by_name:
            org_id = existing_by_name["id"]
            await execute(
                "UPDATE organizations SET clerk_org_id = $1 WHERE id = $2::uuid",
                clerk_org_id, org_id,
            )
            print(f"  ✓ Updated existing org with clerk_org_id: id={org_id}")
        else:
            row = await fetch_one(
                "INSERT INTO organizations (name, clerk_org_id) VALUES ($1, $2) RETURNING id::text",
                org_name, clerk_org_id,
            )
            org_id = row["id"]
            print(f"  ✓ Created organization: id={org_id}")

    # 3. If clerk_user_id provided, ensure clerk_users table and user record exist
    if clerk_user_id:
        try:
            await execute("""CREATE TABLE IF NOT EXISTS clerk_users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                clerk_user_id STRING NOT NULL UNIQUE,
                email STRING NOT NULL DEFAULT '',
                name STRING NOT NULL DEFAULT 'Unknown',
                avatar_url STRING NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now() ON UPDATE now()
            )""")
            await execute("""CREATE TABLE IF NOT EXISTS user_organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES clerk_users(id) ON DELETE CASCADE,
                org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                role STRING NOT NULL DEFAULT 'org:member',
                created_at TIMESTAMPTZ DEFAULT now(),
                UNIQUE (user_id, org_id)
            )""")
            print("  ✓ Tables exist")
        except Exception as e:
            print(f"  ! Could not create tables: {e}")

        user = await fetch_one(
            "SELECT id::text FROM clerk_users WHERE clerk_user_id = $1",
            clerk_user_id,
        )
        if not user:
            row = await fetch_one(
                "INSERT INTO clerk_users (clerk_user_id, email, name) VALUES ($1, '', 'Admin') RETURNING id::text",
                clerk_user_id,
            )
            user_id = row["id"]
            print(f"  ✓ Created user record: id={user_id}")
        else:
            user_id = user["id"]
            print(f"  ✓ User exists: id={user_id}")

        # Add user to org with admin role
        membership = await fetch_one(
            "SELECT id::text FROM user_organizations WHERE user_id = $1::uuid AND org_id = $2::uuid",
            user_id, org_id,
        )
        if membership:
            await execute(
                "UPDATE user_organizations SET role = 'org:admin' WHERE id = $1::uuid",
                membership["id"],
            )
            print(f"  ✓ Updated membership to admin: user={user_id} org={org_id}")
        else:
            await execute(
                "INSERT INTO user_organizations (user_id, org_id, role) VALUES ($1::uuid, $2::uuid, 'org:admin')",
                user_id, org_id,
            )
            print(f"  ✓ Created admin membership: user={user_id} org={org_id}")

    print("\nDone! Your org is synced. Restart the backend and sign in.")
    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
