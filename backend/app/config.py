from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://localhost:27017/?replicaSet=rs0"
    DB_NAME: str = "equicity"
    MAPBOX_TOKEN: str = ""
    ALERT_DRI_THRESHOLD: float = 75.0
    ALERT_DRI_RESET: float = 70.0
    ALERT_COOLDOWN_DAYS: int = 14

    class Config:
        env_file = ".env"

settings = Settings()
