from dotenv import load_dotenv
import os
import redis

load_dotenv()
try:
    redis_client = redis.from_url(os.getenv("REDIS_URL"), decode_responses=True)
    redis_client.ping()
    print("Redis Connection: Successful")
except Exception as e:
    print("Redis Connection Error:", e)
