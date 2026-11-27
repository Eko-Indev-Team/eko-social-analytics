"""Ads reports: ports of AdMarketer's Performance, Experiments and Overview pages.

Pure functions over AdMarketer "ad record" and signup dicts (see the shared spec / DATA_DICTIONARY);
the HTTP layer (``app/api/routes/ads_reports.py``) loads the records and shapes the JSON.
"""

from . import experiments, overview, performance

__all__ = ["experiments", "overview", "performance"]
