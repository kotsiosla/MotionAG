
// Audio context for notification sounds
let audioContext: AudioContext | null = null;

// Pre-loaded audio element for iOS fallback
let fallbackAudio: HTMLAudioElement | null = null;

// Initialize voices and handle dynamic loading
let availableVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const loadVoices = () => {
        try {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                availableVoices = voices;
                console.log(`[AudioEngine] ${voices.length} voices loaded`);
            }
        } catch (e) {
            console.warn('[AudioEngine] Error loading voices:', e);
        }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Proactive retry with increasing delays
    [100, 500, 1000, 2000, 5000].forEach(delay => {
        setTimeout(loadVoices, delay);
    });
}

export const getVoiceDiagnostics = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return "Not supported";
    const voices = window.speechSynthesis.getVoices();
    const greekVoices = voices.filter(v => v.lang.startsWith('el') || v.lang.startsWith('gr') || v.name.toLowerCase().includes('greek'));
    const names = greekVoices.map(v => v.name).join(', ') || 'None';
    return `Total: ${voices.length}, Greek: ${greekVoices.length} (${names})`;
};

// iOS Audio/Speech unlock - must be called from user interaction
export const unlockAudio = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    // Explicitly reset locking flag to prevent potential deadlocks
    (window as any)._isUnlockingAudio = false;

    console.log('[AudioEngine] Extreme resilience unlock attempt...');
    let speechAttempted = false;

    // 1. Web Audio API Unlock (Critical for Beeps, but not for Speech)
    try {
        if (!audioContext || audioContext.state === 'closed') {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) audioContext = new AudioCtx();
        }

        if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        if (audioContext) {
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
        }
    } catch (e) {
        console.warn('[AudioEngine] WebAudio unlock failed (non-critical):', e);
    }

    // 2. HTML5 Audio Unlock (Critical for fallbacks on iOS)
    try {
        if (!fallbackAudio) {
            fallbackAudio = new Audio();
            fallbackAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQg6l9PCqYhMOq+7l4xiLm7Sw8FnHQMqpd3wgiwCJYjj9rVRAnXL/dZJBQBzyv7UUAdtt/vPXAsqfOb61FgGOobx/M1PDFqR7/20SBR1mvP9rj0Yb5/49qQrHHem+/qXIx51r/76jBYle7789IANMorr+e1nAkqU5/rmWwBUl+f74lMEXZnq/tlKCWmb7P/TPhBxoPL/yjMVeqf1/8YmGH6v+P/BHxyFtvr/uhYhir78/7IPJo/A/v+pCyuUxv//nAYwmcv//44CNp7Q//+BATuh1f//cwE+ptv/+2MARKvg//dTAkqw5f/ySgNPs+n/7UEEVLbt/+g4BVq58P/jMAZfvPP/3ygHZL/2/9kgCWnC+P/VGApuwfr/0RAMcr/8/8wJDnW9/f/IARN3uv7/xAEWebr//78BF3q5//+8AB56uf//uQAhfLn//7UAJH65//+yACd/uv//sAApgLr//68ALIC5//+uAC6Auf//rQAwgbn//6wAMoG5//+rADSBuf//qgA2gbr//6kAOIK6//+oADqCuv//qAA8grr//6cAPYO6//+mAD+Du///pgBBg7v//6UAQ4S7//+kAESEu///pABGhLv//6MASISbm5ubm5trbW9vcHBva2pqampnZWRiYF5cWldVU1BOTEM/Ozk3NDIwLSwpJyQhHx0aGBUSEA4MCggGBAIAAQMFBwkLDQ8RExUXGRsdHyEkJiopLC4wMjQ2ODo8P0FFR0tOUFRXWV1gYmRmZ2lrbG1ub29wcG9ubWxqaGVhXVhTTkdAOTIrJB0XEQsGAQD/';
            fallbackAudio.load();
            fallbackAudio.volume = 0.01;
        }
        await fallbackAudio.play();
        fallbackAudio.pause();
    } catch (e) {
        console.warn('[AudioEngine] HTML5 Audio unlock failed (non-critical):', e);
    }

    // 3. Speech Synthesis Unlock (MOST CRITICAL)
    try {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(' ');
            utterance.volume = 0;
            utterance.rate = 4;
            window.speechSynthesis.speak(utterance);
            speechAttempted = true;

            // Refresh voices
            availableVoices = window.speechSynthesis.getVoices();
        }
    } catch (e) {
        console.warn('[AudioEngine] SpeechSynthesis unlock failed:', e);
    }

    return speechAttempted || true;
};

// Speak text using Web Speech API
export const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
        window.speechSynthesis.cancel();
    } catch (e) { }

    if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'el-GR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isWindows = /Windows/.test(ua);

    let greekVoice: SpeechSynthesisVoice | undefined;

    // Refresh voices if empty
    if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
    }

    if (isIOS) {
        greekVoice = availableVoices.find(v => (v.lang.startsWith('el') || v.lang.startsWith('gr')) && v.name.includes('Melina'));
    } else if (isAndroid) {
        greekVoice = availableVoices.find(v => (v.lang.startsWith('el') || v.lang.startsWith('gr')) && v.name.toLowerCase().includes('google'));
    } else if (isWindows) {
        greekVoice = availableVoices.find(v => (v.lang.startsWith('el') || v.lang.startsWith('gr')) && v.name.includes('Stefanos'));
    }

    // fallback: ANY voice that looks Greek
    if (!greekVoice) greekVoice = availableVoices.find(v => v.lang === 'el-GR' || v.lang === 'el');
    if (!greekVoice) greekVoice = availableVoices.find(v => (v.lang.startsWith('el') || v.lang.startsWith('gr')));
    if (!greekVoice) greekVoice = availableVoices.find(v => v.name.toLowerCase().includes('greek'));

    if (greekVoice) {
        console.log(`[AudioEngine] Selected Greek voice: ${greekVoice.name} (${greekVoice.lang})`);
        utterance.voice = greekVoice;
        utterance.lang = greekVoice.lang;
    } else {
        console.warn('[AudioEngine] No Greek voice found even in fallback');
        utterance.lang = 'el-GR';
    }

    // Delay for iOS satisfaction
    setTimeout(() => {
        try {
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error('[AudioEngine] speak failed:', e);
        }
    }, isIOS ? 100 : 0);
};

export const speakTest = () => {
    speak("Δοκιμή φωνητικής αναγγελίας. Αν ακούτε αυτό το μήνυμα, οι ειδοποιήσεις λειτουργούν κανονικά.");
};

export const playSound = (urgency: 'low' | 'medium' | 'high' = 'medium') => {
    if (typeof window === 'undefined') return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && fallbackAudio) {
        const beepCount = urgency === 'high' ? 3 : urgency === 'medium' ? 2 : 1;
        let i = 0;
        const play = () => {
            if (i < beepCount && fallbackAudio) {
                fallbackAudio.currentTime = 0;
                fallbackAudio.play().then(() => {
                    i++;
                    setTimeout(play, 300);
                }).catch(() => { });
            }
        };
        play();
        return;
    }

    try {
        if (!audioContext) return;
        const baseFreq = urgency === 'high' ? 1000 : urgency === 'medium' ? 800 : 600;
        const beepCount = urgency === 'high' ? 3 : urgency === 'medium' ? 2 : 1;

        for (let i = 0; i < beepCount; i++) {
            setTimeout(() => {
                if (!audioContext) return;
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.frequency.value = baseFreq + (i * 100);
                gain.gain.setValueAtTime(0.5, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                osc.start(audioContext.currentTime);
                osc.stop(audioContext.currentTime + 0.3);
            }, i * 200);
        }
    } catch (e) { }
};

export const vibrate = (urgency: 'low' | 'medium' | 'high' = 'medium') => {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
        const patterns = {
            low: [200],
            medium: [200, 100, 200],
            high: [200, 100, 200, 100, 300, 100, 300],
        };
        navigator.vibrate(patterns[urgency]);
    } catch (e) { }
};
