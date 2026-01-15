# Snapshot: Stable Push & Alarm Logic (v1.5.17.9.2)
Date: 2026-01-15

This document records the exact state of the project after fixing the iOS Push Notification and Alarm Logic issues.

## How to Recall this Point
If you ever need to return to this exact state, run:
```bash
git checkout tags/v1.5.17.9-stable
```

## What was Fixed
1. **Push Encryption**: Upgraded to RFC 8291 for iOS Safari banner visibility.
2. **Alarm Logic**: Implemented `watchedTrips` filtering in the `check-stop-arrivals` Edge Function.
3. **SW Stability**: Reverted to split-file Service Worker v2.0.5.

## Verified Success
- **Stop**: 2793
- **Trip**: 17000726 (Bus 4614)
- **Status**: Received 201 OK from APNS at 08:08:45 local time.
