```javascript
// chat.js
// Removed Firebase Storage dependency to keep it free/simple as requested.
// Using Base64 encoding for small files (< 700KB) stored directly in Firestore.

let unsubscribeChat = null;
let typingTimeout = null;
let mediaRecorder = null;
let audioChunks = [];
let replyToMessage = null;

function getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

async function startChat(friendData) {
    appState.currentChatFriend = friendData;
    
    // UI Setup
    document.getElementById('chatUserName').textContent = friendData.email.split('@')[0];
    if(friendData.username) document.getElementById('chatUserName').textContent = friendData.username;
    
    // Check Block Status (Placeholder)
    
    ui.showView('chat');
    loadMessages();
    setupRealtimeStatus();

    updateInputState();
}


// --- Realtime Status (Typing & Online) ---
function setupRealtimeStatus() {
    const friendId = appState.currentChatFriend.uid;
    
    // Listen for Online/Last Seen
    db.collection('users').doc(friendId).onSnapshot(doc => {
        if(!doc.exists) return;
        const data = doc.data();
        const statusEl = document.getElementById('chatUserStatus');
        if(data.status === 'online') {
            statusEl.textContent = 'Online';
            statusEl.style.color = '#4cd137';
        } else {
            statusEl.textContent = 'Offline'; 
            statusEl.style.color = 'rgba(255,255,255,0.5)';
        }
    });

    // Listen for Typing
    const chatId = getChatId(appState.currentUser.uid, friendId);
    db.collection('chats').doc(chatId).collection('typing').doc(friendId)
        .onSnapshot(doc => {
            const indicator = document.getElementById('typingIndicator');
            if(doc.exists && doc.data().isTyping) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        });
}

// --- Typing & Input ---
document.getElementById('messageInput').addEventListener('input', () => {
    updateInputState();
    
    // Send typing status
    const chatId = getChatId(appState.currentUser.uid, appState.currentChatFriend.uid);
    db.collection('chats').doc(chatId).collection('typing').doc(appState.currentUser.uid).set({
        isTyping: true,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    if(typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
         db.collection('chats').doc(chatId).collection('typing').doc(appState.currentUser.uid).set({
            isTyping: false
        });
    }, 2000);
});

function updateInputState() {
    const val = document.getElementById('messageInput').value.trim();
    if(val.length > 0) {
        document.getElementById('recordBtn').classList.add('hidden');
        document.getElementById('sendMessageBtn').classList.remove('hidden');
    } else {
        document.getElementById('recordBtn').classList.remove('hidden');
        document.getElementById('sendMessageBtn').classList.add('hidden');
    }
}


// --- Messaging Core ---
function loadMessages() {
    const chatId = getChatId(appState.currentUser.uid, appState.currentChatFriend.uid);
    const container = document.getElementById('messagesContainer');
    container.innerHTML = ''; 

    if(unsubscribeChat) unsubscribeChat();

    const query = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .limit(50);

    unsubscribeChat = query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                renderMessage(change.doc.data(), change.doc.id);
            }
        });
        container.scrollTop = container.scrollHeight;
    });
}

function renderMessage(msg, id) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    const isMe = msg.senderId === appState.currentUser.uid;
    
    div.className = `message ${ isMe ? 'msg-sent' : 'msg-received' } `;
    
    // Handle Types
    if(msg.type === 'text') {
        div.textContent = msg.text;
    } else if (msg.type === 'image') {
        div.classList.add('media-msg');
        div.innerHTML = `< img src = "${msg.url}" loading = "lazy" onclick = "window.open('${msg.url}')" style = "cursor:pointer" > `; 
    } else if (msg.type === 'audio') {
        div.innerHTML = `
    < div class="audio-player" >
                <button onclick="this.nextElementSibling.play()"><i class="fa-solid fa-play"></i></button>
                <audio src="${msg.url}"></audio>
                <span>Voice Note</span>
            </div >
    `;
    }

    // Append Info
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';
    const info = document.createElement('div');
    info.style.fontSize = '0.7rem';
    info.style.opacity = '0.6';
    info.style.textAlign = 'right';
    info.style.marginTop = '4px';
    info.innerHTML = `${ time } ${ isMe ? '<i class="fa-solid fa-check-double"></i>' : '' } `;
    div.appendChild(info);

    container.appendChild(div);
}

// --- Sending Logic ---
document.getElementById('sendMessageBtn').addEventListener('click', () => sendText());
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendText();
});

async function sendText() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if(!text) return;

    await dispatchMessage({ type: 'text', text: text });
    input.value = '';
    updateInputState();
}

async function dispatchMessage(payload) {
   if(!appState.currentChatFriend) return;
   
   const chatId = getChatId(appState.currentUser.uid, appState.currentChatFriend.uid);
   
   // Common Fields
   const msgData = {
       senderId: appState.currentUser.uid,
       timestamp: firebase.firestore.FieldValue.serverTimestamp(),
       read: false,
       ...payload
   };

   // Check Reply
   if(replyToMessage) {
       msgData.replyTo = replyToMessage;
       closeReply(); // clear UI
   }

   // Fire & Forget
   db.collection('chats').doc(chatId).collection('messages').add(msgData);
}

// --- Attachments (Base64) ---
document.getElementById('attachBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    // Size Validations (Limit to 700KB for Firestore safety)
    if(file.size > 700 * 1024) {
        alert("File too large for free storage. Please send files smaller than 700KB.");
        return;
    }

    // Detect Type
    let type = 'file';
    if(file.type.startsWith('image/')) type = 'image';
    if(file.type.startsWith('audio/')) type = 'audio';

    // Convert to Base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64Url = reader.result;
        await dispatchMessage({ type, url: base64Url, fileName: file.name });
    };
    reader.onerror = (error) => console.log('Error: ', error);
});

// --- Voice Recording (Base64) ---
const recordBtn = document.getElementById('recordBtn');

recordBtn.addEventListener('mousedown', startRecording);
recordBtn.addEventListener('mouseup', stopRecording);
recordBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); }); // Mobile support
recordBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

async function startRecording() {
    recordBtn.classList.add('recording');
    audioChunks = [];
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.start();
    } catch(e) {
        alert("Microphone Error: " + e.message);
        recordBtn.classList.remove('recording');
    }
}

async function stopRecording() {
    recordBtn.classList.remove('recording');
    if(!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.stop();
    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        
        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Url = reader.result;
            // Check size limits again
            if(base64Url.length > 1000000) { // Roughly 750KB for Base64
                 alert("Voice note too long for free storage.");
                 return;
            }
            await dispatchMessage({ type: 'audio', url: base64Url });
        };
        
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    };
}

// --- Options (Block, Clear) ---
document.getElementById('chatOptionsBtn').addEventListener('click', () => {
    ui.toggleElement('chatOptionsDropdown', true);
    setTimeout(() => {
        document.addEventListener('click', hideDropdownOutside);
    }, 100);
});

function hideDropdownOutside(e) {
    if(!e.target.closest('#chatOptionsDropdown')) {
        ui.toggleElement('chatOptionsDropdown', false);
        document.removeEventListener('click', hideDropdownOutside);
    }
}

document.getElementById('clearChatBtn').addEventListener('click', async () => {
    if(confirm("Delete all messages for YOU?")) {
        alert("Not implemented fully yet - needs specific delete logic per user message.");
    }
});
```
