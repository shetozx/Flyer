const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
};

// High Quality Media Constraints
const mediaConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    video: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { ideal: 30 }
    }
};

let pc = null;
let localStream = null;
let remoteStream = null;


// Call State
let currentCallId = null;

// References
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// 1. Initialize logic for incoming calls globally
auth.onAuthStateChanged((user) => {
    if (user) {
        listenForIncomingCalls(user.uid);
    }
});

function listenForIncomingCalls(uid) {
    // Listen for offers where callee == this user
    // We'll use a 'calls' collection. Each doc is a call.
    // Query: where calleeId == uid, and type == 'offer' (or just existing call docs)
    // For simplicity: We will listen to the specific path matching potential chat IDs or a global 'calls' query.
    // Optimization: Listen to a 'incoming_calls' subcollection on the user profile or root calls with where clause.

    db.collection('calls').where('calleeId', '==', uid).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const callData = change.doc.data();
                // Check if call is fresh (timestamp check could be added)
                showIncomingCallModal(change.doc.id, callData);
            }
        });
    });
}

function showIncomingCallModal(callId, callData) {
    // Check if simplified ID lookup for name
    // Ideally we fetch user profile, for now show generic or email if available in callData
    document.getElementById('callerNameDisplay').textContent = (callData.callerEmail || "Unknown") + " is calling...";
    ui.toggleElement('callModal', true);

    // Bind Accept/Reject
    document.getElementById('acceptCallBtn').onclick = () => answerCall(callId);
    document.getElementById('rejectCallBtn').onclick = () => rejectCall(callId);
}

// 2. Start Call
document.getElementById('videoCallBtn').addEventListener('click', () => startCall(true));
document.getElementById('voiceCallBtn').addEventListener('click', () => startCall(false));

async function startCall(videoEnabled) {
    if (!appState.currentChatFriend) return;

    // UI
    ui.toggleElement('activeCallOverlay', true);
    document.getElementById('localVideo').style.display = videoEnabled ? 'block' : 'none'; // hide self view if voice only

    // Use defined high-quality constraints, but override video if voice-only call
    const constraints = {
        ...mediaConstraints,
        video: videoEnabled ? mediaConstraints.video : false
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    pc = new RTCPeerConnection(servers);
    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };

    localVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    // Create Call Doc
    const callDoc = db.collection('calls').doc(); // Auto-ID
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    currentCallId = callDoc.id;

    // ICE Candidates
    pc.onicecandidate = event => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    // Create Offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
        callerId: appState.currentUser.uid,
        callerEmail: appState.currentUser.email,
        calleeId: appState.currentChatFriend.uid,
        videoEnabled: videoEnabled,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await callDoc.set(offer);

    // Listen for Answer
    callDoc.onSnapshot(snapshot => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data && data.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
    });

    // Listen for Remote ICE
    answerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

// 3. Answer Call
async function answerCall(callId) {
    currentCallId = callId;
    ui.toggleElement('callModal', false);
    ui.toggleElement('activeCallOverlay', true);

    const callDoc = db.collection('calls').doc(callId);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    const callData = (await callDoc.get()).data();
    const videoEnabled = callData.videoEnabled; // Respect caller's mode? Or negotiation? Assuming match.

    pc = new RTCPeerConnection(servers);

    localStream = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: true });
    remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };

    localVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    pc.onicecandidate = event => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    // Set Remote Description (Offer)
    const offerDescription = callData;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    // Create Answer
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    // Listen for Remote ICE (Caller's candidates)
    offerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

// 4. End Call / Hangup
document.getElementById('endCallBtn').addEventListener('click', endCall);

function rejectCall(callId) {
    // Just remove from UI or delete doc
    ui.toggleElement('callModal', false);
    // Optional: db.collection('calls').doc(callId).delete();
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop()); // Not really needed but good cleanup
    }
    if (pc) {
        pc.close();
    }

    pc = null;
    localStream = null;
    remoteStream = null;

    ui.toggleElement('activeCallOverlay', false);

    // Clean up DB doc (optional)
    if (currentCallId) {
        // We might want to keep history, but for signaling, we can just leave it or mark as ended.
        // db.collection('calls').doc(currentCallId).delete(); 
        currentCallId = null;
    }
}

// Toggle Mute
document.getElementById('muteAudioBtn').addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
    }
});

document.getElementById('muteVideoBtn').addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
    }
});
