"""
ClosetMate production perf smoke test.
Uses only stdlib. Hits public endpoints (no auth) at safe concurrency.
"""
import asyncio
import statistics
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = "https://apigateway-production-b91d.up.railway.app"

def hit(url, timeout=10):
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            r.read()
            ok = (r.status == 200)
    except Exception:
        ok = False
    return (time.perf_counter() - t0) * 1000, ok  # ms

def stats(samples, label):
    samples.sort()
    n = len(samples)
    if n == 0:
        print(f"{label}: no data")
        return
    print(f"\n{label} (n={n})")
    print(f"  min:    {samples[0]:7.1f} ms")
    print(f"  median: {statistics.median(samples):7.1f} ms")
    print(f"  p95:    {samples[int(n*0.95)]:7.1f} ms")
    print(f"  p99:    {samples[int(n*0.99)]:7.1f} ms")
    print(f"  max:    {samples[-1]:7.1f} ms")

def baseline(endpoint, n=50):
    print(f"\n=== Baseline: {n} sequential GETs to {endpoint} ===")
    samples = []
    errors = 0
    for _ in range(n):
        ms, ok = hit(BASE + endpoint)
        samples.append(ms)
        if not ok: errors += 1
    stats(samples, "sequential latency")
    print(f"  errors: {errors}/{n}")

def concurrent(endpoint, vusers=30, duration_s=30):
    print(f"\n=== Concurrent: {vusers} virtual users for {duration_s}s on {endpoint} ===")
    samples, errors = [], 0
    deadline = time.time() + duration_s
    def worker():
        local_samples, local_errors = [], 0
        while time.time() < deadline:
            ms, ok = hit(BASE + endpoint)
            local_samples.append(ms)
            if not ok: local_errors += 1
        return local_samples, local_errors
    with ThreadPoolExecutor(max_workers=vusers) as pool:
        futs = [pool.submit(worker) for _ in range(vusers)]
        for f in futs:
            s, e = f.result()
            samples.extend(s)
            errors += e
    total = len(samples)
    rps = total / duration_s
    stats(samples, "concurrent latency")
    print(f"  total requests: {total}")
    print(f"  errors:         {errors} ({100*errors/max(total,1):.2f}%)")
    print(f"  throughput:     {rps:.1f} req/s")

if __name__ == "__main__":
    # Baseline (single-user) latency for both endpoints
    baseline("/health", n=50)
    baseline("/api/health/all", n=50)
    # Concurrent load matching SRS target (30 users, 30s)
    concurrent("/health", vusers=30, duration_s=30)
    concurrent("/api/health/all", vusers=30, duration_s=30)
