// auth.js

// Auth State Listener
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        appState.currentUser = user;
        console.log("Logged in as:", user.email);

        // Update specific user doc in Firestore (to ensure existence for search)
        db.collection('users').doc(user.uid).set({
            email: user.email,
            uid: user.uid,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update UI
        document.getElementById('userControls').classList.remove('hidden');
        // shorten email for display
        document.getElementById('currentUserDisplay').textContent = user.email.split('@')[0];

        ui.showView('friends');
        loadFriendsList(); // from friends.js
    } else {
        // User is signed out
        appState.currentUser = null;
        console.log("Logged out");

        document.getElementById('userControls').classList.add('hidden');
        ui.showView('login');
    }
});

// Login
document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        ui.showError('authError', e.message);
    }
});

// Register
document.getElementById('registerBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;

    try {
        await auth.createUserWithEmailAndPassword(email, pass);
    } catch (e) {
        ui.showError('authError', e.message);
    }
});
