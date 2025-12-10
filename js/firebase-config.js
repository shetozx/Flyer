// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCBma8M1i0ceUch-_dyP5nJ9vt_4S40zGc",
    authDomain: "flyerchatt.firebaseapp.com",
    projectId: "flyerchatt",
    storageBucket: "flyerchatt.firebasestorage.app",
    messagingSenderId: "719401697364",
    appId: "1:719401697364:web:d2cdb4a6435a6079386dc1"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Export globally
window.auth = auth;
window.db = db;

