import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDyuTqtGoZuWHU6fPAUFdMn2bhhArL9DDg",
    authDomain: "supernova-a2ae5.firebaseapp.com",
    projectId: "supernova-a2ae5",
    storageBucket: "supernova-a2ae5.firebasestorage.app",
    messagingSenderId: "390242388997",
    appId: "1:390242388997:web:3911198f11b47ab104a06c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const notasCol = collection(db, "notas");

// --- BANCO DE MAPAS ---
const MAPAS = {
    'mundo': 'Teste1.png',
    'caverna': 'Teste2.png', // Certifique-se de ter esses arquivos
    'cidade': 'Teste3.png'
};

let mapaAtual = 'mundo';
const mapImg = new Image();
mapImg.src = MAPAS[mapaAtual];

const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
let zoom = 1.0;
let offsetX = 0;
let offsetY = 0;
let notas = [];
let notaAtivaId = null;
let iconeAtual = 'map-pin';
let unsubscribe = null; // Para limpar o listener ao trocar de mapa

// --- FUNÇÃO PARA TROCAR MAPA ---
window.mudarMapa = (id) => {
    if(!MAPAS[id]) return;
    mapaAtual = id;
    mapImg.src = MAPAS[id];
    
    // Resetar visualização
    zoom = 1.0;
    offsetX = 0;
    offsetY = 0;
    
    // Reiniciar Sincronização com Filtro
    conectarFirebase();
};

function conectarFirebase() {
    // Se já houver uma conexão aberta, fecha ela antes de abrir a nova do outro mapa
    if (unsubscribe) unsubscribe();

    // FILTRO: Só pega notas onde o campo "mapaId" é igual ao mapaAtual
    const q = query(notasCol, where("mapaId", "==", mapaAtual));

    unsubscribe = onSnapshot(q, (snapshot) => {
        notas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.updateSidebarUI();
        render();
    });
}

// Iniciar conexão pela primeira vez
conectarFirebase();

// --- DESENHO E CONTROLES ---
const iconList = ['map-pin', 'castle', 'skull', 'swords', 'tent', 'anchor', 'flame', 'book', 'shield', 'gem'];
const VectorIcons = {
    'map-pin': (c, s) => { c.beginPath(); c.arc(0, -s*0.2, s*0.6, 0, Math.PI*2); c.moveTo(0, s); c.lineTo(-s*0.5, 0); c.lineTo(s*0.5, 0); c.fill(); },
    'castle': (c, s) => { c.fillRect(-s*0.8, -s*0.8, s*1.6, s*1.6); c.clearRect(-s*0.2, -s*0.8, s*0.4, s*0.4); },
    'skull': (c, s) => { c.beginPath(); c.arc(0, -s*0.2, s*0.7, 0, Math.PI, true); c.rect(-s*0.4, 0, s*0.8, s*0.6); c.fill(); },
    'swords': (c, s) => { c.rotate(Math.PI/4); c.fillRect(-s, -1.5, s*2, 3); c.rotate(-Math.PI/2); c.fillRect(-s, -1.5, s*2, 3); },
    'tent': (c, s) => { c.beginPath(); c.moveTo(0, -s); c.lineTo(s, s); c.lineTo(-s, s); c.fill(); },
    'anchor': (c, s) => { c.lineWidth=2; c.beginPath(); c.arc(0,0,s*0.8,0,Math.PI); c.moveTo(0,-s); c.lineTo(0,s); c.stroke(); },
    'flame': (c, s) => { c.beginPath(); c.moveTo(0, s); c.quadraticCurveTo(s,0,0,-s); c.quadraticCurveTo(-s,0,0,s); c.fill(); },
    'book': (c, s) => { c.fillRect(-s*0.8, -s*0.6, s*1.6, s*1.2); c.strokeStyle="#000"; c.beginPath(); c.moveTo(0,-s*0.6); c.lineTo(0,s*0.6); c.stroke(); },
    'shield': (c, s) => { c.beginPath(); c.moveTo(-s, -s); c.lineTo(s, -s); c.quadraticCurveTo(s, s, 0, s*1.2); c.quadraticCurveTo(-s, s, -s, -s); c.fill(); },
    'gem': (c, s) => { c.beginPath(); c.moveTo(0,-s); c.lineTo(s,0); c.lineTo(0,s); c.lineTo(-s,0); c.fill(); }
};

canvas.oncontextmenu = (e) => e.preventDefault();
canvas.addEventListener('mousedown', (e) => {
    const wx = (e.clientX - offsetX) / zoom;
    const wy = (e.clientY - offsetY) / zoom;

    if (e.button === 0) { // ESQUERDO: MOVER
        let lx = e.clientX, ly = e.clientY;
        const move = (m) => {
            offsetX += m.clientX - lx; offsetY += m.clientY - ly;
            lx = m.clientX; ly = m.clientY; render();
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    } 
    else if (e.button === 2) { // DIREITO: AÇÕES
        const hit = notas.find(n => Math.hypot(n.x - wx, n.y - wy) < 25/zoom);
        if (hit) {
            window.abrirNota(hit.id);
        } else {
            const nova = { 
                x: wx, y: wy, nome: 'Nova Nota', texto: '', 
                cor: '#3b82f6', icone: iconeAtual, cat: 'Cidade',
                mapaId: mapaAtual // SALVA A QUAL MAPA ESSA NOTA PERTENCE
            };
            addDoc(notasCol, nova).then(docRef => window.abrirNota(docRef.id, true));
        }
    }
});

// Funções de Interface (Globais)
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('hidden');
window.fecharNota = () => document.getElementById('modal-nota').classList.add('hidden');
window.entrarModoEdicao = () => {
    document.getElementById('view-mode').classList.add('hidden');
    document.getElementById('edit-mode').classList.remove('hidden');
};
window.entrarModoLeitura = () => {
    document.getElementById('view-mode').classList.remove('hidden');
    document.getElementById('edit-mode').classList.add('hidden');
};

window.abrirNota = (id, editar = false) => {
    notaAtivaId = id;
    const n = notas.find(nota => nota.id === id);
    if(!n) return;
    document.getElementById('view-title').innerText = n.nome;
    document.getElementById('view-desc').innerText = n.texto || "...";
    document.getElementById('view-category').innerText = n.cat;
    document.getElementById('view-icon-bg').style.backgroundColor = n.cor;
    document.getElementById('view-icon').setAttribute('data-lucide', n.icone);
    document.getElementById('nota-nome').value = n.nome;
    document.getElementById('nota-texto').value = n.texto;
    document.getElementById('nota-cor').value = n.cor;
    document.getElementById('nota-cat').value = n.cat;
    iconeAtual = n.icone;
    window.renderIconSelector();
    editar ? window.entrarModoEdicao() : window.entrarModoLeitura();
    document.getElementById('modal-nota').classList.remove('hidden');
    lucide.createIcons();
};

window.salvarNota = async () => {
    const nRef = doc(db, "notas", notaAtivaId);
    await updateDoc(nRef, {
        nome: document.getElementById('nota-nome').value,
        texto: document.getElementById('nota-texto').value,
        cor: document.getElementById('nota-cor').value,
        cat: document.getElementById('nota-cat').value,
        icone: iconeAtual
    });
    window.fecharNota();
};

window.deletarNota = async () => {
    if(confirm("Excluir?")) {
        await deleteDoc(doc(db, "notas", notaAtivaId));
        window.fecharNota();
    }
};

window.renderIconSelector = () => {
    const cont = document.getElementById('icon-selector');
    cont.innerHTML = '';
    iconList.forEach(i => {
        const d = document.createElement('div');
        d.className = `icon-item ${iconeAtual === i ? 'selected' : ''}`;
        d.innerHTML = `<i data-lucide="${i}" style="width:16px"></i>`;
        d.onclick = () => { iconeAtual = i; window.renderIconSelector(); lucide.createIcons(); };
        cont.appendChild(d);
    });
    lucide.createIcons();
};

window.updateSidebarUI = () => {
    const list = document.getElementById('lista-notas');
    const search = document.getElementById('search-notes').value.toLowerCase();
    list.innerHTML = '';
    notas.filter(n => n.nome.toLowerCase().includes(search)).forEach(n => {
        const item = document.createElement('div');
        item.className = 'side-item-custom';
        item.innerHTML = `<div style="width:8px; height:8px; border-radius:50%; background:${n.cor}"></div><div class="side-item-text"><strong>${n.nome}</strong><small>${n.cat}</small></div>`;
        item.onclick = () => {
            zoom = 1.5;
            offsetX = (canvas.width/2) - (n.x * zoom);
            offsetY = (canvas.height/2) - (n.y * zoom);
            window.abrirNota(n.id);
            render();
        };
        list.appendChild(item);
    });
    lucide.createIcons();
};

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);
    if (mapImg.complete) ctx.drawImage(mapImg, 0, 0);
    notas.forEach(n => {
        ctx.save(); ctx.translate(n.x, n.y);
        ctx.beginPath(); ctx.arc(0, 0, 20/zoom, 0, Math.PI*2);
        ctx.fillStyle = n.cor; ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 2/zoom; ctx.stroke();
        ctx.fillStyle = "white"; ctx.strokeStyle = "white";
        if (VectorIcons[n.icone]) VectorIcons[n.icone](ctx, 10/zoom);
        ctx.restore();
    });
    ctx.restore();
    document.getElementById('zoom-display').innerText = Math.round(zoom * 100) + '%';
}

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const wx = (e.clientX - offsetX) / zoom;
    const wy = (e.clientY - offsetY) / zoom;
    zoom = Math.min(Math.max(0.1, zoom * factor), 8);
    offsetX = e.clientX - wx * zoom;
    offsetY = e.clientY - wy * zoom;
    render();
}, {passive:false});

mapImg.onload = render;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
});
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;