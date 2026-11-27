"""ads module

Ads module (AdMarketer port): Meta ads, lead-form leads (PII), creatives + pictures, creative labels, campaign
optimisation, website signups (PII), reference datasets, sync runs and Ad Studio drafts (all workspace-owned), plus
the lead-qualification columns (rules of 2026-11-18) on ads_leads and on the existing leads table (nullable).

Revision ID: a7d5e3c1b9f4
Revises: d4e2b7a91c3f
Create Date: 2026-11-18 12:20:18.372403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a7d5e3c1b9f4'
down_revision: Union[str, None] = 'd4e2b7a91c3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('ads_creative_images',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('ad_id', sa.String(length=64), nullable=False),
    sa.Column('content_type', sa.String(length=32), nullable=False),
    sa.Column('byte_size', sa.Integer(), nullable=False),
    sa.Column('is_full', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_creative_images_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_creative_images')),
    sa.UniqueConstraint('workspace_id', 'ad_id', name=op.f('uq_ads_creative_images_workspace_id_ad_id'))
    )
    op.create_index(op.f('ix_ads_creative_images_workspace_id'), 'ads_creative_images', ['workspace_id'], unique=False)
    op.create_table('ads_creative_labels',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('image_hash', sa.String(length=128), nullable=False),
    sa.Column('image_type', sa.Text(), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_creative_labels_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_creative_labels')),
    sa.UniqueConstraint('workspace_id', 'image_hash', name=op.f('uq_ads_creative_labels_workspace_id_image_hash'))
    )
    op.create_index(op.f('ix_ads_creative_labels_workspace_id'), 'ads_creative_labels', ['workspace_id'], unique=False)
    op.create_table('ads_creatives',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('ad_id', sa.String(length=64), nullable=False),
    sa.Column('campaign_id', sa.String(length=64), nullable=True),
    sa.Column('account_name', sa.String(length=300), nullable=True),
    sa.Column('built', sa.String(length=10), nullable=True),
    sa.Column('type', sa.String(length=16), server_default='unknown', nullable=False),
    sa.Column('primary_text', sa.Text(), server_default='', nullable=False),
    sa.Column('headline', sa.Text(), server_default='', nullable=False),
    sa.Column('description', sa.Text(), server_default='', nullable=False),
    sa.Column('cta', sa.String(length=64), server_default='', nullable=False),
    sa.Column('image_hash', sa.String(length=128), server_default='', nullable=False),
    sa.Column('image_full', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_creatives_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_creatives')),
    sa.UniqueConstraint('workspace_id', 'ad_id', name=op.f('uq_ads_creatives_workspace_id_ad_id'))
    )
    op.create_index(op.f('ix_ads_creatives_workspace_id'), 'ads_creatives', ['workspace_id'], unique=False)
    op.create_table('ads_leads',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('meta_lead_id', sa.String(length=64), nullable=False),
    sa.Column('ad_id', sa.String(length=64), nullable=True),
    sa.Column('form_id', sa.String(length=64), nullable=True),
    sa.Column('created_time', sa.String(length=40), nullable=True),
    sa.Column('answers', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('name', sa.Text(), nullable=True),
    sa.Column('phone', sa.String(length=64), nullable=True),
    sa.Column('submitted_pincode', sa.String(length=6), nullable=True),
    sa.Column('pincode_qualified', sa.Boolean(), nullable=True),
    sa.Column('passes_screening', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('qualified', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('pincode_match', sa.Boolean(), nullable=True),
    sa.Column('education_answer', sa.Text(), nullable=True),
    sa.Column('education_level', sa.String(length=32), nullable=True),
    sa.Column('education_ok', sa.Boolean(), nullable=True),
    sa.Column('can_invest', sa.Boolean(), nullable=True),
    sa.Column('esaf_response', sa.String(length=3), nullable=True),
    sa.Column('esaf_response_source', sa.String(length=8), nullable=True),
    sa.Column('qualification_status', sa.String(length=16), server_default='needs_info', nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("esaf_response IS NULL OR esaf_response IN ('yes', 'no')", name=op.f('ck_ads_leads_esaf_values')),
    sa.CheckConstraint("esaf_response_source IS NULL OR esaf_response_source IN ('form', 'staff')", name=op.f('ck_ads_leads_esaf_source_values')),
    sa.CheckConstraint("qualification_status IN ('sbi_strong', 'esaf_strong', 'esaf_pitch', 'needs_info', 'not_qualified')", name=op.f('ck_ads_leads_qualification_values')),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_leads_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_leads')),
    sa.UniqueConstraint('workspace_id', 'meta_lead_id', name=op.f('uq_ads_leads_workspace_id_meta_lead_id'))
    )
    op.create_index(op.f('ix_ads_leads_qualification_status'), 'ads_leads', ['qualification_status'], unique=False)
    op.create_index('ix_ads_leads_workspace_ad', 'ads_leads', ['workspace_id', 'ad_id'], unique=False)
    op.create_index(op.f('ix_ads_leads_workspace_id'), 'ads_leads', ['workspace_id'], unique=False)
    op.create_table('ads_meta_ads',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('ad_id', sa.String(length=64), nullable=False),
    sa.Column('account_id', sa.String(length=64), nullable=True),
    sa.Column('account_name', sa.String(length=300), nullable=True),
    sa.Column('campaign_id', sa.String(length=64), nullable=False),
    sa.Column('campaign_name', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=64), nullable=True),
    sa.Column('objective', sa.String(length=64), nullable=True),
    sa.Column('channel', sa.String(length=16), server_default='other', nullable=False),
    sa.Column('created_time', sa.String(length=40), nullable=True),
    sa.Column('first_impression_date', sa.String(length=10), nullable=True),
    sa.Column('first_impression_hour', sa.String(length=16), nullable=True),
    sa.Column('ad_name', sa.Text(), nullable=True),
    sa.Column('thumbnail_url', sa.Text(), nullable=True),
    sa.Column('creative', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('metrics', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('breakdowns', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('targeting', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('lead_form_id', sa.String(length=64), nullable=True),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("channel IN ('lead_form', 'website', 'other')", name=op.f('ck_ads_meta_ads_channel_values')),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_meta_ads_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_meta_ads')),
    sa.UniqueConstraint('workspace_id', 'ad_id', name=op.f('uq_ads_meta_ads_workspace_id_ad_id'))
    )
    op.create_index('ix_ads_meta_ads_workspace_campaign', 'ads_meta_ads', ['workspace_id', 'campaign_id'], unique=False)
    op.create_index(op.f('ix_ads_meta_ads_workspace_id'), 'ads_meta_ads', ['workspace_id'], unique=False)
    op.create_table('ads_optimization',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('campaign_id', sa.String(length=64), nullable=False),
    sa.Column('optimization_goal', sa.String(length=64), nullable=True),
    sa.Column('bid_strategy', sa.String(length=64), nullable=True),
    sa.Column('pixel_id', sa.String(length=64), nullable=True),
    sa.Column('custom_event_type', sa.String(length=64), nullable=True),
    sa.Column('daily_budget', sa.String(length=32), nullable=True),
    sa.Column('lifetime_budget', sa.String(length=32), nullable=True),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_optimization_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_optimization')),
    sa.UniqueConstraint('workspace_id', 'campaign_id', name=op.f('uq_ads_optimization_workspace_id_campaign_id'))
    )
    op.create_index(op.f('ix_ads_optimization_workspace_id'), 'ads_optimization', ['workspace_id'], unique=False)
    op.create_table('ads_reference_datasets',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('source_file', sa.String(length=200), nullable=True),
    sa.Column('row_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_reference_datasets_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_reference_datasets')),
    sa.UniqueConstraint('workspace_id', 'name', name=op.f('uq_ads_reference_datasets_workspace_id_name'))
    )
    op.create_index(op.f('ix_ads_reference_datasets_workspace_id'), 'ads_reference_datasets', ['workspace_id'], unique=False)
    op.create_table('ads_targeting_records',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('campaign_id', sa.String(length=64), nullable=False),
    sa.Column('campaign_name', sa.Text(), nullable=True),
    sa.Column('ad_name', sa.Text(), nullable=True),
    sa.Column('account_name', sa.String(length=300), nullable=True),
    sa.Column('pincodes', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
    sa.Column('locations', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
    sa.Column('interests_behaviors', sa.Text(), server_default='', nullable=False),
    sa.Column('setup', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_targeting_records_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_targeting_records')),
    sa.UniqueConstraint('workspace_id', 'campaign_id', name=op.f('uq_ads_targeting_records_workspace_id_campaign_id'))
    )
    op.create_index(op.f('ix_ads_targeting_records_workspace_id'), 'ads_targeting_records', ['workspace_id'], unique=False)
    op.create_table('ads_website_signups',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('signup_id', sa.String(length=64), nullable=False),
    sa.Column('mobile', sa.String(length=64), nullable=True),
    sa.Column('name', sa.Text(), nullable=True),
    sa.Column('submitted_at', sa.String(length=40), nullable=True),
    sa.Column('qualification_verdict', sa.String(length=64), nullable=True),
    sa.Column('shop_address', sa.Text(), nullable=True),
    sa.Column('attribution_tier', sa.String(length=32), server_default='none', nullable=False),
    sa.Column('matched_campaign_id', sa.String(length=64), nullable=True),
    sa.Column('matched_campaign_name', sa.Text(), nullable=True),
    sa.Column('utm_source', sa.Text(), server_default='', nullable=False),
    sa.Column('utm_medium', sa.Text(), server_default='', nullable=False),
    sa.Column('utm_campaign', sa.Text(), server_default='', nullable=False),
    sa.Column('extra', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("attribution_tier IN ('campaign_matched', 'fbclid_only', 'none')", name=op.f('ck_ads_website_signups_tier_values')),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_website_signups_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_website_signups')),
    sa.UniqueConstraint('workspace_id', 'signup_id', name=op.f('uq_ads_website_signups_workspace_id_signup_id'))
    )
    op.create_index(op.f('ix_ads_website_signups_workspace_id'), 'ads_website_signups', ['workspace_id'], unique=False)
    op.create_table('ads_studio_drafts',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('brief', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('copy', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('targeting', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('guardrails', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('image', sa.LargeBinary(), nullable=True),
    sa.Column('image_content_type', sa.String(length=32), nullable=True),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('mode', sa.String(length=16), server_default='dry_run', nullable=False),
    sa.Column('status', sa.String(length=16), server_default='draft', nullable=False),
    sa.Column('meta_ids', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=80), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("mode IN ('dry_run', 'live')", name=op.f('ck_ads_studio_drafts_mode_values')),
    sa.CheckConstraint("status IN ('draft', 'built', 'active', 'failed')", name=op.f('ck_ads_studio_drafts_status_values')),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['team_members.id'], name=op.f('fk_ads_studio_drafts_created_by_member_id_team_members'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_studio_drafts_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_studio_drafts'))
    )
    op.create_index('ix_ads_studio_drafts_workspace_created', 'ads_studio_drafts', ['workspace_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_ads_studio_drafts_workspace_id'), 'ads_studio_drafts', ['workspace_id'], unique=False)
    op.create_table('ads_sync_runs',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('trigger', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('triggered_by_member_id', sa.String(length=80), nullable=True),
    sa.Column('queued_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('lease_expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('counts', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('error_code', sa.String(length=64), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.CheckConstraint("kind IN ('meta', 'signups')", name=op.f('ck_ads_sync_runs_kind_values')),
    sa.CheckConstraint("status IN ('queued', 'running', 'succeeded', 'failed')", name=op.f('ck_ads_sync_runs_status_values')),
    sa.CheckConstraint("trigger IN ('manual', 'scheduled', 'import')", name=op.f('ck_ads_sync_runs_trigger_values')),
    sa.ForeignKeyConstraint(['triggered_by_member_id'], ['team_members.id'], name=op.f('fk_ads_sync_runs_triggered_by_member_id_team_members'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_ads_sync_runs_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ads_sync_runs'))
    )
    op.create_index(op.f('ix_ads_sync_runs_workspace_id'), 'ads_sync_runs', ['workspace_id'], unique=False)
    op.create_index('ix_ads_sync_runs_workspace_kind_queued', 'ads_sync_runs', ['workspace_id', 'kind', 'queued_at'], unique=False)
    op.create_index('uq_ads_sync_runs_one_active', 'ads_sync_runs', ['workspace_id', 'kind'], unique=True, postgresql_where=sa.text("status IN ('queued', 'running')"))
    op.add_column('leads', sa.Column('pincode', sa.String(length=6), nullable=True))
    op.add_column('leads', sa.Column('pincode_match', sa.Boolean(), nullable=True))
    op.add_column('leads', sa.Column('education_answer', sa.String(length=200), nullable=True))
    op.add_column('leads', sa.Column('education_level', sa.String(length=32), nullable=True))
    op.add_column('leads', sa.Column('education_ok', sa.Boolean(), nullable=True))
    op.add_column('leads', sa.Column('can_invest', sa.Boolean(), nullable=True))
    op.add_column('leads', sa.Column('esaf_response', sa.String(length=3), nullable=True))
    op.add_column('leads', sa.Column('qualification_status', sa.String(length=16), nullable=True))
    op.create_check_constraint(op.f('ck_leads_esaf_values'), 'leads', "esaf_response IS NULL OR esaf_response IN ('yes', 'no')")
    op.create_check_constraint(op.f('ck_leads_qualification_values'), 'leads',
                               "qualification_status IS NULL OR qualification_status IN "
                               "('sbi_strong', 'esaf_strong', 'esaf_pitch', 'needs_info', 'not_qualified')")


def downgrade() -> None:
    op.drop_constraint(op.f('ck_leads_qualification_values'), 'leads', type_='check')
    op.drop_constraint(op.f('ck_leads_esaf_values'), 'leads', type_='check')
    op.drop_column('leads', 'qualification_status')
    op.drop_column('leads', 'esaf_response')
    op.drop_column('leads', 'can_invest')
    op.drop_column('leads', 'education_ok')
    op.drop_column('leads', 'education_level')
    op.drop_column('leads', 'education_answer')
    op.drop_column('leads', 'pincode_match')
    op.drop_column('leads', 'pincode')
    op.drop_index('uq_ads_sync_runs_one_active', table_name='ads_sync_runs', postgresql_where=sa.text("status IN ('queued', 'running')"))
    op.drop_index('ix_ads_sync_runs_workspace_kind_queued', table_name='ads_sync_runs')
    op.drop_index(op.f('ix_ads_sync_runs_workspace_id'), table_name='ads_sync_runs')
    op.drop_table('ads_sync_runs')
    op.drop_index(op.f('ix_ads_studio_drafts_workspace_id'), table_name='ads_studio_drafts')
    op.drop_index('ix_ads_studio_drafts_workspace_created', table_name='ads_studio_drafts')
    op.drop_table('ads_studio_drafts')
    op.drop_index(op.f('ix_ads_website_signups_workspace_id'), table_name='ads_website_signups')
    op.drop_table('ads_website_signups')
    op.drop_index(op.f('ix_ads_targeting_records_workspace_id'), table_name='ads_targeting_records')
    op.drop_table('ads_targeting_records')
    op.drop_index(op.f('ix_ads_reference_datasets_workspace_id'), table_name='ads_reference_datasets')
    op.drop_table('ads_reference_datasets')
    op.drop_index(op.f('ix_ads_optimization_workspace_id'), table_name='ads_optimization')
    op.drop_table('ads_optimization')
    op.drop_index(op.f('ix_ads_meta_ads_workspace_id'), table_name='ads_meta_ads')
    op.drop_index('ix_ads_meta_ads_workspace_campaign', table_name='ads_meta_ads')
    op.drop_table('ads_meta_ads')
    op.drop_index(op.f('ix_ads_leads_workspace_id'), table_name='ads_leads')
    op.drop_index('ix_ads_leads_workspace_ad', table_name='ads_leads')
    op.drop_index(op.f('ix_ads_leads_qualification_status'), table_name='ads_leads')
    op.drop_table('ads_leads')
    op.drop_index(op.f('ix_ads_creatives_workspace_id'), table_name='ads_creatives')
    op.drop_table('ads_creatives')
    op.drop_index(op.f('ix_ads_creative_labels_workspace_id'), table_name='ads_creative_labels')
    op.drop_table('ads_creative_labels')
    op.drop_index(op.f('ix_ads_creative_images_workspace_id'), table_name='ads_creative_images')
    op.drop_table('ads_creative_images')
