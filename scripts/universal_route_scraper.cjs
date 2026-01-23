const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
let SUPABASE_KEY = '';
try {
    SUPABASE_KEY = fs.readFileSync('key.txt', 'utf8').trim();
} catch (e) {
    console.error('Warning: key.txt not found. GTFS mapping will be skipped.');
}

// Mapping from Website Operator ID to GTFS Operator ID (Proxy)
const OPERATOR_MAPPING = {
    '12': '10', // LPT (Zenon)
    '13': '6',  // EMEL
    '14': '2',  // OSYPA
    '15': '4',  // OSEA
    '16': '5',  // Intercity
    '17': '9',  // NPT
};

const PROVINCES = [1, 2, 3, 4, 5]; // 1: Larnaca, 2: Nicosia, 3: Limassol, 4: Paphos, 5: Famagusta
const OPERATORS = Object.keys(OPERATOR_MAPPING);

const BASE_URL = 'https://www.motionbuscard.org.cy/routes/pagedroutelistpartialview';

async function fetchRoutePage(operatorId, provinceId, page = 1) {
    const url = `${BASE_URL}?iIdOperator=${operatorId}&iIdProvince=${provinceId}&iIdMunicipality=-1&iPage=${page}`;
    console.log(`Fetching operator ${operatorId}, province ${provinceId}, page ${page}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0'
            },
            signal: AbortSignal.timeout(60000)
        });
        if (!response.ok) return null;
        return await response.text();
    } catch (error) {
        console.error(`  - Error fetching:`, error.message);
        return null;
    }
}

function cleanRouteNumber(text) {
    if (!text) return '';
    // Remove "Διαδρομή" and any non-alphanumeric trailing chars
    return text.replace(/Διαδρομή/g, '').replace(/[^a-zA-Z0-9]$/, '').trim();
}

function parseAlerts(html, operatorId, provinceId) {
    if (!html || html.length < 500) return [];

    const $ = cheerio.load(html);
    const alerts = [];
    const gtfsOpId = OPERATOR_MAPPING[operatorId];

    $('.arrivalTimes__list__item').each((i, el) => {
        const $el = $(el);
        const $warningPanel = $el.find('.elementPanel--warning');

        if ($warningPanel.length > 0) {
            const rawRouteNum = $el.find('.line__item__text').first().text().trim();
            const routeNumber = cleanRouteNumber(rawRouteNum);
            const routeName = $el.find('.arrivalTimes__list__item__link__text').first().text().trim().replace(/\s+/g, ' ');

            $warningPanel.find('.elementPanel__content__list__item').each((j, itemEl) => {
                const alertText = $(itemEl).text().trim().replace(/\s+/g, ' ');
                if (alertText) {
                    alerts.push({
                        website_operator_id: operatorId,
                        gtfs_operator_id: gtfsOpId,
                        province_id: provinceId,
                        route_number: routeNumber,
                        route_name: routeName,
                        alert_text: alertText,
                        scraped_at: new Date().toISOString()
                    });
                }
            });
        }
    });

    return alerts;
}

const gtfsCache = new Map();

async function getGtfsRoutes(operatorId) {
    if (gtfsCache.has(operatorId)) return gtfsCache.get(operatorId);

    if (!SUPABASE_KEY) return [];

    console.log(`Fetching GTFS routes for operator ${operatorId}...`);
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/routes?operator=${operatorId}`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const result = await response.json();
        const routes = result.data || [];
        gtfsCache.set(operatorId, routes);
        return routes;
    } catch (e) {
        console.error(`  - Error fetching GTFS routes:`, e.message);
        return [];
    }
}

async function runScraper() {
    const scrapedAlerts = [];

    for (const operatorId of OPERATORS) {
        console.log(`\n--- Processing Operator ${operatorId} ---`);
        for (const provinceId of PROVINCES) {
            let page = 1;
            let hasMore = true;

            while (hasMore && page < 20) {
                const html = await fetchRoutePage(operatorId, provinceId, page);
                if (!html) { hasMore = false; continue; }

                const pageAlerts = parseAlerts(html, operatorId, provinceId);
                if (pageAlerts.length > 0) scrapedAlerts.push(...pageAlerts);

                const $ = cheerio.load(html);
                if ($('.arrivalTimes__list__item').length === 0) { hasMore = false; continue; }

                // Check pagination
                let maxPage = 0;
                $('.pagination a').each((i, a) => {
                    const t = $(a).text().trim();
                    if (!isNaN(t)) maxPage = Math.max(maxPage, parseInt(t));
                });
                if (maxPage > page) page++; else hasMore = false;
            }
        }
    }

    // Deduplicate
    const uniqueScraped = Array.from(new Map(scrapedAlerts.map(item => [
        `${item.gtfs_operator_id}_${item.route_number}_${item.alert_text}`,
        item
    ])).values());

    console.log(`\nScraping done. Found ${uniqueScraped.length} unique alerts. Starting GTFS mapping...`);

    const finalAlerts = [];

    for (const alert of uniqueScraped) {
        const gtfsRoutes = await getGtfsRoutes(alert.gtfs_operator_id);

        // Try to find a match by short name
        // We look for exact match first, then partial if needed
        let match = gtfsRoutes.find(r => r.route_short_name === alert.route_number);

        if (!match) {
            // Try if gtfs has leading zeros or alert has
            match = gtfsRoutes.find(r =>
                parseInt(r.route_short_name) === parseInt(alert.route_number)
            );
        }

        finalAlerts.push({
            ...alert,
            gtfs_route_id: match ? match.route_id : null,
            gtfs_route_long_name: match ? match.route_long_name : null,
            matching_method: match ? 'short_name_match' : 'no_match'
        });
    }

    const outputPath = path.join(process.cwd(), 'active_route_alerts_final.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalAlerts, null, 2));
    console.log(`\nSuccess! Final results saved to ${outputPath}`);

    // Summary table
    console.log('\n--- Final Alert Summary ---');
    console.table(finalAlerts.map(a => ({
        Op: a.gtfs_operator_id,
        Route: a.route_number,
        GTFS_ID: a.gtfs_route_id || '???',
        Alert: a.alert_text.substring(0, 50) + (a.alert_text.length > 50 ? '...' : '')
    })));
}

runScraper();
