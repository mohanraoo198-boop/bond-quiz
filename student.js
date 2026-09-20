// Bond Market Quiz — student app
const TICKER_FACTS = [
  "10Y G-SEC YIELD STEADY", "COUPON: THE PRICE OF PATIENCE", "PAR IS WHERE FACE VALUE LIVES",
  "DURATION MEASURES RATE SENSITIVITY", "A CALL OPTION FAVORS THE ISSUER", "A PUT OPTION FAVORS THE HOLDER",
  "CLEAN PRICE EXCLUDES ACCRUED INTEREST", "CREDIT SPREADS WIDEN WITH RISK", "TRANCHES RANK BY PRIORITY OF PAYMENT",
  "REPO: TODAY'S CASH AGAINST TOMORROW'S SECURITY", "LIQUIDITY HAS A PRICE — CALL IT A PREMIUM"
];

const root = document.getElementById('app-root');
const masthead = document.getElementById('masthead-right');
const tabsEl = document.getElementById('tabs');
let SESSION = null; // {classId, rollNo, name, className}
let CLASS_DOC = null;

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

function renderTicker() {
  const track = document.getElementById('ticker-track');
  track.innerHTML = TICKER_FACTS.map(f => `<span><b>&#8226;</b> ${f}</span>`).join('');
}

function saveSession(s) { localStorage.setItem('bq_session', JSON.stringify(s)); SESSION = s; }
function loadSession() { try { return JSON.parse(localStorage.getItem('bq_session')); } catch (e) { return null; } }
function clearSession() { localStorage.removeItem('bq_session'); SESSION = null; }

function setMasthead() {
  if (!SESSION) { masthead.innerHTML = ''; tabsEl.style.display = 'none'; return; }
  masthead.innerHTML = `<span><b>${escapeHtml(SESSION.name)}</b> &middot; Roll ${escapeHtml(SESSION.rollNo)} &middot; ${escapeHtml(SESSION.className || SESSION.classId)}</span>
    <button class="logout" id="logout-btn">Sign out</button>`;
  document.getElementById('logout-btn').onclick = () => { clearSession(); location.hash = ''; renderRoute(); };
  tabsEl.style.display = 'flex';
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- Routing ----------
window.addEventListener('hashchange', renderRoute);

function renderRoute() {
  const hash = location.hash.replace('#', '');
  if (!SESSION) { renderLogin(); return; }
  setMasthead();
  if (hash.startsWith('quiz/')) {
    const day = parseInt(hash.split('/')[1], 10);
    renderQuiz(day);
  } else if (hash === 'leaderboard') {
    setActiveTab('leaderboard');
    renderLeaderboard();
  } else {
    setActiveTab('dashboard');
    renderDashboard();
  }
}

function setActiveTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
}

document.getElementById('tab-dashboard').onclick = () => { location.hash = ''; };
document.getElementById('tab-leaderboard').onclick = () => { location.hash = 'leaderboard'; };

// ---------- Login ----------
function renderLogin() {
  tabsEl.style.display = 'none';
  masthead.innerHTML = '';
  root.innerHTML = '';
  root.appendChild(el(`
    <div class="certificate">
      <div class="eyebrow"><span>UNIT I</span><span>DEBT SECURITIES</span></div>
      <h2>Bond Market Quiz</h2>
      <div class="tagline">18-day progressive assessment &middot; sign in to begin today's coupon</div>
      <div class="field"><label>Class code</label><input id="in-class" placeholder="e.g. MBA25A" autocapitalize="characters"></div>
      <div class="field"><label>Roll number</label><input id="in-roll" placeholder="e.g. F2025013"></div>
      <div class="field"><label>Password</label><input id="in-pass" type="password" placeholder="Given by your faculty"></div>
      <button class="btn" id="login-btn">Sign in</button>
      <div class="error-msg" id="login-err"></div>
      <div class="hint">Ask your faculty for your class code and password.</div>
    </div>
  `));
  document.getElementById('login-btn').onclick = doLogin;
  root.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
}

async function doLogin() {
  const classId = document.getElementById('in-class').value.trim().toUpperCase();
  const rollNo = document.getElementById('in-roll').value.trim();
  const pass = document.getElementById('in-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.textContent = '';
  if (!classId || !rollNo || !pass) { errEl.textContent = 'Fill in all three fields.'; return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Checking...';
  try {
    await ensureAnonAuth();
    const classSnap = await db.collection('classes').doc(classId).get();
    if (!classSnap.exists) { errEl.textContent = 'Class code not found.'; return; }
    const studentSnap = await db.collection('classes').doc(classId).collection('students').doc(rollNo).get();
    if (!studentSnap.exists) { errEl.textContent = 'Roll number not found for this class.'; return; }
    const student = studentSnap.data();
    if (String(student.password) !== pass) { errEl.textContent = 'Incorrect password.'; return; }
    saveSession({ classId, rollNo, name: student.name || rollNo, className: classSnap.data().name });
    location.hash = '';
    renderRoute();
  } catch (e) {
    console.error(e);
    errEl.textContent = 'Could not reach the server. Check your connection and try again.';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

// ---------- Dashboard ----------
// ---------- Chronological unlock logic ----------
// A day is available once it's within the class's manually-unlocked ceiling
// AND the student has completed every prior day — so nobody can skip ahead,
// but the admin still controls how far the class can go via "Unlock next day".
function isDayOpenForStudent(dayNum, results, classCeiling) {
  if (dayNum > classCeiling) return false;
  if (dayNum === 1) return true;
  return !!results['day' + (dayNum - 1)];
}

async function renderDashboard() {
  root.innerHTML = '<div class="loading">Loading your coupon schedule&hellip;</div>';
  const classRef = db.collection('classes').doc(SESSION.classId);
  const studentRef = classRef.collection('students').doc(SESSION.rollNo);
  const [classSnap, studentSnap] = await Promise.all([classRef.get(), studentRef.get()]);
  CLASS_DOC = classSnap.data();
  const student = studentSnap.data() || {};
  const results = student.results || {};
  const unlockedDay = CLASS_DOC.unlockedDay || 1;
  const completedCount = Object.keys(results).length;
  const totalScore = Object.values(results).reduce((a, r) => a + (r.score || 0), 0);

  const cards = QUIZ_DATA.map(day => {
    const r = results['day' + day.day];
    const isDone = !!r;
    const isOpen = !isDone && isDayOpenForStudent(day.day, results, unlockedDay);
    const isPending = !isDone && !isOpen && day.day <= unlockedDay; // ceiling allows it, but a prior day is still incomplete
    const stateClass = isDone ? 'done' : (isOpen ? 'open' : 'locked');
    const stamp = isDone ? 'Redeemed' : (isOpen ? 'Open' : (isPending ? 'Complete previous day' : 'Locked'));
    return `<div class="day-card ${stateClass}" data-day="${day.day}" data-open="${isOpen ? '1' : '0'}" data-done="${isDone ? '1' : '0'}">
      <span class="stamp">${stamp}</span>
      <div class="num">${String(day.day).padStart(2, '0')}</div>
      <span class="topic">${escapeHtml(day.title)}</span>
      ${isDone ? `<span class="score">${r.score}/9</span>` : ''}
    </div>`;
  }).join('');

  root.innerHTML = `
    <div class="dash-head">
      <h2>Coupon Schedule</h2>
      <p>Day ${unlockedDay} of 18 is open. Complete each day's quiz, in order, to redeem its coupon.</p>
      <div class="stat-row">
        <div class="stat"><div class="n">${completedCount}/18</div><div class="l">Days completed</div></div>
        <div class="stat"><div class="n">${totalScore}</div><div class="l">Total points</div></div>
        <div class="stat"><div class="n">${completedCount ? Math.round((totalScore / (completedCount * 9)) * 100) : 0}%</div><div class="l">Accuracy</div></div>
      </div>
    </div>
    <div class="schedule">${cards}</div>
  `;
  root.querySelectorAll('.day-card').forEach(c => {
    c.onclick = () => {
      if (c.dataset.open === '1' && c.dataset.done !== '1') location.hash = 'quiz/' + c.dataset.day;
    };
  });
}

// ---------- Quiz ----------
let QUIZ_STATE = null;

async function renderQuiz(dayNum) {
  const day = QUIZ_DATA.find(d => d.day === dayNum);
  if (!day) { location.hash = ''; return; }

  // Re-check against the server (not just the dashboard's cached view) so a
  // student can't retake a day, or skip ahead out of order, by typing the
  // URL/hash directly, refreshing, or re-clicking after the dashboard
  // already rendered.
  root.innerHTML = '<div class="loading">Loading today&rsquo;s coupon&hellip;</div>';
  const classRef = db.collection('classes').doc(SESSION.classId);
  const studentRef = classRef.collection('students').doc(SESSION.rollNo);
  const [classSnap, snap] = await Promise.all([classRef.get(), studentRef.get()]);
  const results = (snap.data() || {}).results || {};
  const unlockedDay = (classSnap.data() || {}).unlockedDay || 1;

  if (results['day' + dayNum]) {
    root.innerHTML = '<div class="loading">You&rsquo;ve already completed this day&rsquo;s quiz &mdash; redirecting&hellip;</div>';
    setTimeout(() => { location.hash = ''; }, 900);
    return;
  }
  if (!isDayOpenForStudent(dayNum, results, unlockedDay)) {
    root.innerHTML = '<div class="loading">Complete the previous day first &mdash; redirecting&hellip;</div>';
    setTimeout(() => { location.hash = ''; }, 900);
    return;
  }

  // Shuffle each question's options deterministically per student+day+question,
  // so the correct answer isn't reliably in the same position (or the
  // longest option) for every student — this is what the seeded shuffle below
  // fixes, without needing to touch the question bank itself.
  const shuffledDay = {
    ...day,
    questions: day.questions.map((q, qi) => {
      const seed = hashSeed(SESSION.rollNo + '|' + day.day + '|' + qi);
      const order = seededShuffleIndices(q.o.length, seed);
      const newOptions = order.map(i => q.o[i]);
      const newCorrect = order.indexOf(q.c);
      return { ...q, o: newOptions, c: newCorrect };
    })
  };

  QUIZ_STATE = { day: shuffledDay, idx: 0, score: 0, answered: false };
  paintQuiz();
}

// Small deterministic PRNG (mulberry32) seeded from a string, so the same
// student always sees the same shuffle for the same question if they
// reload mid-quiz, but different students/days get different orders.
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function seededShuffleIndices(n, seed) {
  let s = seed;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function paintQuiz() {
  const { day, idx } = QUIZ_STATE;
  const q = day.questions[idx];
  const tierLabel = ['Tier I &middot; Recall', 'Tier II &middot; Conceptual', 'Tier III &middot; Applied'][q.t - 1];
  const punches = day.questions.map((qq, i) => {
    let cls = 'punch';
    if (i < idx) cls += (QUIZ_STATE.history && QUIZ_STATE.history[i]) ? ' correct' : ' wrong';
    else if (i === idx) cls += ' current';
    return `<div class="${cls}">${i + 1}</div>`;
  }).join('');

  const articlesHtml = day.articles.map(a => `
    <div class="article-box">
      <div class="head">${escapeHtml(a.head)}</div>
      <div class="dateline">${escapeHtml(a.dateline)}</div>
      <div class="body">${escapeHtml(a.body)}</div>
    </div>`).join('');

  root.innerHTML = `
    <div class="quiz-wrap">
      <div class="quiz-head">
        <div class="daytitle">Day ${day.day} &middot; ${escapeHtml(day.title)}</div>
        <span class="tier-tag">${tierLabel}</span>
      </div>
      <div class="punchrow">${punches}</div>
      <div id="articles-panel" style="${idx === 0 ? '' : 'display:none'}">${articlesHtml}</div>
      <span class="articles-toggle" id="art-toggle">${idx === 0 ? 'Hide articles' : 'Show today\'s articles'}</span>
      <div class="question-card">
        <div class="qtext">${escapeHtml(q.text)}</div>
        <div id="options"></div>
        <div id="explain"></div>
        <button class="btn next-btn" id="next-btn" style="display:none">Next question</button>
      </div>
    </div>
  `;
  document.getElementById('art-toggle').onclick = () => {
    const p = document.getElementById('articles-panel');
    const showing = p.style.display !== 'none';
    p.style.display = showing ? 'none' : 'block';
    document.getElementById('art-toggle').textContent = showing ? "Show today's articles" : 'Hide articles';
  };
  const optWrap = document.getElementById('options');
  q.o.forEach((opt, i) => {
    const b = el(`<button class="option"><span class="letter">${String.fromCharCode(65 + i)}.</span>${escapeHtml(opt)}</button>`);
    b.onclick = () => selectOption(i);
    optWrap.appendChild(b);
  });
}

function selectOption(i) {
  if (QUIZ_STATE.answered) return;
  QUIZ_STATE.answered = true;
  const { day, idx } = QUIZ_STATE;
  const q = day.questions[idx];
  const correct = i === q.c;
  QUIZ_STATE.history = QUIZ_STATE.history || [];
  QUIZ_STATE.history[idx] = correct;
  if (correct) QUIZ_STATE.score++;

  document.querySelectorAll('.option').forEach((b, bi) => {
    b.disabled = true;
    if (bi === q.c) b.classList.add('correct');
    else if (bi === i) b.classList.add('wrong');
  });
  document.getElementById('explain').innerHTML = `<div class="explain-box">${correct ? 'Correct. ' : 'Not quite. '}${escapeHtml(q.e)}</div>`;
  const nextBtn = document.getElementById('next-btn');
  nextBtn.style.display = 'block';
  nextBtn.textContent = idx === day.questions.length - 1 ? 'See results' : 'Next question';
  nextBtn.onclick = advanceQuiz;
  // refresh punch row highlight
  const punches = document.querySelectorAll('.punch');
  punches[idx].classList.remove('current');
  punches[idx].classList.add(correct ? 'correct' : 'wrong');
}

async function advanceQuiz() {
  const { day, idx } = QUIZ_STATE;
  if (idx < day.questions.length - 1) {
    QUIZ_STATE.idx++;
    QUIZ_STATE.answered = false;
    paintQuiz();
  } else {
    await submitDayResult();
  }
}

async function submitDayResult() {
  const { day, score } = QUIZ_STATE;
  root.innerHTML = '<div class="loading">Saving your result&hellip;</div>';
  const studentRef = db.collection('classes').doc(SESSION.classId).collection('students').doc(SESSION.rollNo);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(studentRef);
      const data = snap.data() || {};
      const results = data.results || {};
      if (results['day' + day.day]) return; // already recorded elsewhere — don't overwrite
      results['day' + day.day] = { score, completedAt: Date.now() };
      const totalScore = Object.values(results).reduce((a, r) => a + (r.score || 0), 0);
      tx.set(studentRef, { results, totalScore }, { merge: true });
    });
  } catch (e) {
    console.error(e);
  }
  paintResult(score, day.questions.length);
}

function paintResult(score, total) {
  const pct = Math.round((score / total) * 100);
  let msg = 'Keep at it — review today\'s concepts and come back stronger tomorrow.';
  if (pct >= 90) msg = 'Outstanding — a near-perfect redemption.';
  else if (pct >= 70) msg = 'Solid work. A couple of concepts to revisit.';
  else if (pct >= 50) msg = 'Halfway there — reread today\'s articles before tomorrow.';
  root.innerHTML = `
    <div class="result-card">
      <div class="big">${score}/${total}</div>
      <div class="of">Day ${QUIZ_STATE.day.day} &middot; ${escapeHtml(QUIZ_STATE.day.title)}</div>
      <div class="msg">${msg}</div>
      <button class="btn" id="back-btn">Back to schedule</button>
      <button class="btn secondary" id="board-btn" style="margin-top:10px">View leaderboard</button>
    </div>
  `;
  document.getElementById('back-btn').onclick = () => { location.hash = ''; };
  document.getElementById('board-btn').onclick = () => { location.hash = 'leaderboard'; };
}

// ---------- Leaderboard ----------
async function renderLeaderboard() {
  root.innerHTML = '<div class="loading">Tallying the yield table&hellip;</div>';
  const snap = await db.collection('classes').doc(SESSION.classId).collection('students').get();
  const rows = [];
  snap.forEach(doc => {
    const d = doc.data();
    const completed = d.results ? Object.keys(d.results).length : 0;
    rows.push({ rollNo: doc.id, name: d.name || doc.id, total: d.totalScore || 0, completed });
  });
  rows.sort((a, b) => b.total - a.total || b.completed - a.completed);

  const body = rows.map((r, i) => {
    const rankClass = i === 0 ? 'g1' : i === 1 ? 'g2' : i === 2 ? 'g3' : '';
    const me = r.rollNo === SESSION.rollNo ? ' me' : '';
    return `<tr class="${me}">
      <td class="rank ${rankClass}">${i + 1}</td>
      <td class="name">${escapeHtml(r.name)}<br><span class="roll">Roll ${escapeHtml(r.rollNo)} &middot; ${r.completed}/18 days</span></td>
      <td class="score">${r.total}</td>
    </tr>`;
  }).join('');

  root.innerHTML = `
    <div class="board">
      <div class="dash-head" style="margin-bottom:14px"><h2>Yield Table</h2><p>${SESSION.className || SESSION.classId} &middot; ranked by total points</p></div>
      <table>
        <thead><tr><th>Rank</th><th>Student</th><th style="text-align:right">Points</th></tr></thead>
        <tbody>${body || '<tr><td colspan="3">No students yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

// ---------- Boot ----------
renderTicker();
SESSION = loadSession();
renderRoute();
