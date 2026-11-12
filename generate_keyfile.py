"""
Generate a MongoDB keyfile for replica-set internal auth.
Run once before `docker-compose up`.
"""
import os, base64, secrets

keyfile = os.path.join(os.path.dirname(__file__), "mongo-keyfile")
key = base64.b64encode(secrets.token_bytes(756)).decode()

with open(keyfile, "w") as f:
    f.write(key)

# On Linux/Mac the keyfile must be chmod 400
try:
    os.chmod(keyfile, 0o400)
except Exception:
    pass

print(f"✅  mongo-keyfile written to {keyfile}")
print("    Pass this file to mongod via --keyFile /etc/mongo/keyfile")

