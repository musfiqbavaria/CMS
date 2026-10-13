"""Login is the brute-force target: strict per-IP rate limit (Redis-backed cache)."""

from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"
