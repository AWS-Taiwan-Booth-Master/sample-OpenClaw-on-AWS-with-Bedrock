"""
Shared helpers for invoking the openclaw CLI from backend routers.

Centralizes binary discovery and environment setup so that no router
needs to hardcode a Node.js version path.
"""

import glob
import os


def find_openclaw_bin() -> str:
    """Find the openclaw binary regardless of Node.js version."""
    patterns = [
        "/home/ubuntu/.nvm/versions/node/*/bin/openclaw",
        "/usr/local/bin/openclaw",
        "/usr/bin/openclaw",
    ]
    for pattern in patterns:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]
    return "openclaw"  # fallback to PATH lookup


def openclaw_env() -> dict:
    """Return an env dict with correct PATH and HOME for running openclaw as ubuntu."""
    env = os.environ.copy()
    bin_dir = os.path.dirname(find_openclaw_bin())
    env["PATH"] = f"{bin_dir}:/usr/local/bin:/usr/bin:/bin"
    env["HOME"] = "/home/ubuntu"
    return env


def openclaw_env_path() -> str:
    """Return a PATH string suitable for env(1) invocations."""
    return os.path.dirname(find_openclaw_bin()) + ":/usr/local/bin:/usr/bin:/bin"


def openclaw_home() -> str:
    """Return the openclaw data directory (~/.openclaw for the ubuntu user)."""
    return "/home/ubuntu/.openclaw"


def openclaw_config() -> dict:
    """Read and return the Gateway's openclaw.json config."""
    import json
    config_path = os.path.join(openclaw_home(), "openclaw.json")
    try:
        with open(config_path) as f:
            return json.load(f)
    except Exception:
        return {}


def parse_openclaw_json(stdout: str):
    """Parse JSON from openclaw stdout, skipping any ANSI/log preamble."""
    import json
    if not stdout:
        return None
    json_start = stdout.find('{')
    if json_start >= 0:
        return json.loads(stdout[json_start:])
    return None
