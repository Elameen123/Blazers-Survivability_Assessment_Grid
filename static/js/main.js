// static/js/main.js
console.log("Main.js is loading...");

// Shared auth token for all API calls. SAG uses an org-level gate; when
// launched from the Command Center we authenticate automatically so the
// operator never sees a separate login. Token is attached to every fetch.
let BZ_AUTH_TOKEN = null;

function bzFetch(url, options = {}) {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    if (BZ_AUTH_TOKEN) opts.headers['Auth-Token'] = BZ_AUTH_TOKEN;
    return fetch(url, opts);
}

async function ensureAuth() {
    if (BZ_AUTH_TOKEN) return true;
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Org-level gate. Real per-user auth is the Command Center's job.
            body: JSON.stringify({ organization: 'Blazers' })
        });
        if (res.ok) {
            const data = await res.json();
            BZ_AUTH_TOKEN = data.token || 'blazers_auth_token';
            window.BZ_AUTH_TOKEN = BZ_AUTH_TOKEN;
            return true;
        }
    } catch (e) {
        console.error('Auto-auth failed:', e);
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async function() {
    // Authenticate first, THEN load protected data — no more 401 cascade.
    const ok = await ensureAuth();
    if (!ok) {
        showLoginForm();
        return;
    }
    await fetchLogo();
    await loadData();

    document.getElementById('generateGrid').addEventListener('click', async function(e) {
        e.preventDefault();
        await ensureAuth();
        await generateGrid();
        await loadData();
    });
});

// Authentication functions
async function checkAuthentication() {
    const ok = await ensureAuth();
    if (!ok) { showLoginForm(); return; }
    await fetchLogo();
    await loadData();
}

function showLoginForm() {
    const loginForm = document.createElement('div');
    loginForm.className = 'login-modal';
    loginForm.innerHTML = `
        <div class="login-container">
            <h3>Login Required</h3>
            <input type="email" id="email" placeholder="Email" />
            <input type="password" id="password" placeholder="Password" />
            <button id="login-button">Login</button>
        </div>
    `;
    document.body.appendChild(loginForm);

    document.getElementById('login-button').addEventListener('click', async function() {
        await login();
    });
}

async function login() {
    try {
        const ok = await ensureAuth();
        if (!ok) throw new Error('Authentication failed');
        document.querySelector('.login-modal')?.remove();
        await fetchLogo();
        await loadData();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function fetchLogo() {
    try {
        const response = await bzFetch('/api/logo');
        if (!response.ok) throw new Error('Failed to fetch logo');
        
        const data = await response.json();
        console.log(data.url);
        document.getElementById('logo').src = data.url;
    } catch (error) {
        console.error('Error loading logo:', error);
    }
}

// Data loading functions
let samples = [];
let dataset = [];
let map = null;

async function loadData() {
    try {
        const [samplesResponse, datasetResponse] = await Promise.all([
            bzFetch(window.BZ_samplesUrl ? window.BZ_samplesUrl() : '/api/samples'),
            bzFetch('/api/dataset')
        ]);
        
        if (!samplesResponse.ok || !datasetResponse.ok) {
            throw new Error('Failed to fetch data');
        }
        
        samples = await samplesResponse.json();
        dataset = await datasetResponse.json();
        
        console.log(samples);
        console.log(dataset);
        
        populateTable();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function populateTable() {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    for (const sampleId in samples) {
        const sample = samples[sampleId];
        const row = document.createElement('tr');
        
        // Add sample name
        const nameCell = document.createElement('td');
        nameCell.textContent = sample.image_name;
        row.appendChild(nameCell);
        
        // Add rock type
        const typeCell = document.createElement('td');
        typeCell.textContent = sample.type || 'Not Analyzed';
        row.appendChild(typeCell);
        
        // Add additional information from the dataset
        if (sample.type) {
            const matchedData = dataset.find(item => 
                item.type.toLowerCase() === sample.type.toLowerCase()
            );
            
            if (matchedData) {
                // Formation process
                const formationCell = document.createElement('td');
                formationCell.textContent = matchedData.formation_process || 'N/A';
                row.appendChild(formationCell);
                
                // Texture
                const textureCell = document.createElement('td');
                textureCell.textContent = matchedData.texture || 'N/A';
                row.appendChild(textureCell);
                
                // Structure
                const structureCell = document.createElement('td');
                structureCell.textContent = matchedData.structure || 'N/A';
                row.appendChild(structureCell);
                
                // Life support potential
                const lifeSupportCell = document.createElement('td');
                const percentage = matchedData.life_support_potential?.percentage;
                lifeSupportCell.textContent = percentage ? `${percentage.toFixed(2)}%` : 'N/A';
                lifeSupportCell.className = percentage >= 50 ? 'green' : 'red';
                row.appendChild(lifeSupportCell);
            } else {
                // No matching data found
                for (let i = 0; i < 4; i++) {
                    const cell = document.createElement('td');
                    cell.textContent = 'No Data';
                    row.appendChild(cell);
                }
            }
        } else {
            // No rock type available
            for (let i = 0; i < 4; i++) {
                const cell = document.createElement('td');
                cell.textContent = 'No Type';
                row.appendChild(cell);
            }
        }
        
        tableBody.appendChild(row);
    }
}

// Map and grid generation functions
async function generateGrid() {
    // Get coordinates from form
    const researchLat = parseFloat(document.getElementById('location-lat').value);
    const researchLng = parseFloat(document.getElementById('location-long').value);
    const studyLat = parseFloat(document.getElementById('study-lat').value);
    const studyLng = parseFloat(document.getElementById('study-long').value);
    
    try {
        const summary = computeHabitabilitySummary();
        const response = await bzFetch('/api/generate_grid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                researchLat,
                researchLng,
                studyLat,
                studyLng,
                missionId: (window.BZ_MISSION && window.BZ_MISSION.id) || null,
                summary
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate grid');
        }
        
        const result = await response.json();
        renderSummary(summary, result.persisted);
        try {
            createMap(researchLat, researchLng, studyLat, studyLng);
        } catch (mapErr) {
            console.error('Map render error (summary still saved):', mapErr);
        }
    } catch (error) {
        console.error('Error generating grid:', error);
        alert('Failed to generate grid: ' + error.message);
    }
}

function createMap(researchLat, researchLng, studyLat, studyLng) {
    // Remove existing map if present
    if (map) {
        map.remove();
    }
    
    // Create new map centered on research location
    map = L.map('map').setView([researchLat, researchLng], 17);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
    }).addTo(map);
    
    // Add circle for research location
    L.circle([researchLat, researchLng], {
        color: 'rgb(158, 118, 16)',
        radius: 800
    }).addTo(map)
        .bindPopup('Research Location')
        .openPopup();
    
    // Add circle for study area
    L.circle([studyLat, studyLng], {
        color: 'navy',
        radius: 600
    }).addTo(map)
        .bindPopup('Study Area')
        .openPopup();
    
    // Grid size for sample locations
    const gridSize = 0.0001;
    
    // Array to hold coordinates for life-supporting locations
    const lifeSupportingLocations = [];
    
    // Add markers and grids for each sample
    for (const sampleId in samples) {
        const sample = samples[sampleId];
        
        if (sample.latitude && sample.longitude) {
            const lat = parseFloat(sample.latitude);
            const lng = parseFloat(sample.longitude);
            
            // Find matching dataset entry
            const matchingData = dataset.find(data => 
                data.type && sample.type && 
                data.type.toLowerCase() === sample.type.toLowerCase()
            );
            
            // Determine color based on life support potential
            let rectColor = "red";
            if (matchingData && matchingData.life_support_potential && 
                matchingData.life_support_potential.percentage >= 50) {
                rectColor = "blue";
                lifeSupportingLocations.push([lat, lng]);
            }
            
            // Add rectangle grid around sample location
            const bounds = [
                [lat - gridSize, lng - gridSize],
                [lat + gridSize, lng + gridSize]
            ];
            L.rectangle(bounds, { color: rectColor, weight: 1 }).addTo(map)
                .bindPopup(sample.image_name);
            
            // Add marker for sample location
            L.marker([lat, lng]).addTo(map)
                .bindPopup(sample.image_name);
        }
    }
    
    // Create convex hull for life-supporting locations
    if (lifeSupportingLocations.length >= 3) {
        const hullPoints = calculateConvexHull(lifeSupportingLocations);
        const simplifiedHull = simplifyPath(hullPoints, 0.0001);
        
        L.polygon(simplifiedHull, { color: 'green', weight: 3 }).addTo(map)
            .bindPopup('Potential Life-Supporting Area');
    }
    
    // Fit map to include all points
    const allPoints = [
        [researchLat, researchLng],
        [studyLat, studyLng],
        ...Object.values(samples)
            .filter(s => s.latitude && s.longitude)
            .map(s => [parseFloat(s.latitude), parseFloat(s.longitude)])
    ];
    
    if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds);
        map.setView([researchLat, researchLng], 16);
    }
}

// Algorithm for calculating convex hull (Gift Wrapping algorithm)
function calculateConvexHull(points) {
    if (points.length < 3) return points;
    
    // Find leftmost point
    let leftMost = points[0];
    for (let i = 1; i < points.length; i++) {
        if (points[i][0] < leftMost[0]) {
            leftMost = points[i];
        }
    }
    
    const hull = [];
    let currentPoint = leftMost;
    let endPoint;
    
    do {
        hull.push(currentPoint);
        endPoint = points[0];
        
        for (let i = 1; i < points.length; i++) {
            // Check orientation: clockwise or counterclockwise
            const crossProduct = ((endPoint[0] - currentPoint[0]) * (points[i][1] - currentPoint[1])) -
                ((endPoint[1] - currentPoint[1]) * (points[i][0] - currentPoint[0]));
            
            if (endPoint === currentPoint || crossProduct > 0) {
                endPoint = points[i];
            }
        }
        
        currentPoint = endPoint;
    } while (endPoint !== leftMost);
    
    return hull;
}

// Ramer-Douglas-Peucker algorithm for path simplification
function simplifyPath(points, tolerance) {
    if (points.length < 3) return points;
    
    // Helper function to calculate perpendicular distance
    function perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd[0] - lineStart[0];
        const dy = lineEnd[1] - lineStart[1];
        
        const area = Math.abs(dx * (lineStart[1] - point[1]) - dy * (lineStart[0] - point[0]));
        const length = Math.sqrt(dx * dx + dy * dy);
        
        return area / length;
    }
    
    let dmax = 0;
    let index = 0;
    
    for (let i = 1; i < points.length - 1; i++) {
        const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }
    
    if (dmax > tolerance) {
        const recResults1 = simplifyPath(points.slice(0, index + 1), tolerance);
        const recResults2 = simplifyPath(points.slice(index), tolerance);
        
        return recResults1.slice(0, -1).concat(recResults2);
    } else {
        return [points[0], points[points.length - 1]];
    }
}
/* =====================================================================
   BLAZERS additions: habitability summary (computed from the same data
   the map uses) + on-page summary chips. The summary is what SAG sends
   back to the mission so the Command Center can show the spatial verdict.
   ===================================================================== */
function computeHabitabilitySummary() {
    const habitable = [];
    let total = 0;
    let sumLifeSupport = 0;
    let countedLifeSupport = 0;

    for (const sampleId in samples) {
        const sample = samples[sampleId];
        if (!sample.latitude || !sample.longitude) continue;
        total++;
        const matchingData = dataset.find(d =>
            d.type && sample.type && d.type.toLowerCase() === sample.type.toLowerCase()
        );
        const pct = matchingData && matchingData.life_support_potential
            ? matchingData.life_support_potential.percentage : null;
        if (pct != null) { sumLifeSupport += pct; countedLifeSupport++; }
        if (pct != null && pct >= 50) {
            habitable.push([parseFloat(sample.latitude), parseFloat(sample.longitude)]);
        }
    }

    let hull = [];
    if (habitable.length >= 3) {
        hull = simplifyPath(calculateConvexHull(habitable), 0.0001);
    }

    return {
        totalSamples: total,
        habitableCount: habitable.length,
        avgLifeSupport: countedLifeSupport ? +(sumLifeSupport / countedLifeSupport).toFixed(1) : 0,
        hull: hull,
        generatedAt: Date.now()
    };
}

function renderSummary(summary, persisted) {
    const strip = document.getElementById('summary-strip');
    if (!strip) return;
    const okClass = summary.habitableCount > 0 ? 'ok' : '';
    const note = summary.totalSamples === 0
        ? '<div class="chip"><div class="k">Note</div><div class="v" style="font-size:12px;line-height:1.3;color:var(--ink-3)">No georeferenced samples — add lat/lng + rock type in IAS to map habitability.</div></div>'
        : '';
    strip.innerHTML = `
        <div class="chip"><div class="k">Georeferenced</div><div class="v">${summary.totalSamples}</div></div>
        <div class="chip ${okClass}"><div class="k">Habitable Zones</div><div class="v">${summary.habitableCount}</div></div>
        <div class="chip"><div class="k">Avg Life Support</div><div class="v">${summary.avgLifeSupport}%</div></div>
        ${persisted ? '<div class="chip ok"><div class="k">Synced</div><div class="v">✓</div></div>' : ''}
        ${note}
    `;
}
