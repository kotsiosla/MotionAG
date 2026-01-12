
// Simplified GTFS-RT Fetcher for Debugging
// Usage: deno run --allow-net run_debug_feed.ts

const GTFS_RT_BASE_URL = "http://20.19.98.194:8328/Api/api/gtfs-realtime";

// --- Minimal Protobuf Parser (Copied from Source) ---
function readVarint(data, offset) {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;
    while (offset + bytesRead < data.length) {
        const byte = data[offset + bytesRead];
        result |= (byte & 0x7F) << shift;
        bytesRead++;
        if ((byte & 0x80) === 0) break;
        shift += 7;
    }
    return { value: result, bytesRead };
}

function readString(data, offset, length) {
    const decoder = new TextDecoder();
    return decoder.decode(data.slice(offset, offset + length));
}

function parseProtobuf(data) {
    const fields = [];
    let offset = 0;
    while (offset < data.length) {
        const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
        offset += tagBytes;
        const fieldNumber = tag >> 3;
        const wireType = tag & 0x7;
        let value;
        let rawBytes;
        switch (wireType) {
            case 0: { const { value: v, bytesRead } = readVarint(data, offset); value = v; offset += bytesRead; break; }
            case 1: { offset += 8; break; } // Skip 64-bit
            case 2: { const { value: len, bytesRead } = readVarint(data, offset); offset += bytesRead; rawBytes = data.slice(offset, offset + len); value = rawBytes; offset += len; break; }
            case 5: { offset += 4; break; } // Skip 32-bit
        }
        fields.push({ fieldNumber, wireType, value, rawBytes });
    }
    return fields;
}

// --- Specific Parsers ---
function parseTripDescriptor(data) { // Field 1
    const fields = parseProtobuf(data);
    const trip = {};
    for (const field of fields) {
        if (field.fieldNumber === 5 && field.rawBytes) trip.routeId = readString(field.rawBytes, 0, field.rawBytes.length);
        if (field.fieldNumber === 1 && field.rawBytes) trip.tripId = readString(field.rawBytes, 0, field.rawBytes.length);
    }
    return trip;
}

function parseVehicleDescriptor(data) { // Field 3
    const fields = parseProtobuf(data);
    const veh = {};
    for (const field of fields) {
        if (field.fieldNumber === 1 && field.rawBytes) veh.id = readString(field.rawBytes, 0, field.rawBytes.length);
    }
    return veh;
}

function parseStopTimeUpdate(data) {
    const fields = parseProtobuf(data);
    const stu = {};
    for (const field of fields) {
        if (field.fieldNumber === 4 && field.rawBytes) stu.stopId = readString(field.rawBytes, 0, field.rawBytes.length);
        if (field.fieldNumber === 2 && field.rawBytes) { // Arrival
            const subFields = parseProtobuf(field.rawBytes);
            stu.arrival = {};
            for (const sf of subFields) {
                if (sf.fieldNumber === 2) stu.arrival.time = sf.value; // Time
            }
        }
    }
    return stu;
}

function parseTripUpdate(data) {
    const fields = parseProtobuf(data);
    const tu = { stopTimeUpdate: [] };
    for (const field of fields) {
        if (field.fieldNumber === 1 && field.rawBytes) tu.trip = parseTripDescriptor(field.rawBytes);
        if (field.fieldNumber === 3 && field.rawBytes) tu.vehicle = parseVehicleDescriptor(field.rawBytes);
        if (field.fieldNumber === 2 && field.rawBytes) tu.stopTimeUpdate.push(parseStopTimeUpdate(field.rawBytes));
    }
    return tu;
}

function parseFeedEntity(data) {
    const fields = parseProtobuf(data);
    const entity = {};
    for (const field of fields) {
        if (field.fieldNumber === 3 && field.rawBytes) entity.tripUpdate = parseTripUpdate(field.rawBytes);
    }
    return entity;
}

function parseFeedMessage(data) {
    const fields = parseProtobuf(data);
    const entities = [];
    for (const field of fields) {
        if (field.fieldNumber === 2 && field.rawBytes) entities.push(parseFeedEntity(field.rawBytes));
    }
    return entities;
}

// --- Main Execution ---
async function run() {
    console.log("Fetching live data...");
    const resp = await fetch(GTFS_RT_BASE_URL);
    const arrayBuffer = await resp.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    console.log(`Parsing ${data.length} bytes...`);
    const entities = parseFeedMessage(data);
    console.log(`Found ${entities.length} entities.`);

    const STOP_ID = "3125";
    const TARGET = "4641";

    console.log(`Searching for Stop ${STOP_ID} and Bus ${TARGET}...`);

    for (const ent of entities) {
        if (ent.tripUpdate && ent.tripUpdate.stopTimeUpdate) {
            for (const stu of ent.tripUpdate.stopTimeUpdate) {
                if (stu.stopId === STOP_ID) {
                    const route = ent.tripUpdate.trip?.routeId || "?";
                    const vehicle = ent.tripUpdate.vehicle?.id || "?";
                    const time = stu.arrival?.time || 0;
                    const mins = Math.round((time - (Date.now() / 1000)) / 60);

                    if (route.includes(TARGET) || vehicle.includes(TARGET)) {
                        console.log(`\n✅ FOUND IT!`);
                        console.log(`   Bus/Route: ${TARGET}`);
                        console.log(`   Vehicle ID: ${vehicle}`);
                        console.log(`   Route ID: ${route}`);
                        console.log(`   Arrival: in ${mins} minutes`);
                        console.log(`   Unix Time: ${time}`);
                    } else {
                        // console.log(`   [Info] Bus at 3125: Route ${route}, Vehicle ${vehicle}, in ${mins} min`);
                    }
                }
            }
        }
    }
    console.log("Done.");
}

run();
