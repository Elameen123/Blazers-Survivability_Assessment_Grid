// static/js/main.js
console.log("Main.js is loading...");
document.addEventListener('DOMContentLoaded', function() {
    // Check for existing authentication
    checkAuthentication();
    fetchLogo();
        loadData();
    
    // Add event listeners
    document.getElementById('generateGrid').addEventListener('click', function(e) {
        e.preventDefault();
        generateGrid();
        fetchLogo();
        loadData();
    });
});

// Authentication functions
async function checkAuthentication() {
    try {
        // In a real app, check session validity from the server
        await fetchLogo();
        await loadData();
    } catch (error) {
        showLoginForm();
    }
}

function showLoginForm() {
    const loginForm = document.createElement('div');
    loginForm.className = 'login-modal';
    loginForm.innerHTML = `
        <div class="login-container">
            <h3>Login Required</h3>
            <input type="email" id="email" placeholder="Email" value="lanre.mohammed23@gmail.com" />
            <input type="password" id="password" placeholder="Password" value="••••••••" />
            <button id="login-button">Login</button>
        </div>
    `;
    document.body.appendChild(loginForm);
    
    document.getElementById('login-button').addEventListener('click', async function() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        await login(email, password);
    });
}

async function login(email, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        
        document.querySelector('.login-modal')?.remove();
        await fetchLogo();
        await loadData();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function fetchLogo() {
    try {
        const response = await fetch('/api/logo');
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
            fetch('/api/samples'),
            fetch('/api/dataset')
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
        const response = await fetch('/api/generate_grid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                researchLat,
                researchLng,
                studyLat,
                studyLng
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate grid');
        }
        
        await response.json(); // Process any returned data
        createMap(researchLat, researchLng, studyLat, studyLng);
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