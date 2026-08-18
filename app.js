/* ============================================
   META TRACKER 2026 — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ─── Constants ─────────────────────────────────
  const USERS_KEY = 'metaTracker2026_users';
  const ACTIVE_USER_KEY = 'metaTracker2026_activeUser';
  const LEGACY_STORAGE_KEY = 'metaTracker2026'; // for migration
  const CIRCUMFERENCE = 2 * Math.PI * 50; // r=50 for SVG circle

  // ─── Auth State ────────────────────────────────
  let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  let activeUser = JSON.parse(localStorage.getItem(ACTIVE_USER_KEY) || 'null');
  
  function getStorageKey() {
    return activeUser ? `metaTracker2026_data_${activeUser.id}` : null;
  }

  function saveUsers() {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  
  function saveActiveUser() {
    if (activeUser) {
      localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(activeUser));
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  }

  // ─── Default State ─────────────────────────────
  function getDefaultState() {
    return {
      endDate: '2026-12-31',
      theme: 'light',
      goals: [
        {
          id: generateId(),
          name: 'Academia',
          target: 90,
          icon: '🏋️',
          color: '#6C5CE7',
          slug: 'academia',
        },
        {
          id: generateId(),
          name: 'Jiu-Jitsu',
          target: 60,
          icon: '🥋',
          color: '#00B894',
          slug: 'jiu-jitsu',
        },
      ],
      sessions: [],
    };
  }

  // ─── State Management ──────────────────────────
  let state = null; // Loaded only when authenticated

  function loadState() {
    if (!activeUser) return getDefaultState();
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migration: ensure slugs exist
        parsed.goals.forEach((g) => {
          if (!g.slug) g.slug = slugify(g.name);
        });
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
    return getDefaultState();
  }

  function saveState() {
    if (!activeUser) return;
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  // ─── Utilities ─────────────────────────────────
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }

  function formatDateFull(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function getDaysRemaining() {
    const now = new Date();
    const end = new Date(state.endDate + 'T23:59:59');
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function getTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const d = String(monday.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getSessionsForGoal(goalId) {
    return state.sessions.filter((s) => s.goalId === goalId);
  }

  function getStreakDays() {
    if (state.sessions.length === 0) return 0;

    const uniqueDates = [...new Set(state.sessions.map((s) => s.date))].sort().reverse();
    if (uniqueDates.length === 0) return 0;

    const today = getTodayStr();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Check if most recent session is today or yesterday
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterdayStr) {
      return 0;
    }

    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1] + 'T12:00:00');
      const currDate = new Date(uniqueDates[i] + 'T12:00:00');
      const diffDays = (prevDate - currDate) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function getWeekSessions() {
    const weekStart = getWeekStart();
    return state.sessions.filter((s) => s.date >= weekStart).length;
  }

  // ─── DOM References ────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    daysRemaining: $('#days-remaining'),
    totalSessions: $('#total-sessions'),
    currentStreak: $('#current-streak'),
    weekSessions: $('#week-sessions'),
    overallProgress: $('#overall-progress'),
    goalsGrid: $('#goals-grid'),
    logList: $('#log-list'),
    emptyState: $('#empty-state'),
    fabAdd: $('#fab-add'),

    // Auth
    authOverlay: $('#auth-overlay'),
    appContainer: $('.app-container'),
    authTabs: $$('.auth-tab'),
    formLogin: $('#form-login'),
    formRegister: $('#form-register'),
    loginUsername: $('#login-username'),
    loginPassword: $('#login-password'),
    regUsername: $('#reg-username'),
    regPassword: $('#reg-password'),
    btnLogout: $('#btn-logout'),

    // Theme
    btnTheme: $('#btn-theme'),
    themeIcon: $('#theme-icon'),

    // Modals
    modalAddSession: $('#modal-add-session'),
    modalEditGoal: $('#modal-edit-goal'),
    modalSettings: $('#modal-settings'),

    // Session form
    formAddSession: $('#form-add-session'),
    sessionGoal: $('#session-goal'),
    sessionDate: $('#session-date'),
    sessionNotes: $('#session-notes'),
    sessionDuration: $('#session-duration'),
    editSessionId: $('#edit-session-id'),
    modalSessionTitle: $('#modal-session-title'),
    submitSessionBtn: $('#submit-session-btn'),

    // Goal form
    formEditGoal: $('#form-edit-goal'),
    editGoalId: $('#edit-goal-id'),
    goalName: $('#goal-name'),
    goalTarget: $('#goal-target'),
    modalGoalTitle: $('#modal-goal-title'),
    deleteGoalBtn: $('#delete-goal-btn'),

    // Settings
    settingsEndDate: $('#settings-end-date'),

    // Particles
    bgParticles: $('#bgParticles'),

    // Confetti
    confettiCanvas: $('#confetti-canvas'),

    // Toast
    toastContainer: $('#toast-container'),
  };

  // ─── Background Particles ──────────────────────
  function createParticles() {
    const colors = ['rgba(108,92,231,0.3)', 'rgba(0,184,148,0.2)', 'rgba(225,112,85,0.2)', 'rgba(0,206,201,0.2)'];
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 4 + 2;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDuration = Math.random() * 15 + 10 + 's';
      particle.style.animationDelay = Math.random() * 10 + 's';
      dom.bgParticles.appendChild(particle);
    }
  }

  // ─── Toast Notifications ───────────────────────
  function showToast(message, type = 'success') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── Confetti ──────────────────────────────────
  function launchConfetti() {
    const canvas = dom.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#6C5CE7', '#00B894', '#E17055', '#FDCB6E', '#E84393', '#00CEC9', '#0984E3', '#FF7675'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach((p) => {
        p.x += p.vx;
        p.vy += 0.05;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        if (frame > 60) p.opacity -= 0.008;

        if (p.opacity > 0 && p.y < canvas.height + 20) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      });

      frame++;
      if (alive && frame < 300) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animate();
  }

  // ─── Render Functions ──────────────────────────

  function applyTheme() {
    if (!state.theme) state.theme = 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    
    if (state.theme === 'dark') {
      dom.themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else {
      dom.themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveState();
    applyTheme();
  }

  function renderAll() {
    applyTheme();
    renderCountdown();
    renderStats();
    renderGoals();
    renderLog();
    populateGoalSelect();
  }

  function renderCountdown() {
    const days = getDaysRemaining();
    dom.daysRemaining.textContent = days;
    dom.daysRemaining.classList.add('number-animate');
    setTimeout(() => dom.daysRemaining.classList.remove('number-animate'), 400);
  }

  function renderStats() {
    const totalSessions = state.sessions.length;
    const streak = getStreakDays();
    const weekSessions = getWeekSessions();

    // Overall progress: average of all goals
    let overallPercent = 0;
    if (state.goals.length > 0) {
      const totalPercent = state.goals.reduce((sum, goal) => {
        const completed = getSessionsForGoal(goal.id).length;
        return sum + Math.min(100, Math.round((completed / goal.target) * 100));
      }, 0);
      overallPercent = Math.round(totalPercent / state.goals.length);
    }

    animateNumber(dom.totalSessions, totalSessions);
    animateNumber(dom.currentStreak, streak);
    animateNumber(dom.weekSessions, weekSessions);
    dom.overallProgress.textContent = overallPercent + '%';
  }

  function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 500;
    const steps = 20;
    const stepTime = duration / steps;
    const increment = (target - current) / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        el.textContent = target;
        clearInterval(timer);
      } else {
        el.textContent = Math.round(current + increment * step);
      }
    }, stepTime);
  }

  function renderGoals() {
    dom.goalsGrid.innerHTML = '';

    state.goals.forEach((goal) => {
      const sessions = getSessionsForGoal(goal.id);
      const completed = sessions.length;
      const percent = Math.min(100, Math.round((completed / goal.target) * 100));
      const remaining = Math.max(0, goal.target - completed);
      const daysLeft = getDaysRemaining();
      const perWeek = daysLeft > 0 ? Math.ceil((remaining / daysLeft) * 7) : 0;

      const dashOffset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

      // Check milestones
      const milestones = [25, 50, 75, 100];
      const currentMilestone = milestones.filter((m) => percent >= m).pop();

      const card = document.createElement('div');
      card.className = 'goal-card';
      card.style.setProperty('--goal-color', goal.color);
      card.innerHTML = `
        <div class="goal-card-header">
          <div class="goal-card-info">
            <div class="goal-card-icon">${goal.icon}</div>
            <div>
              <div class="goal-card-name">${escapeHtml(goal.name)}</div>
              <div class="goal-card-target">${completed} de ${goal.target} treinos</div>
            </div>
          </div>
          <div class="goal-card-actions">
            <button title="Editar Meta" data-edit-goal="${goal.id}" aria-label="Editar meta ${escapeHtml(goal.name)}">✏️</button>
            <button title="Registrar Treino" data-quick-add="${goal.id}" aria-label="Registrar treino de ${escapeHtml(goal.name)}">➕</button>
          </div>
        </div>
        <div class="goal-progress-container">
          <div class="circular-progress">
            <svg viewBox="0 0 120 120">
              <circle class="progress-bg" cx="60" cy="60" r="50"/>
              <circle class="progress-bar" cx="60" cy="60" r="50"
                stroke-dasharray="${CIRCUMFERENCE}"
                stroke-dashoffset="${dashOffset}"
                style="stroke: ${goal.color}"/>
            </svg>
            <div class="progress-text">
              <span class="progress-percentage" style="color: ${goal.color}">${percent}%</span>
              <span class="progress-label">concluído</span>
            </div>
          </div>
          <div class="goal-stats">
            <div class="goal-stat-row">
              <span class="goal-stat-label">Realizados</span>
              <span class="goal-stat-value">${completed}</span>
            </div>
            <div class="goal-stat-row">
              <span class="goal-stat-label">Faltam</span>
              <span class="goal-stat-value">${remaining}</span>
            </div>
            <div class="goal-stat-row">
              <span class="goal-stat-label">Meta semanal</span>
              <span class="goal-stat-value">${perWeek}/sem</span>
            </div>
            <div class="goal-stat-row">
              <span class="goal-stat-label">Dias restantes</span>
              <span class="goal-stat-value">${daysLeft}</span>
            </div>
            ${
              currentMilestone
                ? `<div class="goal-stat-row">
                <span class="goal-stat-label">Marco</span>
                <span class="milestone-badge">🏆 ${currentMilestone}%</span>
              </div>`
                : ''
            }
          </div>
        </div>
        <div class="goal-quick-add">
          <button data-quick-today="${goal.id}">
            <span>+</span> Registrar treino de hoje
          </button>
        </div>
      `;

      dom.goalsGrid.appendChild(card);
    });

    // Attach card events
    $$('[data-edit-goal]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditGoal(btn.dataset.editGoal);
      });
    });

    $$('[data-quick-add]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddSession(btn.dataset.quickAdd);
      });
    });

    $$('[data-quick-today]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickAddToday(btn.dataset.quickToday);
      });
    });
  }

  function renderLog(filter = 'all') {
    const filteredSessions = state.sessions
      .filter((s) => {
        if (filter === 'all') return true;
        const goal = state.goals.find((g) => g.id === s.goalId);
        return goal && goal.slug === filter;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    dom.logList.innerHTML = '';

    if (filteredSessions.length === 0) {
      dom.emptyState.style.display = 'block';
      dom.logList.style.display = 'none';
      return;
    }

    dom.emptyState.style.display = 'none';
    dom.logList.style.display = 'flex';

    filteredSessions.forEach((session) => {
      const goal = state.goals.find((g) => g.id === session.goalId);
      if (!goal) return;

      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `
        <div class="log-entry-icon" style="background: ${goal.color}15; border: 1px solid ${goal.color}30;">
          ${goal.icon}
        </div>
        <div class="log-entry-info">
          <div class="log-entry-name">${escapeHtml(goal.name)}</div>
          <div class="log-entry-meta">
            <span>📅 ${formatDate(session.date)}</span>
            ${session.duration ? `<span>⏱ ${session.duration} min</span>` : ''}
          </div>
          ${session.notes ? `<div class="log-entry-notes">${escapeHtml(session.notes)}</div>` : ''}
        </div>
        <div class="log-entry-actions">
          <button title="Editar" data-edit-session="${session.id}" aria-label="Editar sessão">✏️</button>
          <button class="delete" title="Excluir" data-delete-session="${session.id}" aria-label="Excluir sessão">🗑️</button>
        </div>
      `;

      dom.logList.appendChild(entry);
    });

    // Attach log events
    $$('[data-edit-session]').forEach((btn) => {
      btn.addEventListener('click', () => openEditSession(btn.dataset.editSession));
    });

    $$('[data-delete-session]').forEach((btn) => {
      btn.addEventListener('click', () => deleteSession(btn.dataset.deleteSession));
    });
  }

  function populateGoalSelect() {
    dom.sessionGoal.innerHTML = '';
    state.goals.forEach((goal) => {
      const opt = document.createElement('option');
      opt.value = goal.id;
      opt.textContent = `${goal.icon} ${goal.name}`;
      dom.sessionGoal.appendChild(opt);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Session Management ────────────────────────

  function openAddSession(preselectedGoalId) {
    dom.editSessionId.value = '';
    dom.modalSessionTitle.textContent = 'Registrar Treino';
    dom.submitSessionBtn.textContent = 'Registrar';
    dom.formAddSession.reset();
    dom.sessionDate.value = getTodayStr();

    if (preselectedGoalId) {
      dom.sessionGoal.value = preselectedGoalId;
    }

    openModal(dom.modalAddSession);
  }

  function openEditSession(sessionId) {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;

    dom.editSessionId.value = session.id;
    dom.modalSessionTitle.textContent = 'Editar Treino';
    dom.submitSessionBtn.textContent = 'Salvar';
    dom.sessionGoal.value = session.goalId;
    dom.sessionDate.value = session.date;
    dom.sessionNotes.value = session.notes || '';
    dom.sessionDuration.value = session.duration || '';

    openModal(dom.modalAddSession);
  }

  function saveSession(e) {
    e.preventDefault();

    const goalId = dom.sessionGoal.value;
    const date = dom.sessionDate.value;
    const notes = dom.sessionNotes.value.trim();
    const duration = dom.sessionDuration.value ? parseInt(dom.sessionDuration.value) : null;
    const editId = dom.editSessionId.value;

    if (!goalId || !date) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const goal = state.goals.find((g) => g.id === goalId);

    if (editId) {
      // Edit existing
      const idx = state.sessions.findIndex((s) => s.id === editId);
      if (idx !== -1) {
        state.sessions[idx] = { ...state.sessions[idx], goalId, date, notes, duration };
        showToast(`Treino de ${goal.name} atualizado!`, 'success');
      }
    } else {
      // Add new
      const session = {
        id: generateId(),
        goalId,
        date,
        notes,
        duration,
        createdAt: new Date().toISOString(),
      };
      state.sessions.push(session);

      const completed = getSessionsForGoal(goalId).length;
      const percent = Math.round((completed / goal.target) * 100);

      // Check milestone
      const milestones = [25, 50, 75, 100];
      if (milestones.includes(percent)) {
        showToast(`🏆 ${goal.icon} ${goal.name}: ${percent}% da meta atingida!`, 'success');
        if (percent === 100) {
          launchConfetti();
        }
      } else {
        showToast(`${goal.icon} Treino de ${goal.name} registrado!`, 'success');
      }
    }

    saveState();
    closeModal(dom.modalAddSession);
    renderAll();
  }

  function deleteSession(sessionId) {
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const goal = state.goals.find((g) => g.id === session.goalId);
    const goalName = goal ? goal.name : 'Treino';

    if (confirm(`Excluir este treino de ${goalName}?`)) {
      state.sessions = state.sessions.filter((s) => s.id !== sessionId);
      saveState();
      renderAll();
      showToast('Treino excluído.', 'info');
    }
  }

  function quickAddToday(goalId) {
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;

    const session = {
      id: generateId(),
      goalId,
      date: getTodayStr(),
      notes: '',
      duration: null,
      createdAt: new Date().toISOString(),
    };
    state.sessions.push(session);

    const completed = getSessionsForGoal(goalId).length;
    const percent = Math.round((completed / goal.target) * 100);

    const milestones = [25, 50, 75, 100];
    if (milestones.includes(percent)) {
      showToast(`🏆 ${goal.icon} ${goal.name}: ${percent}% da meta atingida!`, 'success');
      if (percent === 100) {
        launchConfetti();
      }
    } else {
      showToast(`${goal.icon} Treino de ${goal.name} registrado!`, 'success');
    }

    saveState();
    renderAll();
  }

  // ─── Goal Management ──────────────────────────

  function openAddGoal() {
    dom.editGoalId.value = '';
    dom.modalGoalTitle.textContent = 'Nova Meta';
    dom.deleteGoalBtn.style.display = 'none';
    dom.formEditGoal.reset();
    dom.goalName.value = '';
    dom.goalTarget.value = '';

    // Reset pickers
    resetPickers();
    openModal(dom.modalEditGoal);
  }

  function openEditGoal(goalId) {
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;

    dom.editGoalId.value = goal.id;
    dom.modalGoalTitle.textContent = 'Editar Meta';
    dom.deleteGoalBtn.style.display = 'inline-flex';
    dom.goalName.value = goal.name;
    dom.goalTarget.value = goal.target;

    // Set icon picker
    $$('.icon-option').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.icon === goal.icon);
    });

    // Set color picker
    $$('.color-option').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.color === goal.color);
    });

    openModal(dom.modalEditGoal);
  }

  function saveGoal(e) {
    e.preventDefault();

    const name = dom.goalName.value.trim();
    const target = parseInt(dom.goalTarget.value);
    const editId = dom.editGoalId.value;

    if (!name || !target || target < 1) {
      showToast('Preencha nome e quantidade de treinos.', 'error');
      return;
    }

    const selectedIcon = $('.icon-option.selected');
    const selectedColor = $('.color-option.selected');
    const icon = selectedIcon ? selectedIcon.dataset.icon : '🏋️';
    const color = selectedColor ? selectedColor.dataset.color : '#6C5CE7';

    if (editId) {
      const idx = state.goals.findIndex((g) => g.id === editId);
      if (idx !== -1) {
        state.goals[idx] = {
          ...state.goals[idx],
          name,
          target,
          icon,
          color,
          slug: slugify(name),
        };
        showToast(`Meta "${name}" atualizada!`, 'success');
      }
    } else {
      state.goals.push({
        id: generateId(),
        name,
        target,
        icon,
        color,
        slug: slugify(name),
      });
      showToast(`Meta "${name}" criada!`, 'success');
    }

    saveState();
    closeModal(dom.modalEditGoal);
    renderAll();
    updateFilterButtons();
  }

  function deleteGoal() {
    const goalId = dom.editGoalId.value;
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;

    if (confirm(`Excluir a meta "${goal.name}" e todos os treinos associados?`)) {
      state.goals = state.goals.filter((g) => g.id !== goalId);
      state.sessions = state.sessions.filter((s) => s.goalId !== goalId);
      saveState();
      closeModal(dom.modalEditGoal);
      renderAll();
      updateFilterButtons();
      showToast(`Meta "${goal.name}" excluída.`, 'info');
    }
  }

  function resetPickers() {
    $$('.icon-option').forEach((btn, i) => {
      btn.classList.toggle('selected', i === 0);
    });
    $$('.color-option').forEach((btn, i) => {
      btn.classList.toggle('selected', i === 0);
    });
  }

  // ─── Filter Buttons ───────────────────────────

  let currentFilter = 'all';

  function updateFilterButtons() {
    const filterContainer = $('.log-filters');
    // Keep 'all' button, rebuild rest
    filterContainer.innerHTML = '<button class="filter-btn active" data-filter="all">Todos</button>';

    state.goals.forEach((goal) => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.filter = goal.slug;
      btn.textContent = goal.name;
      filterContainer.appendChild(btn);
    });

    attachFilterEvents();
  }

  function attachFilterEvents() {
    $$('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderLog(currentFilter);
      });
    });
  }

  // ─── Modal Management ─────────────────────────

  function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => {
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function closeAllModals() {
    $$('.modal-overlay').forEach((m) => m.classList.remove('active'));
    document.body.style.overflow = '';
  }

  // ─── Settings ──────────────────────────────────

  function openSettings() {
    dom.settingsEndDate.value = state.endDate;
    openModal(dom.modalSettings);
  }

  function saveSettings() {
    const endDate = dom.settingsEndDate.value;
    if (endDate) {
      state.endDate = endDate;
    }
    saveState();
    closeModal(dom.modalSettings);
    renderAll();
    showToast('Configurações salvas!', 'success');
  }

  function exportData() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-tracker-2026-backup-${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Dados exportados com sucesso!', 'success');
  }

  function importData() {
    const input = $('#import-file');
    input.click();
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (imported.goals && imported.sessions) {
          if (confirm('Isso substituirá todos os dados atuais. Continuar?')) {
            state = imported;
            // Migration
            state.goals.forEach((g) => {
              if (!g.slug) g.slug = slugify(g.name);
            });
            saveState();
            renderAll();
            updateFilterButtons();
            showToast('Dados importados com sucesso!', 'success');
          }
        } else {
          showToast('Arquivo inválido.', 'error');
        }
      } catch (err) {
        showToast('Erro ao importar arquivo.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function resetAllData() {
    if (confirm('⚠️ ATENÇÃO: Isso apagará todos os dados permanentemente. Continuar?')) {
      if (confirm('Tem certeza? Esta ação não pode ser desfeita!')) {
        state = getDefaultState();
        saveState();
        closeAllModals();
        renderAll();
        updateFilterButtons();
        showToast('Todos os dados foram resetados.', 'info');
      }
    }
  }

  // ─── Event Listeners ──────────────────────────

  function bindEvents() {
    // Theme
    dom.btnTheme.addEventListener('click', toggleTheme);

    // FAB
    dom.fabAdd.addEventListener('click', () => openAddSession());

    // Session form
    dom.formAddSession.addEventListener('submit', saveSession);
    $('#close-add-session').addEventListener('click', () => closeModal(dom.modalAddSession));
    $('#cancel-add-session').addEventListener('click', () => closeModal(dom.modalAddSession));

    // Goal form
    dom.formEditGoal.addEventListener('submit', saveGoal);
    $('#close-edit-goal').addEventListener('click', () => closeModal(dom.modalEditGoal));
    $('#cancel-edit-goal').addEventListener('click', () => closeModal(dom.modalEditGoal));
    dom.deleteGoalBtn.addEventListener('click', deleteGoal);

    // Add goal button
    $('#btn-add-goal').addEventListener('click', openAddGoal);

    // Settings
    $('#btn-settings').addEventListener('click', openSettings);
    $('#close-settings').addEventListener('click', () => closeModal(dom.modalSettings));
    $('#save-settings').addEventListener('click', saveSettings);
    $('#btn-export').addEventListener('click', exportData);
    $('#btn-import').addEventListener('click', importData);
    $('#import-file').addEventListener('change', handleImport);
    $('#btn-reset').addEventListener('click', resetAllData);

    // Icon picker
    $$('.icon-option').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        $$('.icon-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Color picker
    $$('.color-option').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        $$('.color-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Close modals on overlay click
    $$('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay);
      });
    });

    // Close modals on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    // Filter buttons
    attachFilterEvents();

    // Auth events
    dom.authTabs.forEach(t => t.addEventListener('click', handleAuthTabs));
    dom.formLogin.addEventListener('submit', handleLogin);
    dom.formRegister.addEventListener('submit', handleRegister);
    dom.btnLogout.addEventListener('click', logout);
  }

  // ─── Authentication ────────────────────────────

  function handleAuthTabs(e) {
    const tabName = e.target.dataset.tab;
    dom.authTabs.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    
    if (tabName === 'login') {
      dom.formLogin.classList.add('active');
      dom.formRegister.classList.remove('active');
    } else {
      dom.formLogin.classList.remove('active');
      dom.formRegister.classList.add('active');
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    const username = dom.loginUsername.value.trim().toLowerCase();
    const password = dom.loginPassword.value;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      activeUser = user;
      saveActiveUser();
      startApp();
      showToast(`Bem-vindo de volta, ${user.username}!`, 'success');
    } else {
      showToast('Usuário ou senha incorretos.', 'error');
    }
  }

  function handleRegister(e) {
    e.preventDefault();
    const username = dom.regUsername.value.trim().toLowerCase();
    const password = dom.regPassword.value;
    
    if (users.find(u => u.username === username)) {
      showToast('Este nome de usuário já existe.', 'error');
      return;
    }
    
    const isFirstUser = users.length === 0;
    const newUser = { id: generateId(), username, password };
    users.push(newUser);
    saveUsers();
    
    activeUser = newUser;
    saveActiveUser();
    
    // Migration logic for the first user:
    if (isFirstUser) {
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyData) {
        localStorage.setItem(getStorageKey(), legacyData);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    
    startApp();
    showToast(`Conta criada! Bem-vindo, ${username}!`, 'success');
  }

  function logout() {
    activeUser = null;
    saveActiveUser();
    state = null;
    
    dom.appContainer.style.display = 'none';
    dom.authOverlay.classList.add('active');
    dom.formLogin.reset();
    dom.formRegister.reset();
  }

  function startApp() {
    state = loadState();
    dom.authOverlay.classList.remove('active');
    dom.appContainer.style.display = 'block';
    
    updateFilterButtons();
    renderAll();
    dom.sessionDate.max = getTodayStr();
  }

  // ─── Initialize ────────────────────────────────

  function init() {
    createParticles();
    bindEvents();
    
    if (activeUser) {
      startApp();
    } else {
      dom.appContainer.style.display = 'none';
      dom.authOverlay.classList.add('active');
    }

    console.log(
      '%c⚡ Meta Tracker 2026 — Loaded!',
      'color: #6C5CE7; font-size: 14px; font-weight: bold;'
    );
  }

  // Start app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
