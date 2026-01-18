import { useState, useEffect } from 'react';

interface AirQualityData {
    aqi: number;
    pm10: number;
    pm2_5: number;
    description: string;
    color: string;
}

export const useAirQuality = (lat?: number, lng?: number) => {
    const [data, setData] = useState<AirQualityData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Default to Cyprus (Nicosia/Center) if no location provided
        // roughly 35.1856, 33.3823, but let's wait for valid coords if intended
        // Actually, let's allow it to run with provided coords, or fail silently if none
        if (!lat || !lng) return;

        const fetchAirQuality = async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,pm10,pm2_5`
                );
                const json = await response.json();

                if (json.current) {
                    const aqi = json.current.european_aqi;

                    // EAQI Scale
                    // 0-20: Good
                    // 20-40: Fair
                    // 40-60: Moderate
                    // 60-80: Poor
                    // 80-100: Very Poor
                    // >100: Extremely Poor

                    let description = 'Good';
                    let color = '#22c55e'; // Green

                    if (aqi >= 20) {
                        description = 'Fair';
                        color = '#84cc16'; // Lime
                    }
                    if (aqi >= 40) {
                        description = 'Moderate';
                        color = '#eab308'; // Yellow
                    }
                    if (aqi >= 60) {
                        description = 'Poor';
                        color = '#f97316'; // Orange
                    }
                    if (aqi >= 80) {
                        description = 'Very Poor';
                        color = '#ef4444'; // Red
                    }
                    if (aqi >= 100) {
                        description = 'Extremely Poor';
                        color = '#7f1d1d'; // Dark Red
                    }

                    setData({
                        aqi,
                        pm10: json.current.pm10,
                        pm2_5: json.current.pm2_5,
                        description,
                        color
                    });
                }
            } catch (err) {
                console.error('Failed to fetch air quality', err);
                setError('Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        fetchAirQuality();

        // Refresh every 30 mins
        const interval = setInterval(fetchAirQuality, 30 * 60 * 1000);
        return () => clearInterval(interval);

    }, [lat, lng]);

    return { data, loading, error };
};
