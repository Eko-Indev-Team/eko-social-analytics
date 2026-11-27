"""Instagram content publishing: posts SocialBoard publishes to a connected professional account.

* ``InstagramPublication`` — one post (photo, carousel, reel or story): caption, media items, schedule, the Meta
  container ids created for it and the published media id/permalink. Publishing runs in the background worker.
* ``InstagramPublishAsset`` — a JPEG uploaded to SocialBoard for a post. Meta fetches images from a public URL
  (there is no binary upload for images), so each asset gets an unguessable ``public_token`` served at
  ``<API>/integrations/instagram/media/<token>.jpg`` while its post is pending.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, LargeBinary, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, WorkspaceOwned

PUBLICATION_KINDS = ("image", "carousel", "reel", "story")
PUBLICATION_STATUSES = ("scheduled", "queued", "publishing", "published", "failed", "cancelled")


class InstagramPublication(WorkspaceOwned, TimestampMixin, Base):
    __tablename__ = "instagram_publications"
    __table_args__ = (
        CheckConstraint("kind IN ('image', 'carousel', 'reel', 'story')", name="kind_values"),
        CheckConstraint("status IN ('scheduled', 'queued', 'publishing', 'published', 'failed', 'cancelled')", name="status_values"),
        Index("ix_instagram_publications_due", "status", "scheduled_at"),
        Index("ix_instagram_publications_workspace_created", "workspace_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    connection_id: Mapped[str] = mapped_column(ForeignKey("instagram_connections.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    caption: Mapped[str | None] = mapped_column(Text)
    # [{"type": "image"|"video", "url": "https://…"} | {"type": "image", "asset_id": "iga_…"}]
    items: Mapped[list[Any]] = mapped_column(server_default=text("'[]'::jsonb"))
    # share_to_feed (reels), alt_text (images), cover_url (reels)
    options: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    status: Mapped[str] = mapped_column(String(16))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Worker bookkeeping: when to look at the post again, and the container ids created on Meta.
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    containers: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    ig_media_id: Mapped[str | None] = mapped_column(String(64))
    permalink: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Our own safe message (never raw provider payloads or tokens).
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))


class InstagramPublishAsset(WorkspaceOwned, Base):
    __tablename__ = "instagram_publish_assets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    public_token: Mapped[str] = mapped_column(String(64), unique=True)
    content_type: Mapped[str] = mapped_column(String(32))
    byte_size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("team_members.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
