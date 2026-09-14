// Bond Market Quiz — faculty admin panel
const root = document.getElementById('app-root');
let ADMIN_OK = false;
let CURRENT_CLASS = null;

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function boot() {
  await ensureAnonAuth();
  renderGate();
}

async function renderGate() {
  root.innerHTML = '<div class="loading">Checking access&hellip;</div>';
  const metaSnap = await db.collection('meta').doc('admin').get();
  const firstTime = !metaSnap.exists;
  root.innerHTML = `
    <div class="certificate">
      <div class="eyebrow"><span>FACULTY</span><span>ADMIN PANEL</span></div>
      <h2>${firstTime ? 'Set up faculty passcode' : 'Faculty sign-in'}</h2>
      <div class="tagline">${firstTime ? 'This is the first visit — choose a passcode for managing classes.' : 'Enter the faculty passcode to manage classes and rosters.'}</div>
      <div class="field"><label>${firstTime ? 'Create a passcode' : 'Passcode'}</label><input id="in-pass" type="password"></div>
      <button class="btn" id="gate-btn">${firstTime ? 'Save & continue' : 'Enter'}</button>
      <div class="error-msg" id="gate-err"></div>
    </div>
  `;
  document.getElementById('gate-btn').onclick = async () => {
    const val = document.getElementById('in-pass').value.trim();
    const errEl = document.getElementById('gate-err');
    if (!val) { errEl.textContent = 'Enter a passcode.'; return; }
    if (firstTime) {
      await db.collection('meta').doc('admin').set({ passcode: val });
      ADMIN_OK = true; renderDashboard();
    } else {
      const pass = metaSnap.data().passcode;
      if (val === pass) { ADMIN_OK = true; renderDashboard(); }
      else errEl.textContent = 'Incorrect passcode.';
    }
  };
}

async function renderDashboard() {
  root.innerHTML = '<div class="loading">Loading classes&hellip;</div>';
  const classesSnap = await db.collection('classes').get();
  const classes = [];
  classesSnap.forEach(d => classes.push({ id: d.id, ...d.data() }));

  const options = classes.map(c => `<option value="${c.id}" ${CURRENT_CLASS === c.id ? 'selected' : ''}>${escapeHtml(c.name)} (${c.id})</option>`).join('');

  root.innerHTML = `
    <div class="dash-head">
      <h2>Faculty admin</h2>
      <p>Manage class codes, rosters, and the daily unlock schedule.</p>
    </div>
    <div class="certificate" style="max-width:640px; margin-bottom:24px">
      <h2 style="font-size:17px">Create a new class</h2>
      <div class="field"><label>Class code (students use this to sign in)</label><input id="new-classid" placeholder="e.g. MBA25A"></div>
      <div class="field"><label>Class name</label><input id="new-classname" placeholder="e.g. MBA Finance, Section A"></div>
      <button class="btn" id="create-class-btn">Create class</button>
      <div class="error-msg" id="create-err"></div>
    </div>

    <div class="certificate" style="max-width:640px">
      <h2 style="font-size:17px">Select a class</h2>
      <div class="field">
        <select id="class-select"><option value="">-- choose --</option>${options}</select>
      </div>
    </div>
    <div id="class-panel" style="width:100%; max-width:640px; margin-top:20px"></div>
  `;
  document.getElementById('create-class-btn').onclick = createClass;
  document.getElementById('class-select').onchange = (e) => {
    CURRENT_CLASS = e.target.value;
    if (CURRENT_CLASS) renderClassPanel(CURRENT_CLASS);
    else document.getElementById('class-panel').innerHTML = '';
  };
  if (CURRENT_CLASS) renderClassPanel(CURRENT_CLASS);
}

async function createClass() {
  const id = document.getElementById('new-classid').value.trim().toUpperCase();
  const name = document.getElementById('new-classname').value.trim();
  const errEl = document.getElementById('create-err');
  if (!id || !name) { errEl.textContent = 'Enter both a class code and a name.'; return; }
  const existing = await db.collection('classes').doc(id).get();
  if (existing.exists) { errEl.textContent = 'That class code already exists.'; return; }
  await db.collection('classes').doc(id).set({ name, unlockedDay: 1, createdAt: Date.now() });
  CURRENT_CLASS = id;
  renderDashboard();
}

async function renderClassPanel(classId) {
  const panel = document.getElementById('class-panel');
  panel.innerHTML = '<div class="loading">Loading class&hellip;</div>';
  const classSnap = await db.collection('classes').doc(classId).get();
  const cls = classSnap.data();
  const studentsSnap = await db.collection('classes').doc(classId).collection('students').get();
  const students = [];
  studentsSnap.forEach(d => students.push({ rollNo: d.id, ...d.data() }));
  students.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  const rows = students.map(s => {
    const completed = s.results ? Object.keys(s.results).length : 0;
    return `<tr>
      <td class="name">${escapeHtml(s.name)}<br><span class="roll">Roll ${escapeHtml(s.rollNo)}</span></td>
      <td>${completed}/18</td>
      <td class="score">${s.totalScore || 0}</td>
      <td><button class="btn small secondary" data-remove="${s.rollNo}">Remove</button></td>
    </tr>`;
  }).join('');

  panel.innerHTML = `
    <div class="stat-row">
      <div class="stat"><div class="n">${cls.unlockedDay}</div><div class="l">Day unlocked</div></div>
      <div class="stat"><div class="n">${students.length}</div><div class="l">Students enrolled</div></div>
    </div>
    <div style="display:flex; gap:10px; margin-bottom:22px">
      <button class="btn secondary" id="lock-btn" ${cls.unlockedDay <= 1 ? 'disabled' : ''}>Lock back a day</button>
      <button class="btn" id="unlock-btn" ${cls.unlockedDay >= 18 ? 'disabled' : ''}>Unlock next day</button>
    </div>

    <div class="certificate" style="max-width:100%">
      <h2 style="font-size:16px">Add students</h2>
      <div class="tagline" style="text-align:left; margin-bottom:10px">One per line: <code>RollNo, Name, Password</code></div>
      <textarea id="roster-input" rows="6" style="width:100%; background:var(--ink-2); border:1px solid var(--ledger-line); color:var(--text); border-radius:4px; padding:10px; font-family:var(--mono); font-size:13px"></textarea>
      <button class="btn" id="add-students-btn" style="margin-top:12px">Add to roster</button>
      <div class="error-msg" id="roster-err"></div>
    </div>

    <div class="board" style="margin-top:24px">
      <table>
        <thead><tr><th>Student</th><th>Progress</th><th>Points</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No students yet — add some above.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  document.getElementById('unlock-btn').onclick = async () => {
    await db.collection('classes').doc(classId).update({ unlockedDay: Math.min(18, cls.unlockedDay + 1) });
    renderClassPanel(classId);
  };
  document.getElementById('lock-btn').onclick = async () => {
    await db.collection('classes').doc(classId).update({ unlockedDay: Math.max(1, cls.unlockedDay - 1) });
    renderClassPanel(classId);
  };
  document.getElementById('add-students-btn').onclick = async () => {
    const lines = document.getElementById('roster-input').value.split('\n').map(l => l.trim()).filter(Boolean);
    const errEl = document.getElementById('roster-err');
    if (!lines.length) { errEl.textContent = 'Paste at least one student row.'; return; }
    const batch = db.batch();
    let count = 0;
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 3) continue;
      const [rollNo, name, password] = parts;
      const ref = db.collection('classes').doc(classId).collection('students').doc(rollNo);
      batch.set(ref, { name, password }, { merge: true });
      count++;
    }
    if (!count) { errEl.textContent = 'Could not parse any rows. Use: RollNo, Name, Password'; return; }
    await batch.commit();
    renderClassPanel(classId);
  };
  panel.querySelectorAll('[data-remove]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Remove this student and their results?')) return;
      await db.collection('classes').doc(classId).collection('students').doc(b.dataset.remove).delete();
      renderClassPanel(classId);
    };
  });
}

boot();
