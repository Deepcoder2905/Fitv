from dotenv import load_dotenv
load_dotenv()
import os
from datetime import timedelta
import urllib.parse

class Config:
    # Database configuration - using SQLite for simplicity
    db_user = os.environ.get('POSTGRES_USER')
    db_password = urllib.parse.quote_plus(os.environ.get('POSTGRES_PASSWORD'))
    db_host = os.environ.get('DATABASE_HOST')
    db_port = os.environ.get('DATABASE_PORT')
    db_name = os.environ.get('POSTGRES_DB')
    
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'deepubhai'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'deepubhai' 
    # Gemini API Key
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY') 