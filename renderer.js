const dgram = require('dgram');

const socket = dgram.createSocket('udp4');
const PORT = 41234;
const BROADCAST_ADDR = '10.0.0.255'; 
const peers = new Set();
let myName = ''; 
let isMuted = false;

// Grab the HTML elements
const chatHistory = document.getElementById('chat-history');
const messageInput = document.getElementById('message-input');
const loginOverlay = document.getElementById('login-overlay');
const nameInput = document.getElementById('name-input');
const muteBtn = document.getElementById('mute-btn');

// Load the trauma-inducing sound effect
const pingSound = new Audio('./ResettiPing.wav'); 

// THE MUTE TOGGLE
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔊'; 
});

// Helper function to draw messages
function addMessageToScreen(text, isSystem = false, isMe = false) {
    const div = document.createElement('div');
    
    if (isSystem) {
        div.className = 'message system';
    } else {
        // Assign the correct class based on who sent it
        div.className = isMe ? 'message my-message' : 'message other-message';
    }
    
    div.textContent = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight; 
}

// WAIT FOR THE LOGIN
nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        myName = nameInput.value.trim() || `User_${Math.floor(Math.random() * 1000)}`;
        
        // Hide the login screen
        loginOverlay.style.display = 'none';
        
        // Put the typing cursor in the chat box
        messageInput.focus();
        
        // Boot the network
        startNetwork();
    }
});

function startNetwork() {
    // 1. THE LISTENER
    socket.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg);
            
            if (data.type === 'DISCOVERY' && data.name !== myName) {
                if (!peers.has(rinfo.address)) {
                    peers.add(rinfo.address);
                    addMessageToScreen(`[System] ${data.name} joined the network.`, true);
                }
            } 
            else if (data.type === 'CHAT' && data.name !== myName) {
                // Only play the sound if the chat is not muted
                if (!isMuted) {
                    pingSound.play().catch(err => console.log("Audio failed:", err));
                }
                
                addMessageToScreen(`${data.name}: ${data.text}`, false, false);
            }
            else if (data.type === 'DISCONNECT' && data.name !== myName) {
                if (peers.has(rinfo.address)) {
                    peers.delete(rinfo.address); 
                    addMessageToScreen(`[System] ${data.name} has left the chat.`, true);
                }
            }
        } catch (e) {
            // Ignore garbage data
        }
    });

    // 2. THE YELLER
    socket.bind(PORT, () => {
        socket.setBroadcast(true);
        addMessageToScreen(`Welcome, ${myName}.`, true);

        setInterval(() => {
            const message = Buffer.from(JSON.stringify({ type: 'DISCOVERY', name: myName }));
            socket.send(message, 0, message.length, PORT, BROADCAST_ADDR);
        }, 3000);
    });

    // 3. THE TYPER
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && messageInput.value.trim() !== '') {
            const text = messageInput.value;
            messageInput.value = ''; // Clear the box

            addMessageToScreen(`You: ${text}`, false, true);

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

    // 4. GRACEFUL EXIT
    window.addEventListener('beforeunload', () => {
        const message = Buffer.from(JSON.stringify({ type: 'DISCONNECT', name: myName }));
        for (const ip of peers) {
            socket.send(message, 0, message.length, PORT, ip);
        }
    });
}