"""Build tools/macro/data.json for the macro dashboard.

Runs in GitHub Actions every weekday (see .github/workflows/macro-data.yml).
Standard library only. Public sources, no API keys:
  - ECB Data Portal API  https://data-api.ecb.europa.eu
  - FRED (St. Louis Fed) https://fred.stlouisfed.org/graph/fredgraph.csv
If one series fails, the previous values for that series are kept and the
failure is recorded in data.json, so the page never goes blank.

Run locally:  python scripts/fetch_macro.py
"""
import csv
import datetime as dt
import io
import json
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "macro", "data.json")
START = "2010-01-01"
UA = {"User-Agent": "hammaadmondal.github.io macro dashboard (github actions)", "Accept": "text/csv"}

ECB = "https://data-api.ecb.europa.eu/service/data/{flow}/{key}?startPeriod={start}&format=csvdata"
FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={id}&cosd={start}"

# id: (source, flow/series, key, label, unit, note)
SERIES = {
    "ecb_dfr":   ("ecb", "FM",  "D.U2.EUR.4F.KR.DFR.LEV", "ECB deposit facility rate", "%", "ECB, FM.D.U2.EUR.4F.KR.DFR.LEV"),
    "fed_upper": ("fred", "DFEDTARU", None, "Fed funds target, upper bound", "%", "Federal Reserve via FRED, DFEDTARU"),
    "ea_hicp":   ("ecb", "ICP", "M.U2.N.000000.4.ANR", "Euro area HICP inflation", "% y/y", "Eurostat/ECB, ICP.M.U2.N.000000.4.ANR"),
    "ea_core":   ("ecb", "ICP", "M.U2.N.XEF000.4.ANR", "Euro area core HICP", "% y/y", "Eurostat/ECB, ICP.M.U2.N.XEF000.4.ANR (excl. energy, food, alcohol, tobacco)"),
    "ie_hicp":   ("ecb", "ICP", "M.IE.N.000000.4.ANR", "Ireland HICP inflation", "% y/y", "Eurostat/ECB, ICP.M.IE.N.000000.4.ANR"),
    "us_cpi":    ("fred", "CPIAUCSL", None, "US CPI inflation", "% y/y", "BLS via FRED, CPIAUCSL (12-month change computed)"),
    "euribor3m": ("ecb", "FM",  "M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA", "3-month Euribor", "%", "ECB, FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA (monthly average)"),
    "eurusd":    ("ecb", "EXR", "D.USD.EUR.SP00.A", "EUR/USD", "USD per EUR", "ECB reference rate, EXR.D.USD.EUR.SP00.A"),
    "ie_10y":    ("ecb", "IRS", "M.IE.L.L40.CI.0000.EUR.N.Z", "Ireland 10-year yield", "%", "ECB, IRS.M.IE.L.L40.CI.0000.EUR.N.Z (monthly average)"),
    "de_10y":    ("ecb", "IRS", "M.DE.L.L40.CI.0000.EUR.N.Z", "Germany 10-year yield", "%", "ECB, IRS.M.DE.L.L40.CI.0000.EUR.N.Z (monthly average)"),
    "us_10y":    ("fred", "DGS10", None, "US 10-year Treasury yield", "%", "US Treasury via FRED, DGS10"),
    "us_2y":     ("fred", "DGS2", None, "US 2-year Treasury yield", "%", "US Treasury via FRED, DGS2"),
}
# Yield curves: maturity in years -> series
EA_CURVE = {0.25: "SR_3M", 1: "SR_1Y", 2: "SR_2Y", 3: "SR_3Y", 5: "SR_5Y", 7: "SR_7Y", 10: "SR_10Y", 15: "SR_15Y", 20: "SR_20Y", 30: "SR_30Y"}
US_CURVE = {0.25: "DGS3MO", 0.5: "DGS6MO", 1: "DGS1", 2: "DGS2", 3: "DGS3", 5: "DGS5", 7: "DGS7", 10: "DGS10", 20: "DGS20", 30: "DGS30"}


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read().decode("utf-8")
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"  retry {i + 1} after {e}", file=sys.stderr)
            time.sleep(4 * (i + 1))


def norm_date(p):
    """'2026-10' -> '2026-10-01'; daily dates unchanged."""
    return p + "-01" if len(p) == 7 else p[:10]


def ecb_rows(flow, key, start=START):
    """Returns {series_key: [(date, value), ...]} (key may use + for several series)."""
    text = get(ECB.format(flow=flow, key=key, start=start))
    out = {}
    for row in csv.DictReader(io.StringIO(text)):
        v = row.get("OBS_VALUE", "")
        if v in ("", "NaN"):
            continue
        out.setdefault(row["KEY"], []).append((norm_date(row["TIME_PERIOD"]), float(v)))
    for k in out:
        out[k].sort()
    return out


def fred_rows(sid, start=START):
    text = get(FRED.format(id=sid, start=start))
    rows = list(csv.reader(io.StringIO(text)))
    obs = []
    for r in rows[1:]:
        if len(r) < 2 or r[1] in ("", "."):
            continue
        obs.append((r[0][:10], float(r[1])))
    return obs


def yoy(obs):
    """12-month % change for a monthly index."""
    idx = dict(obs)
    out = []
    for d, v in obs:
        y, m = int(d[:4]), d[5:7]
        prev = idx.get(f"{y - 1}-{m}-01")
        if prev:
            out.append((d, round((v / prev - 1) * 100, 2)))
    return out


def monthly(obs):
    """Last observation in each month (keeps charts light)."""
    by = {}
    for d, v in obs:
        by[d[:7]] = (d, v)
    return [by[k] for k in sorted(by)]


def year_ago(obs):
    if not obs:
        return None
    last = dt.date.fromisoformat(obs[-1][0])
    target = (last - dt.timedelta(days=365)).isoformat()
    prior = [o for o in obs if o[0] <= target]
    return prior[-1] if prior else None


def pack(obs, daily):
    hist = monthly(obs) if daily else obs
    return {"latest": obs[-1], "year_ago": year_ago(obs), "obs": [[d, round(v, 4)] for d, v in hist]}


def curve_from(series_by_tenor):
    """series_by_tenor: {tenor: [(date, val), ...]} -> latest curve and curve one year earlier."""
    dates = [obs[-1][0] for obs in series_by_tenor.values() if obs]
    if not dates:
        raise ValueError("no curve data")
    asof = min(dates)  # last date every tenor has
    target = (dt.date.fromisoformat(asof) - dt.timedelta(days=365)).isoformat()
    now, then, then_date = [], [], None
    for t in sorted(series_by_tenor):
        obs = series_by_tenor[t]
        a = [o for o in obs if o[0] <= asof]
        b = [o for o in obs if o[0] <= target]
        if a:
            now.append([t, round(a[-1][1], 3)])
        if b:
            then.append([t, round(b[-1][1], 3)])
            then_date = max(then_date or b[-1][0], b[-1][0])
    return {"date": asof, "year_ago_date": then_date, "now": now, "year_ago": then}


def main():
    try:
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f)
    except Exception:  # noqa: BLE001
        old = {"series": {}, "curves": {}}

    data = {"updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "series": {}, "curves": {}, "errors": []}

    for sid, (src, flow, key, label, unit, note) in SERIES.items():
        print(f"{sid} ...", file=sys.stderr)
        try:
            if src == "ecb":
                rows = ecb_rows(flow, key)
                obs = next(iter(rows.values()))
                daily = key.startswith("D.")
            else:
                obs = fred_rows(flow, START if flow != "CPIAUCSL" else "2009-01-01")
                daily = flow.startswith("DGS") or flow.startswith("DFED")
                if flow == "CPIAUCSL":
                    obs = yoy(obs)
                    daily = False
            if not obs:
                raise ValueError("empty series")
            data["series"][sid] = {"label": label, "unit": unit, "source": note, **pack(obs, daily)}
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED: {e}", file=sys.stderr)
            data["errors"].append(f"{sid}: {e}")
            if sid in old.get("series", {}):
                data["series"][sid] = old["series"][sid]

    curve_start = (dt.date.today() - dt.timedelta(days=430)).isoformat()
    try:
        key = "B.U2.EUR.4F.G_N_A.SV_C_YM." + "+".join(EA_CURVE.values())
        rows = ecb_rows("YC", key, curve_start)
        by_tenor = {t: rows.get(f"YC.B.U2.EUR.4F.G_N_A.SV_C_YM.{code}", []) for t, code in EA_CURVE.items()}
        data["curves"]["ea"] = {"label": "Euro area AAA government yield curve (spot)", "source": "ECB, YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_*", **curve_from(by_tenor)}
    except Exception as e:  # noqa: BLE001
        print(f"curve ea FAILED: {e}", file=sys.stderr)
        data["errors"].append(f"curve ea: {e}")
        if "ea" in old.get("curves", {}):
            data["curves"]["ea"] = old["curves"]["ea"]
    try:
        by_tenor = {}
        for t, code in US_CURVE.items():
            by_tenor[t] = fred_rows(code, curve_start)
        data["curves"]["us"] = {"label": "US Treasury yield curve (constant maturity)", "source": "US Treasury via FRED, DGS3MO to DGS30", **curve_from(by_tenor)}
    except Exception as e:  # noqa: BLE001
        print(f"curve us FAILED: {e}", file=sys.stderr)
        data["errors"].append(f"curve us: {e}")
        if "us" in old.get("curves", {}):
            data["curves"]["us"] = old["curves"]["us"]

    if not data["series"]:
        sys.exit("No series fetched; leaving data.json unchanged.")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"wrote {OUT}: {len(data['series'])} series, {len(data['curves'])} curves, {len(data['errors'])} errors", file=sys.stderr)


if __name__ == "__main__":
    main()
