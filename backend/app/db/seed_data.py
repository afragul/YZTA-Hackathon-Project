"""
Seed data loader.

Reads seed_data.json (the single source of truth for demo data).
"""

import json
from pathlib import Path

_SEED_FILE = Path(__file__).parent / "seed_data.json"

SEED: dict = json.loads(_SEED_FILE.read_text(encoding="utf-8"))
