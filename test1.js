// document.getElementById('location-form').addEventListener('submit', function(e) {
//   e.preventDefault();
  
//   // Get the latitude and longitude for PAU
//   const pauLatitude = parseFloat(document.getElementById('latitude').value);
//   const pauLongitude = parseFloat(document.getElementById('longitude').value);
  
//   // Get the latitude and longitude for the study area
//   const studyLatitude = parseFloat(document.getElementById('study-latitude').value);
//   const studyLongitude = parseFloat(document.getElementById('study-longitude').value);
  
//   // Initialize the map centered on PAU coordinates
//   const map = L.map('map').setView([pauLatitude, pauLongitude], 17);
  
//   // Add a tile layer to the map (OpenStreetMap tiles)
//   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//       maxZoom: 18,
//   }).addTo(map);
  
//   // Dummy data simulating processed images with life support potential
//   const dummyData = [
//       { lat: studyLatitude + 0.0002, lon: studyLongitude + 0.0002, lifeSupportPotential: 60 },
//       { lat: studyLatitude - 0.0002, lon: studyLongitude - 0.0002, lifeSupportPotential: 45 },
//       { lat: studyLatitude + 0.0004, lon: studyLongitude + 0.0004, lifeSupportPotential: 70 },
//       { lat: studyLatitude - 0.0004, lon: studyLongitude - 0.0004, lifeSupportPotential: 85 },
//       { lat: studyLatitude + 0.0003, lon: studyLongitude + 0.0001, lifeSupportPotential: 50 }
//   ];
  
//   // Filter locations with life support potential of 50% or above
//   const lifeSupportingLocations = dummyData.filter(item => item.lifeSupportPotential >= 50);
  
//   // Draw a red grid over the study area
//   const gridSize = 0.001;  // Smaller grid size for the study area inside PAU
//   const studyBounds = [[studyLatitude - gridSize, studyLongitude - gridSize], [studyLatitude + gridSize, studyLongitude + gridSize]];
//   L.rectangle(studyBounds, { color: "red", weight: 1 }).addTo(map).bindPopup('Study Area Grid');
  
//   // Add blue grids and markers for each life-supporting location within the study area
//   const polygonPoints = []; // To store points for drawing the life-supporting area
//   lifeSupportingLocations.forEach(location => {
//       const bounds = [[location.lat - 0.0001, location.lon - 0.0001], [location.lat + 0.0001, location.lon + 0.0001]];
//       L.rectangle(bounds, { color: "blue", weight: 1 }).addTo(map).bindPopup(`Life Support Potential: ${location.lifeSupportPotential}%`);
//       L.marker([location.lat, location.lon]).addTo(map)
//           .bindPopup(`Life Support Potential: ${location.lifeSupportPotential}%`);
      
//       polygonPoints.push([location.lat, location.lon]);
//   });

//   // If there are sufficient points, create a polygon
//   if (polygonPoints.length > 3) {
//       L.polygon(polygonPoints, { color: 'green', fillColor: 'green', fillOpacity: 0.5 })
//           .addTo(map)
//           .bindPopup('Connected Life-Supporting Area');
//   }
// });

 // Your web app's Firebase configuration
 const firebaseConfig = {
    apiKey: "AIzaSyA6c_4j2Zw33NdlP2jSbIp0ySHGSmpluQ8",
    authDomain: "blazers-rovers-sample-database.firebaseapp.com",
    projectId: "blazers-rovers-sample-database",
    storageBucket: "blazers-rovers-sample-database.appspot.com",
    messagingSenderId: "464730486363",
    appId: "1:464730486363:web:78ccfde176cea53e21317e"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var database = firebase.database();

// Reference to the Firebase Auth service
const auth = firebase.auth();

// Function to sign in with email and password
function signInWithEmailAndPassword(email, password) {
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in 
            const user = userCredential.user;
            console.log('User signed in:', user);
            // Redirect or take any action after successful sign-in
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(`Error [${errorCode}]: ${errorMessage}`);
            // Handle errors here (e.g., show error message to the user)
        });
}

signInWithEmailAndPassword("lanre.mohammed23@gmail.com", "Wilmar.jr7");



document.getElementById('location-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const studyLatitude = parseFloat(document.getElementById('study-latitude').value);
    const studyLongitude = parseFloat(document.getElementById('study-longitude').value);
    
    // Initialize the map centered on the study area coordinates
    const map = L.map('map').setView([studyLatitude, studyLongitude], 17);
    
    // Add a tile layer to the map (OpenStreetMap tiles)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
    }).addTo(map);
    
    // Retrieve data from Firebase Realtime Database using the updated structure
    database.ref('blazers-rovers-sample-database').once('value').then(function(snapshot) {
        const samples = snapshot.val().samples;
        const tbody = document.querySelector('#rock-table tbody');
        
        for (let sampleId in samples) {
            const sample = samples[sampleId];
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const potentialCell = document.createElement('td');
            
            nameCell.textContent = sample.name;
            potentialCell.textContent = `${sample.percentageToSupportLife}%`;
            potentialCell.className = sample.percentageToSupportLife >= 50 ? 'green' : 'red';
            
            row.appendChild(nameCell);
            row.appendChild(potentialCell);
            tbody.appendChild(row);
            
            // Plot life-supporting locations on the map
            if (sample.percentageToSupportLife >= 50) {
                const marker = L.marker([sample.latitude, sample.longitude]).addTo(map)
                    .bindPopup(`${sample.name}<br>Life Support Potential: ${sample.percentageToSupportLife}%`);
                marker.openPopup();
            }
        }
    });
});

