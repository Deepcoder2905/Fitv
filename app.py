from flask import Flask, request, jsonify,send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, date
import json
import re
from config import Config
from models import db, User, SquatSession, PushupSession
import os
import redis
# Gemini (Google Generative AI) integration
try:
    import google.generativeai as genai
except ImportError:
    genai = None
from sqlalchemy import func, desc


app = Flask(__name__, static_folder="frontend/build", static_url_path="")
app.config.from_object(Config)

# Initialize extensions
CORS(app)
jwt = JWTManager(app)
db.init_app(app)
redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
redis_client = redis.Redis.from_url(redis_url)

with app.app_context():
    db.create_all()
import os



@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    file_path = os.path.join(app.static_folder, path)
    if path != "" and os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")
# Validation functions
def is_valid_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def is_valid_password(password):
    """Validate password strength"""
    return len(password) >= 6

def is_valid_username(username):
    """Validate username format"""
    return len(username) >= 3 and username.isalnum()


@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validation
        if not username or not email or not password:
            return jsonify({"error": "Username, email, and password are required"}), 400
        
        if not is_valid_username(username):
            return jsonify({"error": "Username must be at least 3 characters long and contain only letters and numbers"}), 400
        
        if not is_valid_email(email):
            return jsonify({"error": "Invalid email format"}), 400
        
        if not is_valid_password(password):
            return jsonify({"error": "Password must be at least 6 characters long"}), 400
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already exists"}), 409
        
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 409
        
        # Create new user
        user = User(username=username, email=email)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Create tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            "message": "User registered successfully",
            "user": user.to_dict(),
            "access_token": access_token,
            "refresh_token": refresh_token
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        username_or_email = data.get('username_or_email', '').strip()
        password = data.get('password', '')
        
        if not username_or_email or not password:
            return jsonify({"error": "Username/email and password are required"}), 400
        
        # Find user by username or email
        user = User.query.filter(
            (User.username == username_or_email) | (User.email == username_or_email.lower())
        ).first()
        
        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid username/email or password"}), 401
        
        # Create tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            "message": "Login successful",
            "user": user.to_dict(),
            "access_token": access_token,
            "refresh_token": refresh_token
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        current_user_id = get_jwt_identity()
        new_access_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            "access_token": new_access_token
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/profile', methods=['GET'])
# @jwt_required()
def get_profile():
    """Get current user profile"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/squat-session', methods=['POST'])
# @jwt_required()
def save_squat_session():
    """Save a completed squat session"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'squat_count' not in data:
            return jsonify({"error": "Missing squat_count in request"}), 400
        
        squat_count = int(data['squat_count'])
        duration = data.get('duration', 0)  # in seconds
        
        session = SquatSession(
            user_id=current_user_id,
            squat_count=squat_count,
            duration=duration
        )
        
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            "message": "Session saved successfully",
            "session": session.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/stats', methods=['GET'])
# @jwt_required()
def get_user_stats():
    """Get user statistics"""
    try:
        current_user_id = get_jwt_identity()
        
        # Get user's squat sessions
        sessions = SquatSession.query.filter_by(user_id=current_user_id).all()
        
        total_squats = sum(session.squat_count for session in sessions)
        sessions_completed = len(sessions)
        best_session = max([session.squat_count for session in sessions]) if sessions else 0
        average_per_session = total_squats / sessions_completed if sessions_completed > 0 else 0
        
        stats = {
            "total_squats": total_squats,
            "sessions_completed": sessions_completed,
            "best_session": best_session,
            "average_per_session": round(average_per_session, 1)
        }
        
        recent_sessions = [session.to_dict() for session in sessions[-10:]]  # Last 10 sessions
        
        return jsonify({
                "stats": stats,
                "recent_sessions": recent_sessions
            }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions', methods=['GET'])
# @jwt_required()
def get_sessions():
    """Get all squat sessions for current user"""
    try:
        current_user_id = get_jwt_identity()
        sessions = SquatSession.query.filter_by(user_id=current_user_id).order_by(SquatSession.timestamp.desc()).all()
            
        return jsonify({
                "sessions": [session.to_dict() for session in sessions],
                "total_sessions": len(sessions)
            }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
# @jwt_required()
def delete_session(session_id):
    """Delete a specific session"""
    try:
        current_user_id = get_jwt_identity()
        session = SquatSession.query.filter_by(id=session_id, user_id=current_user_id).first()
        
        if not session:
            return jsonify({"error": "Session not found"}), 404
    
        db.session.delete(session)
        db.session.commit()
    
        return jsonify({
                "message": "Session deleted successfully"
            }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/reset-stats', methods=['POST'])
# @jwt_required()
def reset_stats():
    """Reset all user statistics and sessions"""
    try:
        current_user_id = get_jwt_identity()
        
        # Delete all sessions for the user
        SquatSession.query.filter_by(user_id=current_user_id).delete()
        db.session.commit()
    
        return jsonify({
                "message": "All stats and sessions reset successfully"
            }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/exercise-ai')
def exercise_ai():
    query = request.args.get('query', '').strip()
    if not query:
        return jsonify({'error': 'Missing query parameter'}), 400
    cache_key = f"exercise_ai:{query.lower()}"
    cached = redis_client.get(cache_key)
    if cached:
        return jsonify(json.loads(cached))
    try:
        import google.generativeai as genai
    except ImportError:
        return jsonify({'error': 'Gemini library not installed'}), 500
    api_key = app.config.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'Gemini API key not configured'}), 500
    try:
        genai.configure(api_key=api_key)
        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
            "response_mime_type": "text/plain"
        }
        model = genai.GenerativeModel(model_name="gemini-2.5-pro",
    generation_config=generation_config,)
        prompt = f"""
You are a fitness expert AI. Provide a detailed, friendly, and practical summary for the exercise: {query}.
Include the following sections:
1. Introduction (what is this exercise)
2. three Benefits 
3. Recommended weight and reps (give general advice for beginners/intermediate/advanced in table form)
4. Step-by-step instructions (numbered)
Format your answer with clear section headings.
Note: if the input is not an exercise, just say "I'm sorry, I can't help with that."
"""
        response = model.generate_content(prompt)
        summary = response.text.strip()
        result = {'name': query, 'summary': summary}
        redis_client.setex(cache_key, 60*60*24*3, json.dumps(result))  # Cache for 3 days
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/pushup-session', methods=['POST'])
# @jwt_required()
def save_pushup_session():
    """Save a completed pushup session"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        if not data or 'pushup_count' not in data:
            return jsonify({"error": "Missing pushup_count in request"}), 400
        pushup_count = int(data['pushup_count'])
        duration = data.get('duration', 0)  # in seconds
        session = PushupSession(
            user_id=current_user_id,
            pushup_count=pushup_count,
            duration=duration
        )
        db.session.add(session)
        db.session.commit()
        return jsonify({
            "message": "Pushup session saved successfully",
            "session": session.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/pushup-stats', methods=['GET'])
# @jwt_required()
def get_pushup_stats():
    """Get user pushup statistics"""
    try:
        current_user_id = get_jwt_identity()
        sessions = PushupSession.query.filter_by(user_id=current_user_id).all()
        total_pushups = sum(session.pushup_count for session in sessions)
        sessions_completed = len(sessions)
        best_session = max([session.pushup_count for session in sessions]) if sessions else 0
        average_per_session = total_pushups / sessions_completed if sessions_completed > 0 else 0
        stats = {
            "total_pushups": total_pushups,
            "sessions_completed": sessions_completed,
            "best_session": best_session,
            "average_per_session": round(average_per_session, 1)
        }
        recent_sessions = [session.to_dict() for session in sessions[-10:]]  # Last 10 sessions
        return jsonify({
            "stats": stats,
            "recent_sessions": recent_sessions
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/pushup-sessions', methods=['GET'])
# @jwt_required()
def get_pushup_sessions():
    """Get all pushup sessions for current user"""
    try:
        current_user_id = get_jwt_identity()
        sessions = PushupSession.query.filter_by(user_id=current_user_id).order_by(PushupSession.timestamp.desc()).all()
        return jsonify({
            "sessions": [session.to_dict() for session in sessions],
            "total_sessions": len(sessions)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/pushup-sessions/<int:session_id>', methods=['DELETE'])
# @jwt_required()
def delete_pushup_session(session_id):
    """Delete a specific pushup session"""
    try:
        current_user_id = get_jwt_identity()
        session = PushupSession.query.filter_by(id=session_id, user_id=current_user_id).first()
        if not session:
            return jsonify({"error": "Session not found"}), 404
        db.session.delete(session)
        db.session.commit()
        return jsonify({
            "message": "Pushup session deleted successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/reset-pushup-stats', methods=['POST'])
# @jwt_required()
def reset_pushup_stats():
    """Reset all user pushup statistics and sessions"""
    try:
        current_user_id = get_jwt_identity()
        PushupSession.query.filter_by(user_id=current_user_id).delete()
        db.session.commit()
        return jsonify({
            "message": "All pushup stats and sessions reset successfully"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/leaderboard/squats')
def leaderboard_squats():
    results = (
        db.session.query(
            User.username,
            func.sum(SquatSession.squat_count).label('total_squats')
        )
        .join(SquatSession, SquatSession.user_id == User.id)
        .group_by(User.id)
        .order_by(desc('total_squats'))
        .limit(5)
        .all()
    )
    leaderboard = [{'username': r[0], 'total_squats': r[1]} for r in results]
    return jsonify({'leaderboard': leaderboard})

@app.route('/api/leaderboard/squats/daily')
def leaderboard_squats_daily():
    today = date.today()
    results = (
        db.session.query(
            User.username,
            func.sum(SquatSession.squat_count).label('total_squats')
        )
        .join(SquatSession, SquatSession.user_id == User.id)
        .filter(SquatSession.date == today)
        .group_by(User.id)
        .order_by(desc('total_squats'))
        .limit(5)
        .all()
    )
    leaderboard = [{'username': r[0], 'total_squats': r[1]} for r in results]
    return jsonify({'leaderboard': leaderboard})

@app.route('/api/leaderboard/pushups')
def leaderboard_pushups():
    results = (
        db.session.query(
            User.username,
            func.sum(PushupSession.pushup_count).label('total_pushups')
        )
        .join(PushupSession, PushupSession.user_id == User.id)
        .group_by(User.id)
        .order_by(desc('total_pushups'))
        .limit(5)
        .all()
    )
    leaderboard = [{'username': r[0], 'total_pushups': r[1]} for r in results]
    return jsonify({'leaderboard': leaderboard})

@app.route('/api/leaderboard/pushups/daily')
def leaderboard_pushups_daily():
    today = date.today()
    results = (
        db.session.query(
            User.username,
            func.sum(PushupSession.pushup_count).label('total_pushups')
        )
        .join(PushupSession, PushupSession.user_id == User.id)
        .filter(PushupSession.date == today)
        .group_by(User.id)
        .order_by(desc('total_pushups'))
        .limit(5)
        .all()
    )
    leaderboard = [{'username': r[0], 'total_pushups': r[1]} for r in results]
    return jsonify({'leaderboard': leaderboard})

print("Gemini API Key:", app.config.get('GEMINI_API_KEY'))
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
