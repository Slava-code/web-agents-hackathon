/**
 * BROWSER_USE // TERMINAL
 * Full trajectory tracking with live viewer.
 */

const presets = {
  'hacker-news': {
    task: 'Go to news.ycombinator.com and get the top 5 stories with their scores and number of comments. Format them as a numbered list.',
    url: 'https://news.ycombinator.com',
  },
  'wikipedia': {
    task: 'Go to wikipedia.org and find the "On this day" section on the English homepage. List 3 notable events mentioned.',
    url: 'https://en.wikipedia.org',
  },
  'weather': {
    task: 'Go to wttr.in and get the current weather summary for San Francisco.',
    url: 'https://wttr.in/San+Francisco',
  },
  'github': {
    task: 'Go to github.com/trending and list the top 3 trending repositories today with their descriptions and star counts.',
    url: 'https://github.com/trending',
  },
};

let allSteps = [];
let stepCount = 0;
let finalResult = null;

function loadPreset(name) {
  const p = presets[name];
  if (!p) return;
  document.getElementById('taskInput').value = p.task;
  document.getElementById('urlInput').value = p.url;
  document.getElementById('taskInput').focus();
}

function setStatus(state, text) {
  document.getElementById('statusDot').className = 'status-indicator ' + state;
  document.getElementById('statusText').textContent = text;
}

function updateTimestamp() {
  const now = new Date();
  document.getElementById('timestamp').textContent =
    now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

/**
 * Derive a human-readable description for a step.
 * Priority: next_goal > parsed action summary > memory snippet > fallback
 */
function getStepDescription(data) {
  if (data.next_goal && data.next_goal.trim()) return data.next_goal;

  // Try to extract action summary
  if (data.actions && data.actions.length > 0) {
    for (const raw of data.actions) {
      try {
        const action = JSON.parse(raw);
        if (action.done && action.done.text) return action.done.text;
        // Describe other action types
        const keys = Object.keys(action);
        if (keys.length > 0) {
          const type = keys[0];
          const detail = action[type];
          if (type === 'click_element') return `Click element #${detail.index}`;
          if (type === 'input_text') return `Type "${(detail.text || '').slice(0, 50)}"`;
          if (type === 'go_to_url') return `Navigate to ${detail.url || ''}`;
          if (type === 'scroll_down') return 'Scroll down';
          if (type === 'scroll_up') return 'Scroll up';
          if (type === 'extract_content') return 'Extract page content';
          if (type === 'wait') return 'Wait';
          return type.replace(/_/g, ' ');
        }
      } catch { /* not JSON */ }
    }
  }

  // Fall back to memory snippet
  if (data.memory && data.memory.trim()) {
    const mem = data.memory.trim();
    return mem.length > 120 ? mem.slice(0, 120) + '...' : mem;
  }

  return 'Processing...';
}

/* ---- Tabs ---- */
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
}

/* ---- Live Viewer ---- */
function showLiveViewer(url) {
  const frame = document.getElementById('liveFrame');
  frame.src = url;
  frame.style.display = 'block';
  document.getElementById('viewerPlaceholder').style.display = 'none';
  document.getElementById('liveDot').classList.add('live');
}

/* ---- Sidebar Step (live tab) ---- */
function addSidebarStep(data) {
  const container = document.getElementById('sidebarSteps');
  if (container.querySelector('.sidebar-empty')) container.innerHTML = '';

  const desc = getStepDescription(data);

  const el = document.createElement('div');
  el.className = 'sidebar-step';
  el.onclick = () => {
    switchTab('trajectory');
    const trajEl = document.getElementById('traj-step-' + data.number);
    if (trajEl) {
      trajEl.classList.add('open');
      trajEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  el.innerHTML = `
    <div class="sidebar-step-num">STEP ${String(data.number).padStart(2, '0')}</div>
    <div class="sidebar-step-goal">${escapeHtml(desc)}</div>
    ${data.url ? `<div class="sidebar-step-url">${escapeHtml(data.url)}</div>` : ''}
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

/* ---- Show final output on the sidebar ---- */
function showFinalOutputInSidebar(output) {
  const container = document.getElementById('sidebarSteps');
  const card = document.createElement('div');
  card.className = 'final-output-card';
  card.innerHTML = `
    <div class="final-label">FINAL OUTPUT</div>
    <div class="final-text">${escapeHtml(output)}</div>
  `;
  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

/* ---- Trajectory Step ---- */
function addTrajectoryStep(data) {
  const container = document.getElementById('trajectoryContainer');
  const empty = document.getElementById('trajEmpty');
  if (empty) empty.remove();

  const desc = getStepDescription(data);

  const el = document.createElement('div');
  el.className = 'traj-step';
  el.id = 'traj-step-' + data.number;

  // Parse actions into readable format
  let actionsHtml = '';
  if (data.actions && data.actions.length > 0) {
    const parsed = data.actions.map(a => {
      try { return JSON.stringify(JSON.parse(a), null, 2); } catch { return a; }
    }).join('\n');
    actionsHtml = `
      <div class="traj-section">
        <div class="traj-section-label">Actions Performed</div>
        <div class="traj-section-content actions">${escapeHtml(parsed)}</div>
      </div>`;
  }

  el.innerHTML = `
    <div class="traj-step-header" onclick="this.parentElement.classList.toggle('open')">
      <div class="traj-step-num">STEP ${String(data.number).padStart(2, '0')}</div>
      <div class="traj-step-summary">
        <div class="traj-step-goal">${escapeHtml(desc)}</div>
        <div class="traj-step-meta">${escapeHtml(data.url || '')}</div>
      </div>
      ${data.screenshot_url ? `
        <div class="traj-step-thumb" onclick="event.stopPropagation(); openLightbox('${data.screenshot_url}', 'Step ${data.number}')">
          <img src="${data.screenshot_url}" alt="Step ${data.number}" loading="lazy" />
        </div>` : ''}
      <div class="traj-step-arrow">&#9654;</div>
    </div>
    <div class="traj-step-body">
      ${data.evaluation_previous_goal ? `
        <div class="traj-section">
          <div class="traj-section-label">Evaluation of Previous Goal</div>
          <div class="traj-section-content eval">${escapeHtml(data.evaluation_previous_goal)}</div>
        </div>` : ''}

      ${data.next_goal ? `
        <div class="traj-section">
          <div class="traj-section-label">Next Goal</div>
          <div class="traj-section-content">${escapeHtml(data.next_goal)}</div>
        </div>` : ''}

      ${data.memory ? `
        <div class="traj-section">
          <div class="traj-section-label">Agent Memory / Reasoning</div>
          <div class="traj-section-content memory">${escapeHtml(data.memory)}</div>
        </div>` : ''}

      ${actionsHtml}

      <div class="traj-section">
        <div class="traj-section-label">URL</div>
        <div class="traj-section-content">${escapeHtml(data.url || '--')}</div>
      </div>

      ${data.screenshot_url ? `
        <div class="traj-screenshot">
          <img src="${data.screenshot_url}" alt="Step ${data.number} screenshot"
            onclick="openLightbox('${data.screenshot_url}', 'Step ${data.number}: ${escapeHtml(desc)}')" />
        </div>` : ''}
    </div>
  `;
  container.appendChild(el);
}

/* ---- Backfill missing trajectory steps from final result ---- */
function backfillTrajectory(steps) {
  const knownNumbers = new Set(allSteps.map(s => s.number));
  for (const s of steps) {
    if (!knownNumbers.has(s.number)) {
      allSteps.push(s);
      addTrajectoryStep(s);
    } else {
      const existing = allSteps.find(e => e.number === s.number);
      if (existing && !existing.screenshot_url && s.screenshot_url) {
        existing.screenshot_url = s.screenshot_url;
        const el = document.getElementById('traj-step-' + s.number);
        if (el) {
          const header = el.querySelector('.traj-step-header');
          const arrow = header.querySelector('.traj-step-arrow');
          if (!header.querySelector('.traj-step-thumb') && s.screenshot_url) {
            const thumb = document.createElement('div');
            thumb.className = 'traj-step-thumb';
            thumb.onclick = (e) => { e.stopPropagation(); openLightbox(s.screenshot_url, 'Step ' + s.number); };
            thumb.innerHTML = `<img src="${s.screenshot_url}" alt="Step ${s.number}" loading="lazy" />`;
            header.insertBefore(thumb, arrow);
          }
          const body = el.querySelector('.traj-step-body');
          if (body && !body.querySelector('.traj-screenshot') && s.screenshot_url) {
            const div = document.createElement('div');
            div.className = 'traj-screenshot';
            div.innerHTML = `<img src="${s.screenshot_url}" alt="Step ${s.number}" onclick="openLightbox('${s.screenshot_url}', 'Step ${s.number}')" />`;
            body.appendChild(div);
          }
        }
      }
    }
  }
}

/* ---- Summary Bar ---- */
function showSummary(data) {
  const bar = document.getElementById('summaryBar');
  bar.style.display = 'flex';

  document.getElementById('sumLlm').textContent = data.llm || '--';
  document.getElementById('sumSteps').textContent = allSteps.length;
  document.getElementById('sumCost').textContent = data.cost ? '$' + data.cost : '--';
  document.getElementById('costDisplay').textContent = data.cost ? '$' + data.cost : '--';

  if (data.started_at && data.finished_at && data.started_at !== 'None' && data.finished_at !== 'None') {
    const start = new Date(data.started_at);
    const end = new Date(data.finished_at);
    const sec = ((end - start) / 1000).toFixed(1);
    document.getElementById('sumTime').textContent = sec + 's';
  }

  const verdict = document.getElementById('sumVerdict');
  if (data.judge_verdict === true) {
    verdict.innerHTML = 'JUDGE: <span class="highlight" style="color: var(--phosphor);">PASS</span>';
  } else if (data.judge_verdict === false) {
    verdict.innerHTML = 'JUDGE: <span class="highlight" style="color: var(--red);">FAIL</span>';
  }
}

/* ---- Raw Log ---- */
function addLogEntry(type, prefix, bodyHTML) {
  const output = document.getElementById('rawLog');
  const welcome = output.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry log-type-${type}`;
  entry.innerHTML = `
    <span class="log-prefix">${prefix}</span>
    <div class="log-body">${bodyHTML}</div>
  `;
  output.appendChild(entry);
  output.scrollTop = output.scrollHeight;
}

function addTypingIndicator(target) {
  const container = document.getElementById(target || 'rawLog');
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.id = 'typing-' + (target || 'rawLog');
  indicator.innerHTML = `<span></span><span></span><span></span><span class="typing-text">AGENT WORKING</span>`;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator(target) {
  const el = document.getElementById('typing-' + (target || 'rawLog'));
  if (el) el.remove();
}

/* ---- Lightbox ---- */
function openLightbox(src, caption) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxCaption').textContent = caption;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

/* ---- Reset ---- */
function clearAll() {
  allSteps = [];
  stepCount = 0;
  finalResult = null;

  document.getElementById('stepCount').textContent = '0';
  document.getElementById('sessionId').textContent = '--';
  document.getElementById('taskId').textContent = '--';
  document.getElementById('costDisplay').textContent = '--';
  document.getElementById('trajBadge').textContent = '0';
  document.getElementById('summaryBar').style.display = 'none';

  document.getElementById('liveFrame').style.display = 'none';
  document.getElementById('liveFrame').src = '';
  document.getElementById('viewerPlaceholder').style.display = 'flex';
  document.getElementById('liveDot').classList.remove('live');
  document.getElementById('sidebarSteps').innerHTML = '<div class="sidebar-empty">Waiting for agent...</div>';

  document.getElementById('trajectoryContainer').innerHTML = '<div class="traj-empty" id="trajEmpty"><p>No trajectory data yet.</p></div>';

  document.getElementById('rawLog').innerHTML = '';
}

/* ---- Execute ---- */
async function executeTask() {
  const taskInput = document.getElementById('taskInput');
  const urlInput = document.getElementById('urlInput');
  const btn = document.getElementById('executeBtn');

  const task = taskInput.value.trim();
  if (!task) { taskInput.focus(); return; }

  btn.disabled = true;
  clearAll();
  switchTab('live');
  setStatus('active', 'RUNNING');
  updateTimestamp();

  addLogEntry('created', 'INIT', '<span class="log-goal">Dispatching agent...</span>');
  addTypingIndicator('rawLog');

  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, start_url: urlInput.value.trim() || undefined }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Server error');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);
          removeTypingIndicator('rawLog');
          updateTimestamp();

          if (data.type === 'session') {
            document.getElementById('sessionId').textContent = data.session_id?.slice(0, 8) || '--';
            if (data.live_url) {
              showLiveViewer(data.live_url);
              addLogEntry('session', 'SESSION', `
                <span class="log-goal">Live browser session started</span>
                <div class="log-url">${escapeHtml(data.live_url)}</div>
              `);
            } else {
              addLogEntry('session', 'SESSION', '<span class="log-goal">Session created (no live URL)</span>');
            }
            addTypingIndicator('rawLog');
          }

          else if (data.type === 'created') {
            document.getElementById('taskId').textContent = data.task_id?.slice(0, 8) || '--';
            addLogEntry('created', 'TASK', `<span class="log-goal">Agent deployed</span> <span class="dim">${data.task_id || ''}</span>`);
            addTypingIndicator('rawLog');
          }

          else if (data.type === 'step') {
            stepCount++;
            document.getElementById('stepCount').textContent = stepCount;
            document.getElementById('trajBadge').textContent = stepCount;

            allSteps.push(data);
            addSidebarStep(data);
            addTrajectoryStep(data);

            const desc = getStepDescription(data);
            addLogEntry('step', `S${String(data.number).padStart(2, '0')}`, `
              <div class="log-goal">${escapeHtml(desc)}</div>
              ${data.url ? `<div class="log-url">${escapeHtml(data.url)}</div>` : ''}
            `);
            addTypingIndicator('rawLog');
          }

          else if (data.type === 'done') {
            finalResult = data;
            const isSuccess = data.is_success !== false && data.status !== 'failed';

            document.getElementById('liveDot').classList.remove('live');

            if (data.steps) backfillTrajectory(data.steps);
            document.getElementById('trajBadge').textContent = allSteps.length;

            showSummary(data);

            // Show output prominently in the sidebar
            if (data.output) {
              showFinalOutputInSidebar(data.output);
            }

            // Also add a final output card to the trajectory view
            if (data.output) {
              const container = document.getElementById('trajectoryContainer');
              const card = document.createElement('div');
              card.className = 'final-output-card';
              card.innerHTML = `
                <div class="final-label">FINAL OUTPUT</div>
                <div class="final-text">${escapeHtml(data.output)}</div>
              `;
              container.appendChild(card);
            }

            addLogEntry('done', 'DONE', `
              <span class="log-status ${isSuccess ? 'success' : 'failed'}">${isSuccess ? 'COMPLETE' : 'FAILED'}</span>
              ${data.output ? `<div class="log-output">${escapeHtml(data.output)}</div>` : ''}
              ${data.cost ? `<div class="log-url">Cost: $${escapeHtml(data.cost)}</div>` : ''}
              ${data.suggestions ? `<div class="log-url">Suggestions: ${escapeHtml(JSON.stringify(data.suggestions))}</div>` : ''}
            `);

            setStatus(isSuccess ? 'success' : 'error', isSuccess ? 'COMPLETE' : 'FAILED');
          }

        } catch (parseErr) { /* skip */ }
      }
    }
  } catch (err) {
    removeTypingIndicator('rawLog');
    addLogEntry('error', 'FATAL', `<span class="log-goal" style="color:var(--red)">${escapeHtml(err.message)}</span>`);
    setStatus('error', 'ERROR');
  } finally {
    btn.disabled = false;
    removeTypingIndicator('rawLog');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); executeTask(); }
  if (e.key === 'Escape') closeLightbox();
});

setInterval(updateTimestamp, 100);
updateTimestamp();
