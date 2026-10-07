/* ============================================================
   X-Ray Comparison — app.js
   4 Brands + 4-way Compare + Export PDF
   ============================================================ */

console.log("app.js v1.7.0 loaded — 4 brands + 4-way Compare + Export PDF");

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
const slot4 = document.getElementById('slot4');
const btnCompareNow = document.getElementById('btnCompareNow');
const btnCompareClear = document.getElementById('btnCompareClear');

let currentLang = 'en';
let currentBrand = 'Wipotec';
let currentModelIndex = null;
let compareSelection = [];

const MAX_COMPARE = 4;

function getCurrentModels() {
  if (currentBrand === 'Wipotec') return modelsWipotec;
  if (currentBrand === 'Mettler-Toledo') return modelsMettlerToledo;
  if (currentBrand === 'Ishida') return modelsIshida;
  return [...modelsAnritsu, ...modelsXR76];
}
function getModel(brand, index) {
  if (brand === 'Wipotec') return modelsWipotec[index];
  if (brand === 'Mettler-Toledo') return modelsMettlerToledo[index];
  if (brand === 'Ishida') return modelsIshida[index];
  return [...modelsAnritsu, ...modelsXR76][index];
}
function getBrandShort(brand) {
  if (brand === 'Wipotec') return 'WIPOTEC';
  if (brand === 'Mettler-Toledo') return 'MT';
  if (brand === 'Ishida') return 'ISHIDA';
  return 'ANRITSU';
}
function getBrandLogo(brand) {
  if (brand === 'Wipotec') return 'wipotec-logo.png';
  if (brand === 'Mettler-Toledo') return 'mt-logo.png';
  if (brand === 'Ishida') return 'ishida-logo.png';
  return 'anritsu-logo.png';
}
function getBrandLabel(brand) {
  if (brand === 'Wipotec') return 'WIPOTEC';
  if (brand === 'Mettler-Toledo') return 'Mettler-Toledo';
  if (brand === 'Ishida') return 'Ishida';
  return 'Anritsu';
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

  let bannerLogo = 'wipotec-logo.png';
  let bannerAlt = 'WIPOTEC';
  if (currentBrand === 'Mettler-Toledo') { bannerLogo = 'mt-logo.png'; bannerAlt = 'Mettler-Toledo'; }
  else if (currentBrand === 'Ishida') { bannerLogo = 'ishida-logo.png'; bannerAlt = 'Ishida'; }
  else if (currentBrand === 'Anritsu') { bannerLogo = 'anritsu-logo.png'; bannerAlt = 'Anritsu'; }
  const brandBannerHTML = `<div class="detail-brand-banner"><img src="${bannerLogo}" alt="${bannerAlt}"></div>`;

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
   Compare Mode (4-way)
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
  [slot1, slot2, slot3, slot4].forEach((slot, i) => {
    if (!slot) return;
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

  const itemCount = compareSelection.length;
  const isFour = itemCount === 4;
  const isThree = itemCount === 3;

  detailContainer.innerHTML = '';
  document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));

  const items = compareSelection.map(s => {
    const m = getModel(s.brand, s.index);
    return { s, m, brandLabel: getBrandLabel(s.brand), logo: getBrandLogo(s.brand) };
  });

  const allKeys = [...Object.keys(items[0].m.specs)];
  items.slice(1).forEach(item => {
    Object.keys(item.m.specs).forEach(k => {
      if (!allKeys.includes(k)) allKeys.push(k);
    });
  });

  let rows = '';
  allKeys.forEach(labelKey => {
    const values = items.map(item => {
      const raw = item.m.specs[labelKey] || '—';
      const translated = raw.replace(/>([^<]+)</g, (m, text) => `>${translateValue(text)}<`);
      const plain = raw.replace(/<[^>]*>/g, '').trim();
      return { raw, translated, plain };
    });

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

  const thCells = items.map(item =>
    `<th>
      <div class="th-model-name">${item.m.name}</div>
      <div class="th-brand-logo"><img src="${item.logo}" alt="${item.brandLabel}"></div>
    </th>`
  ).join('');

  let compareClass = '';
  if (isFour) compareClass = 'compare-4';
  else if (isThree) compareClass = 'compare-3';

  compareView.innerHTML = `
    <div class="compare-view">
      <div class="compare-view-header">
        <h2>${t('compareTitle')}</h2>
        <div class="compare-view-header-actions">
          <button class="btn-export-pdf" id="btnExportPdf">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ${t('exportPdf')}
          </button>
          <button class="btn-close-compare" id="btnCloseCompare">✕ ${t('compareClose')}</button>
        </div>
      </div>
      <div class="compare-images ${compareClass}">
        ${imageCells}
      </div>
      <table class="compare-table ${compareClass}">
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

  document.getElementById('btnExportPdf').addEventListener('click', () => {
    exportComparePDF(items, itemCount);
  });

  compareView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   Export Compare as PDF
   ============================================================ */
function exportComparePDF(items, itemCount) {
  const btn = document.getElementById('btnExportPdf');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Generating...';

  try {
    const printWindow = window.open('', '_blank');

    let rows = '';
    const allKeys = [...Object.keys(items[0].m.specs)];
    items.slice(1).forEach(item => {
      Object.keys(item.m.specs).forEach(k => {
        if (!allKeys.includes(k)) allKeys.push(k);
      });
    });

    allKeys.forEach(labelKey => {
      const values = items.map(item => {
        const raw = item.m.specs[labelKey] || '—';
        const plain = raw.replace(/<[^>]*>/g, '').trim();
        return { raw, plain };
      });
      const firstPlain = values[0].plain;
      const allSame = values.every(v => v.plain === firstPlain);

      const cells = values.map(v =>
        `<td class="${allSame ? '' : 'different'}">${v.raw}</td>`
      ).join('');

      rows += `<tr><th>${tLabel(labelKey)}</th>${cells}</tr>`;
    });

    const imageCells = items.map(item => {
      const img = item.m.image
        ? `<img src="${window.location.origin}/${item.m.image}" alt="${item.m.name}" crossorigin="anonymous">`
        : `<div class="no-img">No image</div>`;
      return `
        <div class="img-cell">
          ${img}
          <div class="model-name">${item.m.name}</div>
          <div class="brand-label">${item.brandLabel}</div>
        </div>`;
    }).join('');

    const thCells = items.map(item =>
      `<th>
        <div class="th-name">${item.m.name}</div>
        <div class="th-brand"><img src="${window.location.origin}/${item.logo}" alt="${item.brandLabel}"></div>
      </th>`
    ).join('');

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>X-Ray Comparison - ${dateStr}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15px; color: #222; }
          .header {
            display: flex; align-items: center; gap: 20px;
            border-bottom: 3px solid #009999; padding-bottom: 12px; margin-bottom: 15px;
          }
          .header img { height: 36px; }
          .header h1 { font-size: 18px; color: #007a7a; }
          .header .date { margin-left: auto; font-size: 11px; color: #888; }
          .images {
            display: grid; grid-template-columns: repeat(${itemCount}, 1fr);
            gap: 8px; margin-bottom: 15px;
            border-bottom: 1px solid #ddd; padding-bottom: 15px;
          }
          .img-cell { text-align: center; }
          .img-cell img {
            max-width: 100%; max-height: 130px; object-fit: contain;
            mix-blend-mode: multiply;
          }
          .img-cell .no-img { color: #aaa; font-size: 11px; padding: 30px 0; }
          .img-cell .model-name {
            margin-top: 6px; font-weight: 600; color: #007a7a; font-size: 12px;
          }
          .img-cell .brand-label {
            display: inline-block; margin-top: 3px;
            background: #009999; color: #fff;
            padding: 1px 8px; border-radius: 8px;
            font-size: 10px; font-weight: 600;
          }
          table { width: 100%; border-collapse: collapse; }
          th, td {
            border: 1px solid #ddd; padding: 6px 8px;
            text-align: left; font-size: 10px; vertical-align: top;
          }
          thead th {
            background: #f5f8f8; color: #007a7a;
            font-weight: 700; border-bottom: 2px solid #009999;
          }
          thead th .th-brand img { height: 14px; margin-top: 3px; }
          tbody th {
            background: #f5f8f8; font-weight: 600; color: #58595b;
          }
          tbody tr:nth-child(even) th,
          tbody tr:nth-child(even) td { background: #e6f7f7; }
          td.different { background: #fff8e1 !important; }
          .footer {
            margin-top: 15px; padding-top: 8px;
            border-top: 1px solid #ddd;
            font-size: 10px; color: #888; text-align: center;
          }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${window.location.origin}/wipotec-logo.png" alt="WIPOTEC">
          <h1>${t('compareTitle')}</h1>
          <div class="date">${dateStr}</div>
        </div>

        <div class="images">${imageCells}</div>

        <table>
          <thead><tr><th></th>${thCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
          ${t('footer')} | Generated: ${dateStr}
        </div>

        <script>
          window.addEventListener('load', function() {
            setTimeout(function() { window.print(); }, 500);
          });
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

  } catch (err) {
    alert('Error generating PDF: ' + err.message);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }, 1500);
  }
}

/* ============================================================
   Start
   ============================================================ */
renderCards();
applyLanguage();