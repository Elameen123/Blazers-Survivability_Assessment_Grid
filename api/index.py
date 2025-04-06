# app.py - Flask Backend
from flask import Flask, render_template, request, jsonify, session
import os
import firebase_admin
from firebase_admin import credentials, db, storage, auth
from dotenv import load_dotenv
from functools import wraps

# Load environment variables
load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static')
) 

app.secret_key = os.getenv('FLASK_SECRET_KEY')

# Initialize Firebase with credentials from environment variables
cred = credentials.Certificate({
    "type": "service_account",
    "project_id": os.getenv('FIREBASE_PROJECT_ID'),
    "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
    "private_key": os.getenv('FIREBASE_PRIVATE_KEY').replace('\\n', '\n'),
    "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
    "client_id": os.getenv('FIREBASE_CLIENT_ID'),
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": os.getenv('FIREBASE_CLIENT_CERT_URL')
})

firebase_admin.initialize_app(cred, {
    'databaseURL': os.getenv('FIREBASE_DATABASE_URL'),
    'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET')
})

# Authentication middleware
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')
    
@app.route('/api/check-auth')
def check_auth():
    """Check if the user is authenticated."""
    authenticated = 'user_id' in session
    return jsonify({'authenticated': authenticated})

@app.route('/api/login', methods=['POST'])
def login():
    """Handle user authentication."""
    data = request.json
    organization = data.get('organization')
    
    if organization == "Blazers":
        # Create a simple user ID for the session
        session['user_id'] = 'blazers_user_id'
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Invalid organization name'}), 401

@app.route('/api/logo')
@login_required
def get_logo():
    """Return the static public URL for the team logo."""
    url = os.getenv('FIREBASE_LOGO_URL')
    return jsonify({'url': url})

@app.route('/api/samples')
@login_required
def get_samples():
    """Get all rock samples from the database."""
    ref = db.reference('Samples')
    samples = ref.get()
    print(samples)
    return jsonify(samples)
    

@app.route('/api/dataset')
@login_required
def get_dataset():
    """Get the dataset with rock type information."""
    ref = db.reference('Dataset')
    dataset = ref.get()
    return jsonify(dataset)

@app.route('/api/generate_grid', methods=['POST'])
@login_required
def generate_grid():
    """Generate grid data based on coordinates."""
    data = request.json
    research_location = {
        'lat': float(data.get('researchLat')),
        'lng': float(data.get('researchLng'))
    }
    study_area = {
        'lat': float(data.get('studyLat')),
        'lng': float(data.get('studyLng'))
    }
    
    # Processing would happen here in a real implementation
    return jsonify({
        'research_location': research_location,
        'study_area': study_area,
        'status': 'success'
    })

# For Vercel's Python serverless function
from http.server import BaseHTTPRequestHandler

# Correct handler for Vercel serverless
def handler(request, context):
    return app(request['headers'], start_response)

def start_response(status, response_headers, exc_info=None):
    return None