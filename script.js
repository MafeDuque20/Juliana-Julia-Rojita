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
  poem: 'Julia una vez te dediqué un poema... pero ni modo hoy no estamos sentimentales, escuche el mero remix.',

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
  hangmanWinMsg: 'Epa la Arepa...Amor ya escogió sus audífonos?',

  /* Máximo de errores en el ahorcado */
  maxErrors: 6
};

/* ============================================================
   DETECCIÓN DE PÁGINA
   ============================================================ */
const isIndex = !!document.getElementById('levelsGrid');
const isGame  = !!document.getElementById('screen-start');

if (isIndex) initMenu();
if (isGame)  initGame();

/* ============================================================
   INDEX — Menú principal
   ============================================================ */
function initMenu() {
  const grid        = document.getElementById('levelsGrid');
  const totalLevels = 10;

  for (let i = 1; i <= totalLevels; i++) {
    const card = document.createElement('div');
    card.classList.add('level-card');

    if (i === 1) {
      card.classList.add('active');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${CONFIG.cardLabel}${i} — disponible`);
      card.addEventListener('click', () => { window.location.href = 'juego.html'; });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') window.location.href = 'juego.html';
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
      : `Muy paila hermana, era "${CONFIG.hangmanWord}"`;

    btnRestart.style.display = 'inline-flex';
  }

  btnRestart.addEventListener('click', initHangman);

} /* fin initGame */
