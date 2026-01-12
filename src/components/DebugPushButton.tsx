
import { usePushSubscription } from '@/hooks/usePushSubscription';

export const DebugPushButton = () => {
    const { subscribe, isSupported, isLoading } = usePushSubscription();

    const handleClick = async () => {
        if (!isSupported) {
            alert('Push notifications are not supported on this device');
            return;
        }
        const success = await subscribe([]); // empty route list is fine for testing
        if (success) {
            alert('✅ Subscription created – check Supabase for the new ID');
        } else {
            alert('❌ Subscription failed – see console for details');
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={isLoading}
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                background: '#0066ff',
                color: '#fff',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                zIndex: 9999,
            }}
        >
            Create Push Sub
        </button>
    );
};
