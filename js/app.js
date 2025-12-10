// app.js

const views = {
    login: document.getElementById('loginView'),
    friends: document.getElementById('friendsView'),
    chat: document.getElementById('chatView')
};

// UI Helpers
const ui = {
    showView: (viewName) => {
        Object.values(views).forEach(v => v.classList.remove('active-view'));
        views[viewName].classList.add('active-view');
    },

    showError: (elementId, msg) => {
        const el = document.getElementById(elementId);
        el.textContent = msg;
        setTimeout(() => el.textContent = '', 3000);
    },

    toggleElement: (id, show) => {
        const el = document.getElementById(id);
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
};

// Global App State
const appState = {
    currentUser: null,
    currentChatFriend: null
};

// Initial Event Listeners (UI only)
document.addEventListener('DOMContentLoaded', () => {

    // Add Friend Modal
    document.getElementById('addFriendBtn').addEventListener('click', () => {
        ui.toggleElement('addFriendPanel', true);
    });

    document.getElementById('cancelAddFriend').addEventListener('click', () => {
        ui.toggleElement('addFriendPanel', false);
        document.getElementById('newFriendEmail').value = '';
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        auth.signOut();
    });

    // Back from Chat
    document.getElementById('backToFriends').addEventListener('click', () => {
        appState.currentChatFriend = null;
        ui.showView('friends');
        // Unsubscribe from chat listener if exists (handled in chat.js)
        if (window.unsubscribeChat) window.unsubscribeChat();
    });
});
