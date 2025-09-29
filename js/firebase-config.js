// Firebase Configuration
// Replace these values with your own from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyDlZwleEJYASS9HAz6bwc9kwhzmX8Tm4SA",
authDomain: "[listening-party-2-bf563.firebaseapp.com](http://listening-party-2-bf563.firebaseapp.com/)",
projectId: "listening-party-2-bf563",
storageBucket: "listening-party-2-bf563.firebasestorage.app",
messagingSenderId: "682365040773",
appId: "1:682365040773:web:88430153b24c6504b411ec"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const storage = firebase.storage();

// Helper function to show connection status
function checkFirebaseConnection() {
    console.log('🔥 Firebase initialized successfully!');
    console.log('📊 Firestore:', db ? 'Connected' : 'Not connected');
    console.log('📦 Storage:', storage ? 'Connected' : 'Not connected');
}

// Run connection check
checkFirebaseConnection();

// Export for use in other files
window.db = db;
window.storage = storage;