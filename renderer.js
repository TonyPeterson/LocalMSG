const dgram = require('dgram');

const socket = dgram.createSocket('udp4');
const PORT = 41234;
const BROADCAST_ADDR = '10.0.0.255'; 
const peers = new Set();
let myName = ''; 
let isMuted = false;
let isScreenprint = false;

// Grab the HTML elements
const chatHistory = document.getElementById('chat-history');
const messageInput = document.getElementById('message-input');
const loginOverlay = document.getElementById('login-overlay');
const nameInput = document.getElementById('name-input');

// Menu Elements
const hamburgerBtn = document.getElementById('hamburger-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const muteBtn = document.getElementById('mute-btn');
const themeBtn = document.getElementById('theme-btn');

const pingSound = new Audio('./ResettiPing.wav'); 
const rand = (min, max) => (Math.random() * (max - min) + min).toFixed(2);

// TOGGLE THE HAMBURGER MENU
hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Stops the document click listener from immediately closing it
    dropdownMenu.classList.toggle('show');
});

// CLOSE THE MENU IF YOU CLICK ANYWHERE ELSE ON THE SCREEN
document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// THE MUTE TOGGLE
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔊 Unmute Chat' : '🔇 Mute Chat'; 
});

// THE THEME TOGGLE
themeBtn.addEventListener('click', () => {
    isScreenprint = !isScreenprint;
    document.body.classList.toggle('screenprint-mode', isScreenprint);
    themeBtn.textContent = isScreenprint ? '🌙 Dark Mode' : '🎨 Print Mode'; 
});

// Helper function to draw messages
// The updated draw function
function addMessageToScreen(name, text, isSystem = false, isMe = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';

    if (isSystem) {
        const sysDiv = document.createElement('div');
        sysDiv.className = 'message system';
        sysDiv.textContent = text;
        wrapper.appendChild(sysDiv);
    } else {
        // Build the tiny name label
        const nameDiv = document.createElement('div');
        nameDiv.className = 'sender-name';
        nameDiv.textContent = name; // No colon!

        // Build the actual text bubble
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = isMe ? 'message my-message' : 'message other-message';
        bubbleDiv.textContent = text;
        
        // Random misregister coordinates for the bubble
        bubbleDiv.style.setProperty('--bg-x', `${rand(-3, 4)}px`);
        bubbleDiv.style.setProperty('--bg-y', `${rand(-3, 4)}px`);
        bubbleDiv.style.setProperty('--bg-rot', `${rand(-1.5, 1.5)}deg`);
        bubbleDiv.style.setProperty('--bg-skew', `${rand(-2, 2)}deg`);

        bubbleDiv.style.setProperty('--out-x', `${rand(-2, 3)}px`);
        bubbleDiv.style.setProperty('--out-y', `${rand(-2, 3)}px`);
        bubbleDiv.style.setProperty('--out-rot', `${rand(-1.5, 1.5)}deg`);
        bubbleDiv.style.setProperty('--out-skew', `${rand(-2, 2)}deg`);

        // Pack them into the wrapper
        wrapper.appendChild(nameDiv);
        wrapper.appendChild(bubbleDiv);
    }
    
    chatHistory.appendChild(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight; 
}

// WAIT FOR THE LOGIN
nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        myName = nameInput.value.trim() || `User_${Math.floor(Math.random() * 1000)}`;
        
        loginOverlay.style.display = 'none';
        messageInput.focus();
        startNetwork();
    }
});

function startNetwork() {
    socket.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg);
            
            if (data.type === 'DISCOVERY' && data.name !== myName) {
                if (!peers.has(rinfo.address)) {
                    peers.add(rinfo.address);
                    addMessageToScreen('', `[System] ${data.name} joined the network.`, true);
                }
            } 
            else if (data.type === 'CHAT' && data.name !== myName) {
                if (!isMuted) {
                    pingSound.play().catch(err => console.log("Audio failed:", err));
                }
                addMessageToScreen(data.name, data.text, false, false);
            }
            else if (data.type === 'DISCONNECT' && data.name !== myName) {
                if (peers.has(rinfo.address)) {
                    peers.delete(rinfo.address); 
                    addMessageToScreen('', `[System] ${data.name} has left the chat.`, true);
                }
            }
        } catch (e) {}
    });

    socket.bind(PORT, () => {
        socket.setBroadcast(true);
        addMessageToScreen('', `Welcome, ${myName}.`, true);

        setInterval(() => {
            const message = Buffer.from(JSON.stringify({ type: 'DISCOVERY', name: myName }));
            socket.send(message, 0, message.length, PORT, BROADCAST_ADDR);
        }, 3000);
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && messageInput.value.trim() !== '') {
            const text = messageInput.value;
            messageInput.value = ''; 

            addMessageToScreen('You', text, false, true);

            const message = Buffer.from(JSON.stringify({ 
                type: 'CHAT', 
                name: myName,
                text: text 
            }));

            for (const ip of peers) {
                socket.send(message, 0, message.length, PORT, ip);
            }
        }
    });

    window.addEventListener('beforeunload', () => {
        const message = Buffer.from(JSON.stringify({ type: 'DISCONNECT', name: myName }));
        for (const ip of peers) {
            socket.send(message, 0, message.length, PORT, ip);
        }
    });
}