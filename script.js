const API_URL = "https://script.google.com/macros/s/AKfycbxIYt1Aqi7-zUL6x918nP6Vn1-p-esx1ql4a050c99y8PKna-GtbFbdajHMStELLLqJrQ/exec"; 
const qs = (id) => document.getElementById(id);

let cachedTemplates = { 
    normal: '', endless: '', refusal: '', repeat: '', entry: '', 
    yunga: '', topotushka: '', otherInit: '', exile: '', training: '' 
};

let mentorsQueue = []; 
let currentNextMentor = null; 
let autoNextMentor = null;
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

function buildAndSelectNextMentor(lastMentorName) {
    const selectEl = qs('initNextMentor');
    if (!selectEl) return;

    selectEl.innerHTML = '';

let openMentors = mentorsQueue.filter(m => m.status && m.status.toLowerCase().includes('открыт'));
    
    const selfStudyMentor = { name: 'Самообучение', id: 'self', vk: '', status: 'открыт', isSelfStudy: true };
    openMentors.unshift(selfStudyMentor);

    if (openMentors.length === 0) {
        selectEl.innerHTML = '<option disabled>Нет открытых наставников!</option>';
        currentNextMentor = null;
        autoNextMentor = null;
        return;
    }

    openMentors.forEach(m => {
        const option = document.createElement('option');
        option.value = m.name;
        option.textContent = m.name;
        selectEl.appendChild(option);
    });

    autoNextMentor = openMentors.length > 1 ? openMentors[1] : openMentors[0];

    if (lastMentorName && openMentors.length > 1) { 
        const targetName = lastMentorName.trim().toLowerCase();
        const lastIndex = mentorsQueue.findIndex(m => m.name.toLowerCase() === targetName);
        
        if (lastIndex !== -1) {
            for (let i = 1; i <= mentorsQueue.length; i++) {
                let checkIndex = (lastIndex + i) % mentorsQueue.length;
                if (mentorsQueue[checkIndex].status.toLowerCase().includes('открыт')) {
                    const found = openMentors.find(om => om.name === mentorsQueue[checkIndex].name);
                    if (found) {
                        autoNextMentor = found; 
                        break;
                    }
                }
            }
        }
    }
    
    currentNextMentor = autoNextMentor;
    selectEl.value = currentNextMentor.name;

    selectEl.addEventListener('change', (e) => {
        currentNextMentor = openMentors.find(m => m.name === e.target.value);
    });
}
const calc = () => {
    if (!qs('permType')) return;
    const type = qs('permType').value;
    const fac = qs('permFactionType') ? qs('permFactionType').value : 'official';
    const guar = qs('permGuarantorId') ? qs('permGuarantorId').value.trim() : '';
    const start = qs('permStartDate') ? qs('permStartDate').value : '';

    ['permTargetWrap', 'permFactionWrap', 'permGuarantorWrap', 'permDateWrap', 'permEndWrap', 'permReReqWrap'].forEach(id => {
        if (qs(id)) qs(id).classList.remove('hidden');
    });

    if (type === 'повторный' || type === 'отказ') {
        ['permTargetWrap', 'permFactionWrap', 'permGuarantorWrap', 'permDateWrap', 'permEndWrap', 'permReReqWrap'].forEach(id => {
            if (qs(id)) qs(id).classList.add('hidden');
        });
    } else if (type === 'бессрочное') {
        ['permFactionWrap', 'permGuarantorWrap', 'permDateWrap', 'permEndWrap', 'permReReqWrap'].forEach(id => {
            if (qs(id)) qs(id).classList.add('hidden');
        });
    }

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
        if (type === 'обычное' && fac === 'loner' && !guar) errorMsg.classList.remove('hidden');
        else errorMsg.classList.add('hidden');
    }
};

async function syncWithSheet() {
    const buttons = [qs('btnGenPerm'), qs('btnGenEntry'), qs('btnGenInitiation'), qs('btnGenExile')];   
    buttons.forEach(b => { if(b) { b.disabled = true; b.textContent = "Загрузка..."; }});

    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        
        cachedTemplates = data.templates;
        cachedVars = data.vars;
        mentorsQueue = data.mentors || [];

        if (qs('sheetDate')) qs('sheetDate').textContent = data.lastUpdate || "—";
        
        if (qs('initLastMentor') && data.lastMentorName) {
            qs('initLastMentor').value = data.lastMentorName;
        }
        buildAndSelectNextMentor(data.lastMentorName);

        calc();
        
        if (qs('btnGenPerm')) { qs('btnGenPerm').disabled = false; qs('btnGenPerm').textContent = "Составить код разрешения"; }
        if (qs('btnGenEntry')) { qs('btnGenEntry').disabled = false; qs('btnGenEntry').textContent = "Составить код вступления"; }
        if (qs('btnGenInitiation')) { qs('btnGenInitiation').disabled = false; qs('btnGenInitiation').textContent = "Составить код посвящения"; }
        if (qs('btnGenExile')) { qs('btnGenExile').disabled = false; qs('btnGenExile').textContent = "Составить код изгнания"; } 

    } catch (e) { 
        console.error("Ошибка синхронизации:", e); 
        if (qs('sheetDate')) qs('sheetDate').textContent = "ошибка";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    syncWithSheet(); 
    if (qs('permStartDate')) qs('permStartDate').value = getMoscowDate();

    document.querySelectorAll('.acc-head').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.acc-head').forEach(b => b.classList.remove('active'));
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
        qs('initLastMentor').addEventListener('input', (e) => {
            buildAndSelectNextMentor(e.target.value);
        });
    }
    const initTypeEl = qs('initType');
    const initTargetIdEl = qs('initTargetId');
    
if (initTypeEl && initTargetIdEl) {
    const toggleInitFields = () => {
        const pirateNameEl = qs('initPirateName');
        const pirateWrapper = pirateNameEl ? pirateNameEl.parentElement : null;
        
        const idWrapper = initTargetIdEl.parentElement;

        if (initTypeEl.value === 'topotushka') {
            if (pirateWrapper) pirateWrapper.classList.add('hidden');
            
        } else {
            if (idWrapper) idWrapper.classList.remove('hidden');
            if (pirateWrapper) pirateWrapper.classList.remove('hidden');
        }
    };
    
    initTypeEl.addEventListener('change', toggleInitFields);
    toggleInitFields(); 
}

    if (qs('btnGenPerm')) {
        qs('btnGenPerm').addEventListener('click', () => {
            const type = qs('permType').value;
            
            if (type === 'повторный') {
                if (!cachedTemplates.repeat) return alert("Шаблон не загружен из таблицы!");
                qs('permResult').value = cachedTemplates.repeat;
                return;
            }

            const fac = qs('permFactionType') ? qs('permFactionType').value : 'official';
            const guarID = qs('permGuarantorId') ? qs('permGuarantorId').value.trim() : '';
            const targetId = qs('permTargetId').value.trim() || 'ID';
            
            let isForcedRefusal = (type === 'обычное' && fac === 'loner' && !guarID);
            
            let tpl = (type === 'отказ' || isForcedRefusal) ? cachedTemplates.refusal : cachedTemplates.normal;
            
            if (!tpl) return alert("Шаблон не загружен!");

            const guarantorPart = guarID ? `[br]Поручителем выступил игрок [b][cat${guarID}] [${guarID}].[/b] За все ваши действия этот игрок несёт ответственность.[br]` : "";
            
            const textRefusal = isForcedRefusal 
                ? "К сожалению, вынуждены отказать вам в получении разрешения на посещение территории шайки Разбитого Корабля.[br]На данный момент мы предоставляем разрешение одиночкам вне Церковной Территории только при наличии поручителя. Вы можете повторно запросить собеседование [b]при смене фракции или получении рекомендации от игрока из шайки[/b]." 
                : "На данный момент мы не можем предоставить вам разрешение на посещение территории.";

            let termText = "";
            if (type === 'бессрочное') {
                termText = `[center][b][cat${targetId}] [${targetId}]; бессрочное[/b][/center][br]`;
            } else if (type === 'обычное') {
                termText = `[center][b][cat${targetId}] [${targetId}]: ${qs('permStartDate').value} — ${qs('permEndDate').value}[/b][/center][br]Столько будет действовать ваше разрешение на проход по территории шайки Разбитого Корабля. После его окончания запросить разрешение повторно можно [b]${qs('permReReqDate').value}.[/b] Ещё раз проходить собеседование не придётся, нужно только указать вашу актуальную фракцию.[br][br]${guarantorPart}`;
            }

            const data = {
                '{РАЗРЕШЕНЕЦ}': targetId,
                '{СРОК}': termText, 
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

    if (qs('btnGenEntry')) {
        qs('btnGenEntry').addEventListener('click', () => {
            const tpl = cachedTemplates.entry;
            if (!tpl) return alert("Шаблон вступления не загружен!");
            const res = tpl.split('{ВЕРХОВНАЯ_СФЕРА}').join(cachedVars.high);
            qs('entryResult').value = res;
        });
    }

    if (qs('btnGenInitiation')) {
    qs('btnGenInitiation').addEventListener('click', () => {
        const type = qs('initType').value;
        const targetId = qs('initTargetId').value.trim() || 'ID';
        const pirateName = qs('initPirateName').value.trim() || 'траляля'; 
        
        let res = '';
        let report = '';

        if (type === 'yunga') {
            if (!currentNextMentor) return alert("Наставник не определен!");
            
            if (currentNextMentor.isSelfStudy || currentNextMentor.name === 'Самообучение') {
                res = `Привет, готово! Поздравляю с посвящением в юнги. В течение дня глава или заместитель [b][url=blog736261]отряда Китов[/url].[/b] должны написать тебе в личные сообщения.`;
                
                const whalesTags = cachedVars.whales || '';
                report = `#Наставники\n${targetId} — самообучение\n${whalesTags}`;
            } 
            else {
                res = (cachedTemplates.yunga || "")
                    .split('{АЙДИ}').join(targetId)
                    .split('{НАСТАВНИК}').join(`[link${currentNextMentor.id}]`);
                
                let outOfTurnMark = "";
                if (autoNextMentor && currentNextMentor.name !== autoNextMentor.name) {
                    outOfTurnMark = " (!)";
                }
                
                report = `#Наставники\n${targetId} — ${currentNextMentor.name}${outOfTurnMark}\n${currentNextMentor.vk} `;
            }
        } else if (type === 'topotushka') {
            res = (cachedTemplates.topotushka || "").split('{АЙДИ}').join(targetId);
        } else {
            res = (cachedTemplates.otherInit || "").split('{АЙДИ}').join(targetId);
        }

        qs('initResult').value = res;
        
        if (qs('initReportResult')) qs('initReportResult').value = report;
        
        if (qs('initPirateReportResult')) {
            qs('initPirateReportResult').value = `#пи\n${targetId} — ${pirateName}`;
        }
    });
}
if (qs('btnGenExile')) {
    qs('btnGenExile').addEventListener('click', () => {
        const type = qs('exileType').value;
        const targetId = qs('exileTargetId').value.trim() || '1234567';
        const targetName = qs('exileTargetName').value.trim() || 'Имя';
        
        let res = '';
        let report = '';
        
        if (type === 'обычное') {
            res = cachedTemplates.exile || "";
            report = ""; 
        } else if (type === 'отработка') {
            let tpl = cachedTemplates.training || "";
            
            const today = getMoscowDate();
            const endDate = addDays(today, 31); 
            const srok = `${today} — ${endDate}`;
            
            res = tpl.split('{СРОК_ИЗГНАНИЯ}').join(srok);
            
            report = `#отработка — ${targetName} [${targetId}], ${srok}`;
        }

        qs('exileResult').value = res;
        if (qs('exileReportResult')) qs('exileReportResult').value = report;
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

document.querySelectorAll('.acc-head').forEach(btn => {
    btn.addEventListener('click', () => {
        if (navCol.classList.contains('mobile-open')) {
            navCol.classList.remove('mobile-open');
        }
    });
});

const exileTypeEl = qs('exileType');
if (exileTypeEl) {
    const toggleExileFields = () => {
        const isTraining = exileTypeEl.value === 'отработка';
        
        if (qs('exileTargetIdWrap')) qs('exileTargetIdWrap').classList.toggle('hidden', !isTraining);
        if (qs('exileTargetNameWrap')) qs('exileTargetNameWrap').classList.toggle('hidden', !isTraining);
        
        if (qs('exileReportCard')) qs('exileReportCard').classList.toggle('hidden', !isTraining);
    };
    exileTypeEl.addEventListener('change', toggleExileFields);
    toggleExileFields();
}