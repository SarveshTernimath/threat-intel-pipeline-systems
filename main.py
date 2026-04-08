import os
import uvicorn
from api.server import app

if __name__ == "__main__":
    # Render naturally injects the PORT environment variable
    # If not found, fallback to 8000 for local development
    port = int(os.environ.get("PORT", 8000))
    print(f"Booting native Uvicorn on 0.0.0.0:{port} for Render Loadbalancer")
    uvicorn.run("api.server:app", host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")
