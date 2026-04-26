const API_URL = "https://script.google.com/macros/s/AKfycbwetyYlqTfJw5pV-J0XKyQg_Ye5TT_Sn3OutJSHU4malRtoFVHKVr7czWEcZapdeavx/exec"; 
const qs = (id) => document.getElementById(id);

let cachedTemplates = { 
    normal: '', endless: '', refusal: '', entry: '', 
    yunga: '', topotushka: '', otherInit: '' 
};
let mentorsQueue = []; 
let currentNextMentor = null; 
let cachedVars = {}; 

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

// Функция расчета очереди наставников
function calcNextMentor() {
    if (!qs('initLastMentor') || !qs('initNextMentor') || mentorsQueue.length === 0) return;
    
    const lastMentorName = qs('initLastMentor').value.trim().toLowerCase();
    
    // Фильтруем только тех, кто открыт
    const openMentors = mentorsQueue.filter(m => m.status.toLowerCase().includes('открыт'));
    
    if (openMentors.length === 0) {
        qs('initNextMentor').value = "Нет открытых наставников!";
        currentNextMentor = null;
        return;
    }

    currentNextMentor = openMentors[0]; // По умолчанию первый открытый
    
    if (lastMentorName) {
        // Ищем индекс последнего выданного (из ВК) в общем списке
        const lastIndex = mentorsQueue.findIndex(m => m.name.toLowerCase() === lastMentorName);
        
        if (lastIndex !== -1) {
            // Идем по кругу от найденного человека и ищем первого открытого
            for (let i = 1; i <= mentorsQueue.length; i++) {
                let checkIndex = (lastIndex + i) % mentorsQueue.length;
                if (mentorsQueue[checkIndex].status.toLowerCase().includes('открыт')) {
                    currentNextMentor = mentorsQueue[checkIndex];
                    break;
                }
            }
        }
    }
    
    qs('initNextMentor').value = currentNextMentor.name;
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
    const buttons = [qs('btnGenPerm'), qs('btnGenEntry'), qs('btnGenInitiation')];
    buttons.forEach(b => { if(b) { b.disabled = true; b.textContent = "Загрузка данных..."; }});

    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        
        // Распределяем шаблоны из нового формата
        cachedTemplates = data.templates;
        cachedVars = data.vars;
        mentorsQueue = data.mentors || [];

        if (qs('sheetDate')) qs('sheetDate').textContent = data.lastUpdate || "—";
        
        // Вставляем имя последнего наставника из ВК
        if (qs('initLastMentor') && data.lastMentorName) {
            qs('initLastMentor').value = data.lastMentorName;
            calcNextMentor();
        }

        calc();
        
        if (qs('btnGenPerm')) { qs('btnGenPerm').disabled = false; qs('btnGenPerm').textContent = "Составить код разрешения"; }
        if (qs('btnGenEntry')) { qs('btnGenEntry').disabled = false; qs('btnGenEntry').textContent = "Составить код вступления"; }
        if (qs('btnGenInitiation')) { qs('btnGenInitiation').disabled = false; qs('btnGenInitiation').textContent = "Составить код посвящения"; }

    } catch (e) { 
        console.error("Ошибка синхронизации:", e); 
        if (qs('sheetDate')) qs('sheetDate').textContent = "ошибка";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    syncWithSheet(); 
    if (qs('permStartDate')) qs('permStartDate').value = getMoscowDate();

    // Навигация
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

    if (qs('initLastMentor')) {
        qs('initLastMentor').addEventListener('input', calcNextMentor);
    }

    // --- ГЕНЕРАЦИЯ РАЗРЕШЕНИЯ ---
    if (qs('btnGenPerm')) {
        qs('btnGenPerm').addEventListener('click', () => {
            const type = qs('permType').value;
            const fac = qs('permFactionType') ? qs('permFactionType').value : 'official';
            const guarID = qs('permGuarantorId') ? qs('permGuarantorId').value.trim() : '';
            
            let isForcedRefusal = (type === 'обычное' && fac === 'loner' && !guarID);
            let tpl = (type === 'отказ' || isForcedRefusal) ? cachedTemplates.refusal : (type === 'бессрочное' ? cachedTemplates.endless : cachedTemplates.normal);
            
            if (!tpl) return alert("Шаблон не загружен!");

            const guarantorPart = guarID ? `[br]Поручителем выступил игрок [b][cat${guarID}] [${guarID}].[/b] За все ваши действия этот игрок несёт ответственность.` : "";
            const textRefusal = isForcedRefusal ? "К сожалению... (текст сокращен)" : "На данный момент...";

            const data = {
                '{РАЗРЕШЕНЕЦ}': qs('permTargetId').value.trim() || 'ID',
                '{НАЧАЛО}': qs('permStartDate').value,
                '{КОНЕЦ}': (type === 'бессрочное') ? 'бессрочное' : qs('permEndDate').value,
                '{ПЕРЕВЫДАЧА}': qs('permReReqDate').value,
                '{ПОРУЧИТЕЛЬ}': guarantorPart,
                '{ТЕКСТ_ОТКАЗА}': textRefusal,
                '{ВЕРХОВНАЯ_СФЕРА}': cachedVars.high,
                '{ОТКРЫВАТОРЫ}': cachedVars.gate,
                '{СУДОВЫЕ_ВРАЧИ}': cachedVars.heal,
                '{КАРТА_ВНЕЛАГЕРНАЯ}': cachedVars.mapOut,
                '{КАРТА_ЛАГЕРНАЯ}': cachedVars.mapIn
            };

            let res = tpl;
            for (let k in data) res = res.split(k).join(data[k]);
            qs('permResult').value = res;
        });
    }

    // --- ГЕНЕРАЦИЯ ВСТУПЛЕНИЯ ---
    if (qs('btnGenEntry')) {
        qs('btnGenEntry').addEventListener('click', () => {
            const tpl = cachedTemplates.entry;
            if (!tpl) return alert("Шаблон вступления не загружен!");
            const res = tpl.split('{ВЕРХОВНАЯ_СФЕРА}').join(cachedVars.high);
            qs('entryResult').value = res;
        });
    }

    // --- ГЕНЕРАЦИЯ ПОСВЯЩЕНИЯ ---
    if (qs('btnGenInitiation')) {
        qs('btnGenInitiation').addEventListener('click', () => {
            const type = qs('initType').value;
            const targetId = qs('initTargetId').value.trim() || 'ID';
            
            let res = '';
            let report = '';

            if (type === 'yunga') {
                if (!currentNextMentor) return alert("Наставник не определен!");
                
                // Код для блога/ЛС
                res = (cachedTemplates.yunga || "")
                    .split('{АЙДИ}').join(targetId)
                    .split('{НАСТАВНИК}').join(`[link${currentNextMentor.id}]`);
                
                // Код отчета для ВК
report = `#Наставники\n${targetId} — ${currentNextMentor.name}\n[ ${currentNextMentor.vk} ]`;
            } 
            else if (type === 'topotushka') {
                res = (cachedTemplates.topotushka || "").split('{АЙДИ}').join(targetId);
            } 
            else {
                res = (cachedTemplates.otherInit || "").split('{АЙДИ}').join(targetId);
            }

            qs('initResult').value = res;
            if (qs('initReportResult')) qs('initReportResult').value = report;
        });
    }

    document.querySelectorAll('.copy-btn').forEach(b => {
        b.addEventListener('click', () => {
            const el = qs(b.dataset.copy);
            if (el) { el.select(); document.execCommand('copy'); }
        });
    });
});

const navToggle = qs('navToggle');
const navCol = qs('navCol');

if (navToggle && navCol) {
    navToggle.addEventListener('click', () => {
        navCol.classList.toggle('mobile-open');
    });
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (navCol.classList.contains('mobile-open')) {
            navCol.classList.remove('mobile-open');
        }
    });
});