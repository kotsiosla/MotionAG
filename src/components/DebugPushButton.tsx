import { supabase } from '@/integrations/supabase/client';
import { usePushSubscription } from '@/hooks/usePushSubscription';

export const DebugPushButton = () => {
    const { subscribe, isSupported, isLoading } = usePushSubscription();

    const handleClick = async () => {
        try {
            if (!isSupported) {
                alert('Push not supported');
                return;
            }

            // Check Supabase config
            const url = (supabase as any).supabaseUrl;
            const key = (supabase as any).supabaseKey;
            console.log('Push Debug - Supabase Config:', { url, key: key ? 'PRESENT' : 'MISSING' });

            alert(`Config: ${url}\nKey: ${key ? 'Present' : 'Missing'}`);

            const success = await subscribe([]); // empty route list is fine for testing

            // We need to fetch the latest ID ourselves since subscribe doesn't return it
            const { data: latest } = await supabase
                .from('push_subscriptions')
                .select('id, created_at')
                .order('created_at', { ascending: false })
                .limit(1);

            if (success) {
                alert(`✅ SUCCESS\nID: ${latest?.[0]?.id || 'Unknown'}\nCreated: ${latest?.[0]?.created_at || 'Unknown'}`);
            } else {
                alert('❌ FAILED - Check toasts or console');
            }
        } catch (e: any) {
            alert(`💥 CRASH: ${e.message}`);
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
