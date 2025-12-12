/*
    filename: script.js
    author: Elliot Vosburgh
    last updated: 12 december 2025
    description:
        javascript for Little Compton Stone Wall Stewards dashboard
*/

// LEAFLET
const map = L.map('map', { zoomControl: false }).setView([0, 0], 2);

const roads = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; <a href="https://carto.com/">CARTO</a> | Application © <a href="https://vosburgh.dev">Elliot Vosburgh</a>',
    subdomains: 'abcd',
    maxZoom: 23,
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 23,
});

roads.addTo(map);

const baseMaps = {
    "Roads": roads,
    "Satellite": satellite
};

L.control.zoom({
    position: 'topright'
}).addTo(map);

const layersControl = L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

function updateLayersControlPosition() {
    const isMobile = window.innerWidth <= 800;
    map.removeControl(layersControl);
    layersControl.options.position = isMobile ? "bottomright" : "topright";
    layersControl.addTo(map);
}

updateLayersControlPosition();
window.addEventListener("resize", updateLayersControlPosition);

const miniMap = new L.Control.MiniMap(
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 11,
    }),
    {
        toggleDisplay: false,
        zoomLevelOffset: -4,
    }
).addTo(map);

const markers = L.markerClusterGroup({
    maxClusterRadius: 150,
    disableClusteringAtZoom: 18
});

let featureData = [];
let markerIndex = {};

map.createPane('wallsPane');
map.getPane('wallsPane').style.zIndex = 200;
map.getPane('wallsPane').style.pointerEvents = 'auto';

fetch('walls.geojson')
    .then(r => r.json())
    .then(data => {
        const wallsLayer = L.geoJSON(data, {
            pane: 'wallsPane',
            style: { color: '#003cffff', weight: 1,  opacity: 0.8 },
            interactive: false
        });
        map.addLayer(wallsLayer);

        map.on('baselayerchange', function (event) {
            if (event.name === "Satellite") {
                wallsLayer.setStyle({
                    color: '#ffde97ff',
                    weight: 1,
                    opacity: 0.8
                });
            } else {
                wallsLayer.setStyle({
                    color: '#003cffff',
                    weight: 1, 
                    opacity: 0.8
                });
            }
        });

        const bounds = wallsLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20], maxZoom: 18 });
        }
    });

fetch('data.geojson')
    .then(r => r.json())
    .then(data => {
        featureData = data.features;

        document.getElementById('entry-count').textContent =
            `(${recentEntryCount} out of ${featureData.length})`;

        populateFilters(featureData);
        populateRecentEntries(featureData);

        const geoJsonLayer = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                const marker = L.circleMarker(latlng, {
                    radius: 7,
                    fillColor: "#ff0000ff",
                    color: "#ffffffff",
                    weight: 1,
                    opacity: 0.9,
                    fillOpacity: 0.9
                });

                marker.feature = feature;

                markerIndex[feature.properties.entry_id] = marker;
                return marker;
            },

            onEachFeature: (feature, layer) => {
				const p = feature.properties;

				let html = `<div class="popup-inner">`;

				if (p.Photo_URL) {
					html += `
						<div class="popup-photo">
							<img src="${p.Photo_URL}" alt="Image not taken" />
						</div>`;
				}

				html += `<div class="popup-content-text">`;

				html += `
					<div class="popup-row"><b>Wall Condition:</b> ${p.Wall_Condition || "Not given"}</div>
					<div class="popup-row"><b>Vegetation Cover:</b> ${p.Vegetation_Cover || "Not given"}</div>
					<div class="popup-row"><b>Wall Type:</b> ${p.Wall_Type || "Not given"}</div>
				`;

				if (p.Stone_Shape?.length) {
					html += `<div class="popup-row"><b>Stone Shape:</b> ${p.Stone_Shape.join(", ")}</div>`;
				}

				if (p.Surveyor_Name) {
					html += `<div class="popup-row"><b>Collected by:</b> ${p.Surveyor_Name}</div>`;
				}

				html += `</div></div>`;

				layer.bindPopup(html, { maxWidth: 450 });
			}
        });

        markers.addLayer(geoJsonLayer);
        map.addLayer(markers);

        if (geoJsonLayer.getBounds().isValid()) {
            map.fitBounds(geoJsonLayer.getBounds());
        }
    });

// FILTERS
function populateFilters(features) {
    const wallTypes = new Set();
    const vegTypes = new Set();

    features.forEach(f => {
        if (f.properties.Wall_Type) wallTypes.add(f.properties.Wall_Type);
        if (f.properties.Vegetation_Cover) vegTypes.add(f.properties.Vegetation_Cover);
    });

    let vegArray = Array.from(vegTypes);
    const vegOrder = [
        "Clear (0-25% covered)",
        "Some overgrowth (25-50% covered)",
        "Quite covered (50-75% covered)",
        "Hidden (75-100% covered)"
    ];

    vegArray.sort((a, b) => {
        const ai = vegOrder.indexOf(a);
        const bi = vegOrder.indexOf(b);

        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
    });

    const wallSelect = document.getElementById("filter-walltype");
    wallSelect.innerHTML = `<option value="">(Any wall type)</option>`;
    wallTypes.forEach(v => wallSelect.innerHTML += `<option value="${v}">${v}</option>`);

    const vegSelect = document.getElementById("filter-veg");
    vegSelect.innerHTML = `<option value="">(Any vegetation)</option>`;
    vegArray.forEach(v => vegSelect.innerHTML += `<option value="${v}">${v}</option>`);
}

function applyFilters() {
    const txt = document.getElementById("search-bar").value.toLowerCase();
    const w = document.getElementById("filter-walltype").value;
    const veg = document.getElementById("filter-veg").value;

    markers.clearLayers();

    const filtered = featureData.filter(f => {
        const p = f.properties;

        if (txt) {
            const blob = Object.values(p)
                .flat()
                .join(" ")
                .toLowerCase();
            if (!blob.includes(txt)) return false;
        }
        if (w && p.Wall_Type !== w) return false;
        if (veg && p.Vegetation_Cover !== veg) return false;

        return true;
    });

    const newLayer = L.geoJSON(
        { type: "FeatureCollection", features: filtered },
        {
            pointToLayer: (f, latlng) => markerIndex[f.properties.entry_id],
        }
    );

    markers.addLayer(newLayer);
    updateMarkerColors();
}

document.getElementById("search-bar").addEventListener("input", applyFilters);
document.getElementById("filter-walltype").addEventListener("change", applyFilters);
document.getElementById("filter-veg").addEventListener("change", applyFilters);

document.getElementById("reset-filters").addEventListener("click", () => {
    document.getElementById("search-bar").value = "";
    document.getElementById("filter-walltype").value = "";
    document.getElementById("filter-veg").value = "";
    applyFilters();
});

// RECENT ENTRIES
const recentEntryCount = 10;

function populateRecentEntries(features) {
    const list = document.getElementById("recent-entries");
    list.innerHTML = "";

    const sorted = [...features]
        .sort((a, b) => new Date(b.properties.created_at) - new Date(a.properties.created_at))
        .slice(0, recentEntryCount);

    sorted.forEach(f => {
        const p = f.properties;
        const date = new Date(p.created_at).toLocaleString();

        const div = document.createElement("div");
        div.className = "entry-card";

        div.innerHTML = `
            <div class="entry-date">${date}</div>
            <div class="entry-id">${p.Wall_Type} in ${p.Wall_Condition.toLowerCase()} condition under ${p.Vegetation_Cover.toLowerCase()} herbaceous cover. ${p.Surveyor_Name ? `<div style="font-style: oblique; padding-top: 5px;">Collected by ${p.Surveyor_Name}</div>` : `<div style="font-style: oblique; padding-top: 5px;">Anonymous submission</div>`}</div>
        `;

        div.addEventListener("click", () => {
            const marker = markerIndex[p.entry_id];
            if (marker) {
                map.setView(marker.getLatLng(), 18);
                marker.openPopup();
            }
        });

        list.appendChild(div);
    });
}

// SIDEBAR TOGGLE
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-btn');

if (window.innerWidth < 1100) {
    sidebar.classList.add('closed');
    toggleBtn.textContent = '❯';
} else {
    toggleBtn.style.display = 'none';
}

toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('closed');

    toggleBtn.textContent = sidebar.classList.contains('closed') ? '❯' : '❮';
});
