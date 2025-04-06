from flask import Flask, render_template, request, jsonify, session
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

# This is the correct pattern for Vercel serverless functions with Flask
from flask import Response

def handler(event, context):
    """AWS Lambda / Vercel serverless function handler."""
    return awsgi_response(app, event, context)

def awsgi_response(app, event, context):
    """
    This function handles the WSGI to AWS Lambda / Vercel bridge
    """
    from io import StringIO
    import sys

    stdout_ = sys.stdout
    stderr_ = sys.stderr
    
    try:
        # Capture output to avoid Flask's default stdout/stderr handling
        sys.stdout = StringIO()
        sys.stderr = StringIO()
        
        # Process the request through Flask
        environ = {
            'wsgi.version': (1, 0),
            'wsgi.input': StringIO(event.get('body', '') or ''),
            'wsgi.errors': sys.stderr,
            'wsgi.multithread': False,
            'wsgi.multiprocess': False,
            'wsgi.run_once': False,
            'REQUEST_METHOD': event.get('httpMethod', 'GET'),
            'PATH_INFO': event.get('path', '/'),
            'SERVER_NAME': 'vercel',
            'SERVER_PORT': '443',
            'HTTP_HOST': event.get('headers', {}).get('host', 'vercel'),
            'CONTENT_LENGTH': str(len(event.get('body', '') or '')),
            'CONTENT_TYPE': event.get('headers', {}).get('content-type', ''),
            'QUERY_STRING': '&'.join([f"{k}={v}" for k, v in event.get('queryStringParameters', {}).items()]) if event.get('queryStringParameters') else '',
        }
        
        # Add HTTP headers
        for header, value in event.get('headers', {}).items():
            key = header.upper().replace('-', '_')
            if key not in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
                environ[f'HTTP_{key}'] = value
        
        # Get response from Flask app
        response_data = {}
        
        def start_response(status, response_headers, exc_info=None):
            status_code = int(status.split(' ')[0])
            response_data['statusCode'] = status_code
            response_data['headers'] = {h[0]: h[1] for h in response_headers}
            return lambda x: None  # No-op write function
        
        body = b''.join(list(app(environ, start_response)))
        response_data['body'] = body.decode('utf-8') if isinstance(body, bytes) else body
        
        return response_data
    
    finally:
        # Restore stdout/stderr
        sys.stdout = stdout_
        sys.stderr = stderr_

# For local development
if __name__ == '__main__':
    app.run(debug=True)

