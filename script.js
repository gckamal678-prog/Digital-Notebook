// Firebase मोड्युलहरू इम्पोर्ट (तपाईंको कन्फिगरेसन अनुसार)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDY_v7RHnkCTI6uyV4DNDjqoaIBGweg8c",
  authDomain: "digital-a2552.firebaseapp.com",
  projectId: "digital-a2552",
  storageBucket: "digital-a2552.firebasestorage.app",
  messagingSenderId: "218135618179",
  appId: "1:218135618179:web:821b76920d3e5669ac31b6"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// आफ्नो युजर आईडी (तपाईंले लगइन गर्दा वा सुरुमा प्रयोग गर्ने निश्चित ID, जस्तै: "mero_khata_123")
// नोट: यो आईडी परिवर्तन नगर्नुहोस्, किनकि यही नाममा तपाईंको ब्याकअप बस्छ।
const CURRENT_USER_ID = localStorage.getItem('my_unique_userid') || "user_" + Math.random().toString(36).substring(2, 8);
localStorage.setItem('my_unique_userid', CURRENT_USER_ID);

let html5QrCode = null;
let lastGeneratedToken = "";

// -------------------------------------------------------------
// १. क्लाउड ब्याकअप र रिस्टोर फंक्सनहरू (तपाईंको आफ्नै कोड)
// -------------------------------------------------------------
export async function backupToCloud() {
    try {
        const localData = {
            notes: JSON.parse(localStorage.getItem('advanced_notebook_notes') || '[]'),
            theme: localStorage.getItem('theme') || 'dark',
            language: localStorage.getItem('language') || 'en',
            currency: localStorage.getItem('currency') || 'NPR',
            updatedAt: new Date().toISOString()
        };

        await set(ref(db, 'users/' + CURRENT_USER_ID), localData);
        return { success: true, message: "Cloud मा डाटा सफल रूपमा सेभ भयो!" };
    } catch (error) {
        console.error("Cloud Backup Error:", error);
        return { success: false, message: error.message };
    }
}

export async function restoreFromCloud(userIdToFetch = CURRENT_USER_ID) {
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `users/${userIdToFetch}`));
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.notes) localStorage.setItem('advanced_notebook_notes', JSON.stringify(data.notes));
            if (data.theme) localStorage.setItem('theme', data.theme);
            if (data.language) localStorage.setItem('language', data.language);
            if (data.currency) localStorage.setItem('currency', data.currency);
            
            return { success: true, message: "क्लाउडबाट डाटा सफलतापुर्वक Sync भयो!" };
        } else {
            return { success: false, message: "क्लाउडमा कुनै ब्याकअप भेटिएन!" };
        }
    } catch (error) {
        console.error("Cloud Restore Error:", error);
        return { success: false, message: error.message };
    }
}

// -------------------------------------------------------------
// २. सुरक्षित QR जेनेरेसन (तपाईंको ID र समय समेटिएको)
// -------------------------------------------------------------
window.generateSecureQR = function() {
    const qrcodeContainer = document.getElementById('qrcode');
    if (!qrcodeContainer) return;
    
    qrcodeContainer.innerHTML = ""; 
    
    const uniqueHash = Math.random().toString(36).substring(2, 8);
    // टोकनभित्र तपाईंको खास ID र Timestamp राखिन्छ
    const secureToken = `LEDGER_SYNC_${CURRENT_USER_ID}_${Date.now()}_${uniqueHash}`;
    
    lastGeneratedToken = secureToken;

    if (typeof QRCode !== 'undefined') {
        new QRCode(qrcodeContainer, {
            text: secureToken,
            width: 150,
            height: 150,
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.classList.remove('hidden');
    
    showFeedback("पारिवारिक सुरक्षित QR जेनेरेट भयो! अब यसलाई सेयर गर्नुहोस्।", "success");
}

// -------------------------------------------------------------
// ३. स्क्यान सफल भएपछि चल्ने मुख्य लजिक
// -------------------------------------------------------------
function handleScanSuccess(text) {
    if (typeof text !== 'string') return;

    if (text.startsWith("LEDGER_SYNC_")) {
        const parts = text.split("_");
        if (parts.length >= 3) {
            const targetUserId = parts[2]; // यो श्रीमानको युजर आईडी हो
            const tokenTimestamp = parseInt(parts[3], 10);
            const timeDifference = (Date.now() - tokenTimestamp) / 1000; // सेकेन्डमा

            // २ मिनेट (१२० सेकेन्ड) भन्दा पुरानो QR भएमा अस्वीकार गर्ने
            if (timeDifference > 120 || timeDifference < 0) {
                playBeep(false);
                showFeedback("यो QR को समय समाप्त भयो (Expired)! नयाँ QR मगाउनुहोस्।", "error");
                return;
            }

            // सफलताको अडियो र कम्पन
            if (navigator.vibrate) navigator.vibrate(200);
            playBeep(true);

            // श्रीमतीजीको फोनमा यो ID सेभ गर्ने ताकि सधैँ सिङ्क हुन पाओोस्
            localStorage.setItem("linked_ledger_user_id", targetUserId);

            showFeedback("खाता सफलतापूर्वक लिंक भयो! डाटा लोड हुँदैछ...", "success");

            // तुरुन्तै क्लाउडबाट श्रीमानको डाटा तानेर एपमा देखाउने
            restoreFromCloud(targetUserId).then(res => {
                if (res.success) {
                    alert("श्रीमानको लेजर खाता सफलतापूर्वक तपाईंको फोनमा सिङ्क भयो!");
                    location.reload(); // पेज रिफ्रेस गरेर नयाँ डेटा देखाउने
                } else {
                    showFeedback("डाटा तान्न सकिएन: " + res.message, "error");
                }
            });
            return;
        }
    }

    playBeep(false);
    showFeedback("अमान्य (Invalid) QR कोड!", "error");
}

// -------------------------------------------------------------
// ४. अडियो र स्क्यानिङ कन्ट्रोल फंक्सनहरू
// -------------------------------------------------------------
function playBeep(isSuccess) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = isSuccess ? 'sine' : 'sawtooth';
        oscillator.frequency.setValueAtTime(isSuccess ? 880 : 300, audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + (isSuccess ? 0.15 : 0.3));
    } catch (e) {
        console.warn("Audio Context error", e);
    }
}

window.startRealScanner = function() {
    const placeholder = document.getElementById('scannerPlaceholder');
    const spinner = document.getElementById('scannerLoading');
    
    if (spinner) spinner.classList.remove('hidden');
    if (placeholder) placeholder.style.display = 'none';
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 150, height: 150 } },
        (decodedText) => {
            if (spinner) spinner.classList.add('hidden');
            handleScanSuccess(decodedText);
            stopRealScanner();
        },
        () => {}
    ).catch((err) => {
        if (spinner) spinner.classList.add('hidden');
        showFeedback("क्यामेरा खोल्न सकिएन। अनुमति (Permission) चेक गर्नुहोस्।", "error");
        if (placeholder) placeholder.style.display = 'flex';
    });
}

window.stopRealScanner = function() {
    const spinner = document.getElementById('scannerLoading');
    if (spinner) spinner.classList.add('hidden');

    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            const placeholder = document.getElementById('scannerPlaceholder');
            if (placeholder) placeholder.style.display = 'flex';
        }).catch(err => console.error(err));
    }
}

window.shareFamilyQR = async function() {
    if (!lastGeneratedToken) {
        alert("पहिले सुरक्षित QR जेनेरेट गर्नुहोस्!");
        return;
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Family Ledger Sync Token',
                text: `मेरो लेजर खाता हेर्न र सिङ्क गर्न यो सुरक्षित टोकन प्रयोग गर्नुहोस्: ${lastGeneratedToken}`
            });
        } catch (err) {
            console.log('Sharing canceled', err);
        }
    } else {
        try {
            await navigator.clipboard.writeText(lastGeneratedToken);
            alert("टोकन क्लिपबोर्डमा कपी भयो!");
        } catch (err) {
            console.error('Clipboard failed', err);
        }
    }
}

function showFeedback(message, type) {
    const fb = document.getElementById('feedbackMsg');
    if (!fb) return;
    
    fb.classList.remove('hidden', 'bg-emerald-950', 'text-emerald-300', 'bg-red-950', 'text-red-300');
    if (type === 'success') {
        fb.classList.add('bg-emerald-950', 'text-emerald-300');
    } else {
        fb.classList.add('bg-red-950', 'text-red-300');
    }
    fb.textContent = message;

    setTimeout(() => {
        fb.classList.add('hidden');
    }, 3000);
}
