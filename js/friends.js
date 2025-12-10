// friends.js

let unsubscribeFriends = null;

function loadFriendsList() {
    if (!appState.currentUser) return;

    const listContainer = document.getElementById('friendsListContainer');
    listContainer.innerHTML = '<div class="loading-spinner">Loading friends...</div>';

    // Real-time listener for friends
    // Friends are stored in users/{uid}/friends collection

    unsubscribeFriends = db.collection('users')
        .doc(appState.currentUser.uid)
        .collection('friends')
        .onSnapshot(snapshot => {
            listContainer.innerHTML = '';
            if (snapshot.empty) {
                listContainer.innerHTML = '<p style="text-align:center; opacity:0.6; margin-top:20px;">No friends yet. Add one!</p>';
                return;
            }

            snapshot.forEach(doc => {
                const friendData = doc.data();
                const friendItem = document.createElement('div');
                friendItem.className = 'friend-item';
                friendItem.innerHTML = `
                    <div class="avatar"><i class="fa-solid fa-user"></i></div>
                    <div class="friend-info">
                        <h4>${friendData.email.split('@')[0]}</h4> <!-- Simple username from email -->
                        <p>${friendData.email}</p>
                    </div>
                `;
                friendItem.addEventListener('click', () => {
                    startChat(friendData); // in chat.js
                });
                listContainer.appendChild(friendItem);
            });
        });
}

// Add Friend Logic
document.getElementById('confirmAddFriend').addEventListener('click', async () => {
    const email = document.getElementById('newFriendEmail').value.trim();
    if (!email) return;

    if (email === appState.currentUser.email) {
        alert("You cannot add yourself!");
        return;
    }

    // 1. Find user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
        alert("User not found!");
        return;
    }

    const friendDoc = snapshot.docs[0];
    const friendData = friendDoc.data();

    // 2. Add to my friends collection
    await db.collection('users').doc(appState.currentUser.uid).collection('friends').doc(friendData.uid).set({
        uid: friendData.uid,
        email: friendData.email
    });

    // 3. Add me to their friends collection (Auto-friend for simplicity in v1)
    await db.collection('users').doc(friendData.uid).collection('friends').doc(appState.currentUser.uid).set({
        uid: appState.currentUser.uid,
        email: appState.currentUser.email
    });

    ui.toggleElement('addFriendPanel', false);
    document.getElementById('newFriendEmail').value = '';
    alert("Friend added!");
});
