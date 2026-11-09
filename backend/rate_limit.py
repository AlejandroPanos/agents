from slowapi import Limiter
from slowapi.util import get_remote_address

ENDPOINT_RATE_LIMIT = "60/minute"

limiter = Limiter(key_func=get_remote_address)
