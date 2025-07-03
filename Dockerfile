# Stage 1: Build React frontend
FROM node:18 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/ .
RUN npm install && npm run build

# Stage 2: Build Flask backend and serve frontend
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential libpq-dev

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy all backend project files
COPY . .

# Copy built React frontend from previous stage
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Expose Flask port
EXPOSE 8000

# Start Flask app
CMD ["python", "app.py"]
