const API_URL = "https://script.google.com/macros/s/AKfycbyAjWWlyMmhTLPq2efcmhWWks6c9FZ_sOVoXMPBNapn5zCo3-dhtfPJETW2wKNsRQ/exec"; 
const qs = (id) => document.getElementById(id);

let cachedTemplates = { normal: '', endless: '', refusal: '', entry: '' };

function getMoscowDate() {
    const d = new Date();
    const mskDate = new Date(d.getTime() + (3 * 60 + d.getTimezoneOffset()) * 60000);
    return `${String(mskDate.getDate()).padStart(2, '0')}.${String(mskDate.getMonth() + 1).padStart(2, '0')}.${String(mskDate.getFullYear()).slice(-2)}`;
}

function addDays(dateStr, days) {
    if (!dateStr || dateStr.split('.').length !== 3) return '';
    const [d, m, y] = dateStr.split('.').map(Number);
    const date = new Date(2000 + y, m - 1, d);
    date.setDate(date.getDate() + days);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(-2)}`;
}

function formatContacts(raw) {
    if (!raw || !raw.trim()) return '';
    const items = raw.trim().split('\n').map(l => {
        const p = l.trim().split(/\s+/);
        return p.length >= 2 ? `[link${p[0]}] [[url=${p[1]}]VK[/url]]` : null;
    }).filter(Boolean);
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    const last = items.pop();
    return items.join(', ') + ' и ' + last;
}

const calc = () => {
    if (!qs('permType')) return;
    const type = qs('permType').value;
    const fac = qs('permFactionType') ? qs('permFactionType').value : 'official';
    const guar = qs('permGuarantorId') ? qs('permGuarantorId').value.trim() : '';
    const start = qs('permStartDate') ? qs('permStartDate').value : '';

    const wraps = ['permTargetWrap', 'permFactionWrap', 'permGuarantorWrap', 'permDateWrap', 'permEndWrap', 'permReReqWrap'];
    wraps.forEach(id => {
        const el = qs(id);
        if (el) {
            if (type === 'отказ') el.classList.add('hidden');
            else el.classList.remove('hidden');
        }
    });

    if (type === 'обычное' && start) {
        let days = (fac === 'official') ? (guar ? 31 : 14) : (fac === 'autonomy' ? (guar ? 14 : 7) : 7);
        const end = addDays(start, days);
        if (qs('permEndDate')) qs('permEndDate').value = end;
        if (qs('permReReqDate')) qs('permReReqDate').value = addDays(end, 31);
    } else if (type === 'бессрочное') {
        if (qs('permEndDate')) qs('permEndDate').value = 'бессрочное';
        if (qs('permReReqDate')) qs('permReReqDate').value = 'не требуется';
    } else if (type === 'отказ') {
        if (qs('permEndDate')) qs('permEndDate').value = 'отказано';
        if (qs('permReReqDate')) qs('permReReqDate').value = addDays(getMoscowDate(), 31);
    }
    
    const errorMsg = qs('permErrorMsg');
    if (errorMsg) {
        if (type !== 'отказ' && fac === 'loner' && !guar) errorMsg.classList.remove('hidden');
        else errorMsg.classList.add('hidden');
    }
};

async function syncWithSheet() {
    const b1 = qs('btnGenPerm');
    const b2 = qs('btnGenEntry');
    
    if (b1) { b1.disabled = true; b1.textContent = "Загрузка шаблонов..."; }
    if (b2) { b2.disabled = true; b2.textContent = "Загрузка..."; }

    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        
        cachedTemplates = {
            normal: data.normal || '',
            endless: data.endless || '',
            refusal: data.refusal || '',
            entry: data.entry || ''
        };
        
        if (qs('sheetDate')) qs('sheetDate').textContent = data.lastUpdate || "—";

        const fields = {
            'permHighSphere': data.high, 'permGatekeepers': data.gate, 
            'permHealers': data.heal, 'permMapOut': data.mapOut, 
            'permMapIn': data.mapIn, 'entryHighSphere': data.high
        };

        for (let id in fields) if (qs(id)) qs(id).value = fields[id] || '';
        
        calc();
        
        if (b1) { b1.disabled = false; b1.textContent = "Составить код разрешения"; }
        if (b2) { b2.disabled = false; b2.textContent = "Составить код вступления"; }

    } catch (e) { 
        console.error("Ошибка:", e); 
        if (b1) b1.textContent = "Ошибка связи. Обнови страницу!";
        if (qs('sheetDate')) qs('sheetDate').textContent = "ошибка";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    syncWithSheet(); 
    if (qs('permStartDate')) qs('permStartDate').value = getMoscowDate();

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.form-view').forEach(f => f.classList.add('hidden'));
            btn.classList.add('active');
            const target = qs('form-' + btn.dataset.form);
            if (target) target.classList.remove('hidden');
            if (qs('workAreaTitle')) qs('workAreaTitle').textContent = btn.textContent;
        });
    });

    ['permType', 'permFactionType', 'permStartDate', 'permGuarantorId'].forEach(id => {
        const el = qs(id);
        if (el) el.addEventListener('input', calc);
    });

    if (qs('btnGenPerm')) {
        qs('btnGenPerm').addEventListener('click', () => {
            const type = qs('permType').value;
            const fac = qs('permFactionType') ? qs('permFactionType').value : 'official';
            const guarID = qs('permGuarantorId') ? qs('permGuarantorId').value.trim() : '';
            
            let isForcedRefusal = (type === 'обычное' && fac === 'loner' && !guarID);
            
            let tpl = (type === 'отказ' || isForcedRefusal) ? cachedTemplates.refusal : (type === 'бессрочное' ? cachedTemplates.endless : cachedTemplates.normal);
            
            if (!tpl) return alert("Шаблон не загружен!");

            const guarantorPart = guarID ? `[br]Поручителем выступил игрок [b][cat${guarID}] [${guarID}].[/b] За все ваши действия этот игрок несёт ответственность.` : "";

            const textRefusal = isForcedRefusal 
                ? "К сожалению, вынуждены отказать вам в получении разрешения на посещение шайки Разбитого Корабля.[br]На данный момент мы предоставляем разрешение одиночкам вне Церковной Территории только при наличии поручителя. Вы можете повторно запросить собеседование [b]при смене фракции или получении рекомендации от игрока из шайки[/b]." 
                : "На данный момент мы не можем предоставить вам разрешение на посещение территории.";

            const data = {
                '{РАЗРЕШЕНЕЦ}': (qs('permTargetId') ? qs('permTargetId').value.trim() : '') || 'ID',
                '{НАЧАЛО}': qs('permStartDate') ? qs('permStartDate').value : '',
                '{КОНЕЦ}': (type === 'бессрочное') ? 'бессрочное' : (qs('permEndDate') ? qs('permEndDate').value : ''),
                '{ПЕРЕВЫДАЧА}': qs('permReReqDate') ? qs('permReReqDate').value : '',
                '{ПОРУЧИТЕЛЬ}': guarantorPart,
                '{ТЕКСТ_ОТКАЗА}': textRefusal,
                '{ВЕРХОВНАЯ_СФЕРА}': formatContacts(qs('permHighSphere') ? qs('permHighSphere').value : ''),
                '{ОТКРЫВАТОРЫ}': formatContacts(qs('permGatekeepers') ? qs('permGatekeepers').value : ''),
                '{СУДОВЫЕ_ВРАЧИ}': formatContacts(qs('permHealers') ? qs('permHealers').value : ''),
                '{КАРТА_ВНЕЛАГЕРНАЯ}': qs('permMapOut') ? qs('permMapOut').value : '',
                '{КАРТА_ЛАГЕРНАЯ}': qs('permMapIn') ? qs('permMapIn').value : ''
            };

            let res = tpl;
            for (let k in data) res = res.split(k).join(data[k]);
            if (qs('permResult')) qs('permResult').value = res;
        });
    }

    if (qs('btnGenEntry')) {
        qs('btnGenEntry').addEventListener('click', () => {
            const tpl = cachedTemplates.entry;
            if (!tpl) return alert("Шаблон вступления еще не загружен!");
            const res = tpl.split('{ВЕРХОВНАЯ_СФЕРА}').join(formatContacts(qs('entryHighSphere').value));
            if (qs('entryResult')) qs('entryResult').value = res;
        });
    }

    document.querySelectorAll('.acc-head').forEach(h => {
        h.addEventListener('click', () => {
            const item = h.closest('.acc-item');
            if (item) item.classList.toggle('open');
        });
    });

    document.querySelectorAll('.copy-btn').forEach(b => {
        b.addEventListener('click', () => {
            const el = qs(b.dataset.copy);
            if (el) { el.select(); document.execCommand('copy'); }
        });
    });
});