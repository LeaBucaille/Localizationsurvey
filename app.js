(function () {
  'use strict';

  var cfg = window.SURVEY_CONFIG;
  var DRAFT_KEY = 'survey-draft-' + cfg.surveyId;
  var DONE_KEY = 'survey-done-' + cfg.surveyId;
  var LANG_KEY = 'survey-lang';

  /* ------------------------------------------------------------------
     Textes de l'interface. Pour ajouter une langue, copiez un bloc et
     traduisez-le. Les langues absentes retombent sur l'anglais.
     Vous pouvez aussi surcharger un texte via cfg.strings.
     ------------------------------------------------------------------ */
  var UI = {
    en: {
      start: 'Start the survey',
      next: 'Next',
      back: 'Back',
      submit: 'Submit my answers',
      sending: 'Sending…',
      required: 'Please answer this question.',
      optional: 'optional',
      section: function (a, b) { return 'Section ' + a + ' of ' + b; },
      accessCode: 'Access code',
      accessCodeHelp: 'You received this code together with the survey link.',
      accessCodeMissing: 'Please enter the access code.',
      accessCodeWrong: 'The access code is not valid. Check it and try again.',
      select: 'Select…',
      sendError: 'Your answers could not be sent. Check your connection and try again. Your answers are kept on this device.',
      loadError: 'The survey could not be loaded. Please reload the page or contact the survey owner.',
      thanksTitle: 'Thank you',
      already: 'A response has already been sent from this browser. Thank you for taking part.',
      testMode: 'Test mode: no server is configured, so nothing was sent. This is what would have been recorded.',
      download: 'Download as JSON',
      language: 'Language',
      progress: 'Progress'
    },
    fr: {
      start: "Commencer l'enquête",
      next: 'Suivant',
      back: 'Retour',
      submit: 'Envoyer mes réponses',
      sending: 'Envoi en cours…',
      required: 'Merci de répondre à cette question.',
      optional: 'facultatif',
      section: function (a, b) { return 'Partie ' + a + ' sur ' + b; },
      accessCode: "Code d'accès",
      accessCodeHelp: "Ce code vous a été communiqué avec le lien de l'enquête.",
      accessCodeMissing: "Merci de saisir le code d'accès.",
      accessCodeWrong: "Le code d'accès n'est pas valide. Vérifiez-le et réessayez.",
      select: 'Choisir…',
      sendError: "Vos réponses n'ont pas pu être envoyées. Vérifiez votre connexion et réessayez. Vos réponses sont conservées sur cet appareil.",
      loadError: "L'enquête n'a pas pu être chargée. Rechargez la page ou contactez le responsable de l'enquête.",
      thanksTitle: 'Merci',
      already: 'Une réponse a déjà été envoyée depuis ce navigateur. Merci de votre participation.',
      testMode: "Mode test : aucun serveur n'est configuré, rien n'a été envoyé. Voici ce qui aurait été enregistré.",
      download: 'Télécharger en JSON',
      language: 'Langue',
      progress: 'Progression'
    }
  };

  var state = {
    lang: cfg.defaultLanguage,
    questions: [],
    sections: [],
    step: 0, // 0 = accueil, 1..n = parties, n+1 = fin
    answers: {},
    accessCode: '',
    startedAt: Date.now(),
    sending: false
  };

  var app = document.getElementById('app');

  /* ------------------------------ Utilitaires ------------------------------ */

  function t(key) {
    var table = (cfg.strings && cfg.strings[state.lang]) || UI[state.lang] || UI.en;
    var v = table[key];
    if (v === undefined) v = UI.en[key];
    if (typeof v === 'function') return v.apply(null, Array.prototype.slice.call(arguments, 1));
    return v;
  }

  // Renvoie le texte dans la langue courante, sinon la langue par défaut, sinon le premier disponible.
  function tr(obj) {
    if (obj === undefined || obj === null) return '';
    if (typeof obj === 'string' || typeof obj === 'number') return String(obj);
    if (Array.isArray(obj)) return obj;
    return obj[state.lang] || obj[cfg.defaultLanguage] || obj[Object.keys(obj)[0]] || '';
  }

  // Valeur enregistrée pour un choix : le libellé dans la langue par défaut,
  // pour que les résultats bruts soient lisibles quelle que soit la langue de réponse.
  function optionValue(opt) {
    if (typeof opt === 'string') return opt;
    return opt[cfg.defaultLanguage] || opt[Object.keys(opt)[0]] || '';
  }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'checked' || k === 'value' || k === 'disabled' || k === 'selected') el[k] = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }

  function store(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) { /* stockage indisponible : on continue sans */ }
  }
  function read(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }

  function saveDraft() {
    store(localStorage, DRAFT_KEY, JSON.stringify({
      answers: state.answers, step: state.step, startedAt: state.startedAt
    }));
  }

  function loadDraft() {
    var raw = read(localStorage, DRAFT_KEY);
    if (!raw) return;
    try {
      var d = JSON.parse(raw);
      if (d && typeof d.answers === 'object') {
        state.answers = d.answers;
        state.startedAt = d.startedAt || Date.now();
        // Le code d'accès n'est jamais stocké : si l'enquête en exige un, on repart de l'accueil
        // (les réponses déjà saisies sont conservées).
        state.step = cfg.requireAccessCode ? 0 : Math.min(d.step || 0, state.sections.length);
      }
    } catch (e) { /* brouillon illisible : ignoré */ }
  }

  function isAnswered(q) {
    var v = state.answers[q.id];
    if (q.type === 'multiple') return Array.isArray(v) && v.length > 0;
    if (q.type === 'text') return typeof v === 'string' && v.trim() !== '';
    return v !== undefined && v !== null && v !== '';
  }

  // Une question avec "showIf": {"id": "Q7a", "in": ["No"]} n'apparaît que si la réponse
  // à la question Q7a figure dans la liste.
  function isVisible(q) {
    if (!q.showIf) return true;
    var a = state.answers[q.showIf.id];
    var list = q.showIf['in'] || [];
    if (Array.isArray(a)) return a.some(function (v) { return list.indexOf(v) !== -1; });
    return list.indexOf(a) !== -1;
  }

  // Affiche / masque les questions conditionnelles de la partie courante.
  // Une question masquée perd sa réponse (pas de donnée résiduelle).
  function updateVisibility() {
    var section = state.sections[state.step - 1];
    if (!section) return;
    section.questions.forEach(function (q) {
      if (!q.showIf) return;
      var node = document.getElementById('q-' + q.id);
      if (!node) return;
      var show = isVisible(q);
      if (show && node.hidden) {
        node.hidden = false;
      } else if (!show && !node.hidden) {
        delete state.answers[q.id];
        var fresh = renderQuestion(q);
        fresh.hidden = true;
        node.parentNode.replaceChild(fresh, node);
        saveDraft();
      }
    });
  }

  /* ------------------------------ Découpage en parties ------------------------------ */

  function buildSections(questions) {
    var sections = [];
    var index = {};
    questions.forEach(function (q) {
      var key = q.section ? optionValue(q.section) : '';
      if (!(key in index)) {
        index[key] = sections.length;
        sections.push({ title: q.section || null, questions: [] });
      }
      sections[index[key]].questions.push(q);
    });
    return sections;
  }

  /* ------------------------------ Rendu des questions ------------------------------ */

  function renderQuestion(q) {
    var fs = h('fieldset', { 'class': 'q', id: 'q-' + q.id, tabindex: '-1' });
    var legend = h('legend', null, tr(q.text));
    if (!q.required) legend.appendChild(h('span', { 'class': 'opt-tag', text: '(' + t('optional') + ')' }));
    fs.appendChild(legend);

    if (q.hint) fs.appendChild(h('p', { 'class': 'hint', text: tr(q.hint) }));

    var err = h('p', { 'class': 'err', role: 'alert', hidden: true, text: t('required') });

    function onChange() {
      saveDraft();
      err.hidden = true;
      fs.classList.remove('has-error');
      updateVisibility();
    }

    var control;
    var opts = (q.options || []);

    if (q.type === 'single' && opts.length > 8) {
      var select = h('select', { 'class': 'field', 'aria-label': tr(q.text) },
        h('option', { value: '', text: t('select') }));
      opts.forEach(function (o) {
        var val = optionValue(o);
        select.appendChild(h('option', { value: val, text: tr(o), selected: state.answers[q.id] === val }));
      });
      select.addEventListener('change', function () {
        if (select.value === '') delete state.answers[q.id]; else state.answers[q.id] = select.value;
        onChange();
      });
      control = select;

    } else if (q.type === 'single') {
      control = h('div', null, opts.map(function (o) {
        var val = optionValue(o);
        var input = h('input', {
          type: 'radio', name: 'f-' + q.id, value: val, checked: state.answers[q.id] === val,
          onchange: function () { state.answers[q.id] = val; onChange(); }
        });
        return h('label', { 'class': 'choice' }, input, h('span', { text: tr(o) }));
      }));

    } else if (q.type === 'multiple') {
      var boxes = [];
      var exclusiveVals = opts.filter(function (o) { return o && o.exclusive; }).map(optionValue);
      var syncBoxes = function () {
        var cur = state.answers[q.id] || [];
        var atMax = q.maxSelect && cur.length >= q.maxSelect;
        boxes.forEach(function (b) {
          b.input.checked = cur.indexOf(b.val) !== -1;
          b.input.disabled = !!atMax && !b.input.checked && exclusiveVals.indexOf(b.val) === -1;
        });
      };
      control = h('div', null, opts.map(function (o) {
        var val = optionValue(o);
        var input = h('input', {
          type: 'checkbox', name: 'f-' + q.id, value: val,
          onchange: function (ev) {
            var list = (state.answers[q.id] || []).slice();
            var i = list.indexOf(val);
            if (ev.target.checked) {
              if (exclusiveVals.indexOf(val) !== -1) list = [val];
              else list = list.filter(function (v) { return exclusiveVals.indexOf(v) === -1; }).concat(i === -1 ? [val] : []);
            } else if (i !== -1) {
              list.splice(i, 1);
            }
            if (list.length) state.answers[q.id] = list; else delete state.answers[q.id];
            syncBoxes();
            onChange();
          }
        });
        boxes.push({ input: input, val: val });
        return h('label', { 'class': 'choice' }, input, h('span', { text: tr(o) }));
      }));
      syncBoxes();

    } else if (q.type === 'scale' || q.type === 'nps') {
      var min = q.type === 'nps' ? 0 : (q.min !== undefined ? Number(q.min) : 1);
      var max = q.type === 'nps' ? 10 : (q.max !== undefined ? Number(q.max) : 5);
      var pills = [];
      for (var n = min; n <= max; n++) {
        (function (num) {
          var input = h('input', {
            type: 'radio', name: 'f-' + q.id, value: String(num), checked: state.answers[q.id] === num,
            'aria-label': String(num),
            onchange: function () { state.answers[q.id] = num; onChange(); }
          });
          pills.push(h('label', { 'class': 'pill' }, input, h('span', { text: String(num) })));
        })(n);
      }
      var extras = (q.extraOptions || []).map(function (o) {
        var val = optionValue(o);
        var input = h('input', {
          type: 'radio', name: 'f-' + q.id, value: val, checked: state.answers[q.id] === val,
          onchange: function () { state.answers[q.id] = val; onChange(); }
        });
        return h('label', { 'class': 'choice extra' }, input, h('span', { text: tr(o) }));
      });
      control = h('div', { 'class': 'scale-wrap' },
        h('div', { 'class': 'scale' }, pills),
        (q.minLabel || q.maxLabel)
          ? h('div', { 'class': 'scale-ends' }, h('span', { text: tr(q.minLabel) }), h('span', { text: tr(q.maxLabel) }))
          : null,
        extras);

    } else { // text
      var ta = h('textarea', {
        'class': 'field', rows: '4', maxlength: '2000', 'aria-label': tr(q.text),
        value: state.answers[q.id] || ''
      });
      ta.addEventListener('input', function () {
        if (ta.value.trim() === '') delete state.answers[q.id]; else state.answers[q.id] = ta.value;
        onChange();
      });
      control = ta;
    }

    fs.appendChild(control);
    fs.appendChild(err);
    return fs;
  }

  function showError(q) {
    var fs = document.getElementById('q-' + q.id);
    if (!fs) return;
    fs.classList.add('has-error');
    fs.querySelector('.err').hidden = false;
  }

  /* ------------------------------ Écrans ------------------------------ */

  function setProgress() {
    var n = state.sections.length;
    var pct = 0;
    if (state.step >= 1 && state.step <= n) pct = ((state.step - 1) / n) * 100;
    if (state.step > n) pct = 100;
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress').setAttribute('aria-valuenow', String(Math.round(pct)));
    document.getElementById('progress').setAttribute('aria-label', t('progress'));
  }

  function render(focusHeading) {
    document.documentElement.lang = state.lang;
    document.title = tr(cfg.title);
    document.getElementById('brand').textContent = tr(cfg.title);
    var langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.previousElementSibling.textContent = t('language');
    setProgress();

    app.textContent = '';
    var n = state.sections.length;
    var screen;

    if (state.step === 0) screen = renderIntro();
    else if (state.step <= n) screen = renderSection(state.step - 1);
    else screen = renderDone();

    app.appendChild(screen);
    if (focusHeading) {
      var heading = app.querySelector('h1, h2');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    }
  }

  function renderIntro() {
    var wrap = h('div');
    wrap.appendChild(h('h1', { text: tr(cfg.title) }));
    [].concat(tr(cfg.intro)).forEach(function (para, i) {
      wrap.appendChild(h('p', { 'class': i === 0 ? 'lead' : null, text: para }));
    });
    if (cfg.duration) wrap.appendChild(h('p', { 'class': 'meta', text: tr(cfg.duration) }));

    var privacy = tr(cfg.privacy);
    if (privacy && privacy.length) {
      var list = Array.isArray(privacy) ? privacy : [privacy];
      wrap.appendChild(h('div', { 'class': 'notice' }, list.map(function (p) { return h('p', { text: p }); })));
    }

    var alreadyDone = read(localStorage, DONE_KEY) && !cfg.allowMultiple;
    if (alreadyDone) {
      wrap.appendChild(h('p', { 'class': 'lead', text: t('already') }));
      return wrap;
    }

    var codeInput = null;
    var codeErr = null;
    if (cfg.requireAccessCode) {
      codeInput = h('input', {
        'class': 'field', type: 'text', id: 'access-code', autocomplete: 'off',
        autocapitalize: 'off', spellcheck: 'false', value: state.accessCode,
        'aria-describedby': 'access-code-help'
      });
      codeErr = h('p', { 'class': 'err', role: 'alert', hidden: true, text: t('accessCodeMissing') });
      wrap.appendChild(h('div', { 'class': 'q' },
        h('label', { 'for': 'access-code' }, h('strong', { text: t('accessCode') })),
        h('p', { 'class': 'hint', id: 'access-code-help', text: t('accessCodeHelp') }),
        codeInput, codeErr));
    }

    wrap.appendChild(h('div', { 'class': 'nav' },
      h('span'),
      h('button', {
        type: 'button', 'class': 'btn',
        text: t('start'),
        onclick: function () {
          if (codeInput) {
            state.accessCode = codeInput.value.trim();
            if (!state.accessCode) { codeErr.hidden = false; codeInput.focus(); return; }
          }
          state.step = 1;
          saveDraft();
          render(true);
        }
      })));
    return wrap;
  }

  function renderSection(i) {
    var section = state.sections[i];
    var n = state.sections.length;
    var isLast = i === n - 1;
    var wrap = h('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); } });

    if (n > 1) wrap.appendChild(h('p', { 'class': 'meta', text: t('section', i + 1, n) }));
    if (section.title) wrap.appendChild(h('h2', { text: tr(section.title) }));
    else wrap.appendChild(h('h2', { text: tr(cfg.title) }));

    section.questions.forEach(function (q) {
      var node = renderQuestion(q);
      node.hidden = !isVisible(q);
      wrap.appendChild(node);
    });

    if (isLast) {
      // Champ piège anti-robots : invisible pour les humains.
      wrap.appendChild(h('div', { 'class': 'hp', 'aria-hidden': 'true' },
        h('input', { type: 'text', name: 'website', id: 'hp-field', tabindex: '-1', autocomplete: 'off' })));
    }

    var status = h('p', { 'class': 'status', role: 'status' });

    var nextBtn = h('button', {
      type: 'button', 'class': 'btn', text: isLast ? t('submit') : t('next'),
      onclick: function () {
        var firstInvalid = null;
        section.questions.forEach(function (q) {
          if (q.required && isVisible(q) && !isAnswered(q)) {
            showError(q);
            if (!firstInvalid) firstInvalid = q;
          }
        });
        if (firstInvalid) {
          var el = document.getElementById('q-' + firstInvalid.id);
          el.focus();
          el.scrollIntoView({ block: 'center' });
          return;
        }
        if (isLast) { submit(nextBtn, status); return; }
        state.step = i + 2;
        saveDraft();
        render(true);
      }
    });

    wrap.appendChild(h('div', { 'class': 'nav' },
      h('button', {
        type: 'button', 'class': 'btn secondary', text: t('back'),
        onclick: function () { state.step = i; saveDraft(); render(true); }
      }),
      nextBtn));
    wrap.appendChild(status);
    return wrap;
  }

  function renderDone() {
    var wrap = h('div');
    wrap.appendChild(h('h1', { text: t('thanksTitle') }));
    [].concat(tr(cfg.thanks)).forEach(function (para, i) {
      wrap.appendChild(h('p', { 'class': i === 0 ? 'lead' : null, text: para }));
    });
    return wrap;
  }

  /* ------------------------------ Envoi ------------------------------ */

  function buildPayload() {
    var hp = document.getElementById('hp-field');
    return {
      surveyId: cfg.surveyId,
      submissionId: state.submissionId || (state.submissionId = uuid()),
      submittedAt: new Date().toISOString(),
      lang: state.lang,
      durationSec: Math.round((Date.now() - state.startedAt) / 1000),
      accessCode: state.accessCode,
      website: hp ? hp.value : '',
      answers: visibleAnswers()
    };
  }

  // Ne garde que les réponses aux questions réellement affichées.
  function visibleAnswers() {
    var out = {};
    state.questions.forEach(function (q) {
      if (isVisible(q) && isAnswered(q)) out[q.id] = state.answers[q.id];
    });
    return out;
  }

  function finish() {
    store(localStorage, DONE_KEY, new Date().toISOString());
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignoré */ }
    state.step = state.sections.length + 1;
    render(true);
  }

  function submit(btn, status) {
    if (state.sending) return;
    var payload = buildPayload();
    status.className = 'status';
    status.textContent = '';

    if (!cfg.endpoint) { // mode test
      state.step = state.sections.length + 1;
      render(true);
      var json = JSON.stringify(payload, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var link = h('a', { 'class': 'btn secondary', href: URL.createObjectURL(blob), download: 'survey-test-response.json', text: t('download') });
      app.appendChild(h('div', { 'class': 'notice' }, h('p', { text: t('testMode') })));
      app.appendChild(h('pre', { 'class': 'result', text: json }));
      app.appendChild(h('p', null, link));
      return;
    }

    state.sending = true;
    btn.disabled = true;
    btn.textContent = t('sending');

    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 20000);

    fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (res.status === 401 || res.status === 403) throw new Error('code');
      if (!res.ok) throw new Error('http ' + res.status);
      finish();
    }).catch(function (e) {
      clearTimeout(timer);
      state.sending = false;
      btn.disabled = false;
      btn.textContent = t('submit');
      status.className = 'status error';
      status.textContent = (e && e.message === 'code') ? t('accessCodeWrong') : t('sendError');
    });
  }

  /* ------------------------------ Démarrage ------------------------------ */

  function pickLanguage() {
    var codes = cfg.languages.map(function (l) { return l.code; });
    var saved = read(localStorage, LANG_KEY);
    if (saved && codes.indexOf(saved) !== -1) return saved;
    var nav = (navigator.languages || [navigator.language || '']).map(function (l) { return l.slice(0, 2).toLowerCase(); });
    for (var i = 0; i < nav.length; i++) if (codes.indexOf(nav[i]) !== -1) return nav[i];
    return cfg.defaultLanguage;
  }

  function setupLanguageSelect() {
    var box = document.getElementById('lang-box');
    var select = document.getElementById('lang-select');
    if (cfg.languages.length < 2) return;
    cfg.languages.forEach(function (l) {
      select.appendChild(h('option', { value: l.code, text: l.label, selected: l.code === state.lang }));
    });
    select.addEventListener('change', function () {
      state.lang = select.value;
      store(localStorage, LANG_KEY, state.lang);
      render(false);
    });
    box.hidden = false;
  }

  function init() {
    state.lang = pickLanguage();
    fetch(cfg.questionsFile, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('questions'); return r.json(); })
      .then(function (data) {
        state.questions = data.questions || [];
        state.sections = buildSections(state.questions);
        loadDraft();
        setupLanguageSelect();
        render(false);
      })
      .catch(function () {
        app.textContent = '';
        app.appendChild(h('p', { 'class': 'err', role: 'alert', text: t('loadError') }));
      });
  }

  init();
})();
