"""Ad Studio (port of AdMarketer's original feature): build a new Facebook/Instagram recruitment ad.

* ``rules``     — locked captions, 4 approved CTAs, banned "eligibility" wording, 3 angles (pure)
* ``adcopy``    — locked caption or AI-written copy via ``app.ai`` (labelled; deterministic locked fallback)
* ``targeting`` — districts/villages → Meta targeting from the imported reference datasets (pure)
* ``payload``   — the exact Meta request bodies (dry run shows what would be sent)
* ``images``    — upload validation + optional Pollinations generation
* ``meta`` / ``publish`` — live Graph API calls (PAUSED create, explicit activate, insights); mocked in tests only
* ``optimizer`` — rule-based advice for a live ad's numbers
* ``service``   — persistence (``ads_studio_drafts``) and orchestration used by ``app/api/routes/ads_studio.py``
"""
