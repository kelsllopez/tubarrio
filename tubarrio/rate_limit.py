from django.core.cache import cache


def is_rate_limited(request, key: str, limit: int = 120, window_seconds: int = 60) -> bool:
    """
    True si se excede el límite (no incrementar más).
    key: prefijo (ej. 'api_negocios', 'ingresa_negocio').
    """
    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '0')
    cache_key = f"rl:{key}:{ip}"
    n = cache.get(cache_key, 0)
    if n >= limit:
        return True
    try:
        cache.set(cache_key, n + 1, window_seconds)
    except Exception:
        cache.set(cache_key, 1, window_seconds)
    return False
