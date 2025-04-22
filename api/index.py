from flask import Flask, render_template, request, jsonify, session, send_from_directory
import os
import firebase_admin
from firebase_admin import credentials, db, storage, auth
from dotenv import load_dotenv
from functools import wraps

# Load environment variables
load_dotenv()

# Define base directory properly for Vercel
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static')
) 

app.secret_key = os.getenv('FLASK_SECRET_KEY', 'default-secret-key')

# Initialize Firebase with credentials from environment variables
try:
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": os.getenv('FIREBASE_PROJECT_ID'),
        "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
        "private_key": os.getenv('FIREBASE_PRIVATE_KEY').replace('\\n', '\n') if os.getenv('FIREBASE_PRIVATE_KEY') else "",
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
except Exception as e:
    print(f"Firebase initialization error: {e}")

# Authentication middleware
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # For debugging purposes, print session contents
        print("Session contents:", session)
        
        # Check for authentication token in session or request headers
        auth_token = request.headers.get('Auth-Token')
        if 'user_id' not in session and auth_token != 'blazers_auth_token':
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

# Add favicon route to handle 404 error
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')
    
@app.route('/api/check-auth')
def check_auth():
    """Check if the user is authenticated."""
    authenticated = 'user_id' in session or request.headers.get('Auth-Token') == 'blazers_auth_token'
    return jsonify({'authenticated': authenticated})

@app.route('/api/login', methods=['POST'])
def login():
    """Handle user authentication."""
    data = request.json
    organization = data.get('organization')
    
    if organization == "Blazers":
        # Create a simple user ID for the session
        session['user_id'] = 'blazers_user_id'
        return jsonify({'success': True, 'token': 'blazers_auth_token'})
    else:
        return jsonify({'error': 'Invalid organization name'}), 401

@app.route('/api/logo')
@login_required
def get_logo():
    """Return the static public URL for the team logo."""
    url = os.getenv('FIREBASE_LOGO_URL', 'https://example.com/default-logo.png')  # Provide a default
    return jsonify({'url': url})

@app.route('/api/samples')
@login_required
def get_samples():
    """Get all rock samples from the database."""
    try:
        ref = db.reference('Samples')
        samples = ref.get()
        if samples is None:
            # Return empty data if no samples exist
            return jsonify([])
        return jsonify(samples)
    except Exception as e:
        print(f"Error fetching samples: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/dataset')
@login_required
def get_dataset():
    """Get the dataset with rock type information."""
    try:
        ref = db.reference('Dataset')
        dataset = ref.get()
        if dataset is None:
            # Return empty data if no dataset exists
            return jsonify({})
        return jsonify(dataset)
    except Exception as e:
        print(f"Error fetching dataset: {e}")
        return jsonify({'error': str(e)}), 500

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

# For local development
if __name__ == '__main__':
    app.run(debug=True)