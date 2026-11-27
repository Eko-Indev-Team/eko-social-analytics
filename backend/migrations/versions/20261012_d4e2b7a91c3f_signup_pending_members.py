"""signup pending members

Self sign-up (POST /auth/signup) creates memberships in a new "pending" status that an Owner/Admin approves.
Only the CHECK constraint on team_members.status changes.

Revision ID: d4e2b7a91c3f
Revises: 96340c9e5069
Create Date: 2026-10-12 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd4e2b7a91c3f'
down_revision: Union[str, None] = '96340c9e5069'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(op.f('ck_team_members_member_status'), 'team_members', type_='check')
    op.create_check_constraint(op.f('ck_team_members_member_status'), 'team_members', "status IN ('active', 'invited', 'suspended', 'pending')")


def downgrade() -> None:
    # Pending sign-ups have never had access; remove them (and their otherwise unused accounts) before narrowing.
    op.execute("""
        WITH removed AS (DELETE FROM team_members WHERE status = 'pending' RETURNING user_id)
        DELETE FROM users u WHERE u.id IN (SELECT user_id FROM removed WHERE user_id IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = u.id AND m.status <> 'pending')
    """)
    op.drop_constraint(op.f('ck_team_members_member_status'), 'team_members', type_='check')
    op.create_check_constraint(op.f('ck_team_members_member_status'), 'team_members', "status IN ('active', 'invited', 'suspended')")
