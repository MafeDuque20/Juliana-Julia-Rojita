/* ============================================================
   script.js — Julia Game
   Controla tanto index.html como juego.html
   ============================================================ */

'use strict';

/* ============================================================
   CONFIGURACIÓN — Modifica estos valores fácilmente
   ============================================================ */
const CONFIG = {
  /* Nombre del archivo de audio (debe estar en la misma carpeta) */
  audioFile: 'cancion.mp3',

  /* Mensaje que aparece tras iniciar el audio */
  poem: 'Julia una vez te dediqué un poema... pero ni modo hoy no estamos sentimentales.',

  /* Etiqueta de las tarjetas del menú */
  cardLabel: 'Cosa',

  /* Preguntas del quiz
     Propiedades:
       correct  : array de índices de opciones correctas (se ponen verdes)
       trap     : índice de opción "trampa" — no se puede seleccionar,
                  muestra un botón gigante con el texto de trapReveal
       trapReveal: texto que aparece en el botón gigante al pulsar la trampa
  */
  questions: [
    {
      text: '¿Cuál es el lugar más caliente del mundo?',
      options: [
        'Valle de la Muerte',
        'Medellín (el horno)',
        'El Sahara',
        'Yo cuando la veo...'
      ],
      correct: [1, 3]   // Medellín y Yo cuando la veo
    },
    {
      text: 'La mujer más sapa de este mundo es:',
      options: [
        'Juliana',
        'Juliana',
        'Mafe',          // índice 2 → trampa
        'Juliana'
      ],
      correct: [0, 1, 3],
      trap: 2,
      trapReveal: 'Juliana Arango Londoño'
    },
    {
      text: 'Razones por las cuales no le cuelga a su jefa:',
      options: [
        'Cuélgale',
        'Cuélgale',
        'Cuélgale',
        'Cuélgale'
      ],
      correct: [0, 1, 2, 3]
    }
  ],

  /* Palabra del ahorcado */
  hangmanWord: 'OCTANOTRAHPT',

  /* Mensaje de victoria personalizado del ahorcado */
  hangmanWinMsg: 'Amor ya escogió sus audífonos? 🎧',

  /* Máximo de errores en el ahorcado */
  maxErrors: 6
};

/* ============================================================
   DETECCIÓN DE PÁGINA
   ============================================================ */
const isIndex  = !!document.getElementById('levelsGrid');
const isGame   = !!document.getElementById('screen-start');
const isNivel2 = !!document.getElementById('n2-overlay');

if (isIndex)  initMenu();
if (isGame)   initGame();
/* initNivel2() es invocado desde el módulo Firebase en nivel2.html */

/* ============================================================
   INDEX — Menú principal
   ============================================================ */
function initMenu() {
  const grid        = document.getElementById('levelsGrid');
  const totalLevels = 10;

  for (let i = 1; i <= totalLevels; i++) {
    const card = document.createElement('div');
    card.classList.add('level-card');

    /* Niveles activos: 1 y 2 */
    const levelLinks = { 1: 'juego.html', 2: 'nivel2.html' };

    if (levelLinks[i]) {
      card.classList.add('active');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${CONFIG.cardLabel}${i} — disponible`);
      card.addEventListener('click', () => { window.location.href = levelLinks[i]; });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') window.location.href = levelLinks[i];
      });
    } else {
      card.classList.add('locked');
      card.setAttribute('aria-label', `${CONFIG.cardLabel}${i} — bloqueado`);
      card.setAttribute('aria-disabled', 'true');
    }

    card.innerHTML = `
      <span class="level-icon">${i === 1 ? '🔓' : '🔒'}</span>
      <span class="level-number">${String(i).padStart(2, '0')}</span>
      <span class="level-label">${CONFIG.cardLabel}${i}</span>
    `;

    card.style.opacity = '0';
    card.style.animationDelay = `${(i - 1) * 0.04}s`;
    card.classList.add('fade-in');
    setTimeout(() => { card.style.opacity = ''; }, 50);

    grid.appendChild(card);
  }
}

/* ============================================================
   JUEGO — juego.html
   ============================================================ */
function initGame() {

  /* DOM */
  const screens        = document.querySelectorAll('.game-screen');
  const btnStart       = document.getElementById('btnStart');
  const msgPoem        = document.getElementById('msgPoem');
  const btnContinueMsg = document.getElementById('btnContinueMsg');
  const questionCounter= document.getElementById('questionCounter');
  const questionText   = document.getElementById('questionText');
  const optionsList    = document.getElementById('optionsList');
  const btnNext        = document.getElementById('btnNextQuestion');
  const progressBar    = document.getElementById('progressBar');
  const wordDisplay    = document.getElementById('wordDisplay');
  const keyboard       = document.getElementById('keyboard');
  const errorsCount    = document.getElementById('errorsCount');
  const maxErrorsEl    = document.getElementById('maxErrors');
  const endMessage     = document.getElementById('endMessage');
  const btnRestart     = document.getElementById('btnRestart');

  /* Partes del cuerpo del ahorcado */
  const bodyParts = [
    document.getElementById('hm-head'),
    document.getElementById('hm-body'),
    document.getElementById('hm-arm-l'),
    document.getElementById('hm-arm-r'),
    document.getElementById('hm-leg-l'),
    document.getElementById('hm-leg-r'),
  ];

  let audio           = null;
  let currentQuestion = 0;
  let answered        = false;
  let errors          = 0;
  let guessed         = new Set();
  let gameOver        = false;

  /* --- Cambiar pantalla --- */
  function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    const t = document.getElementById(id);
    if (t) t.classList.add('active');
  }

  /* ====================================================
     PANTALLA 1 — Botón inicio
     ==================================================== */
  btnStart.addEventListener('click', () => {
    audio = new Audio(CONFIG.audioFile);
    audio.loop   = false;
    audio.volume = 0.85;
    audio.play().catch(() => console.warn('Autoplay bloqueado por el navegador.'));

    showScreen('screen-message');
    typeMessage(CONFIG.poem, msgPoem);
  });

  /* ====================================================
     PANTALLA 2 — Mensaje con efecto de escritura
     ==================================================== */
  function typeMessage(text, el) {
    el.textContent = '';
    let i = 0;
    const iv = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) clearInterval(iv);
    }, 38);
  }

  btnContinueMsg.addEventListener('click', () => {
    showScreen('screen-questions');
    loadQuestion(0);
  });

  /* ====================================================
     PANTALLA 3 — Quiz
     ==================================================== */
  function loadQuestion(index) {
    answered = false;
    btnNext.style.display = 'none';

    /* Limpiar botón trampa previo */
    removeTrapBtn();

    const q     = CONFIG.questions[index];
    const total = CONFIG.questions.length;

    questionCounter.textContent = `Pregunta ${index + 1} de ${total}`;
    progressBar.style.width     = `${(index / total) * 100}%`;
    questionText.textContent    = q.text;

    optionsList.innerHTML = '';
    q.options.forEach((opt, i) => {
      const li  = document.createElement('li');
      const btn = document.createElement('button');
      btn.classList.add('option-btn');
      btn.textContent = opt;

      if (q.trap !== undefined && i === q.trap) {
        /* Opción trampa */
        btn.addEventListener('click', () => {
          btn.classList.add('wrong');
          btn.disabled = true;
          showTrapBtn(q.trapReveal);
        });
      } else {
        btn.addEventListener('click', () => selectOption(i, q));
      }

      li.appendChild(btn);
      optionsList.appendChild(li);
    });
  }

  /* Muestra el botón gigante de la trampa */
  function showTrapBtn(text) {
    if (document.getElementById('trapRevealBtn')) return;
    const big = document.createElement('button');
    big.id        = 'trapRevealBtn';
    big.className = 'btn-trap-reveal';
    big.textContent = text;
    /* Insertar entre las opciones y el botón siguiente */
    btnNext.parentNode.insertBefore(big, btnNext);
  }

  function removeTrapBtn() {
    const el = document.getElementById('trapRevealBtn');
    if (el) el.remove();
  }

  /* Selección de opción normal */
  function selectOption(clickedIndex, q) {
    if (answered) return;
    answered = true;

    const correctSet = new Set(q.correct);
    const btns = optionsList.querySelectorAll('.option-btn');

    btns.forEach((btn, i) => {
      /* No tocar botón trampa */
      if (q.trap !== undefined && i === q.trap) return;
      btn.disabled = true;
      if (correctSet.has(i)) {
        btn.classList.add('correct');
      } else if (i === clickedIndex) {
        btn.classList.add('wrong');
      }
    });

    setTimeout(() => { btnNext.style.display = 'inline-flex'; }, 650);
  }

  btnNext.addEventListener('click', () => {
    removeTrapBtn();
    currentQuestion++;
    if (currentQuestion < CONFIG.questions.length) {
      loadQuestion(currentQuestion);
    } else {
      progressBar.style.width = '100%';
      setTimeout(() => {
        showScreen('screen-hangman');
        initHangman();
      }, 400);
    }
  });

  /* ====================================================
     PANTALLA 4 — Ahorcado
     ==================================================== */
  function initHangman() {
    errors   = 0;
    guessed  = new Set();
    gameOver = false;

    maxErrorsEl.textContent  = CONFIG.maxErrors;
    errorsCount.textContent  = '0';
    endMessage.style.display = 'none';
    btnRestart.style.display = 'none';

    bodyParts.forEach(p => p.classList.remove('visible'));

    wordDisplay.innerHTML = '';
    CONFIG.hangmanWord.split('').forEach(letter => {
      const span = document.createElement('span');
      span.classList.add('letter-slot');
      span.textContent    = '';
      span.dataset.letter = letter;
      wordDisplay.appendChild(span);
    });

    buildKeyboard();
  }

  function buildKeyboard() {
    keyboard.innerHTML = '';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      const btn = document.createElement('button');
      btn.classList.add('key-btn');
      btn.textContent = letter;
      btn.addEventListener('click', () => handleGuess(letter, btn));
      keyboard.appendChild(btn);
    });
  }

  function handleGuess(letter, btn) {
    if (gameOver || guessed.has(letter)) return;
    guessed.add(letter);
    btn.disabled = true;

    if (CONFIG.hangmanWord.includes(letter)) {
      btn.classList.add('hit');
      wordDisplay.querySelectorAll('.letter-slot').forEach(s => {
        if (s.dataset.letter === letter) s.textContent = letter;
      });
      checkWin();
    } else {
      btn.classList.add('miss');
      errors++;
      errorsCount.textContent = errors;
      if (bodyParts[errors - 1]) bodyParts[errors - 1].classList.add('visible');
      if (errors >= CONFIG.maxErrors) endGame(false);
    }
  }

  function checkWin() {
    const all = [...wordDisplay.querySelectorAll('.letter-slot')].every(s => s.textContent !== '');
    if (all) endGame(true);
  }

  function endGame(win) {
    gameOver = true;
    keyboard.querySelectorAll('.key-btn').forEach(b => b.disabled = true);

    if (!win) {
      wordDisplay.querySelectorAll('.letter-slot').forEach(s => {
        s.textContent = s.dataset.letter;
        s.style.color = '#c08080';
      });
    }

    endMessage.style.display = 'block';
    endMessage.className     = `end-message ${win ? 'win' : 'lose'}`;
    endMessage.textContent   = win
      ? CONFIG.hangmanWinMsg
      : `Game over — La palabra era "${CONFIG.hangmanWord}"`;

    btnRestart.style.display = 'inline-flex';
  }

  btnRestart.addEventListener('click', initHangman);

} /* fin initGame */

/* ============================================================
   NIVEL 2 — Sistema de mensajería en tiempo real
   Requiere: Firebase Firestore + OneSignal (configurados en nivel2.html)
   ============================================================ */
function initNivel2() {

  /* ── Esperar a que el módulo Firebase haya montado __N2 ── */
  if (!window.__N2) {
    console.warn('Firebase aún no está listo, reintentando...');
    setTimeout(initNivel2, 200);
    return;
  }

  const {
    db, collection, addDoc, onSnapshot,
    query, orderBy, serverTimestamp,
    doc, setDoc, getDoc,
    ONESIGNAL_APP_ID, ONESIGNAL_API_KEY
  } = window.__N2;

  /* ── DOM ── */
  const overlay       = document.getElementById('n2-overlay');
  const mainPanel     = document.getElementById('n2-main');
  const btnSoyYo      = document.getElementById('btnSoyYo');
  const btnSoyJulia   = document.getElementById('btnSoyJulia');
  const userLabel     = document.getElementById('n2-user-label');
  const otherLabel    = document.getElementById('n2-other-label');
  const destName      = document.getElementById('n2-dest-name');
  const dot           = document.getElementById('n2-dot');
  const dotOther      = document.getElementById('n2-dot-other');
  const lastSeen      = document.getElementById('n2-last-seen');
  const quickBtns     = document.querySelectorAll('.n2-quick-btn');
  const customInput   = document.getElementById('n2-custom-input');
  const sendBtn       = document.getElementById('n2-send-btn');
  const chatBox       = document.getElementById('n2-chat-box');
  const chatEmpty     = document.getElementById('n2-chat-empty');
  const toast         = document.getElementById('n2-toast');

  /* ── Estado ── */
  let currentUser = localStorage.getItem('n2_usuario') || null;
  let unsubChat   = null;   // para cancelar onSnapshot

  /* ── Nombres visibles ── */
  const NAMES = { maria: 'Yo 🙋', julia: 'Julia 💚' };

  /* ============================================================
     PASO 1 — Identificación
     ============================================================ */
  function setupIdentity() {
    if (currentUser) {
      enterMain(currentUser);
      return;
    }
    overlay.style.display = 'flex';
    mainPanel.style.display = 'none';
  }

  btnSoyYo.addEventListener('click', () => chooseUser('maria'));
  btnSoyJulia.addEventListener('click', () => chooseUser('julia'));

  function chooseUser(user) {
    localStorage.setItem('n2_usuario', user);
    currentUser = user;
    enterMain(user);
  }

  /* ============================================================
     PASO 2 — Pantalla principal
     ============================================================ */
  function enterMain(user) {
    overlay.style.display = 'none';
    mainPanel.style.display = 'flex';

    const other = user === 'maria' ? 'julia' : 'maria';

    /* Etiquetas */
    userLabel.textContent  = NAMES[user];
    otherLabel.textContent = NAMES[other];
    destName.textContent   = NAMES[other];

    /* Activar punto verde propio */
    dot.classList.add('n2-dot-active');

    /* Registrar presencia en Firestore */
    updatePresence(user);
    watchPresence(other);

    /* Inicializar OneSignal */
    setupOneSignal(user);

    /* Escuchar historial */
    startChatListener();
  }

  /* ============================================================
     PRESENCIA — "última vez activo"
     ============================================================ */
  async function updatePresence(user) {
    try {
      await setDoc(doc(db, 'presencia', user), {
        online: true,
        ultima: serverTimestamp()
      });
      /* Marcar offline al cerrar/salir */
      window.addEventListener('beforeunload', () => {
        setDoc(doc(db, 'presencia', user), { online: false, ultima: serverTimestamp() });
      });
    } catch (e) { console.warn('Presencia no disponible:', e); }
  }

  function watchPresence(other) {
    try {
      onSnapshot(doc(db, 'presencia', other), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.online) {
          dotOther.classList.add('n2-dot-active');
          lastSeen.textContent = '● en línea';
        } else {
          dotOther.classList.remove('n2-dot-active');
          const ts = data.ultima?.toDate?.();
          if (ts) {
            lastSeen.textContent = `· visto ${timeAgo(ts)}`;
          }
        }
      });
    } catch (e) { console.warn('watchPresence error:', e); }
  }

  function timeAgo(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)  return 'hace unos segundos';
    if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    return `hace ${Math.floor(diff/86400)} d`;
  }

  /* ============================================================
     ONESIGNAL — Permisos y tags
     ============================================================ */
  function setupOneSignal(user) {
    if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'TU_ONESIGNAL_APP_ID') {
      console.warn('OneSignal no configurado — notificaciones push desactivadas.');
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        notifyButton: { enable: false }
      });

      /* Pedir permiso de notificaciones */
      await OneSignal.Notifications.requestPermission();

      /* Etiquetar al usuario para poder filtrarlo en el envío */
      await OneSignal.User.addTag('usuario', user);
    });
  }

  /* ============================================================
     ENVÍO DE MENSAJES
     ============================================================ */
  /* Botones rápidos */
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sendMessage(btn.dataset.msg);
    });
  });

  /* Enviar con botón */
  sendBtn.addEventListener('click', () => {
    const text = customInput.value.trim();
    if (!text) return;
    sendMessage(text);
    customInput.value = '';
  });

  /* Enviar con Enter */
  customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendBtn.click();
  });

  async function sendMessage(text) {
    if (!currentUser || !text) return;

    const other = currentUser === 'maria' ? 'julia' : 'maria';

    /* Animación de envío */
    sendBtn.classList.add('n2-sending');
    setTimeout(() => sendBtn.classList.remove('n2-sending'), 600);

    try {
      /* 1. Guardar en Firestore */
      await addDoc(collection(db, 'mensajes'), {
        de:      currentUser,
        para:    other,
        mensaje: text,
        fecha:   serverTimestamp()
      });

      /* 2. Enviar push via OneSignal REST API */
      await sendPushNotification(other, text);

    } catch (err) {
      console.error('Error al enviar:', err);
      showToast('Error al enviar. Revisa la consola.');
    }
  }

  async function sendPushNotification(destUser, text) {
    if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'TU_ONESIGNAL_APP_ID') return;

    const senderName = NAMES[currentUser] || currentUser;
    const body = { en: `${senderName}: ${text}` };

    try {
      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${ONESIGNAL_API_KEY}`
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          filters: [
            { field: 'tag', key: 'usuario', relation: '=', value: destUser }
          ],
          headings: { en: 'Julia 💚' },
          contents: body,
          url: window.location.href
        })
      });
    } catch (err) {
      console.warn('Push no enviado:', err);
    }
  }

  /* ============================================================
     HISTORIAL EN TIEMPO REAL — Firestore onSnapshot
     ============================================================ */
  function startChatListener() {
    if (unsubChat) unsubChat(); /* Cancelar listener previo si existe */

    try {
      const q = query(
        collection(db, 'mensajes'),
        orderBy('fecha', 'asc')
      );

      unsubChat = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            renderMessage(change.doc.data());
          }
        });
        chatBox.scrollTop = chatBox.scrollHeight;
      });
    } catch (e) {
      console.warn('Chat listener error:', e);
    }
  }

  function renderMessage(data) {
    /* Ocultar texto "Aún no hay mensajes" */
    if (chatEmpty) chatEmpty.style.display = 'none';

    const isMine = data.de === currentUser;

    const bubble = document.createElement('div');
    bubble.classList.add('n2-bubble');
    bubble.classList.add(isMine ? 'n2-bubble-mine' : 'n2-bubble-theirs');

    const ts = data.fecha?.toDate?.();
    const timeStr = ts
      ? ts.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : '';

    bubble.innerHTML = `
      <span class="n2-bubble-sender">${NAMES[data.de] || data.de}</span>
      <span class="n2-bubble-text">${escapeHtml(data.mensaje)}</span>
      <span class="n2-bubble-time">${timeStr}</span>
    `;

    chatBox.appendChild(bubble);

    /* Toast si el mensaje es del otro */
    if (!isMine) showToast(`${NAMES[data.de]}: ${data.mensaje}`);
  }

  /* ============================================================
     UTILIDADES
     ============================================================ */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('n2-toast-show');
    setTimeout(() => toast.classList.remove('n2-toast-show'), 3500);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ── Arrancar ── */
  setupIdentity();

} /* fin initNivel2 */
