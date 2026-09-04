const dgram = require('dgram');
const readline = require('readline');

const socket = dgram.createSocket('udp4');
const PORT = 41234;
const BROADCAST_ADDR = '10.0.0.255'; 

const peers = new Set();
let myName = ''; 

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.setPrompt('> ');

rl.question('Enter your name: ', (answer) => {
    myName = answer.trim() || `User_${Math.floor(Math.random() * 1000)}`;
    startNetwork();
});

function startNetwork() {
    // 1. THE LISTENER
    socket.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg);
            
            if (data.type === 'DISCOVERY' && data.name !== myName) {
                if (!peers.has(rinfo.address)) {
                    peers.add(rinfo.address);
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    console.log(`[System] ${data.name} joined the network!`);
                    rl.prompt(true);
                }
            } 
            else if (data.type === 'CHAT' && data.name !== myName) {
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                console.log(`${data.name}: ${data.text}`);
                rl.prompt(true); 
            }
            // NEW: Catch the goodbye message and wipe them from the radar
            else if (data.type === 'DISCONNECT' && data.name !== myName) {
                if (peers.has(rinfo.address)) {
                    peers.delete(rinfo.address); 
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    console.log(`[System] ${data.name} has left the chat.`);
                    rl.prompt(true);
                }
            }
        } catch (e) {
            // Ignore garbage data
        }
    });

    // 2. THE YELLER
    socket.bind(PORT, () => {
        socket.setBroadcast(true);
        
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        console.log(`[System] Welcome, ${myName}. Start typing to chat...`);
        console.log(`[System] (Press Ctrl+C to exit gracefully and notify others)`);
        rl.prompt(true); 

        setInterval(() => {
            const message = Buffer.from(JSON.stringify({ type: 'DISCOVERY', name: myName }));
            socket.send(message, 0, message.length, PORT, BROADCAST_ADDR);
        }, 3000);
    });

    // 3. THE TYPER
    rl.on('line', (input) => {
        process.stdout.write('\x1B[1A\x1B[K'); 
        console.log(`You: ${input}`);

        const message = Buffer.from(JSON.stringify({ 
            type: 'CHAT', 
            name: myName,
            text: input 
        }));

        for (const ip of peers) {
            socket.send(message, 0, message.length, PORT, ip);
        }
        
        rl.prompt(true); 
    });

    // 4. THE GRACEFUL EXIT (NEW)
    process.on('SIGINT', () => {
        const message = Buffer.from(JSON.stringify({ type: 'DISCONNECT', name: myName }));
        
        // Fire off a final goodbye to everyone we know
        for (const ip of peers) {
            socket.send(message, 0, message.length, PORT, ip);
        }

        // Give the network a tiny fraction of a second to actually send the UDP packets before killing the app
        setTimeout(() => {
            process.exit(0);
        }, 100);
    });
}