// auth.js

// Auth State Listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        appState.currentUser = user;
        console.log("Logged in as:", user.email);

        // Fetch User Data from Firestore to get Username
        const userDoc = await db.collection('users').doc(user.uid).get();

        if (userDoc.exists && userDoc.data().username) {
            // User has setup profile
            appState.currentUserData = userDoc.data();

            document.getElementById('userControls').classList.remove('hidden');
            document.getElementById('currentUserDisplay').textContent = '@' + appState.currentUserData.username;

            ui.showView('friends');
            loadFriendsList();
        } else {
            // New User or Migration: Go to Setup
            document.getElementById('userControls').classList.add('hidden');
            ui.showView('profileSetupView');
        }

        // Update Online Status
        db.collection('users').doc(user.uid).set({
            status: 'online',
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    } else {
        // User is signed out
        appState.currentUser = null;
        appState.currentUserData = null;
        console.log("Logged out");

        document.getElementById('userControls').classList.add('hidden');
        ui.showView('login');
    }
});

// Setup Completion Logic
document.getElementById('completeSetupBtn')?.addEventListener('click', async () => {
    const username = document.getElementById('setupUsername').value.trim();
    const bio = document.getElementById('setupBio').value.trim();

    if (!username || username.length < 3) {
        alert("Please enter a valid username (3+ chars).");
        return;
    }

    // Check availability (Skipped for speed, assume unique or handle error)

    await db.collection('users').doc(appState.currentUser.uid).set({
        uid: appState.currentUser.uid,
        email: appState.currentUser.email,
        username: username,
        bio: bio,
        searchKey: username.toLowerCase(), // Helper for case-insensitive search
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Reload to trigger auth listener logic
    location.reload();
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
