from flask import Flask, render_template, request, jsonify, session, send_from_directory
import os
import firebase_admin
from firebase_admin import credentials, db, storage, auth
from dotenv import load_dotenv
from functools import wraps

# Load environment variables
load_dotenv()

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
        auth_token = request.headers.get('Auth-Token')
        if 'user_id' not in session and auth_token != 'blazers_auth_token':
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function


def mission_samples_path(mission_id):
    """Mission-scoped samples path, matching the GCC/IAS schema.
    Falls back to the legacy flat /Samples when no mission is supplied."""
    if mission_id:
        return f"missions/{mission_id}/sag/samples"
    return "Samples"


@app.route('/')
def index():
    """Render the main application page. Mission context (if any) is read
    client-side from the URL query params by main.js."""
    return render_template('index.html')


@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(BASE_DIR, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')


@app.route('/api/check-auth')
def check_auth():
    authenticated = 'user_id' in session or request.headers.get('Auth-Token') == 'blazers_auth_token'
    return jsonify({'authenticated': authenticated})


@app.route('/api/login', methods=['POST'])
def login():
    """Handle organisation-level authentication (unchanged contract)."""
    data = request.json or {}
    organization = data.get('organization') or data.get('email')  # tolerant of either field
    # Blazers org gate (kept from original). Real per-user auth is handled by
    # the Command Center session; SAG trusts the shared org token.
    if organization and 'blazers' in str(organization).lower():
        session['user_id'] = 'blazers_user_id'
        return jsonify({'success': True, 'token': 'blazers_auth_token'})
    return jsonify({'error': 'Invalid organization name'}), 401


@app.route('/api/logo')
@login_required
def get_logo():
    url = os.getenv('FIREBASE_LOGO_URL', '/static/brand/logo-mark.svg')
    return jsonify({'url': url})


@app.route('/api/mission_name')
@login_required
def mission_name():
    """Resolve a mission's human-readable name from its meta node."""
    mission_id = request.args.get('missionId')
    if not mission_id:
        return jsonify({'name': None})
    try:
        ref = db.reference(f"missions/{mission_id}/meta/name")
        name = ref.get()
        return jsonify({'name': name})
    except Exception as e:
        print(f"Error fetching mission name: {e}")
        return jsonify({'name': None})


@app.route('/api/samples')
@login_required
def get_samples():
    """Get rock samples — mission-scoped when a mission id is provided,
    else the legacy flat /Samples."""
    try:
        mission_id = request.args.get('missionId')
        ref = db.reference(mission_samples_path(mission_id))
        samples = ref.get()
        if samples is None:
            return jsonify([])
        return jsonify(samples)
    except Exception as e:
        print(f"Error fetching samples: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/dataset')
@login_required
def get_dataset():
    """Shared rock-type reference data (not mission-scoped)."""
    try:
        ref = db.reference('Dataset')
        dataset = ref.get()
        if dataset is None:
            return jsonify({})
        return jsonify(dataset)
    except Exception as e:
        print(f"Error fetching dataset: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate_grid', methods=['POST'])
@login_required
def generate_grid():
    """Persist the habitability summary the client computed for this mission.
    The grid geometry stays client-side (Leaflet); this stores the verdict so
    the Command Center can surface it on the mission overview."""
    data = request.json or {}
    research_location = {
        'lat': float(data.get('researchLat')),
        'lng': float(data.get('researchLng'))
    }
    study_area = {
        'lat': float(data.get('studyLat')),
        'lng': float(data.get('studyLng'))
    }

    mission_id = data.get('missionId')
    summary = data.get('summary')  # { totalSamples, habitableCount, avgLifeSupport, hull:[...] }

    persisted = False
    if mission_id and summary is not None:
        try:
            ref = db.reference(f"missions/{mission_id}/sag/summary")
            ref.set({
                'research_location': research_location,
                'study_area': study_area,
                'totalSamples': summary.get('totalSamples'),
                'habitableCount': summary.get('habitableCount'),
                'avgLifeSupport': summary.get('avgLifeSupport'),
                'habitablePolygon': summary.get('hull'),
                'generatedAt': summary.get('generatedAt'),
                'source': 'SAG'
            })
            # activity log entry for the GCC feed
            act = db.reference(f"missions/{mission_id}/activity").push()
            act.set({
                'type': 'sag_grid_generated',
                'note': f"{summary.get('habitableCount', 0)}/{summary.get('totalSamples', 0)} habitable zones",
                'at': summary.get('generatedAt'),
                'source': 'SAG'
            })
            persisted = True
        except Exception as e:
            print(f"Error persisting grid summary: {e}")

    return jsonify({
        'research_location': research_location,
        'study_area': study_area,
        'persisted': persisted,
        'status': 'success'
    })


# For local development
if __name__ == '__main__':
    app.run(debug=True, port=5000)
