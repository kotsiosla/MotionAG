const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables or keys
const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function uploadAlerts() {
    const alertsPath = path.join(__dirname, '..', 'active_route_alerts_final.json');
    if (!fs.existsSync(alertsPath)) {
        console.error('Alerts file not found:', alertsPath);
        return;
    }

    const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));
    console.log(`Loading ${alerts.length} alerts for upload...`);

    for (const alert of alerts) {
        // Create a unique ID based on operator, route and alert content
        const uniqueId = `scraped_${alert.gtfs_operator_id}_${alert.route_number}_${Buffer.from(alert.alert_text).toString('base64').substring(0, 16)}`;

        const alertData = {
            id: uniqueId,
            operator_id: alert.gtfs_operator_id,
            route_number: alert.route_number,
            gtfs_route_id: alert.gtfs_route_id,
            alert_text: alert.alert_text,
            header_text: `Διακοπή / Τροποποίηση (Γραμμή ${alert.route_number})`,
            severity: 'WARNING',
            updated_at: new Date().toISOString()
        };

        console.log(`Upserting alert for Route ${alert.route_number} (${alert.gtfs_operator_id})...`);

        const { error } = await supabase
            .from('route_alerts')
            .upsert(alertData);

        if (error) {
            console.error(`Error upserting alert for ${alert.route_number}:`, error);
        }
    }

    // Cleanup old scraped alerts (optional, but good for maintenance)
    // For now, we just rely on upsert.

    console.log('\nUpload complete!');
}

uploadAlerts();
