#!/usr/bin/env python3
"""
nocodb_bootstrap.py — Bootstrap NocoDB tables for JobSignal Engine.

Creates all 4 tables (Profile, Tracked Companies, Pipeline, Search Queries)
with correct field types, select options, and descriptions via NocoDB Meta API v3.

Usage:
    python scripts/nocodb_bootstrap.py                                    # Create all 4 tables
    python scripts/nocodb_bootstrap.py --table Pipeline                   # Create only Pipeline table
    python scripts/nocodb_bootstrap.py --force                            # Drop and recreate existing tables
    python scripts/nocodb_bootstrap.py --import-data ./airtable/templates  # Seed from CSV files
    python scripts/nocodb_bootstrap.py --skip-setup                       # Use existing workspace/base
    python scripts/nocodb_bootstrap.py --token-only                       # Print existing API token

Designed for JobSignal Engine Phase 1 (Infrastructure Bootstrap).
Called after `docker-compose up -d` to automate NocoDB first-time setup —
signup, workspace, base, API token generation, and table creation via
NocoDB Meta API v3 and Data API v3.
"""

import argparse
import csv
import json
import logging
import os
import sys
import time
import traceback
from urllib.parse import urljoin

import requests

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Rate limiting: minimum delay between API calls (seconds)
_API_CALL_DELAY = 0.1
_last_api_call = 0.0


# --- Field Type Mapping ------------------------------------------------

FIELD_TYPE_MAP = {
    "text": {"type": "SingleLineText"},
    "longText": {"type": "LongText"},
    "singleSelect": {"type": "SingleSelect"},  # + options.choices from schema
    "multipleSelect": {"type": "MultiSelect"},  # + options.choices from schema
    "url": {"type": "URL"},
    "number": {"type": "Decimal"},  # precision from schema
    "checkbox": {"type": "Checkbox"},
    "date": {"type": "Date"},
    "dateTime": {"type": "DateTime"},
    "attachment": {"type": "Attachment"},
    "lookup": {"type": "Links"},  # needs relation_type + related_table_id
    "email": {"type": "Email"},
    "phoneNumber": {"type": "PhoneNumber"},
    "currency": {"type": "Currency"},
    "percent": {"type": "Percent"},
    "duration": {"type": "Duration"},
    "rating": {"type": "Rating"},
    "rollup": {"type": "Rollup"},
    "formula": {"type": "Formula"},
    "count": {"type": "Number"},
    "autoNumber": {"type": "AutoNumber"},
}


# --- API Helper Functions ----------------------------------------------


def _api_request(method, url, headers=None, json_data=None, retries=3):
    """Make an API request with retry logic and rate limiting.

    Wraps requests.request() with:
    - 100ms minimum delay between calls (rate limiting safety brake)
    - Retry on 429/503/ConnectionError up to `retries` times with 5s interval
    - Logs request method, URL, and response status code
    - Parses JSON response; raises RuntimeError on non-2xx status

    Args:
        method: HTTP method (GET, POST, DELETE, etc.)
        url: Full request URL
        headers: Optional dict of HTTP headers
        json_data: Optional JSON-serializable request body
        retries: Number of retries for transient failures (default: 3)

    Returns:
        Parsed JSON response as a dict

    Raises:
        RuntimeError: If request fails after all retries, or non-2xx response
    """
    global _last_api_call

    elapsed = time.time() - _last_api_call
    if elapsed < _API_CALL_DELAY:
        time.sleep(_API_CALL_DELAY - elapsed)

    last_error = None

    for attempt in range(1, retries + 2):
        try:
            _last_api_call = time.time()
            r = requests.request(
                method=method,
                url=url,
                headers=headers or {},
                json=json_data,
                timeout=30,
            )
            logger.info(f"{method} {url} -> {r.status_code}")

            if r.status_code in (429, 503) and attempt <= retries:
                logger.warning(
                    f"Rate limited / service unavailable (attempt {attempt}/{retries}). "
                    f"Retrying in 5s..."
                )
                time.sleep(5)
                continue

            if r.status_code >= 400:
                msg = f"API {method} {url} failed ({r.status_code}): {r.text[:500]}"
                raise RuntimeError(msg)

            return r.json() if r.text.strip() else {}

        except requests.ConnectionError as e:
            last_error = e
            if attempt <= retries:
                logger.warning(
                    f"Connection error (attempt {attempt}/{retries}): {e}. "
                    f"Retrying in 5s..."
                )
                time.sleep(5)
            else:
                raise RuntimeError(
                    f"API request failed after {retries + 1} attempts: {e}"
                )
        except requests.Timeout as e:
            last_error = e
            if attempt <= retries:
                logger.warning(
                    f"Timeout (attempt {attempt}/{retries}). Retrying in 5s..."
                )
                time.sleep(5)
            else:
                raise RuntimeError(
                    f"API request timed out after {retries + 1} attempts: {e}"
                )

    # Should not reach here, but raise the last error if we do
    raise RuntimeError(f"API request failed after exhausting retries: {last_error}")


def wait_for_nocodb(base_url, timeout=120):
    """Poll NocoDB until it is ready to accept requests.

    Sends GET to /api/v1/auth/user/signin every 5 seconds. Any response
    (any status code) indicates the server is up. Raises RuntimeError
    if the timeout is exceeded.

    Args:
        base_url: NocoDB base URL (e.g., http://localhost:8080)
        timeout: Maximum seconds to wait (default: 120)

    Returns:
        True when server is ready

    Raises:
        RuntimeError: If NocoDB is not ready within the timeout
    """
    deadline = time.time() + timeout
    url = urljoin(base_url.rstrip("/") + "/", "api/v1/auth/user/signin")

    while time.time() < deadline:
        try:
            r = requests.get(url, timeout=5)
            logger.info(f"NocoDB is ready (status: {r.status_code})")
            return True
        except requests.ConnectionError:
            logger.info("Waiting for NocoDB to start...")
            time.sleep(5)
        except requests.Timeout:
            logger.info("Waiting for NocoDB (timeout)...")
            time.sleep(5)
        except Exception:
            logger.info("Waiting for NocoDB (unexpected response)...")
            time.sleep(5)

    raise RuntimeError(f"NocoDB not ready after {timeout}s")


def signup_or_signin(base_url, email, password):
    """Try signup first; if user exists, sign in instead.

    POST /api/v1/auth/user/signup — if 200, returns JWT token for new user.
    On any non-200 response (user already exists), falls through to
    POST /api/v1/auth/user/signin. Raises RuntimeError if signin fails.

    Args:
        base_url: NocoDB base URL
        email: Admin email address
        password: Admin password

    Returns:
        JWT token string

    Raises:
        RuntimeError: If signin fails with non-200 response
    """
    auth_url = urljoin(base_url.rstrip("/") + "/", "api/v1/auth/user/signup")
    payload = {"email": email, "password": password}

    try:
        r = requests.post(auth_url, json=payload, timeout=30)
        if r.status_code == 200:
            data = r.json()
            token = data.get("token")
            logger.info("First-time setup: admin user created")
            if token:
                return token
        else:
            logger.info("Admin user already exists — signing in")
    except Exception as e:
        logger.info(f"Signup attempt failed ({e}) — signing in instead")

    # Sign in
    signin_url = urljoin(base_url.rstrip("/") + "/", "api/v1/auth/user/signin")
    r = requests.post(signin_url, json=payload, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Signin failed: {r.text}")

    data = r.json()
    token = data.get("token")
    if not token:
        raise RuntimeError(f"Signin response missing token: {r.text}")

    logger.info("Signed in successfully")
    return token


def get_or_create_workspace(base_url, token):
    """Create or find a workspace for JobSignal.

    Tries POST /api/v3/meta/workspaces to create "JobSignal" workspace first.
    On 403/404 (likely CE without Enterprise API access), falls back to
    GET /api/v3/meta/workspaces and returns the first workspace id.
    If list is empty, tries creating a base via v1 API (/api/v1/db/meta/projects/)
    to auto-assign to the default workspace, then extracts workspace_id.

    Args:
        base_url: NocoDB base URL
        token: JWT or API token for authentication

    Returns:
        workspace_id string
    """
    headers = {"xc-auth": token}
    create_url = urljoin(base_url.rstrip("/") + "/", "api/v3/meta/workspaces")

    # Try workspace creation (may be Enterprise-only)
    r = None
    try:
        r = requests.post(
            create_url, json={"title": "JobSignal"}, headers=headers, timeout=30
        )
        if r.status_code == 200:
            data = r.json()
            workspace_id = data.get("id")
            if workspace_id:
                logger.info(f"Created workspace 'JobSignal' (id: {workspace_id})")
                return workspace_id
    except Exception:
        pass

    if r is not None and r.status_code in (403, 404):
        logger.info(
            "Workspace creation not available (CE limitation) — listing existing workspaces"
        )

    # Fallback: list workspaces
    try:
        r = requests.get(create_url, headers=headers, timeout=30)
        if r.status_code == 200:
            data = r.json()
            workspace_list = data.get("list", [])
            if workspace_list:
                ws_id = workspace_list[0].get("id")
                ws_title = workspace_list[0].get("title", "Unknown")
                logger.info(f"Using existing workspace '{ws_title}' (id: {ws_id})")
                return ws_id
    except Exception:
        pass

    # Last resort: create a base via v1 API to get auto-assigned to default workspace
    logger.info(
        "No workspaces found — trying v1 base creation to discover default workspace"
    )
    try:
        v1_url = urljoin(base_url.rstrip("/") + "/", "api/v1/db/meta/projects/")
        r = requests.post(
            v1_url, json={"title": "JobSignal Engine Temp"}, headers=headers, timeout=30
        )
        if r.status_code == 200:
            data = r.json()
            workspace_id = data.get("workspace_id")
            if workspace_id:
                logger.info(
                    f"Discovered default workspace (id: {workspace_id}) via v1 API"
                )
                return workspace_id
    except Exception:
        pass

    raise RuntimeError(
        "Could not find or create a NocoDB workspace. "
        "Ensure NocoDB is running and accessible."
    )


def create_base(base_url, token, workspace_id):
    """Create a base in the given workspace.

    POST /api/v3/meta/workspaces/{workspace_id}/bases with title
    "JobSignal Engine". Returns the base_id from the response.

    Args:
        base_url: NocoDB base URL
        token: JWT or API token for authentication
        workspace_id: Target workspace ID

    Returns:
        base_id string
    """
    headers = {"xc-auth": token, "Content-Type": "application/json"}
    url = urljoin(
        base_url.rstrip("/") + "/", f"api/v3/meta/workspaces/{workspace_id}/bases"
    )
    payload = {"title": "JobSignal Engine", "meta": {"icon_color": "#36BFFF"}}

    data = _api_request("POST", url, headers=headers, json_data=payload)
    base_id = data.get("id")
    if not base_id:
        raise RuntimeError(f"Base creation response missing 'id': {data}")

    logger.info(f"Created base 'JobSignal Engine' (id: {base_id})")
    return base_id


def create_api_token(base_url, token, base_id):
    """Create a persistent API token for the base.

    POST /api/v2/meta/bases/{base_id}/api-tokens. On 403, falls back to
    using the JWT token directly with a warning.

    IMPORTANT: The token value is only returned once. This function logs
    it to stdout immediately so the user can capture it.

    Args:
        base_url: NocoDB base URL
        token: JWT token for authentication
        base_id: Base ID to create token for

    Returns:
        API token string (or original JWT if API token creation fails)
    """
    headers = {"xc-auth": token, "Content-Type": "application/json"}
    url = urljoin(base_url.rstrip("/") + "/", f"api/v2/meta/bases/{base_id}/api-tokens")
    payload = {"description": "JobSignal Engine Bootstrap Token"}

    try:
        data = _api_request("POST", url, headers=headers, json_data=payload)
        api_token = data.get("token")
        if api_token:
            # Log token to stdout for immediate capture (only chance)
            print(f"\n{'=' * 60}")
            print(f"API Token: {api_token}")
            print(f"{'=' * 60}")
            print(f"IMPORTANT: Save this token now — it won't be shown again.")
            print(f"Add to docker-compose.example.yml as: NOCDB_API_TOKEN={api_token}")
            print(f"{'=' * 60}\n")
            logger.info("API token created successfully")
            return api_token
    except RuntimeError as e:
        if "403" in str(e):
            logger.warning(
                "API token creation returned 403 (may be CE limitation). "
                "Falling back to JWT token."
            )
        else:
            logger.warning(
                f"API token creation failed: {e}. Falling back to JWT token."
            )

    # Fallback: use JWT token directly
    logger.warning(
        "Using JWT token as API token (session-limited — "
        "consider creating an API token via NocoDB UI)"
    )
    return token


def load_schema(schema_path):
    """Load and validate nocodb-schema.json.

    Validates that the schema has a `tables` array, each table has
    `title` + `fields`, and each field has `title` + `type`.

    Args:
        schema_path: Path to the schema JSON file

    Returns:
        Parsed schema dict

    Raises:
        ValueError: If schema structure is invalid
        FileNotFoundError: If schema file doesn't exist
        json.JSONDecodeError: If schema is not valid JSON
    """
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    if "tables" not in schema:
        raise ValueError("Schema missing 'tables' array")
    if not isinstance(schema["tables"], list):
        raise ValueError("Schema 'tables' must be an array")
    if len(schema["tables"]) == 0:
        raise ValueError("Schema 'tables' array is empty")

    for i, table in enumerate(schema["tables"]):
        if "title" not in table:
            raise ValueError(f"Table at index {i} missing 'title'")
        if "fields" not in table:
            raise ValueError(
                f"Table '{table.get('title', f'index {i}')}' missing 'fields'"
            )
        if not isinstance(table["fields"], list):
            raise ValueError(f"Table '{table['title']}' fields must be an array")
        for j, field in enumerate(table["fields"]):
            if "title" not in field:
                raise ValueError(
                    f"Table '{table['title']}' field at index {j} missing 'title'"
                )
            if "type" not in field:
                raise ValueError(
                    f"Table '{table['title']}' field '{field.get('title', f'index {j}')}' "
                    f"missing 'type'"
                )
            # Check that select types have choices if options is present
            if (
                field.get("type") in ("SingleSelect", "MultiSelect")
                and "options" in field
            ):
                choices = field["options"].get("choices", [])
                if not isinstance(choices, list):
                    raise ValueError(
                        f"Table '{table['title']}' field '{field['title']}' "
                        f"options.choices must be an array"
                    )

    logger.info(
        f"Schema validated: {len(schema['tables'])} tables, "
        f"{sum(len(t['fields']) for t in schema['tables'])} total fields"
    )
    return schema


def get_tables(base_url, token, base_id):
    """List existing tables for a base.

    GET /api/v3/meta/bases/{base_id}/tables.

    Args:
        base_url: NocoDB base URL
        token: JWT or API token for authentication
        base_id: Base ID to list tables from

    Returns:
        Response dict with a 'list' key containing table objects
    """
    headers = {"xc-auth": token}
    url = urljoin(base_url.rstrip("/") + "/", f"api/v3/meta/bases/{base_id}/tables")
    return _api_request("GET", url, headers=headers)


def table_exists(tables_list, title):
    """Check if a table with the given title exists.

    Args:
        tables_list: Response dict from get_tables() (has 'list' key)
        title: Table title to search for

    Returns:
        Table dict if found, None otherwise
    """
    for t in tables_list.get("list", []):
        if t.get("title") == title:
            return t
    return None


def create_table(base_url, token, base_id, table_def):
    """Create a table with fields via Meta API v3.

    POST /api/v3/meta/bases/{base_id}/tables. Constructs the request body
    from the table_def dict with title, description, and fields array.
    Maps `required: true` to `notNull: true` in each field.
    Does NOT include options.choices for SingleSelect/MultiSelect if the
    choices array is empty (avoids 400 errors from NocoDB).

    Args:
        base_url: NocoDB base URL
        token: JWT or API token for authentication
        base_id: Base ID to create the table in
        table_def: Table definition dict from schema (title, description, fields[])

    Returns:
        Response dict with 'id' key for the created table
    """
    headers = {"xc-auth": token, "Content-Type": "application/json"}
    url = urljoin(base_url.rstrip("/") + "/", f"api/v3/meta/bases/{base_id}/tables")

    fields = []
    for field in table_def.get("fields", []):
        f = {
            "title": field["title"],
            "type": field["type"],
            "description": field.get("description", ""),
        }
        if field.get("required"):
            f["notNull"] = True

        # Handle options (select choices, date format, precision, etc.)
        field_options = field.get("options")
        if field_options:
            options = dict(field_options)
            # Don't send empty choices array — NocoDB rejects it
            if "choices" in options and not options["choices"]:
                del options["choices"]
            if options:
                f["options"] = options

        fields.append(f)

    payload = {
        "title": table_def["title"],
        "description": table_def.get("description", ""),
        "fields": fields,
    }

    return _api_request("POST", url, headers=headers, json_data=payload)


def delete_table(base_url, token, base_id, table_id):
    """Delete a table by ID.

    DELETE /api/v3/meta/bases/{base_id}/tables/{table_id}.
    Handles 404 gracefully (already deleted — log and continue).

    Args:
        base_url: NocoDB base URL
        token: JWT or API token for authentication
        base_id: Base ID containing the table
        table_id: Table ID to delete
    """
    headers = {"xc-auth": token}
    url = urljoin(
        base_url.rstrip("/") + "/", f"api/v3/meta/bases/{base_id}/tables/{table_id}"
    )

    try:
        _api_request("DELETE", url, headers=headers)
        logger.info(f"Deleted table (id: {table_id})")
    except RuntimeError as e:
        if "404" in str(e):
            logger.info(f"Table (id: {table_id}) already deleted — continuing")
        else:
            raise


def create_table_idempotent(base_url, token, base_id, table_def, force=False):
    """Create a table if it doesn't exist; with --force, drop and recreate.

    Lists existing tables first (check-then-skip pattern).
    - If table exists AND force: delete it, wait 1s for propagation, then create
    - If table exists AND not force: log skip, return existing table id
    - If table doesn't exist: create it and return new table id

    Args:
        base_url: NocoDB base URL
        token: JWT or API token for authentication
        base_id: Base ID
        table_def: Table definition dict from schema
        force: If True, drop and recreate existing tables

    Returns:
        table_id string
    """
    existing_tables = get_tables(base_url, token, base_id)
    existing = table_exists(existing_tables, table_def["title"])

    if existing:
        if force:
            logger.info(f"Table '{table_def['title']}' exists. --force: deleting...")
            delete_table(base_url, token, base_id, existing["id"])
            time.sleep(1)  # Wait for deletion to propagate
        else:
            logger.info(f"Table '{table_def['title']}' already exists. Skipping.")
            return existing["id"]

    created = create_table(base_url, token, base_id, table_def)
    table_id = created.get("id")
    logger.info(f"Created table '{table_def['title']}' (id: {table_id})")
    return table_id


def import_csv_data(base_url, token, base_id, table_id, csv_path):
    """Seed a table with records from a CSV file.

    Reads CSV with csv.DictReader, batches records into chunks of 10
    (safety brake), and POSTs via /api/v3/data/bulk/{table_id}.
    Handles 400 errors gracefully by logging problematic fields and
    continuing with remaining batches.

    Args:
        base_url: NocoDB base URL
        token: JWT or API token for authentication
        base_id: Base ID (not directly used for bulk endpoint, but for logging)
        table_id: Table ID to import into
        csv_path: Path to CSV file
    """
    if not os.path.exists(csv_path):
        logger.warning(f"CSV file not found: {csv_path} — skipping")
        return

    headers = {"xc-token": token, "Content-Type": "application/json"}
    url = urljoin(base_url.rstrip("/") + "/", f"api/v3/data/bulk/{table_id}")

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        records = list(reader)

    if not records:
        logger.info(f"No records found in {csv_path} — nothing to import")
        return

    logger.info(f"Importing {len(records)} records from {csv_path}")

    # Batch into chunks of 10
    batch_size = 10
    total_imported = 0
    errors = []

    for start in range(0, len(records), batch_size):
        batch = records[start : start + batch_size]
        try:
            _api_request("POST", url, headers=headers, json_data=batch)
            total_imported += len(batch)
            logger.info(
                f"Imported batch: {start + 1}-{start + len(batch)} of {len(records)}"
            )
        except RuntimeError as e:
            errors.append(f"Batch {start // batch_size + 1}: {e}")
            if "400" in str(e):
                logger.warning(
                    f"Field mapping issue in batch — logging first record: "
                    f"{json.dumps(batch[0], default=str)[:200]}"
                )
            else:
                logger.error(f"Batch import failed: {e}")
            # Continue with remaining batches

        # Rate-limit: 100ms between batches
        time.sleep(0.1)

    if errors:
        logger.warning(
            f"Import completed with {len(errors)} batch errors "
            f"(imported {total_imported}/{len(records)} records)"
        )
    else:
        logger.info(f"Successfully imported {total_imported} records to table")


# --- Main Entry Point --------------------------------------------------


def main():
    """Parse CLI arguments and execute the bootstrap workflow."""
    parser = argparse.ArgumentParser(
        description="Bootstrap NocoDB tables for JobSignal Engine"
    )
    parser.add_argument(
        "--nocodb-url",
        default="http://localhost:8080",
        help="NocoDB base URL (default: http://localhost:8080)",
    )
    parser.add_argument(
        "--email",
        default=os.getenv("NOCODB_ADMIN_EMAIL", "admin@jobsignal.local"),
        help="Admin email (env: NOCODB_ADMIN_EMAIL)",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("NOCODB_ADMIN_PASSWORD"),
        help="Admin password (env: NOCODB_ADMIN_PASSWORD)",
    )
    parser.add_argument("--table", help="Create only this table (e.g., 'Pipeline')")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Drop and recreate tables if they exist (destructive)",
    )
    parser.add_argument(
        "--import-data",
        metavar="CSV_DIR",
        help="Seed tables from CSV files in directory",
    )
    parser.add_argument(
        "--skip-setup",
        action="store_true",
        help="Skip workspace/base creation (use existing)",
    )
    parser.add_argument(
        "--token-only",
        action="store_true",
        help="Only output the API token from NOCDB_API_TOKEN env var and exit",
    )

    args = parser.parse_args()

    # Validate --password is provided unless --skip-setup
    if not args.password and not args.skip_setup and not args.token_only:
        parser.error("--password is required (or set NOCODB_ADMIN_PASSWORD env var)")

    base_url = args.nocodb_url.rstrip("/")

    # --- --token-only mode ---
    if args.token_only:
        token = os.getenv("NOCDB_API_TOKEN")
        if token:
            print(token)
        else:
            logger.error("No API token found in NOCDB_API_TOKEN env var")
            sys.exit(1)
        return

    # --- --force destructive-action warning ---
    if args.force:
        message = (
            "\nDESTRUCTIVE ACTION: This will drop and recreate tables. "
            "Are you sure? [y/N]: "
        )
        if sys.stdin.isatty():
            try:
                response = input(message).strip().lower()
            except (EOFError, KeyboardInterrupt):
                response = "n"
            if response not in ("y", "yes"):
                logger.info("--force cancelled by user")
                sys.exit(0)
        else:
            logger.warning(
                "DESTRUCTIVE ACTION: --force enabled in non-interactive mode. "
                "Proceeding without confirmation."
            )

    try:
        # Step 1: Wait for NocoDB readiness
        logger.info("Waiting for NocoDB to be ready...")
        wait_for_nocodb(base_url)

        # Step 2: Sign up or sign in
        logger.info("Authenticating with NocoDB...")
        jwt_token = signup_or_signin(base_url, args.email, args.password)

        # Steps 3-5: Workspace, base, API token (unless --skip-setup)
        if not args.skip_setup:
            logger.info("Setting up workspace and base...")
            workspace_id = get_or_create_workspace(base_url, jwt_token)
            base_id = create_base(base_url, jwt_token, workspace_id)
            api_token = create_api_token(base_url, jwt_token, base_id)
        else:
            logger.info("Using existing setup (--skip-setup)...")
            base_id = os.getenv("NOCODB_BASE_ID")
            if not base_id:
                logger.info("NOCODB_BASE_ID not set — listing bases to find one...")
                # List bases using v3 workspaces list, then v3 bases list
                ws_url = urljoin(base_url.rstrip("/") + "/", "api/v3/meta/workspaces")
                ws_headers = {"xc-auth": jwt_token}
                try:
                    ws_data = _api_request("GET", ws_url, headers=ws_headers)
                    ws_list = ws_data.get("list", [])
                    if ws_list:
                        ws_id = ws_list[0]["id"]
                        bases_url = urljoin(
                            base_url.rstrip("/") + "/",
                            f"api/v3/meta/workspaces/{ws_id}/bases",
                        )
                        bases_data = _api_request("GET", bases_url, headers=ws_headers)
                        bases_list = bases_data.get("list", [])
                        if bases_list:
                            base_id = bases_list[0]["id"]
                            logger.info(f"Using existing base (id: {base_id})")
                except Exception as e:
                    logger.error(f"Could not discover existing base: {e}")
                    sys.exit(1)

            if not base_id:
                logger.error(
                    "Could not determine base_id. Set NOCODB_BASE_ID env var "
                    "or run without --skip-setup for auto-setup."
                )
                sys.exit(1)

            api_token = os.getenv("NOCDB_API_TOKEN", jwt_token)
            if os.getenv("NOCDB_API_TOKEN"):
                logger.info("Using API token from NOCDB_API_TOKEN env var")
            else:
                logger.info("Using JWT token as API token")

        # Step 6: Load schema
        schema_dir = os.path.dirname(os.path.abspath(__file__))
        schema_path = os.path.join(schema_dir, "nocodb-schema.json")
        logger.info(f"Loading schema from {schema_path}...")
        schema = load_schema(schema_path)

        # Filter tables if --table was specified
        tables_to_create = schema["tables"]
        if args.table:
            tables_to_create = [t for t in tables_to_create if t["title"] == args.table]
            if not tables_to_create:
                logger.error(f"Table '{args.table}' not found in schema")
                sys.exit(1)

        # Step 7: Create tables (idempotent)
        logger.info(f"Creating {len(tables_to_create)} table(s)...")
        created_tables = {}

        for table_def in tables_to_create:
            table_id = create_table_idempotent(
                base_url, api_token, base_id, table_def, force=args.force
            )
            created_tables[table_def["title"]] = table_id

        # Step 8: Import CSV data if requested
        if args.import_data:
            logger.info(f"Importing data from {args.import_data}...")
            for table_def in tables_to_create:
                csv_path = os.path.join(
                    args.import_data, f"{table_def['title']}-Grid view.csv"
                )
                if os.path.exists(csv_path):
                    table_id = created_tables.get(table_def["title"])
                    if table_id:
                        import_csv_data(
                            base_url, api_token, base_id, table_id, csv_path
                        )
                else:
                    logger.info(
                        f"No CSV found for '{table_def['title']}' "
                        f"(expected: {csv_path})"
                    )

        logger.info("Bootstrap complete.")
        logger.info(f"Tables created: {', '.join(created_tables.keys())}")

    except RuntimeError as e:
        logger.error(f"Bootstrap failed: {e}")
        logger.debug(traceback.format_exc())
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        logger.debug(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
