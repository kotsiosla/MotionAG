const fs = require('fs');

async function verify() {
    console.log('Verifying v1.5.17.1 local build...');

    try {
        const mainPath = './src/main.tsx';
        const modalPath = './src/components/features/user/StopNotificationModal.tsx';
        const hookPath = './src/hooks/usePushSubscription.ts';
        const alertsPath = './src/components/features/user/AlertsList.tsx';

        const mainContent = fs.readFileSync(mainPath, 'utf8');
        const modalContent = fs.readFileSync(modalPath, 'utf8');
        const hookContent = fs.readFileSync(hookPath, 'utf8');
        const alertsContent = fs.readFileSync(alertsPath, 'utf8');

        const checks = [
            { name: 'Version in main.tsx', pass: mainContent.includes('v1.5.17.1') },
            { name: 'Version in Modal', pass: modalContent.includes('v1.5.17') }, // Modal might stay at 1.5.17 or be compatible
            { name: 'Version in AlertsList', pass: alertsContent.includes('v1.5.17.1') },
            { name: 'Hook: SUB_CREATED', pass: hookContent.includes("'SUB_CREATED'") },
            { name: 'Hook: SUB_FAILED', pass: hookContent.includes("'SUB_FAILED'") },
            { name: 'Hook: SW_FAILED', pass: hookContent.includes("'SW_FAILED'") }
        ];

        console.log('\n--- VERIFICATION v1.5.17.1 ---');
        checks.forEach(c => console.log(`${c.pass ? '✅' : '❌'} ${c.name}`));

        if (checks.every(c => c.pass)) {
            console.log('\nALL LOCAL CHECKS PASSED. Ready for deployment.');
        } else {
            console.error('\nVerification FAILED.');
            process.exit(1);
        }
    } catch (e) {
        console.error('Verification failed:', e.message);
        process.exit(1);
    }
}

verify();
