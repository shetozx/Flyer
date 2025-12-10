// chat.js

let unsubscribeChat = null;

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

function startChat(friendData) {
    appState.currentChatFriend = friendData;

    // Update Header
    document.getElementById('chatUserName').textContent = friendData.email.split('@')[0];
    // Reset Avatar color (optional dynamic logic here)

    // Show View
    ui.showView('chat');

    // Load Messages
    loadMessages();
}

function loadMessages() {
    const chatId = getChatId(appState.currentUser.uid, appState.currentChatFriend.uid);
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = ''; // Clear previous

    if (unsubscribeChat) unsubscribeChat();

    // Listen to messages
    const query = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc') // Oldest first
        .limit(50); // Limit last 50

    unsubscribeChat = query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const msgData = change.doc.data();
                renderMessage(msgData);
            }
        });
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function renderMessage(msgData) {
    const container = document.getElementById('messagesContainer');
    const msgDiv = document.createElement('div');
    const isMe = msgData.senderId === appState.currentUser.uid;

    msgDiv.className = `message ${isMe ? 'msg-sent' : 'msg-received'}`;
    msgDiv.textContent = msgData.text;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Send Message Logic
document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !appState.currentChatFriend) return;

    const chatId = getChatId(appState.currentUser.uid, appState.currentChatFriend.uid);

    input.value = ''; // Clear immediately

    await db.collection('chats').doc(chatId).collection('messages').add({
        text: text,
        senderId: appState.currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update last message in chat metadata (optional for list view later)
    await db.collection('chats').doc(chatId).set({
        lastMessage: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        users: [appState.currentUser.uid, appState.currentChatFriend.uid]
    }, { merge: true });
}
