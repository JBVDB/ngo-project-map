document.addEventListener('DOMContentLoaded', () => {
    // Initialize map centered on [30, 18.69] with zoom level 3
    const map = L.map('map').setView([30, 18.69], 3);

    // Add OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
            '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="http://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>',
    }).addTo(map);

    // State variables
    let metadataMap = {};
    let activeCountryLayer = null;
    let activeRegionsLayer = null;
    let activeCountryName = null;
    const allRegionsLayers = {}; // store region layers keyed by country name

    // Popup & tooltip setup per country feature
    function onEachFeature(feature, layer) {
        const name = feature.properties.name;
        const meta = metadataMap[name];

        // Popup HTML content
        const popupContent = `
      <div class="popup-content">
        <div class="popup-title-wrapper">
          <strong class="popup-country-name">${name}</strong>
          <div class="popup-divider"></div>
        </div>
        Status: ${meta.status}<br>
        Period: ${meta.start_year} – ${meta.end_year ?? 'present'}<br>
        Comment: ${meta.comment}<br>
        <a href="${meta.reference}" target="_blank" rel="noopener noreferrer">More info</a>
      </div>
    `;

        layer.bindPopup(popupContent, { className: 'custom-popup' });

        // Tooltip on hover
        layer.bindTooltip(name, {
            sticky: true,
            direction: 'top',
            offset: [0, -10],
            className: 'country-tooltip',
        });

        layer.on('click', () => {
            map.fitBounds(layer.getBounds(), { padding: [20, 20] });
            // Optional: Highlight selected country or load regions
            // You can add logic here to update activeCountryLayer or activeRegionsLayer if needed
        });
    }

    // Zoom behavior: show/hide regions layers depending on zoom level
    map.on('zoomend', () => {
        const zoom = map.getZoom();

        if (zoom >= 4) {
            // Show all region layers
            for (const layer of Object.values(allRegionsLayers)) {
                if (!map.hasLayer(layer)) {
                    map.addLayer(layer);
                }
            }
        } else {
            // Hide all region layers
            for (const layer of Object.values(allRegionsLayers)) {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            }
            // Optionally reset style of active country on zoom out
            if (activeCountryLayer) {
                activeCountryLayer.setStyle({ fillOpacity: 0.5 });
            }
        }
    });

    // Load country metadata and regions, then load main country GeoJSON
    fetch('countries_metadata.json')
        .then((response) => response.json())
        .then((metadata) => {
            // Create lookup map for metadata by country name
            metadataMap = Object.fromEntries(
                metadata.countries.map((entry) => [entry.name, entry])
            );

            // Load regions for countries that have them
            const regionPromises = metadata.countries
                .filter((entry) => entry.regions && entry.regions.length > 0)
                .map((entry) => {
                    const regionFileName = entry.name.toLowerCase().replace(/ /g, '_') + '.geojson.json';
                    const regionPath = `data/regions/${regionFileName}`;

                    return fetch(regionPath)
                        .then((res) => res.json())
                        .then((regionData) => {
                            const allowedRegions = new Set(entry.regions.map((r) => r.toLowerCase()));
                            const filteredFeatures = regionData.features.filter((f) =>
                                allowedRegions.has(f.properties?.name?.toLowerCase())
                            );

                            const layer = L.geoJSON(
                                {
                                    type: 'FeatureCollection',
                                    features: filteredFeatures,
                                },
                                {
                                    style: {
                                        color: '#444',
                                        weight: 1,
                                        fillOpacity: 0.6,
                                    },
                                    onEachFeature: (f, l) => {
                                        if (f.properties?.name) {
                                            l.bindPopup(`<b>Region:</b> ${f.properties.name}`);
                                        }
                                    },
                                }
                            );

                            allRegionsLayers[entry.name] = layer;
                        })
                        .catch((err) => console.warn(`Error loading regions for ${entry.name}:`, err));
                });

            return Promise.all(regionPromises).then(() => fetch('data/countries.geojson'));
        })
        .then((response) => response.json())
        .then((geojsonData) => {
            geojsonData.features.forEach((feature) => {
                const name = feature.properties.name;
                const countryMeta = metadataMap[name];

                if (countryMeta) {
                    const styleClass = countryMeta.status === 'current' ? 'currentCountries' : 'previousCountries';

                    L.geoJSON(feature, {
                        className: styleClass,
                        style: { fillOpacity: 0.5 },
                        onEachFeature,
                    }).addTo(map);
                }
            });
        })
        .catch((err) => console.error('Error loading data:', err));

    // Reset button logic: reset map view and remove highlights/layers
    document.getElementById('resetView').addEventListener('click', () => {
        map.setView([30, 18.69], 3);

        if (activeRegionsLayer) {
            map.removeLayer(activeRegionsLayer);
            activeRegionsLayer = null;
        }

        if (activeCountryLayer) {
            activeCountryLayer.setStyle({ fillOpacity: 0.5 });
            activeCountryLayer = null;
            activeCountryName = null;
        }

        map.closePopup();
    });

    // Custom red marker
    const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });

    L.marker([48.010707, 7.855399], { icon: redIcon })
        .addTo(map)
        .bindTooltip('Our NGO', {
            direction: 'top',
            offset: [0, -10],
            className: 'custom-tooltip',
        });
});
