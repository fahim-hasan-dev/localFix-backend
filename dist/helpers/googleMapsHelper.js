"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBatchGoogleDistances = exports.formatMilesDistance = exports.calculateHaversineDistanceInMiles = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
/**
 * Fallback Haversine Formula for distance calculation (in miles)
 */
const calculateHaversineDistanceInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
};
exports.calculateHaversineDistanceInMiles = calculateHaversineDistanceInMiles;
const formatMilesDistance = (miles) => {
    if (miles === undefined || miles === null || isNaN(miles)) {
        return null;
    }
    if (miles < 1) {
        return "<1 mi away";
    }
    return `${miles.toFixed(1)} mi away`;
};
exports.formatMilesDistance = formatMilesDistance;
/**
 * Calculates distances from one origin to multiple destinations using Google Maps Distance Matrix API.
 * Gracefully falls back to Haversine calculation if Google Maps API key is missing or fails.
 */
const getBatchGoogleDistances = (origin, destinations) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const resultMap = new Map();
    if (!destinations || destinations.length === 0) {
        return resultMap;
    }
    const apiKey = config_1.default.googleMapsApiKey;
    // Process in chunks of 25 (Google Maps Distance Matrix limit)
    const chunkSize = 25;
    for (let i = 0; i < destinations.length; i += chunkSize) {
        const chunk = destinations.slice(i, i + chunkSize);
        if (apiKey) {
            try {
                const destString = chunk.map((d) => `${d.lat},${d.lng}`).join("|");
                const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${encodeURIComponent(destString)}&units=imperial&key=${apiKey}`;
                const response = yield axios_1.default.get(url, { timeout: 4000 });
                const data = response.data;
                if (data.status === "OK" && ((_b = (_a = data.rows) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.elements)) {
                    const elements = data.rows[0].elements;
                    chunk.forEach((dest, idx) => {
                        var _a;
                        const el = elements[idx];
                        if (el && el.status === "OK" && el.distance) {
                            const meters = el.distance.value;
                            const miles = Math.round((meters / 1609.344) * 10) / 10;
                            resultMap.set(dest.id, {
                                distanceInMiles: miles,
                                distanceFormatted: (0, exports.formatMilesDistance)(miles) || `${miles} mi away`,
                                durationText: (_a = el.duration) === null || _a === void 0 ? void 0 : _a.text,
                                source: "google_maps",
                            });
                        }
                        else {
                            // Individual element failed (e.g. ZERO_RESULTS) -> Fallback
                            const miles = (0, exports.calculateHaversineDistanceInMiles)(origin.lat, origin.lng, dest.lat, dest.lng);
                            resultMap.set(dest.id, {
                                distanceInMiles: miles,
                                distanceFormatted: (0, exports.formatMilesDistance)(miles) || `${miles} mi away`,
                                source: "haversine",
                            });
                        }
                    });
                    continue;
                }
            }
            catch (_err) {
                // Fallback to Haversine on network or API failure
            }
        }
        // Fallback for this chunk
        chunk.forEach((dest) => {
            const miles = (0, exports.calculateHaversineDistanceInMiles)(origin.lat, origin.lng, dest.lat, dest.lng);
            resultMap.set(dest.id, {
                distanceInMiles: miles,
                distanceFormatted: (0, exports.formatMilesDistance)(miles) || `${miles} mi away`,
                source: "haversine",
            });
        });
    }
    return resultMap;
});
exports.getBatchGoogleDistances = getBatchGoogleDistances;
