import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, Search, Loader2, AlertCircle } from 'lucide-react';

interface GoogleMapLocationProps {
    distanceKm: number;
    onLocationSelect?: (location: { lat: number; lng: number; address: string }) => void;
}

// Bangkok CBD coordinates (Silom/Sathorn area)
const BANGKOK_CBD = { lat: 13.7244, lng: 100.5324 };

// Common locations in Bangkok with distance from CBD
const PRESET_LOCATIONS = [
    { name: 'สีลม/สาทร (CBD)', distance: 0, lat: 13.7244, lng: 100.5324 },
    { name: 'สยาม/ราชประสงค์', distance: 2, lat: 13.7466, lng: 100.5347 },
    { name: 'อโศก/สุขุมวิท', distance: 3, lat: 13.7370, lng: 100.5600 },
    { name: 'ลาดพร้าว', distance: 8, lat: 13.8066, lng: 100.5614 },
    { name: 'บางนา', distance: 10, lat: 13.6678, lng: 100.6049 },
    { name: 'รังสิต', distance: 25, lat: 14.0364, lng: 100.6166 },
    { name: 'บางแสน', distance: 80, lat: 13.2835, lng: 100.9265 },
];

export default function GoogleMapLocation({ distanceKm, onLocationSelect }: GoogleMapLocationProps) {
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [address, setAddress] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    // Find closest preset location based on distance
    const closestPreset = PRESET_LOCATIONS.reduce((prev, curr) => 
        Math.abs(curr.distance - distanceKm) < Math.abs(prev.distance - distanceKm) ? curr : prev
    );

    // Initialize with closest preset
    useEffect(() => {
        setSelectedLocation({ lat: closestPreset.lat, lng: closestPreset.lng });
        setAddress(closestPreset.name);
    }, [distanceKm]);

    // Generate Google Maps Embed URL
    const getMapEmbedUrl = useCallback(() => {
        const location = selectedLocation || { lat: closestPreset.lat, lng: closestPreset.lng };
        // Using Google Maps Embed API (free, no API key required for basic embed)
        const query = encodeURIComponent(`${location.lat},${location.lng}`);
        return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${query}&zoom=14&maptype=roadmap`;
    }, [selectedLocation, closestPreset]);

    // Alternative: Use OpenStreetMap (completely free, no API key)
    const getOpenStreetMapUrl = useCallback(() => {
        const location = selectedLocation || { lat: closestPreset.lat, lng: closestPreset.lng };
        return `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.02},${location.lat - 0.015},${location.lng + 0.02},${location.lat + 0.015}&layer=mapnik&marker=${location.lat},${location.lng}`;
    }, [selectedLocation, closestPreset]);

    // Handle preset selection
    const handlePresetSelect = (preset: typeof PRESET_LOCATIONS[0]) => {
        setSelectedLocation({ lat: preset.lat, lng: preset.lng });
        setAddress(preset.name);
        if (onLocationSelect) {
            onLocationSelect({ lat: preset.lat, lng: preset.lng, address: preset.name });
        }
    };

    // Handle search (simplified - uses preset matching)
    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        setIsLoading(true);
        
        // Simple search in presets
        const found = PRESET_LOCATIONS.find(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        setTimeout(() => {
            if (found) {
                handlePresetSelect(found);
                setError(null);
            } else {
                setError('ไม่พบสถานที่ กรุณาเลือกจากรายการด้านล่าง');
            }
            setIsLoading(false);
        }, 500);
    };

    // Calculate distance from CBD for display
    const calculateDistanceFromCBD = (lat: number, lng: number): number => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat - BANGKOK_CBD.lat) * Math.PI / 180;
        const dLng = (lng - BANGKOK_CBD.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(BANGKOK_CBD.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const currentDistance = selectedLocation 
        ? calculateDistanceFromCBD(selectedLocation.lat, selectedLocation.lng).toFixed(1)
        : distanceKm;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="flex items-center text-lg font-semibold mb-4 text-slate-800">
                <MapPin className="w-5 h-5 mr-2 text-red-500" />
                ตำแหน่งโครงการ
            </h2>

            {/* Search Bar */}
            <div className="mb-4">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="ค้นหาสถานที่..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ค้นหา'}
                    </button>
                </div>
                {error && (
                    <p className="text-xs text-red-500 mt-1 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {error}
                    </p>
                )}
            </div>

            {/* Quick Select Locations */}
            <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">เลือกตำแหน่งอ้างอิง:</p>
                <div className="flex flex-wrap gap-2">
                    {PRESET_LOCATIONS.slice(0, 5).map((preset) => (
                        <button
                            key={preset.name}
                            onClick={() => handlePresetSelect(preset)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition ${
                                address === preset.name
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            {preset.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Map Container */}
            <div className="relative rounded-lg overflow-hidden border border-slate-200" style={{ height: '300px' }}>
                <iframe
                    src={getOpenStreetMapUrl()}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Project Location Map"
                    onLoad={() => setMapLoaded(true)}
                />
                {!mapLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                )}
            </div>

            {/* Location Info */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Navigation className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-slate-700">{address || 'ยังไม่ได้เลือกตำแหน่ง'}</span>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        ห่างจาก CBD ~{currentDistance} กม.
                    </span>
                </div>
                {selectedLocation && (
                    <p className="text-xs text-slate-400 mt-1">
                        พิกัด: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                    </p>
                )}
            </div>

            {/* CBD Reference */}
            <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700">
                    📍 <strong>CBD อ้างอิง:</strong> สีลม/สาทร (ศูนย์กลางธุรกิจกรุงเทพ)
                </p>
                <p className="text-xs text-amber-600 mt-1">
                    ค่า x ใน Bertaud Model = ระยะห่างจาก CBD = <strong>{distanceKm} กม.</strong>
                </p>
            </div>
        </div>
    );
}
