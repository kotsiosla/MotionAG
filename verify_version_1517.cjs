const fs = require('fs');

async function verify() {
    console.log('Fetching live bundle...');

    try {
        const mainPath = './src/main.tsx';
        const modalPath = './src/components/features/user/StopNotificationModal.tsx';
        const clientPath = './src/integrations/supabase/client.ts';
        const hookPath = './src/hooks/usePushSubscription.ts';

        const mainContent = fs.readFileSync(mainPath, 'utf8');
        const modalContent = fs.readFileSync(modalPath, 'utf8');
        const clientContent = fs.readFileSync(clientPath, 'utf8');
        const hookContent = fs.readFileSync(hookPath, 'utf8');

        const checks = [
            { name: 'Version in main.tsx', pass: mainContent.includes('v1.5.17') },
            { name: 'Version in Modal', pass: modalContent.includes('v1.5.17') },
            { name: 'Shared Client Fallback', pass: clientContent.includes('VERIFIED_ANON_KEY') },
            { name: 'Hook Diag Logs', pass: hookContent.includes('ATTEMPT_START') && hookContent.includes('PERMISSION_RESULT') },
            {
                name: 'iOS Gesture Fixed',
                pass: modalContent.indexOf('Notification.requestPermission()') < modalContent.indexOf("'ATTEMPT_START'") &&
                    modalContent.indexOf('Notification.requestPermission()') !== -1
            }
        ];

        console.log('\n--- VERIFICATION v1.5.17 ---');
        checks.forEach(c => console.log(`${c.pass ? '✅' : '❌'} ${c.name}`));

        if (checks.every(c => c.pass)) {
            console.log('\nALL LOCAL CHECKS PASSED. Ready for deployment.');
        } else {
            process.exit(1);
        }
    } catch (e) {
        console.error('Verification failed:', e.message);
        process.exit(1);
    }
}

verify();
