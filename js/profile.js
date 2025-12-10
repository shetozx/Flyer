// profile.js

const profile = {
    // Save profile updates
    updateProfile: async (data) => {
        if (!appState.currentUser) return;

        try {
            await db.collection('users').doc(appState.currentUser.uid).set(data, { merge: true });
            alert("Profile Saved!");
            // Update local state display
            if (data.username) document.getElementById('currentUserDisplay').textContent = '@' + data.username;
        } catch (e) {
            console.error(e);
            alert("Error saving profile: " + e.message);
        }
    },

    // Check if username is taken
    checkUsername: async (username) => {
        const snapshot = await db.collection('users').where('username', '==', username).get();
        return !snapshot.empty;
    },

    toggleOnlineStatus: (status) => {
        if (!appState.currentUser) return;
        db.collection('users').doc(appState.currentUser.uid).update({
            status: status,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
};

// Setup Profile UI Listeners
document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const username = document.getElementById('editUsername').value.trim();
    const bio = document.getElementById('editBio').value.trim();

    // Validations
    if (username.length < 3) {
        alert("Username too short");
        return;
    }

    // TODO: optimization - check if username changed before checking DB
    // For now assuming update

    await profile.updateProfile({
        username,
        bio
    });
});
