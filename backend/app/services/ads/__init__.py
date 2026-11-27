"""Ads module (port of AdMarketer): Meta ads + lead-form leads, reports, website signups and Ad Studio.

* ``records``   — Postgres → AdMarketer-shaped dicts (the contract the report builders use)
* ``meta``      — Graph API client and the port of ``all_ads.get_all_real_ads`` (business rules included)
* ``sync``      — durable sync runs (Celery job + manual trigger) that persist a pull into Postgres
* ``queries``   — read models for the HTTP API (masking without ``ads:leads``)
* ``exports``   — Excel downloads
* ``reports`` / ``signups`` (reports role) and ``studio`` (Ad Studio role)
"""
