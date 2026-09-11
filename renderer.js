const dgram = require('dgram');
const { shell } = require('electron'); // For safely opening URLs in the OS browser
const fs = require('fs');
const path = require('path');

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

// Menu Elements
const hamburgerBtn = document.getElementById('hamburger-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const muteBtn = document.getElementById('mute-btn');
const themeBtns = document.querySelectorAll('.theme-btn');

const pingSound = new Audio('./ResettiPing.wav');
const rand = (min, max) => (Math.random() * (max - min) + min).toFixed(2);

// Force the blinking cursor on load
nameInput.focus();

// =========================================
// MENU TOGGLES
// =========================================
hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    dropdownMenu.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔊 Unmute Chat' : '🔇 Mute Chat';
});

themeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const theme = e.target.getAttribute('data-theme');
        if (theme === 'dark') {
            document.body.removeAttribute('data-theme');
        } else {
            document.body.setAttribute('data-theme', theme);
        }
        dropdownMenu.classList.remove('show');
    });
});

// =========================================
// DYNAMIC BACKGROUND LOADER
// =========================================
const bgPrevBtn = document.getElementById('bg-prev');
const bgNextBtn = document.getElementById('bg-next');
const bgLabel = document.getElementById('bg-label');
let bgFiles = [];
let currentBgIndex = -1; // -1 means "None"

// Scan the local folder for images
try {
    const bgsPath = path.join(__dirname, 'bgs', 'dark');
    bgFiles = fs.readdirSync(bgsPath).filter(file => file.match(/\.(jpg|jpeg|png|gif)$/i));
} catch (err) {
    console.error("No /bgs/dark folder found or accessible.", err);
}

function updateBackground() {
    if (currentBgIndex === -1) {
        bgLabel.textContent = "None";
        document.documentElement.style.setProperty('--bg-image', 'none');
        document.documentElement.style.setProperty('--bg-size', 'auto');
    } else {
        bgLabel.textContent = `Bg ${currentBgIndex + 1}`;
        // Set the CSS variables at the root level
        const bgPath = `./bgs/dark/${bgFiles[currentBgIndex]}`;
        document.documentElement.style.setProperty('--bg-image', `url('${bgPath}')`);
        document.documentElement.style.setProperty('--bg-size', 'cover');
        document.documentElement.style.setProperty('--bg-position', 'center');
    }
}

bgPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Stops the menu from instantly closing
    if (bgFiles.length === 0) return;
    
    currentBgIndex--;
    if (currentBgIndex < -1) currentBgIndex = bgFiles.length - 1; // Loop to end
    
    updateBackground();
    document.body.removeAttribute('data-theme'); // Force back to Dark Mode to see it
});

bgNextBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    if (bgFiles.length === 0) return;
    
    currentBgIndex++;
    if (currentBgIndex >= bgFiles.length) currentBgIndex = -1; // Loop to None
    
    updateBackground();
    document.body.removeAttribute('data-theme');
});

// =========================================
// URL PARSER & CHAT RENDERER
// =========================================
function createMessageContent(text) {
    if (!text) return document.createTextNode('');
    
    const frag = document.createDocumentFragment();
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const a = document.createElement('a');
        a.href = match[0];
        a.textContent = match[0];
        a.style.color = 'inherit'; 
        a.style.textDecoration = 'underline';
        a.style.fontWeight = 'bold';
        a.style.cursor = 'pointer';
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            shell.openExternal(a.href);
        });
        
        frag.appendChild(a);
        lastIndex = urlRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    return frag;
}

function addMessageToScreen(name, text, isSystem = false, isMe = false, imageSrc = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';

    if (isSystem) {
        const sysDiv = document.createElement('div');
        sysDiv.className = 'message system';
        sysDiv.textContent = text;
        wrapper.appendChild(sysDiv);
    } else {
        const nameDiv = document.createElement('div');
        nameDiv.className = 'sender-name';
        nameDiv.textContent = name; 

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = isMe ? 'message my-message' : 'message other-message';

        if (imageSrc) {
            const img = document.createElement('img');
            img.src = imageSrc;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '6px';
            img.style.display = 'block';
            bubbleDiv.appendChild(img);
        } else {
            bubbleDiv.appendChild(createMessageContent(text));
        }

        bubbleDiv.style.setProperty('--bg-x', `${rand(-3, 4)}px`);
        bubbleDiv.style.setProperty('--bg-y', `${rand(-3, 4)}px`);
        bubbleDiv.style.setProperty('--bg-rot', `${rand(-1.5, 1.5)}deg`);
        bubbleDiv.style.setProperty('--bg-skew', `${rand(-2, 2)}deg`);

        bubbleDiv.style.setProperty('--out-x', `${rand(-2, 3)}px`);
        bubbleDiv.style.setProperty('--out-y', `${rand(-2, 3)}px`);
        bubbleDiv.style.setProperty('--out-rot', `${rand(-1.5, 1.5)}deg`);
        bubbleDiv.style.setProperty('--out-skew', `${rand(-2, 2)}deg`);

        wrapper.appendChild(nameDiv);
        wrapper.appendChild(bubbleDiv);
    }

    chatHistory.appendChild(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// =========================================
// IMAGE PASTE INTERCEPTOR
// =========================================
messageInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    
    for (let item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault(); 
            
            const blob = item.getAsFile();
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const MAX_SIZE = 250;
                    let width = img.width;
                    let height = img.height;

                    if (width > height && width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    } else if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    const base64 = canvas.toDataURL('image/jpeg', 0.5); 

                    if (base64.length > 60000) {
                        addMessageToScreen('', '[System] Image too complex. UDP rejected it.', true);
                        return;
                    }

                    addMessageToScreen('You', '', false, true, base64);

                    const message = Buffer.from(JSON.stringify({
                        type: 'IMAGE',
                        name: myName,
                        data: base64
                    }));

                    for (const ip of peers) {
                        socket.send(message, 0, message.length, PORT, ip);
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(blob);
        }
    }
});

// =========================================
// LOGIN & NETWORK
// =========================================

// THE BRUTALIST TYPOGRAPHY SCALER
nameInput.addEventListener('input', () => {
    const len = nameInput.value.length || 4;
    nameInput.style.setProperty('--char-count', len);
});

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
                if (!isMuted) pingSound.play().catch(() => {});
                addMessageToScreen(data.name, data.text, false, false);
            }
            else if (data.type === 'IMAGE' && data.name !== myName) {
                if (!isMuted) pingSound.play().catch(() => {});
                addMessageToScreen(data.name, '', false, false, data.data);
            }
            else if (data.type === 'DISCONNECT' && data.name !== myName) {
                if (peers.has(rinfo.address)) {
                    peers.delete(rinfo.address);
                    addMessageToScreen('', `[System] ${data.name} has left the chat.`, true);
                }
            }
        } catch (e) { }
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