"""Lead qualification rules (product owner, 2026-11-18 incl. the "education required for ESAF too" update)."""

from __future__ import annotations

import pytest

from app.services.qualification import STATUS_LABELS, STATUSES, esaf_value, is_qualified, parse_education, qualify_lead, sbi_reasons, yes_no

T, F, N = True, False, None


@pytest.mark.parametrize(("text", "level", "ok"), [
    ("12th pass", "12th / Intermediate", True), ("12", "12th / Intermediate", True), ("Intermediate", "12th / Intermediate", True),
    ("inter", "12th / Intermediate", True), ("HSC", "12th / Intermediate", True), ("+2", "12th / Intermediate", True),
    ("10+2", "12th / Intermediate", True), ("Higher Secondary", "12th / Intermediate", True), ("12वीं", "12th / Intermediate", True),
    ("इंटर", "12th / Intermediate", True),
    ("Graduate", "Graduate", True), ("graduation", "Graduate", True), ("Degree", "Graduate", True), ("BA", "Graduate", True),
    ("B.Sc", "Graduate", True), ("bcom", "Graduate", True), ("BBA", "Graduate", True), ("BCA", "Graduate", True),
    ("B.Tech", "Graduate", True), ("engineering", "Graduate", True), ("स्नातक", "Graduate", True),
    ("Post Graduate", "Post graduate", True), ("PG", "Post graduate", True), ("MA English", "Post graduate", True),
    ("MSc", "Post graduate", True), ("mcom", "Post graduate", True), ("MBA", "Post graduate", True), ("MCA", "Post graduate", True),
    ("PhD", "PhD", True),
    ("8th", "Below 10th", False), ("9th", "Below 10th", False), ("no education", "Below 10th", False), ("illiterate", "Below 10th", False),
    ("10th", "10th", False), ("10", "10th", False), ("matric", "10th", False), ("High School", "10th", False), ("SSC", "10th", False),
    ("below 10", "10th", False), ("10वीं", "10th", False), ("दसवीं", "10th", False),
    ("10th, then 12th", "12th / Intermediate", True),  # highest level mentioned wins
    ("diploma", None, None), ("", None, None), (None, None, None), ("   ", None, None), ("internet cafe", None, None),
])
def test_parse_education(text, level, ok):
    assert parse_education(text) == (level, ok)


@pytest.mark.parametrize(("pin", "edu", "inv", "esaf", "status"), [
    # 1. SBI strong
    (T, T, T, None, "sbi_strong"), (T, T, T, "no", "sbi_strong"), (T, T, T, "yes", "sbi_strong"),
    # 2. education below 12th fails SBI and ESAF — never pitched
    (T, F, T, None, "not_qualified"), (F, F, F, "yes", "not_qualified"), (N, F, N, None, "not_qualified"),
    # 3. pincode or investment failed → ESAF track
    (F, T, T, "yes", "esaf_strong"), (T, T, F, "yes", "esaf_strong"),
    (F, N, T, "yes", "needs_info"),  # ESAF yes but education unknown → confirm
    (F, T, T, "no", "not_qualified"), (T, N, F, "no", "not_qualified"),
    (F, T, T, None, "esaf_pitch"), (N, N, F, None, "esaf_pitch"), (F, T, F, "maybe", "esaf_pitch"),
    # 4. nothing failed, something unknown
    (N, T, T, "yes", "esaf_strong"), (T, N, T, "yes", "needs_info"), (N, T, T, None, "needs_info"),
    (N, N, N, "no", "needs_info"), (T, T, N, None, "needs_info"),
])
def test_qualify_lead_every_branch(pin, edu, inv, esaf, status):
    got, reasons = qualify_lead(pin, edu, inv, esaf)
    assert got == status and got in STATUSES and got in STATUS_LABELS
    assert reasons == sbi_reasons(pin, edu, inv)
    assert is_qualified(got) is (got in ("sbi_strong", "esaf_strong"))


def test_reasons_name_failed_and_unknown_criteria():
    assert sbi_reasons(T, T, T) == []
    assert sbi_reasons(F, N, T) == ["pincode_mismatch", "education_unknown"]
    assert sbi_reasons(N, F, F) == ["pincode_unknown", "education_below_12th", "cannot_invest"]
    assert sbi_reasons(T, T, N) == ["investment_unknown"]


def test_answer_parsing():
    assert yes_no("Yes") is True and yes_no("हाँ") is True and yes_no("No") is False and yes_no("") is None and yes_no(None) is None
    assert esaf_value("yes") == "yes" and esaf_value("नहीं") == "no" and esaf_value("later") is None and esaf_value(None) is None
