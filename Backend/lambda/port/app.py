import os
import json
import boto3
from boto3.dynamodb.conditions import Attr
from urllib.parse import unquote_plus  # <-- IMPORTANT for /ports/{id}

TABLE = os.environ["PORTS_TABLE"]
ddb = boto3.resource("dynamodb").Table(TABLE)

# Fields returned in list view
BASIC_FIELDS = [
    "id", "name", "country", "state", "city", "pincode", "image_url"
]

# None => return full item in detail view
DETAIL_FIELDS = None


def _ok(body_obj, status=200):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body_obj, default=str),
    }


def _err(msg, status=400):
    return _ok({"error": msg}, status)


def _pick(item, fields):
    if fields is None:
        return item
    return {k: item.get(k) for k in fields}


def _build_text_filter(q: str):
    """
    Prefer *_lc attributes (current schema). If missing,
    fall back to case-sensitive contains on name/city/country.
    """
    if not q:
        return None

    # Lowercased fields
    f_lc = (
        Attr("name_lc").contains(q) |
        Attr("city_lc").contains(q) |
        Attr("country_lc").contains(q)
    )

    # Fallback (non-lc fields)
    f_cs = (
        Attr("name").contains(q) |
        Attr("city").contains(q) |
        Attr("country").contains(q)
    )

    return f_lc | f_cs


def _build_structured_filter(params):
    """
    Build a FilterExpression combining state/city/name/pincode
    (ANDed together). Name matches both exact and contains (lc + cs).
    """
    f = None

    state = (params.get("state") or "").strip()
    city = (params.get("city") or "").strip()
    name = (params.get("name") or "").strip()
    pincode = (params.get("pincode") or "").strip()

    def AND(a, b):
        return b if a is None else (a & b)

    if state:
        f = AND(
            f,
            (Attr("state").eq(state) | Attr("state_lc").eq(state.lower()))
        )

    if city:
        f = AND(
            f,
            (Attr("city").eq(city) | Attr("city_lc").eq(city.lower()))
        )

    if pincode:
        # exact or begins_with
        f = AND(
            f,
            (Attr("pincode").eq(pincode) | Attr("pincode").begins_with(pincode))
        )

    if name:
        name_lc = name.lower()
        name_filter = (
            Attr("name_lc").contains(name_lc) |
            Attr("name").contains(name)
        )
        f = AND(f, name_filter)

    return f


def _scan_all(filter_expression=None, projection=None, limit_soft=None):
    """
    Scan with pagination. Use projection to reduce payload in list views.
    limit_soft: if set, stop after returning roughly this many items.
    """
    kwargs = {}
    if filter_expression is not None:
        kwargs["FilterExpression"] = filter_expression

    if projection:
        # Build ProjectionExpression safely
        field_list = sorted(set(projection))
        pe = ", ".join(field_list)
        ean = {f"#n{i}": name for i, name in enumerate(field_list)}
        rev = {v: k for k, v in ean.items()}
        kwargs["ProjectionExpression"] = ", ".join(rev[n] for n in field_list)
        kwargs["ExpressionAttributeNames"] = ean

    items = []
    last_evaluated_key = None

    while True:
        if last_evaluated_key:
            kwargs["ExclusiveStartKey"] = last_evaluated_key

        resp = ddb.scan(**kwargs)
        batch = resp.get("Items", [])
        items.extend(batch)

        last_evaluated_key = resp.get("LastEvaluatedKey")

        if limit_soft and len(items) >= limit_soft:
            break
        if not last_evaluated_key:
            break

    return items


def handle_filters(params):
    """
    Returns distinct states/cities/ports/pincodes.
    Optional inputs: state, city (to cascade).
    """
    state = (params.get("state") or "").strip()
    city = (params.get("city") or "").strip()

    # Small capped scan to keep it light; in prod, maintain a cached meta item.
    items = _scan_all(
        projection=["state", "city", "name", "pincode"],
        limit_soft=2000,
    )

    def uniq_sorted(seq):
        return sorted({s for s in seq if s})

    states = uniq_sorted(x.get("state") for x in items)

    filtered_state = [x for x in items if (not state or x.get("state") == state)]
    cities = uniq_sorted(x.get("city") for x in filtered_state)

    filtered_city = [x for x in filtered_state if (not city or x.get("city") == city)]
    ports = uniq_sorted(x.get("name") for x in filtered_city)
    pincodes = uniq_sorted(x.get("pincode") for x in filtered_city)

    return {
        "states": states,
        "cities": cities,
        "ports": ports,
        "pincodes": pincodes,
    }


def handle_detail(port_id: str):
    """
    Fetch a single port by its id.

    Frontend sends /ports/{id} where id can be URL-encoded,
    e.g. PORT%23jnpt. We must decode it to match DynamoDB key
    "PORT#jnpt".
    """
    if not port_id:
        return _err("id required", 400)

    # *** KEY FIX ***
    # Decode any %XX sequences and '+' signs
    # PORT%23jnpt -> PORT#jnpt
    port_id = unquote_plus(port_id)

    resp = ddb.get_item(Key={"id": port_id})
    item = resp.get("Item")
    if not item:
        return _err("Not found", 404)

    return _ok(_pick(item, DETAIL_FIELDS))


def handle_list(params):
    """
    List/search ports.

    Supports:
      - ?q= free text
      - ?state=&city=&name=&pincode= structured filters
      - ?limit= soft cap on number of results
    """
    q = (params.get("q") or "").strip().lower()
    limit_param = params.get("limit")
    limit_soft = None

    if limit_param:
        try:
            limit_soft = max(1, min(int(limit_param), 2000))
        except Exception:
            limit_soft = None

    text_filter = _build_text_filter(q) if q else None
    structured_filter = _build_structured_filter(params)

    # Combine: if both present, AND them; else whichever exists
    if text_filter and structured_filter:
        filter_expression = text_filter & structured_filter
    else:
        filter_expression = text_filter or structured_filter

    items = _scan_all(
        filter_expression=filter_expression,
        projection=BASIC_FIELDS,  # list view: basics only
        limit_soft=limit_soft,
    )

    # Make sure "id" exists; if the data lacks it, synthesize (fallback).
    for i in items:
        if "id" not in i or not i.get("id"):
            i["id"] = f"SYNTH#{(i.get('name') or '')}#{(i.get('city') or '')}"

    cleaned = [{k: it.get(k) for k in BASIC_FIELDS} for it in items]
    return _ok(cleaned)


def lambda_handler(event, context):
    method = event.get("httpMethod", "GET")
    path = event.get("path", "") or ""
    params = event.get("queryStringParameters") or {}
    path_params = event.get("pathParameters") or {}

    # Preflight
    if method == "OPTIONS":
        return _ok({"ok": True})

    # Route: /ports/filters
    if method == "GET" and path.rstrip("/").endswith("/ports/filters"):
        data = handle_filters(params)
        return _ok(data)

    # Route: /ports/{id}
    if method == "GET" and path.rstrip("/").startswith("/ports/") and path.rstrip("/") != "/ports":
        # Try pathParameters first
        port_id = path_params.get("id")
        if not port_id:
            # Fallback: extract from path
            port_id = path.rstrip("/").split("/")[-1]
        return handle_detail(port_id)

    # Route: /ports (list/search)
    if method == "GET" and path.rstrip("/") == "/ports":
        return handle_list(params)

    return _err("Not found", 404)
