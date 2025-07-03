// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'http://localhost:8000'  // When served by nginx in production
    : 'http://localhost:8000'; // For development

export default API_BASE_URL; 