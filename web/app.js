/* ============================================================
   X-Ray Comparison — app.js
   3 Brands + 3-way Compare + Version badge
   ============================================================ */

console.log("app.js v1.4.0 loaded — 3 brands, 3-way compare");

/* ---------- Version ---------- */
fetch('VERSION.txt?t=' + Date.now())
  .then(r => { if (!r.ok) throw new Error('no version'); return r.text(); })
  .then(v => {
    const cleanVersion = v.trim();
    const badge = document.getElementById('version_badge');
    const footer = document.getElementById('footer_version');
    if (badge) badge.textContent = 'v' + cleanVersion;
    if (footer) footer.textContent = 'v' + cleanVersion;
  })
  .catch(err => console.log('Version skipped:', err.message));

/* ============================================================
   State
   ============================================================ */
const modelsContainer = document.getElementById('models');
const detailContainer = document.getElementById('detail');
const compareView = document.getElementById('compareView');
const slot1 = document.getElementById('slot1');
const slot2 = document.getElementById('slot2');
const slot3 = document.getElementById('slot3');
const btnCompareNow = document.getElementById('btnCompareNow');
const btnCompareClear = document.getElementById('btnCompareClear');

let currentLang = 'en';
let currentBrand = 'Wipotec';
let currentModelIndex = null;
let compareSelection = []; // [{brand, index}]

const MAX_COMPARE = 3;

function getCurrentModels() {
  if (currentBrand === 'Wipotec') return modelsWipotec;
  if (currentBrand === 'Mettler-Toledo') return modelsMettlerToledo;
  return modelsIshida;
}
function getModel(brand, index) {
  if (brand === 'Wipotec') return modelsWipotec[index];
  if (brand === 'Mettler-Toledo') return modelsMettlerToledo[index];
  return modelsIshida[index];
}
function getBrandShort(brand) {
  if (brand === 'Wipotec') return 'WIPOTEC';
  if (brand === 'Mettler-Toledo') return 'MT';
  return 'ISHIDA';
}
function getBrandLogo(brand) {
  if (brand === 'Wipotec') return 'wipotec-logo.png';
  if (brand === 'Mettler-Toledo') return 'mt-logo.png';
  return 'ishida-logo.png';
}
function getBrandLabel(brand) {
  if (brand === 'Wipotec') return 'WIPOTEC';
  if (brand === 'Mettler-Toledo') return 'Mettler-Toledo';
  return 'Ishida';
}

/* ============================================================
   Render cards
   ============================================================ */
function renderCards() {
  modelsContainer.innerHTML = '';
  const list = getCurrentModels();

  list.forEach((model, index) => {
    const card = document.createElement('div');
    card.className = 'model-card';
    card.dataset.index = index;
    card.dataset.brand = currentBrand;

    const isSelected = compareSelection.some(
      s => s.brand === currentBrand && s.index === index
    );
    if (isSelected) card.classList.add('selected-for-compare');

    card.innerHTML = `
      <button class="btn-compare-toggle" title="Add to compare" data-index="${index}">
        ${isSelected ? '✓' : '+'}
      </button>
      <span class="card-name">${model.name}</span>
      <span class="tag"></span>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-compare-toggle')) {
        e.stopPropagation();
        toggleCompare(index, card);
        return;
      }
      showDetail(index, card);
    });

    modelsContainer.appendChild(card);
  });

  updateCardText();
}

function updateCardText() {
  const list = getCurrentModels();
  document.querySelectorAll('.model-card').forEach((card, i) => {
    const model = list[i];
    if (!model) return;
    const nameEl = card.querySelector('.card-name');
    const tagEl = card.querySelector('.tag');
    if (nameEl) nameEl.textContent = model.name;
    if (tagEl) tagEl.textContent = translateValue(model.tag);
  });
}

/* ============================================================
   Brand switch
   ============================================================ */
document.querySelectorAll('.brand-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentBrand = btn.dataset.brand;
    currentModelIndex = null;

    document.querySelectorAll('.brand-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.brand === currentBrand);
    });

    compareView.style.display = 'none';
    detailContainer.innerHTML = `
      <div class="placeholder">
        <span class="arrow">▲</span>
        ${t('placeholder')}
      </div>`;

    renderCards();
    updateCompareTray();
  });
});

/* ---------- Translate ---------- */
function t(key) { return translations[currentLang][key] || key; }
function tLabel(key) { return translations[currentLang].labels[key] || key; }
function translateValue(value) {
  let result = value;
  const map = translations[currentLang].values || {};
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  keys.forEach(enTerm => {
    const escaped = enTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    result = result.replace(regex, map[enTerm]);
  });
  return result;
}

/* ---------- Apply language ---------- */
function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });

  updateCardText();
  updateCompareTray();

  if (currentModelIndex !== null && compareView.style.display === 'none') {
    const activeCard = document.querySelector('.model-card.active');
    showDetail(currentModelIndex, activeCard);
  } else if (currentModelIndex === null && compareView.style.display === 'none') {
    detailContainer.innerHTML = `
      <div class="placeholder">
        <span class="arrow">▲</span>
        ${t('placeholder')}
      </div>`;
  }

  if (compareView.style.display !== 'none' && compareSelection.length >= 2) {
    showCompare();
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  document.documentElement.lang = currentLang;
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLang = btn.dataset.lang;
    applyLanguage();
  });
});

/* ============================================================
   Detail view
   ============================================================ */
function showDetail(index, cardEl) {
  currentModelIndex = index;
  compareView.style.display = 'none';

  document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));
  if (cardEl) cardEl.classList.add('active');

  const model = getCurrentModels()[index];

  let imageBlock = '';
  if (model.image && model.image.trim() !== '') {
    imageBlock = `
      <div class="product-image">
        <img src="${model.image}" alt="${model.name}"
             onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'>${t('noImage')}</div>'">
      </div>`;
  } else {
    imageBlock = `
      <div class="product-image">
        <div class="no-image">${t('noImage')}</div>
      </div>`;
  }

  /* Brand logo banner */
  let bannerLogo = 'wipotec-logo.png';
  let bannerAlt = 'WIPOTEC';
  if (currentBrand === 'Mettler-Toledo') { bannerLogo = 'mt-logo.png'; bannerAlt = 'Mettler-Toledo'; }
  else if (currentBrand === 'Ishida') { bannerLogo = 'ishida-logo.png'; bannerAlt = 'Ishida'; }
  const brandBannerHTML = `<div class="detail-brand-banner"><img src="${bannerLogo}" alt="${bannerAlt}"></div>`;

  /* Specs */
  let rows = '';
  for (const [labelKey, value] of Object.entries(model.specs)) {
    const translatedLabel = tLabel(labelKey);
    const translatedValue = value.replace(/>([^<]+)</g, (m, text) => `>${translateValue(text)}<`);
    const finalValue = translatedValue.includes('<')
      ? translatedValue
      : translateValue(translatedValue);

    rows += `
      <div class="spec-row">
        <div class="spec-label">${translatedLabel}</div>
        <div class="spec-value">${finalValue}</div>
      </div>`;
  }

  detailContainer.innerHTML = `
    <div class="detail">
      <div class="detail-header">
        <h2>${model.name}</h2>
        <span class="badge-orient">${translateValue(model.tag)}</span>
      </div>
      ${brandBannerHTML}
      ${imageBlock}
      ${rows}
    </div>`;
}

/* ============================================================
   Compare Mode (3-way)
   ============================================================ */
function toggleCompare(index, cardEl) {
  const pos = compareSelection.findIndex(
    s => s.brand === currentBrand && s.index === index
  );

  if (pos >= 0) {
    compareSelection.splice(pos, 1);
    cardEl.classList.remove('selected-for-compare');
    const btn = cardEl.querySelector('.btn-compare-toggle');
    if (btn) btn.textContent = '+';
  } else {
    if (compareSelection.length >= MAX_COMPARE) {
      alert(t('compareAlert'));
      return;
    }
    compareSelection.push({ brand: currentBrand, index: index });
    cardEl.classList.add('selected-for-compare');
    const btn = cardEl.querySelector('.btn-compare-toggle');
    if (btn) btn.textContent = '✓';
  }

  updateCompareTray();
}

function updateCompareTray() {
  [slot1, slot2, slot3].forEach((slot, i) => {
    if (compareSelection[i]) {
      const s = compareSelection[i];
      const m = getModel(s.brand, s.index);
      slot.textContent = `${m.name} (${getBrandShort(s.brand)})`;
      slot.classList.add('filled');
    } else {
      slot.textContent = t('compareEmpty');
      slot.classList.remove('filled');
    }
  });

  /* Enable if at least 2 selected */
  btnCompareNow.disabled = compareSelection.length < 2;
}

btnCompareNow.addEventListener('click', () => {
  if (compareSelection.length < 2) return;
  showCompare();
});

btnCompareClear.addEventListener('click', () => {
  compareSelection = [];
  document.querySelectorAll('.model-card').forEach(card => {
    card.classList.remove('selected-for-compare');
    const btn = card.querySelector('.btn-compare-toggle');
    if (btn) btn.textContent = '+';
  });
  updateCompareTray();
  compareView.style.display = 'none';
  if (currentModelIndex === null) {
    detailContainer.innerHTML = `
      <div class="placeholder">
        <span class="arrow">▲</span>
        ${t('placeholder')}
      </div>`;
  }
});

function showCompare() {
  if (compareSelection.length < 2) return;

  const isThree = compareSelection.length === 3;

  detailContainer.innerHTML = '';
  document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));

  /* Models array */
  const items = compareSelection.map(s => {
    const m = getModel(s.brand, s.index);
    return { s, m, brandLabel: getBrandLabel(s.brand), logo: getBrandLogo(s.brand) };
  });

  /* Collect all keys */
  const allKeys = [...Object.keys(items[0].m.specs)];
  items.slice(1).forEach(item => {
    Object.keys(item.m.specs).forEach(k => {
      if (!allKeys.includes(k)) allKeys.push(k);
    });
  });

  /* Build rows */
  let rows = '';
  allKeys.forEach(labelKey => {
    const values = items.map(item => {
      const raw = item.m.specs[labelKey] || '—';
      const translated = raw.replace(/>([^<]+)</g, (m, text) => `>${translateValue(text)}<`);
      const plain = raw.replace(/<[^>]*>/g, '').trim();
      return { raw, translated, plain };
    });

    /* Check if all values same */
    const firstPlain = values[0].plain;
    const allSame = values.every(v => v.plain === firstPlain);

    const cells = values.map(v =>
      `<td class="${allSame ? '' : 'different'}">${v.translated}</td>`
    ).join('');

    rows += `
      <tr>
        <th>${tLabel(labelKey)}</th>
        ${cells}
      </tr>`;
  });

  /* Images */
  const imageCells = items.map(item => {
    const img = item.m.image
      ? `<img src="${item.m.image}" alt="${item.m.name}" onerror="this.style.display='none'">`
      : `<div class="no-image">${t('noImage')}</div>`;
    return `
      <div class="compare-image-cell">
        ${img}
        <div class="model-name">${item.m.name}</div>
        <div class="brand-label">${item.brandLabel}</div>
      </div>`;
  }).join('');

  /* Table headers */
  const thCells = items.map(item =>
    `<th>
      <div class="th-model-name">${item.m.name}</div>
      <div class="th-brand-logo"><img src="${item.logo}" alt="${item.brandLabel}"></div>
    </th>`
  ).join('');

  compareView.innerHTML = `
    <div class="compare-view">
      <div class="compare-view-header">
        <h2>${t('compareTitle')}</h2>
        <button class="btn-close-compare" id="btnCloseCompare">✕ ${t('compareClose')}</button>
      </div>
      <div class="compare-images ${isThree ? 'compare-3' : ''}">
        ${imageCells}
      </div>
      <table class="compare-table ${isThree ? 'compare-3' : ''}">
        <thead>
          <tr>
            <th></th>
            ${thCells}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  compareView.style.display = 'block';

  document.getElementById('btnCloseCompare').addEventListener('click', () => {
    compareView.style.display = 'none';
    if (currentModelIndex !== null) {
      const activeCard = document.querySelector('.model-card.active');
      showDetail(currentModelIndex, activeCard);
    } else {
      detailContainer.innerHTML = `
        <div class="placeholder">
          <span class="arrow">▲</span>
          ${t('placeholder')}
        </div>`;
    }
  });

  compareView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   Start
   ============================================================ */
renderCards();
applyLanguage();