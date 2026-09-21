// 1. Dynamic EmailJS SDK Loader
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
document.head.appendChild(script);

// 2. HTML5 Canvas Matrix Rain Animation
const canvas = document.getElementById('cyberCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*';
const fontSize = 14;
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);

function drawMatrix() {
    ctx.fillStyle = 'rgba(3, 7, 18, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#00f0ff';
    ctx.font = `${fontSize}px monospace`;

    columns = Math.floor(canvas.width / fontSize);
    if (drops.length < columns) {
        drops = Array(columns).fill(1);
    }

    for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        drops[i]++;
    }
}
setInterval(drawMatrix, 33);

// 3. Global Synthesizer Sound Engine (Web Audio API)
let audioEnabled = false;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCyberSound(freq = 600, type = 'sawtooth', duration = 0.1) {
    if (!audioEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

document.getElementById('audioToggleBtn').addEventListener('click', (e) => {
    audioEnabled = !audioEnabled;
    e.target.innerText = `SFX: [${audioEnabled ? 'ON' : 'OFF'}]`;
    if (audioEnabled) playCyberSound(800, 'triangle', 0.2);
});

// Interactive Avatar Overclock Action
document.getElementById('avatarContainer').addEventListener('click', () => {
    playCyberSound(900, 'sawtooth', 0.2);
    const badge = document.querySelector('.avatar-badge');
    badge.innerText = "OVERCLOCKED_100%";
    badge.style.background = "#00ff66";
    badge.style.color = "#000";
    setTimeout(() => {
        badge.innerText = "CYBER_NODE_v3";
        badge.style.background = "#ff007f";
        badge.style.color = "#fff";
    }, 2000);
});

// 4. Simulated Latency Metric Loop
setInterval(() => {
    const latencyEl = document.getElementById('latencyMetric');
    if (latencyEl) {
        const randomLatency = Math.floor(Math.random() * 8) + 10;
        latencyEl.innerText = `${randomLatency}ms`;
    }
}, 3000);

// 5. Dynamic Typing Effect
const roles = ["DISTRIBUTED_CLOUD_SYSTEMS", "AI_WORKFLOWS_&_LLMS", "HIGH_PERFORMANCE_APPS"];
let roleIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typingElement = document.getElementById("typing-text");

function typeEffect() {
    const currentRole = roles[roleIndex];

    if (isDeleting) {
        typingElement.textContent = currentRole.substring(0, charIndex - 1);
        charIndex--;
    } else {
        typingElement.textContent = currentRole.substring(0, charIndex + 1);
        charIndex++;
    }

    let typeSpeed = isDeleting ? 35 : 75;

    if (!isDeleting && charIndex === currentRole.length) {
        typeSpeed = 2400;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        typeSpeed = 400;
    }

    setTimeout(typeEffect, typeSpeed);
}

document.addEventListener("DOMContentLoaded", typeEffect);

// 6. Filterable Projects
const filterBtns = document.querySelectorAll(".filter-btn");
const projectCards = document.querySelectorAll(".project-card");

filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        playCyberSound(500, 'sine', 0.08);
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const filterValue = btn.getAttribute("data-filter");

        projectCards.forEach(card => {
            const categories = card.getAttribute("data-category");
            if (filterValue === "all" || categories.includes(filterValue)) {
                card.classList.remove("hide");
            } else {
                card.classList.add("hide");
            }
        });
    });
});

// 7. System Topology Data & Modal Handler
const projectData = {
    p1: {
        title: "AI Resume & Skill Matcher",
        img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        tags: ["React", "Node.js", "Gemini API", "Express"],
        desc: "Parses PDF resumes into structured JSON payloads, executes semantic comparison against job specs via Google Gemini LLM API, and calculates ATS compatibility matrices.",
        diagram: `[USER_UI] ---> (React Client)\n                   |\n             [REST API POST]\n                   v\n            (Node.js Server) ---> [Gemini LLM API]\n                   |                    |\n            (JSON Parsing) <-------------+\n                   v\n         [RENDER_RESULTS]`
    },
    p2: {
        title: "E-Commerce Micro-Engine",
        img: "https://images.unsplash.com/photo-1556742049-0a67568d0d9f?auto=format&fit=crop&w=800&q=80",
        tags: ["React", "Express.js", "REST API", "State Engine"],
        desc: "High-throughput e-commerce engine utilizing context-driven reactive state, async product catalog filtering, and transactional mock checkout flows.",
        diagram: `[CLIENT_BROWSER] ---> (React State Store)\n                           |\n                     [Async Fetch]\n                           v\n                     (Express Microservice)\n                           |\n                     (Product DB Pipeline)\n                           v\n                [JSON PAYLOAD RESPONSE]`
    },
    p3: {
        title: "Smart Workflow Planner",
        img: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80",
        tags: ["JavaScript", "Python", "Node.js", "Matrix Sorting"],
        desc: "Algorithmic task dispatcher evaluating priority index parameters (Deadline x Urgency weightings) to construct auto-prioritized schedules.",
        diagram: `[TASK_INPUT] ---> (Node.js Dispatcher)\n                          |\n                  [Python Sub-Process]\n                          |\n              (Matrix Urgency Algorithm)\n                          v\n              [PRIORITIZED QUEUE OUTPUT]`
    }
};

const modal = document.getElementById('projectModal');
const closeModalBtn = document.getElementById('closeModalBtn');

document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        playCyberSound(700, 'square', 0.1);
        const card = e.target.closest('.project-card');
        const id = card.getAttribute('data-id');
        const data = projectData[id];

        document.getElementById('modalTitle').innerText = data.title;
        document.getElementById('modalDescription').innerText = data.desc;
        document.getElementById('modalDiagram').innerText = data.diagram;
        document.getElementById('modalImage').src = data.img;

        const tagsContainer = document.getElementById('modalTags');
        tagsContainer.innerHTML = '';
        data.tags.forEach(tag => {
            tagsContainer.innerHTML += `<span class="tag">${tag}</span>`;
        });

        modal.classList.remove('hidden');
    });
});

function closeProjectModal() {
    modal.classList.add('hidden');
}
closeModalBtn.addEventListener('click', closeProjectModal);

// 8. CLI Terminal Drawer with Auto-Complete & Command History
const terminalOverlay = document.getElementById('terminalOverlay');
const terminalToggleBtn = document.getElementById('terminalToggleBtn');
const closeTerminalBtn = document.getElementById('closeTerminalBtn');
const terminalInput = document.getElementById('terminalInput');
const terminalOutput = document.getElementById('terminalOutput');

terminalToggleBtn.addEventListener('click', () => {
    playCyberSound(800, 'sawtooth', 0.1);
    terminalOverlay.classList.remove('hidden');
    terminalInput.focus();
});

closeTerminalBtn.addEventListener('click', () => terminalOverlay.classList.add('hidden'));

const commandList = ['help', 'capabilities', 'projects', 'dispatch', 'whoami', 'clear'];
let commandHistory = [];
let historyIndex = -1;

const commands = {
    help: "Commands: capabilities, projects, dispatch, whoami, clear",
    capabilities: "Frontend: React, JS, Tailwind | Backend: Node, Express, Python | AI: Gemini API",
    projects: "1. AI Resume Matcher | 2. E-Commerce Engine | 3. Smart Workflow Planner",
    dispatch: "Dispatch form active on main UI. Scroll to section or submit message.",
    whoami: "Amuluru Rishwik — Cybernetic Systems & AI Engineer."
};

terminalInput.addEventListener('keydown', (e) => {
    playCyberSound(400, 'square', 0.03);

    if (e.key === 'Tab') {
        e.preventDefault();
        const currentVal = terminalInput.value.trim().toLowerCase();
        const match = commandList.find(cmd => cmd.startsWith(currentVal));
        if (match) terminalInput.value = match;
    } else if (e.key === 'ArrowUp') {
        if (historyIndex > 0) {
            historyIndex--;
            terminalInput.value = commandHistory[historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            terminalInput.value = commandHistory[historyIndex];
        } else {
            historyIndex = commandHistory.length;
            terminalInput.value = '';
        }
    } else if (e.key === 'Enter') {
        const input = terminalInput.value.trim().toLowerCase();

        if (input) {
            commandHistory.push(input);
            historyIndex = commandHistory.length;
        }

        if (input === 'clear') {
            terminalOutput.innerHTML = '';
        } else {
            const response = commands[input] || `Command not recognized: '${input}'. Press TAB to see matches or type 'help'.`;
            terminalOutput.innerHTML += `
        <div class="term-line">
          <span class="term-prompt">rishwik$&nbsp;${input}</span><br/>
          <span>${response}</span>
        </div>
      `;
        }
        terminalInput.value = '';
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
});

// 9. Contact Form EmailJS Handler
document.getElementById('contactForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMessage');

    if (typeof window.emailjs === 'undefined') {
        alert("EmailJS SDK initializing. Please retry momentarily.");
        return;
    }

    submitBtn.innerText = "TRANSMITTING_PAYLOAD...";
    submitBtn.disabled = true;

    const templateParams = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        reply_to: document.getElementById('email').value,
        message: document.getElementById('message').value,
    };

    window.emailjs.send(
        'service_cgc66pn',
        'template_r76aoab',
        templateParams,
        'RPg-DrT5CnGJEtfQW'
    )
    .then(() => {
        playCyberSound(1000, 'sine', 0.2);
        statusMsg.style.color = "#00ff66";
        statusMsg.innerText = "Dispatch transmitted successfully to Rishwik!";
        document.getElementById('contactForm').reset();
    })
    .catch((error) => {
        playCyberSound(200, 'sawtooth', 0.3);
        statusMsg.style.color = "#ff007f";
        statusMsg.innerText = "Transmission failed. Retry dispatch.";
        console.error("EmailJS Error:", error);
    })
    .finally(() => {
        submitBtn.innerText = "TRANSMIT_PAYLOAD";
        submitBtn.disabled = false;
    });
});