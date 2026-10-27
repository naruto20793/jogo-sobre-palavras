document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'pista.game.v1';
  const ANSWERS = { easy: ['AMIGO','FLORA','PLANO','PORTA'], medium: ['PALHA','MONTE','RADIO','VIDRO','CAMPO','TEMPO'], hard: ['LUCRO','CINZA','FURIA','VOGAL','TROCO'] };
  const VALID_WORDS = new Set(['AMIGO','FLORA','PLANO','PALHA','MONTE','RADIO','VIDRO','CAMPO','TEMPO','LUCRO','CINZA','FURIA','VOGAL','TROCO','PLANTA','LIVRO','EPOCA','FAVOR','PORTA','MESA','BOLSA','VERDE','POEMA','NUVEM','CANTO','RISO','TRIGO']);
  const LIMITS = { easy: 8, medium: 6, hard: 5 };
  const LETTERS = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
  const elements = {
    form: document.querySelector('#guess-form'), input: document.querySelector('#guess-input'), attempts: document.querySelector('#attempt-list'),
    count: document.querySelector('#attempt-count'), attemptTitle: document.querySelector('#attempt-title'), puzzleLabel: document.querySelector('#puzzle-label'),
    score: document.querySelector('#semantic-score'), rank: document.querySelector('#semantic-rank'), bars: [...document.querySelectorAll('#semantic-bars i')],
    keyboard: document.querySelector('#virtual-keyboard'), result: document.querySelector('#result-dialog'), settings: document.querySelector('#settings-dialog'),
    toast: document.querySelector('.toast'), resultTitle: document.querySelector('#result-title'), resultSummary: document.querySelector('#result-summary')
  };

  function normalize(word) { return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); }
  function newAnswer(difficulty, mode) {
    const options = ANSWERS[difficulty];
    const seed = mode === 'daily' ? Number(new Date().toISOString().slice(0, 10).replaceAll('-', '')) : Date.now();
    return options[Math.abs(seed) % options.length];
  }
  function createGame(difficulty = 'medium', mode = 'daily') { return { version: 1, difficulty, mode, answer: newAnswer(difficulty, mode), attempts: [], status: 'playing', startedAt: Date.now(), dailyDate: new Date().toISOString().slice(0, 10) }; }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const valid = saved?.version === 1 && Object.hasOwn(LIMITS, saved.difficulty) && ['daily', 'unlimited'].includes(saved.mode) && Array.isArray(saved.attempts) && normalize(saved.answer || '').length === 5;
      if (!valid) return createGame();
      if (saved.mode === 'daily' && saved.dailyDate !== new Date().toISOString().slice(0, 10)) return createGame(saved.difficulty, 'daily');
      return saved;
    } catch (_) { return createGame(); }
  }
  let state = loadState();
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { notify('Não foi possível salvar a partida neste dispositivo.'); } }

  function evaluate(answer, guess) {
    const result = Array(guess.length).fill('absent'); const remaining = answer.split('');
    guess.split('').forEach((letter, index) => { if (letter === remaining[index]) { result[index] = 'correct'; remaining[index] = null; } });
    guess.split('').forEach((letter, index) => { if (result[index] !== 'correct') { const match = remaining.indexOf(letter); if (match >= 0) { result[index] = 'present'; remaining[match] = null; } } });
    return result;
  }
  function semanticScore(answer, guess) {
    if (guess === normalize(answer)) return 100;
    const normalizedAnswer = normalize(answer); let shared = 0;
    normalize(guess).split('').forEach(letter => { if (normalizedAnswer.includes(letter)) shared++; });
    return Math.min(98, 18 + shared * 13 + Math.min(12, state.attempts.length * 4));
  }
  function notify(message) { elements.toast.textContent = message; elements.toast.classList.add('show'); clearTimeout(notify.timer); notify.timer = setTimeout(() => elements.toast.classList.remove('show'), 2400); }
  function labelScore(score) { return score >= 80 ? 'Muito próxima' : score >= 55 ? 'Próxima' : 'Distante'; }
  function startGame(difficulty = state.difficulty, mode = state.mode) {
    if (difficulty === state.difficulty && mode === state.mode && state.status === 'playing' && state.attempts.length) return;
    const preferences = { theme: state.theme, contrast: state.contrast };
    state = createGame(difficulty, mode);
    state.theme = preferences.theme;
    state.contrast = preferences.contrast;
    saveState(); render();
    document.querySelector('#theme-toggle').checked = Boolean(state.theme);
    document.querySelector('#contrast-toggle').checked = Boolean(state.contrast);
    notify(mode === 'daily' ? 'Desafio diário iniciado.' : 'Partida ilimitada iniciada.');
  }

  function renderAttempts() {
    elements.attempts.replaceChildren();
    state.attempts.forEach((attempt, attemptIndex) => {
      const row = document.createElement('div'); row.className = `p-row${attemptIndex === state.attempts.length - 1 ? ' current' : ''}`;
      row.setAttribute('aria-label', `Tentativa ${attemptIndex + 1}: ${attempt.word}. ${attempt.feedback.join(', ')}`);
      const number = document.createElement('span'); number.textContent = attemptIndex + 1; row.append(number);
      attempt.word.split('').forEach((letter, index) => {
        const cell = document.createElement('i'); cell.textContent = letter;
        cell.className = attempt.feedback[index] === 'correct' ? 'correct' : attempt.feedback[index] === 'present' ? 'spot' : 'absent';
        const description = attempt.feedback[index] === 'correct' ? 'correta' : attempt.feedback[index] === 'present' ? 'presente em outra posição' : 'ausente';
        cell.setAttribute('aria-label', `${letter}: ${description}`); row.append(cell);
      }); elements.attempts.append(row);
    });
    const limit = LIMITS[state.difficulty]; const visibleLimit = Math.min(limit, 6);
    for (let index = state.attempts.length; index < visibleLimit; index++) {
      const row = document.createElement('div'); row.className = 'p-row empty-row'; const number = document.createElement('span'); number.textContent = index + 1; row.append(number);
      for (let cellIndex = 0; cellIndex < 5; cellIndex++) row.append(document.createElement('i'));
      elements.attempts.append(row);
    }
    elements.count.textContent = `${state.attempts.length} / ${limit}`;
    elements.attemptTitle.textContent = state.status === 'playing' ? `Tentativa ${String(state.attempts.length + 1).padStart(2, '0')}` : 'Partida concluída';
  }

  function updateKeyboard() {
    elements.keyboard.replaceChildren();
    LETTERS.forEach(rowText => {
      const row = document.createElement('div');
      [...rowText].forEach(letter => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = letter;
        const states = state.attempts.flatMap(attempt => attempt.word.split('').map((value, index) => value === letter ? attempt.feedback[index] : null));
        if (states.includes('correct')) button.className = 'key-correct'; else if (states.includes('present')) button.className = 'key-present'; else if (states.includes('absent')) button.className = 'key-absent';
        button.setAttribute('aria-label', `${letter}: ${states.includes('correct') ? 'correta' : states.includes('present') ? 'presente em outra posição' : states.includes('absent') ? 'ausente' : 'não utilizada'}`);
        button.addEventListener('click', () => { elements.input.value = normalize(elements.input.value + letter).slice(0, 5); elements.input.focus(); }); row.append(button);
      }); elements.keyboard.append(row);
    });
  }

  function render() {
    document.querySelectorAll('[data-difficulty]').forEach(button => button.classList.toggle('active', button.dataset.difficulty === state.difficulty));
    document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === state.mode));
    document.body.classList.toggle('dark-theme', Boolean(state.theme)); document.body.classList.toggle('high-contrast', Boolean(state.contrast));
    elements.puzzleLabel.textContent = state.mode === 'daily' ? `DESAFIO ${Math.floor(Date.now() / 86400000) - 19600}` : 'MODO ILIMITADO';
    renderAttempts(); updateKeyboard();
    const latest = state.attempts.at(-1); elements.score.textContent = latest ? latest.semantic.score : '—';
    elements.rank.innerHTML = latest ? `<b>${latest.semantic.rank}ª</b> de 10.000 palavras próximas · ${labelScore(latest.semantic.score)}` : '<b>Envie</b> sua primeira palavra';
    elements.bars.forEach((bar, index) => bar.style.height = `${latest ? Math.max(12, latest.semantic.score - (4 - index) * 14) : 8}%`);
    elements.input.disabled = state.status !== 'playing'; document.querySelector('#send').disabled = state.status !== 'playing';
  }

  function finish(status) {
    state.status = status; saveState(); render();
    elements.resultTitle.textContent = status === 'won' ? 'Palavra encontrada!' : 'Não foi desta vez';
    elements.resultSummary.innerHTML = `<p>A palavra era <strong>${state.answer}</strong></p><p>${state.attempts.length} tentativa(s) · nível ${state.difficulty}</p>`;
    if (typeof elements.result.showModal === 'function' && !elements.result.open) elements.result.showModal();
    let stats = { played: 0, won: 0 }; try { stats = JSON.parse(localStorage.getItem('pista.stats.v1')) || stats; } catch (_) {}
    stats.played++; if (status === 'won') stats.won++; localStorage.setItem('pista.stats.v1', JSON.stringify(stats));
  }

  elements.form.addEventListener('submit', event => {
    event.preventDefault(); const guess = normalize(elements.input.value);
    if (guess.length !== 5) return notify('Digite exatamente 5 letras.');
    if (!VALID_WORDS.has(guess)) return notify('Palavra não reconhecida pelo jogo.');
    if (state.attempts.some(attempt => attempt.word === guess)) return notify('Essa palavra já foi usada nesta partida.');
    const feedback = evaluate(normalize(state.answer), guess); const score = semanticScore(state.answer, guess);
    state.attempts.push({ word: guess, feedback, semantic: { score, rank: Math.max(1, 10000 - score * 96) } });
    elements.input.value = ''; saveState(); render();
    if (guess === normalize(state.answer)) finish('won'); else if (state.attempts.length >= LIMITS[state.difficulty]) finish('lost'); else notify(`Palpite enviado · proximidade: ${score}%`);
  });

  document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => startGame(button.dataset.difficulty, state.mode)));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => startGame(state.difficulty, button.dataset.mode)));
  document.querySelector('#settings-button').addEventListener('click', () => { if (typeof elements.settings.showModal === 'function' && !elements.settings.open) elements.settings.showModal(); });
  document.querySelector('#ranking-button').addEventListener('click', () => notify('Ranking do desafio: posição 128'));
  document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelector('#theme-toggle').addEventListener('change', event => { state.theme = event.target.checked; saveState(); render(); });
  document.querySelector('#contrast-toggle').addEventListener('change', event => { state.contrast = event.target.checked; saveState(); render(); });
  document.querySelector('#reset-button').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('pista.stats.v1'); state = createGame(state.difficulty, state.mode); saveState(); elements.settings.close(); render(); notify('Progresso local apagado.'); });
  document.querySelector('#new-game-button').addEventListener('click', () => { elements.result.close(); startGame(state.difficulty, state.mode); });
  document.querySelector('#share-button').addEventListener('click', async () => {
    const result = `PISTA · ${state.attempts.length}/${LIMITS[state.difficulty]}\n${state.attempts.map(attempt => attempt.feedback.map(value => value === 'correct' ? '🟩' : value === 'present' ? '🟨' : '⬛').join('')).join('\n')}`;
    try { if (navigator.share) await navigator.share({ text: result }); else await navigator.clipboard.writeText(result); notify('Resultado copiado.'); } catch (_) { notify('Compartilhamento cancelado.'); }
  });
  document.querySelector('#theme-toggle').checked = Boolean(state.theme); document.querySelector('#contrast-toggle').checked = Boolean(state.contrast);
  render();
});
