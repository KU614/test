// Firebase configuration
const firebaseConfig = {
    // Здесь нужно будет вставить ваши данные конфигурации Firebase
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Функция для синхронизации данных
function syncData(data) {
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) {
        console.error('Пользователь не авторизован');
        return;
    }

    database.ref(`users/${userId}/data`).set(data)
        .then(() => console.log('Данные успешно синхронизированы'))
        .catch((error) => console.error('Ошибка синхронизации:', error));
}

// Функция для получения синхронизированных данных
function getSyncedData(callback) {
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) {
        console.error('Пользователь не авторизован');
        return;
    }

    database.ref(`users/${userId}/data`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (callback && data) {
            callback(data);
        }
    });
}

// Constants
const FURNACE_LENGTH = 65000;
const FURNACES = ['rp2', 'rp3', 'rp4'];
const FURNACE_LABELS = {
    rp2: 'РП-2',
    rp3: 'РП-3',
    rp4: 'РП-4'
};

// Создаем аудио элементы для каждой печи
const alarmSounds = {};
const tempoSounds = {};
FURNACES.forEach(furnaceId => {
    // Звук сигнализации простоя
    alarmSounds[furnaceId] = new Audio();
    alarmSounds[furnaceId].src = './sounds/alarm.wav';
    alarmSounds[furnaceId].loop = true;

    // Звук нулевого темпа
    tempoSounds[furnaceId] = new Audio();
    tempoSounds[furnaceId].src = `./sounds/tempo_${furnaceId}.wav`;
    tempoSounds[furnaceId].loop = false;

    // Добавляем обработчики для отслеживания состояния загрузки звука
    alarmSounds[furnaceId].addEventListener('canplaythrough', () => {
        console.log('Звук сигнализации успешно загружен для печи', furnaceId);
    });

    alarmSounds[furnaceId].addEventListener('error', (e) => {
        console.error('Ошибка загрузки звука сигнализации для печи', furnaceId, ':', e);
    });

    tempoSounds[furnaceId].addEventListener('canplaythrough', () => {
        console.log('Звук темпа успешно загружен для печи', furnaceId);
    });

    tempoSounds[furnaceId].addEventListener('error', (e) => {
        console.error('Ошибка загрузки звука темпа для печи', furnaceId, ':', e);
    });

    // Добавляем обработчик окончания воспроизведения звука темпа
    tempoSounds[furnaceId].addEventListener('ended', () => {
        console.log('Звук темпа завершил воспроизведение для печи', furnaceId);
    });
});

// Добавляем стили для индикаторов
const style = document.createElement('style');
style.textContent = `
    .furnace-status {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-left: 10px;
        transition: all 0.3s ease;
        position: relative;
    }
    .status-inactive {
        background-color: #888;
        box-shadow: 0 0 5px rgba(136, 136, 136, 0.5);
    }
    .status-active {
        background-color: #4CAF50;
        box-shadow: 0 0 10px rgba(76, 175, 80, 0.7);
        animation: pulse 2s infinite;
    }
    .status-downtime {
        background-color: #f44336;
        box-shadow: 0 0 10px rgba(244, 67, 54, 0.7);
        animation: blink 1s infinite;
    }
    @keyframes blink {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1); }
    }
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
        100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
    }
    .tab-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
`;
document.head.appendChild(style);

// Добавляем стили для статистики
const statsStyle = document.createElement('style');
statsStyle.textContent = `
    .furnace-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
        padding: 20px;
        background: var(--bg-secondary);
        border-radius: 8px;
    }
    .stat-block {
        padding: 15px;
        background: var(--bg-primary);
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-block h3 {
        margin: 0 0 15px 0;
        color: var(--text-primary);
        border-bottom: 2px solid var(--accent-color);
        padding-bottom: 8px;
    }
    .stat-item {
        margin: 10px 0;
        font-size: 1.1em;
        color: var(--text-secondary);
    }
    .stat-item span {
        font-weight: bold;
        color: var(--text-primary);
    }
`;
document.head.appendChild(statsStyle);

// State management
const state = {
    furnaces: {},
    theme: 'light'
};

// Initialize state for each furnace
FURNACES.forEach(furnaceId => {
    state.furnaces[furnaceId] = {
        sheetLength: 800,
        sheetThickness: 0,
        heatingTime: 0,
        sheetsInFurnace: 0,
        cardNumber: '',
        sheetsInCard: 0,
        remainingSheets: 0,
        heatingTimer: null,
        downtimeTimer: null,
        heatingTimeLeft: 0,
        downtimeTimeLeft: 0,
        isDowntime: false,
        isProcessStarted: false,
        journal: [],
        sheetsManual: false
    };
    restoreFurnaceUI(furnaceId);
    validateInputs(furnaceId);
});

// Theme switching
function setTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    state.theme = theme;
    localStorage.setItem('theme', theme);
    
    // Update checkbox state
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.checked = theme === 'dark';
}

function getSavedTheme() {
    return localStorage.getItem('theme') || 'light';
}

document.getElementById('themeToggle').addEventListener('change', (e) => {
    const newTheme = e.target.checked ? 'dark' : 'light';
    setTheme(newTheme);
});

// --- Реальное время обновления статистики на вкладке отчет ---
let reportStatsInterval = null;

function handleTabSwitch() {
    const activeTab = document.querySelector('.tab-pane.active');
    if (activeTab && activeTab.id === 'report') {
        // Запускаем обновление статистики раз в секунду
        if (!reportStatsInterval) {
            updateFurnaceStats();
            reportStatsInterval = setInterval(updateFurnaceStats, 1000);
        }
    } else {
        // Останавливаем обновление, если уходим с отчета
        if (reportStatsInterval) {
            clearInterval(reportStatsInterval);
            reportStatsInterval = null;
        }
    }
}

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        button.classList.add('active');
        const tabId = button.dataset.tab;
        document.getElementById(tabId).classList.add('active');
        
        // Сохраняем выбранную вкладку
        localStorage.setItem('selectedTab', tabId);
        
        // Добавляем вызов для обновления статистики
        handleTabSwitch();
    });
});

// Initialize furnace controls
function initializeFurnace(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const container = document.getElementById(furnaceId);
    
    // Add event listeners for inputs
    container.querySelector('.sheet-length').addEventListener('input', (e) => {
        furnace.sheetLength = parseInt(e.target.value) || 0;
        furnace.sheetsManual = false;
        calculateSheetsInFurnace(furnaceId);
        validateInputs(furnaceId);
        saveFurnaceState();
        updateFurnaceStatus(furnaceId);
    });
    
    container.querySelector('.sheet-thickness').addEventListener('input', (e) => {
        furnace.sheetThickness = parseInt(e.target.value) || 0;
        validateInputs(furnaceId);
        saveFurnaceState();
        updateFurnaceStatus(furnaceId);
    });
    
    container.querySelector('.heating-time').addEventListener('input', (e) => {
        furnace.heatingTime = parseFloat(e.target.value) || 0;
        validateInputs(furnaceId);
        saveFurnaceState();
        updateFurnaceStatus(furnaceId);
    });
    
    container.querySelector('.sheets-in-furnace').addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        furnace.sheetsInFurnace = val;
        furnace.sheetsManual = true;
        validateInputs(furnaceId);
        saveFurnaceState();
        updateFurnaceStatus(furnaceId);
    });
    
    container.querySelector('.card-number').addEventListener('input', (e) => {
        furnace.cardNumber = e.target.value;
        validateInputs(furnaceId);
        saveFurnaceState();
        updateFurnaceStatus(furnaceId);
    });
    
    container.querySelector('.sheets-in-card').addEventListener('input', (e) => {
        furnace.sheetsInCard = parseInt(e.target.value) || 0;
        furnace.remainingSheets = furnace.sheetsInCard;
        updateRemainingSheets(furnaceId);
        validateInputs(furnaceId);
        saveFurnaceState();
        updateFurnaceStatus(furnaceId);
    });
    
    // Add event listeners for buttons
    container.querySelector('.start-process').addEventListener('click', () => {
        startProcess(furnaceId);
        saveFurnaceState();
    });
    
    container.querySelector('.start-downtime').addEventListener('click', () => {
        startDowntime(furnaceId);
        saveFurnaceState();
    });
    
    container.querySelector('.end-downtime').addEventListener('click', () => {
        endDowntime(furnaceId);
        saveFurnaceState();
    });

    // Добавляем обработчик для кнопки сброса
    container.querySelector('.reset-fields').addEventListener('click', () => {
        if (!confirm('Вы действительно хотите сбросить все значения?')) return;
        resetFields(furnaceId);
    });

    // Инициализируем начальное состояние индикатора
    updateFurnaceStatus(furnaceId);
}

// Validate inputs and enable/disable start button
function validateInputs(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const container = document.getElementById(furnaceId);
    const startButton = container.querySelector('.start-process');
    
    const isValid = furnace.sheetLength > 0 &&
                   furnace.sheetThickness > 0 &&
                   furnace.heatingTime > 0 &&
                   furnace.sheetsInFurnace > 0 &&
                   furnace.cardNumber.trim() !== '' &&
                   furnace.sheetsInCard > 0;
    
    startButton.disabled = !isValid || furnace.isProcessStarted;
    
    // Обновляем расчетное время при изменении параметров
    updateEstimatedTempo(furnaceId);
}

// Функция обновления индикатора состояния печи
function updateFurnaceStatus(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const statusElement = document.querySelector(`.tab-button[data-tab="${furnaceId}"] .furnace-status`);
    
    // Дополнительная проверка перед доступом к classList
    if (!statusElement) {
        console.warn(`Status element not found for furnace: ${furnaceId}`);
        return; // Если элемент не найден, просто выходим из функции
    }
    
    console.log(`Updating status for ${furnaceId}. statusElement:`, statusElement);

    // Удаляем все классы состояния
    statusElement.classList.remove('status-inactive', 'status-active', 'status-downtime');
    
    // Добавляем нужный класс в зависимости от состояния
    if (furnace.isDowntime) {
        statusElement.classList.add('status-downtime');
    } else if (!furnace.isProcessStarted || furnace.remainingSheets === 0) { // Check if process is not started OR sheets are zero
        statusElement.classList.add('status-inactive');
    } else {
        statusElement.classList.add('status-active');
    }
}

// Функция для запуска звука темпа
function startTempoSound(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const tempoSound = tempoSounds[furnaceId];
    
    // Проверяем, что печь в работе и не в простое
    if (furnace.isProcessStarted && !furnace.isDowntime) {
        // Устанавливаем громкость
        tempoSound.volume = 0.5;
        
        // Сбрасываем время воспроизведения
        tempoSound.currentTime = 0;
        
        // Пытаемся воспроизвести звук
        const playPromise = tempoSound.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('Звук темпа успешно начал воспроизведение для печи', furnaceId);
                })
                .catch(error => {
                    console.error('Ошибка воспроизведения звука темпа для печи', furnaceId, ':', error);
                });
        }
    }
}

// Функция для остановки звука темпа
function stopTempoSound(furnaceId) {
    const tempoSound = tempoSounds[furnaceId];
    tempoSound.pause();
    tempoSound.currentTime = 0;
}

// Модифицируем функцию startProcess
function startProcess(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const container = document.getElementById(furnaceId);
    
    furnace.isProcessStarted = true;
    container.querySelector('.start-process').disabled = true;
    container.querySelector('.start-downtime').disabled = false;
    
    // Disable input fields
    container.querySelectorAll('input').forEach(input => {
        input.disabled = true;
    });
    
    calculateHeatingTime(furnaceId);
    addJournalEntry(furnaceId, 'Запуск процесса', furnace.cardNumber);
    updateFurnaceStatus(furnaceId);
    saveFurnaceState();
}

// Calculate number of sheets in furnace
function calculateSheetsInFurnace(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    if (!furnace.sheetsManual) {
        const baseCount = FURNACE_LENGTH / furnace.sheetLength;
        furnace.sheetsInFurnace = Math.floor(baseCount);
        updateSheetsInFurnace(furnaceId);
    }
    saveFurnaceState();
}

// Calculate heating time
function calculateHeatingTime(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    if (furnace.sheetsInFurnace > 0) {
        const heatingTime = (furnace.sheetThickness * furnace.heatingTime) / furnace.sheetsInFurnace;
        startHeatingTimer(furnaceId, heatingTime);
    }
    saveFurnaceState();
}

// --- Новый универсальный таймер нагрева ---
function startHeatingTimer(furnaceId, duration) {
    const furnace = state.furnaces[furnaceId];
    if (furnace.heatingTimer) clearInterval(furnace.heatingTimer);
    
    // Сохраняем начальное время и длительность
    furnace.heatingDuration = Math.round(duration * 60); // seconds
    furnace.heatingStart = Date.now();
    furnace.pauseTotal = 0;
    furnace.pauseStart = null;
    furnace.isProcessStarted = true;
    
    // Обновляем отображение и запускаем интервал
    updateHeatingTimerDisplay(furnaceId);
    furnace.heatingTimer = setInterval(() => {
        updateHeatingTimerDisplay(furnaceId);
    }, 1000);
    
    // Add active class to heating timer container
    const container = document.getElementById(furnaceId);
    container.querySelector('.heating-timer').classList.add('active');

    // Сохраняем состояние
    saveFurnaceState();
}

function updateHeatingTimerDisplay(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const left = getHeatingTimeLeft(furnaceId);
    
    // Отображаем оставшееся время
    const container = document.getElementById(furnaceId);
    const minutes = Math.floor(left / 60);
    const seconds = left % 60;
    container.querySelector('.heating-timer span').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Если время истекло и процесс активен и не в простое — выдать лист
    if (left === 0 && furnace.isProcessStarted && !furnace.isDowntime) {
        clearInterval(furnace.heatingTimer);
        furnace.heatingTimer = null;

        // Remove active class from heating timer container
        container.querySelector('.heating-timer').classList.remove('active');

        if (furnace.remainingSheets > 0) {
            furnace.remainingSheets--;
            updateRemainingSheets(furnaceId);
            addJournalEntry(furnaceId, 'Выдан лист', furnace.cardNumber);
            // Пересчитываем и запускаем таймер для следующего листа
            const nextHeatingTime = (furnace.sheetThickness * furnace.heatingTime) / furnace.sheetsInFurnace;
            if (nextHeatingTime > 0) {
                // Запускаем звук темпа перед стартом нового таймера
                startTempoSound(furnaceId);
                // Запускаем новый таймер
                startHeatingTimer(furnaceId, nextHeatingTime);
            } else {
                console.warn(`Расчетное время нагрева для печи ${furnaceId} <= 0. Остановка или сброс процесса.`);
                container.querySelector('.heating-timer span').textContent = '00:00';
                updateFurnaceStatus(furnaceId);
                // Останавливаем звук темпа
                stopTempoSound(furnaceId);
            }
        } else {
            // Если листов осталось 0 и таймер завершился
            container.querySelector('.heating-timer span').textContent = '00:00';
            updateFurnaceStatus(furnaceId);
            // Останавливаем звук темпа
            stopTempoSound(furnaceId);
        }
    }
    
    // Сохраняем состояние после каждого обновления
    saveFurnaceState();
}

function getHeatingTimeLeft(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    if (!furnace.heatingStart) return 0;
    
    const now = Date.now();
    const pause = furnace.pauseTotal || 0;
    const elapsed = Math.floor((now - furnace.heatingStart - pause) / 1000);
    return Math.max(0, (furnace.heatingDuration || 0) - elapsed);
}

// Модифицируем функцию startDowntime
function startDowntime(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    if (furnace.downtimeTimer) clearInterval(furnace.downtimeTimer);
    
    // Останавливаем звук темпа при начале простоя
    stopTempoSound(furnaceId);
    
    furnace.isDowntime = true;
    furnace.downtimeStart = Date.now();
    furnace.alarmStartTime = null;
    furnace.alarmSilenced = false;
    
    // Останавливаем таймер нагрева
    if (furnace.heatingTimer) {
        clearInterval(furnace.heatingTimer);
        furnace.heatingTimer = null;
        const container = document.getElementById(furnaceId);
        container.querySelector('.heating-timer').classList.remove('active');
    }
    
    // Сохраняем время начала паузы
    if (!furnace.pauseStart) {
        furnace.pauseStart = Date.now();
    }
    
    const container = document.getElementById(furnaceId);
    container.querySelector('.start-downtime').disabled = true;
    container.querySelector('.end-downtime').disabled = false;
    
    addJournalEntry(furnaceId, 'Начало простоя', null, true);
    updateFurnaceStatus(furnaceId);
    
    // Запускаем таймер простоя
    furnace.downtimeTimer = setInterval(() => {
        updateDowntimeTimerDisplay(furnaceId);
    }, 1000);

    container.querySelector('.downtime-timer').classList.add('active');
    saveFurnaceState();
}

// Модифицируем функцию updateDowntimeTimerDisplay
function updateDowntimeTimerDisplay(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    if (!furnace.downtimeStart) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - furnace.downtimeStart) / 1000);
    
    // Обновляем отображение времени
    const container = document.getElementById(furnaceId);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    container.querySelector('.downtime-timer span').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Проверяем необходимость запуска сигнализации
    if (elapsed >= 60 && !furnace.alarmStartTime && !furnace.alarmSilenced) {
        console.log('Запуск сигнализации для печи', furnaceId, 'после', elapsed, 'секунд');
        furnace.alarmStartTime = now;
        startAlarm(furnaceId);
    }
    
    saveFurnaceState();
}

// Функция проверки состояния всех печей
function checkAllFurnacesDowntime() {
    // Проверяем, что ни одна печь не находится в простое
    let anyFurnaceInDowntime = false;
    
    FURNACES.forEach(furnaceId => {
        const furnace = state.furnaces[furnaceId];
        if (furnace.isDowntime || furnace.downtimeStart) {
            anyFurnaceInDowntime = true;
        }
    });
    
    return !anyFurnaceInDowntime;
}

// Модифицируем функцию endDowntime
function endDowntime(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    if (!furnace.isDowntime) return;
    
    // Останавливаем сигнализацию только для текущей печи
    if (furnace.alarmStartTime || furnace.alarmInterval) {
        stopAlarm(furnaceId);
    }
    
    furnace.isDowntime = false;
    furnace.alarmStartTime = null;
    furnace.alarmInterval = null;
    furnace.alarmSilenced = false;
    
    if (furnace.downtimeTimer) {
        clearInterval(furnace.downtimeTimer);
        furnace.downtimeTimer = null;
        const container = document.getElementById(furnaceId);
        container.querySelector('.downtime-timer').classList.remove('active');
    }
    
    // Обновляем общее время паузы
    if (furnace.pauseStart) {
        furnace.pauseTotal += Date.now() - furnace.pauseStart;
        furnace.pauseStart = null;
    }
    
    furnace.downtimeStart = null;
    
    const container = document.getElementById(furnaceId);
    container.querySelector('.start-downtime').disabled = false;
    container.querySelector('.end-downtime').disabled = true;
    
    // Скрываем кнопку отключения сигнализации
    container.querySelector('.silence-alarm').style.display = 'none';
    
    addJournalEntry(furnaceId, 'Завершение простоя', null, false);
    updateFurnaceStatus(furnaceId);
    
    // Перезапускаем таймер нагрева
    if (furnace.isProcessStarted && furnace.heatingDuration > 0 && furnace.remainingSheets > 0) {
        furnace.heatingTimer = setInterval(() => {
            updateHeatingTimerDisplay(furnaceId);
        }, 1000);
        container.querySelector('.heating-timer').classList.add('active');
    }
    
    // Проверяем состояние всех печей
    const allFurnacesOutOfDowntime = checkAllFurnacesDowntime();
    console.log('Проверка состояния печей:', {
        allFurnacesOutOfDowntime,
        furnaces: FURNACES.map(id => ({
            id,
            isDowntime: state.furnaces[id].isDowntime,
            downtimeStart: state.furnaces[id].downtimeStart,
            elapsed: state.furnaces[id].downtimeStart ? Math.floor((Date.now() - state.furnaces[id].downtimeStart) / 1000) : 0
        }))
    });
    
    if (allFurnacesOutOfDowntime) {
        console.log('Все печи вышли из простоя, отключаем сигнализацию на всех печах');
        // Если все печи вышли из простоя, останавливаем сигнализацию
        FURNACES.forEach(id => {
            const currentFurnace = state.furnaces[id];
            if (currentFurnace.alarmStartTime || currentFurnace.alarmInterval) {
                stopAlarm(id);
            }
        });
    } else {
        console.log('Некоторые печи все еще в простое, проверяем необходимость запуска сигнализации');
        // Проверяем каждую печь на необходимость запуска сигнализации
        FURNACES.forEach(id => {
            const currentFurnace = state.furnaces[id];
            if (currentFurnace.isDowntime && currentFurnace.downtimeStart) {
                const elapsed = Math.floor((Date.now() - currentFurnace.downtimeStart) / 1000);
                console.log('Проверка печи', id, ':', {
                    elapsed,
                    hasAlarm: currentFurnace.alarmStartTime,
                    isSilenced: currentFurnace.alarmSilenced
                });
                if (elapsed >= 60 && !currentFurnace.alarmStartTime && !currentFurnace.alarmSilenced) {
                    console.log('Запуск сигнализации для печи', id, 'после', elapsed, 'секунд');
                    currentFurnace.alarmStartTime = Date.now();
                    startAlarm(id);
                }
            }
        });
    }
    
    saveFurnaceState();
}

// Update UI elements
function updateSheetsInFurnace(furnaceId) {
    const container = document.getElementById(furnaceId);
    container.querySelector('.sheets-in-furnace').value = state.furnaces[furnaceId].sheetsInFurnace || '';
    saveFurnaceState();
}

function updateRemainingSheets(furnaceId) {
    const container = document.getElementById(furnaceId);
    container.querySelector('.remaining-sheets').value = state.furnaces[furnaceId].remainingSheets;
    saveFurnaceState();
    updateFurnaceStatus(furnaceId);
}

function updateHeatingTimer(furnaceId) {
    const container = document.getElementById(furnaceId);
    const minutes = Math.floor(state.furnaces[furnaceId].heatingTimeLeft / 60);
    const seconds = state.furnaces[furnaceId].heatingTimeLeft % 60;
    container.querySelector('.heating-timer span').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    saveFurnaceState();
}

function updateDowntimeTimer(furnaceId) {
    const container = document.getElementById(furnaceId);
    const hours = Math.floor(state.furnaces[furnaceId].downtimeTimeLeft / 3600);
    const minutes = Math.floor((state.furnaces[furnaceId].downtimeTimeLeft % 3600) / 60);
    const seconds = state.furnaces[furnaceId].downtimeTimeLeft % 60;
    container.querySelector('.downtime-timer span').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    saveFurnaceState();
}

// Journal management
function addJournalEntry(furnaceId, message, cardNumber = null, isDowntimeStart = null) {
    const furnace = state.furnaces[furnaceId];
    const now = new Date();
    // Проверка на дублирование: если последняя запись совпадает по типу и времени (±1.5 сек)
    const last = furnace.journal[furnace.journal.length - 1];
    if (
        last &&
        last.message === message &&
        last.isDowntimeStart === isDowntimeStart &&
        last.cardNumber === cardNumber &&
        Math.abs(new Date(last.timestamp).getTime() - now.getTime()) < 1500
    ) {
        return; // Не добавлять дубликат
    }
    const entry = {
        timestamp: now,
        message,
        cardNumber,
        isDowntimeStart,
        isProcessStart: message === 'Запуск процесса'
    };
    furnace.journal.push(entry);
    updateJournal(furnaceId);
    updateReport();
    updateFurnaceStats(); // Обновляем статистику
    saveFurnaceState();
}

function updateJournal(furnaceId) {
    const container = document.getElementById(furnaceId);
    const journalContainer = container.querySelector('.journal-entries');
    journalContainer.innerHTML = '';
    
    state.furnaces[furnaceId].journal.forEach(entry => {
        const entryElement = document.createElement('div');
        let className = 'journal-entry';
        if (entry.isDowntimeStart !== null) {
            className += entry.isDowntimeStart ? ' downtime-start' : ' downtime-end';
        } else if (entry.isProcessStart) {
            className += ' process-start';
        }
        entryElement.className = className;
        
        const dateObj = new Date(entry.timestamp);
        const timeStr = dateObj.toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const message = entry.cardNumber ? 
            `${timeStr} - ${entry.message} (Карточка: ${entry.cardNumber})` :
            `${timeStr} - ${entry.message}`;
        
        entryElement.textContent = message;
        journalContainer.appendChild(entryElement);
    });
    saveFurnaceState();
    setupResetJournalButtons();
}

function updateReport() {
    const reportContainer = document.querySelector('.report-entries');
    reportContainer.innerHTML = '';
    
    FURNACES.forEach(furnaceId => {
        const furnace = state.furnaces[furnaceId];
        const furnaceHeader = document.createElement('h3');
        furnaceHeader.textContent = `Печь ${FURNACE_LABELS[furnaceId]}`;
        reportContainer.appendChild(furnaceHeader);
        
        furnace.journal.forEach(entry => {
            const entryElement = document.createElement('div');
            let className = 'journal-entry';
            if (entry.isDowntimeStart !== null) {
                className += entry.isDowntimeStart ? ' downtime-start' : ' downtime-end';
            } else if (entry.isProcessStart) {
                className += ' process-start';
            }
            entryElement.className = className;
            
            const dateObj = new Date(entry.timestamp);
            const timeStr = dateObj.toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const message = entry.cardNumber ? 
                `${timeStr} - ${entry.message} (Карточка: ${entry.cardNumber})` :
                `${timeStr} - ${entry.message}`;
            
            entryElement.textContent = message;
            reportContainer.appendChild(entryElement);
        });
    });
    saveFurnaceState();
    setupResetJournalButtons();
}

// Initialize all furnaces
FURNACES.forEach(initializeFurnace);

// --- Firebase Auth ---
// Регистрация пользователя
function registerUser(email, password) {
  return firebase.auth().createUserWithEmailAndPassword(email, password);
}
// Вход пользователя
function loginUser(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}
// Выход пользователя
function logoutUser() {
  return firebase.auth().signOut();
}
// Проверка статуса авторизации
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    document.getElementById('auth-modal').style.display = 'none';
    document.querySelector('.tab-content').style.display = '';
    document.querySelector('.tabs').style.display = '';
    document.querySelector('.theme-switch').style.display = '';
    document.querySelector('.user-bar').style.display = '';
    document.getElementById('user-name').textContent = user.email;
    // После входа:
    loadFurnaceState();
    FURNACES.forEach(furnaceId => restoreFurnaceUI(furnaceId));
    FURNACES.forEach(furnaceId => initializeFurnace(furnaceId));
  } else {
    document.getElementById('auth-modal').style.display = 'flex';
    document.querySelector('.tab-content').style.display = 'none';
    document.querySelector('.tabs').style.display = 'none';
    document.querySelector('.theme-switch').style.display = 'none';
    document.querySelector('.user-bar').style.display = 'none';
    document.getElementById('user-name').textContent = '';
  }
});
// --- Обработка формы входа/регистрации ---
window.addEventListener('DOMContentLoaded', () => {
  // Применить сохранённую тему
  setTheme(getSavedTheme());
  
  // Восстановить выбранную вкладку или активировать первую по умолчанию
  const savedTab = localStorage.getItem('selectedTab');
  let activeTabButton = null;

  if (savedTab) {
    activeTabButton = document.querySelector(`.tab-button[data-tab="${savedTab}"]`);
  }

  // Если сохраненная вкладка не найдена или элемент не существует, активируем первую
  if (!activeTabButton) {
    activeTabButton = document.querySelector('.tab-button');
  }

  if (activeTabButton) {
      activeTabButton.click(); // Имитируем клик для активации вкладки
  }

  // Добавляем обработчики для модального окна инструкции
  const instructionsBtn = document.getElementById('instructions-btn');
  const instructionsModal = document.getElementById('instructions-modal');
  const closeInstructions = document.querySelector('.close-instructions');

  const getActiveTabId = () => {
      const activeTab = document.querySelector('.tab-button.active');
      console.log('getActiveTabId found activeTab:', activeTab);
      return activeTab ? activeTab.dataset.tab : 'None';
  };

  const closeInstructionsModal = () => {
    console.log('Closing instructions modal. Active tab before hiding:', getActiveTabId());
    instructionsModal.style.display = 'none';
    console.log('Instructions modal closed. Active tab after hiding:', getActiveTabId());
  };

  instructionsBtn.addEventListener('click', () => {
    console.log('Opening instructions modal from tab:', getActiveTabId());
    instructionsModal.style.display = 'flex';
  });

  closeInstructions.addEventListener('click', closeInstructionsModal);

  // Закрытие по клику вне модального окна
  instructionsModal.addEventListener('click', (e) => {
    if (e.target === instructionsModal) {
      closeInstructionsModal();
    }
  });

  // Закрытие по клавише Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && instructionsModal.style.display === 'flex') {
      closeInstructionsModal();
    }
  });

  // auth logic
  const authForm = document.getElementById('auth-form');
  const authTitle = document.getElementById('auth-title');
  const authLogin = document.getElementById('auth-login');
  const authPassword = document.getElementById('auth-password');
  const authPassword2 = document.getElementById('auth-password2');
  const authPassword2Group = document.getElementById('auth-password2-group');
  const authSubmit = document.getElementById('auth-submit');
  const authToggle = document.getElementById('auth-toggle');
  const authError = document.getElementById('auth-error');
  const logoutBtn = document.getElementById('logout-btn');
  let isRegister = false;
  function switchMode(register) {
    isRegister = register;
    authTitle.textContent = register ? 'Регистрация' : 'Вход';
    authSubmit.textContent = register ? 'Зарегистрироваться' : 'Войти';
    authToggle.textContent = register ? 'Вход' : 'Регистрация';
    authPassword2Group.style.display = register ? '' : 'none';
    authError.textContent = '';
    authForm.reset();
  }
  authToggle.onclick = () => switchMode(!isRegister);
  authForm.onsubmit = e => {
    e.preventDefault();
    const email = authLogin.value.trim();
    const pass = authPassword.value;
    const pass2 = authPassword2.value;
    if (!email || !pass || (isRegister && !pass2)) {
      authError.textContent = 'Заполните все поля!';
      return;
    }
    if (isRegister) {
      if (pass !== pass2) {
        authError.textContent = 'Пароли не совпадают!';
        return;
      }
      registerUser(email, pass)
        .then(() => {
          authError.textContent = '';
          // Сбросить все пользовательские данные для нового пользователя
          FURNACES.forEach(furnaceId => {
            state.furnaces[furnaceId] = {
              sheetLength: 800,
              sheetThickness: 0,
              heatingTime: 0,
              sheetsInFurnace: 0,
              cardNumber: '',
              sheetsInCard: 0,
              remainingSheets: 0,
              heatingTimer: null,
              downtimeTimer: null,
              heatingTimeLeft: 0,
              downtimeTimeLeft: 0,
              isDowntime: false,
              isProcessStarted: false,
              journal: [],
              sheetsManual: false
            };
            restoreFurnaceUI(furnaceId);
          });
          saveFurnaceState();
        })
        .catch(err => authError.textContent = err.message);
    } else {
      loginUser(email, pass)
        .then(() => { authError.textContent = ''; })
        .catch(err => authError.textContent = err.message);
    }
  };
  logoutBtn.onclick = () => {
    logoutUser();
  };
  setTimeout(setupResetJournalButtons, 500);
  handleTabSwitch();
});
// --- END Firebase Auth интеграция ---

// --- Переключение вкладок по стрелкам --- ВЛЕВО/ВПРАВО
document.addEventListener('keydown', (e) => {
    // Проверяем, что фокус не находится в поле ввода
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
        return; // Выходим, если фокус в поле ввода
    }

    const activeTabButton = document.querySelector('.tab-button.active');
    if (!activeTabButton) return; // Выходим, если нет активной кнопки вкладки

    const currentTabId = activeTabButton.dataset.tab;
    const furnaceIndex = FURNACES.indexOf(currentTabId);

    // Переключаем только между вкладками печей
    if (furnaceIndex === -1) return; // Выходим, если текущая вкладка не печь

    let nextIndex = -1;

    if (e.key === 'ArrowLeft') {
        e.preventDefault(); // Предотвращаем стандартное поведение стрелки
        nextIndex = (furnaceIndex - 1 + FURNACES.length) % FURNACES.length;
    } else if (e.key === 'ArrowRight') {
        e.preventDefault(); // Предотвращаем стандартное поведение стрелки
        nextIndex = (furnaceIndex + 1) % FURNACES.length;
    }

    if (nextIndex !== -1) {
        const nextFurnaceId = FURNACES[nextIndex];
        const nextTabButton = document.querySelector(`.tab-button[data-tab="${nextFurnaceId}"]`);
        if (nextTabButton) {
            nextTabButton.click(); // Имитируем клик
        }
    }
});

// --- СОХРАНЕНИЕ/ЗАГРУЗКА ДАННЫХ ПЕЧЕЙ ---
function getFurnaceStorageKey() {
    const user = getCurrentUser();
    return user ? `furnaceData_${user}` : null;
}
function saveFurnaceState() {
    const key = getFurnaceStorageKey();
    if (!key) return;
    
    const data = {};
    FURNACES.forEach(furnaceId => {
        const f = state.furnaces[furnaceId];
        data[furnaceId] = {
            sheetLength: f.sheetLength,
            sheetThickness: f.sheetThickness,
            heatingTime: f.heatingTime,
            sheetsInFurnace: f.sheetsInFurnace,
            cardNumber: f.cardNumber,
            sheetsInCard: f.sheetsInCard,
            remainingSheets: f.remainingSheets,
            isDowntime: f.isDowntime,
            isProcessStarted: f.isProcessStarted,
            journal: f.journal,
            sheetsManual: f.sheetsManual,
            heatingDuration: f.heatingDuration || 0,
            heatingStart: f.heatingStart || null,
            pauseTotal: f.pauseTotal || 0,
            pauseStart: f.pauseStart || null,
            downtimeStart: f.downtimeStart || null
        };
    });
    
    localStorage.setItem(key, JSON.stringify(data));
}
function loadFurnaceState() {
    const key = getFurnaceStorageKey();
    if (!key) return;
    
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    
    FURNACES.forEach(furnaceId => {
        if (data[furnaceId]) {
            const f = state.furnaces[furnaceId];
            Object.assign(f, data[furnaceId]);
            
            // Восстанавливаем UI
            restoreFurnaceUI(furnaceId);
            
            // Восстанавливаем таймеры и анимации
            const container = document.getElementById(furnaceId);
            if (f.isProcessStarted) {
                if (f.isDowntime) {
                    // Если печь в простое
                    if (!f.downtimeTimer) {
                        if (container) {
                            container.querySelector('.start-downtime').disabled = true;
                            container.querySelector('.end-downtime').disabled = false;
                        }
                        f.downtimeTimer = setInterval(() => {
                            updateDowntimeTimerDisplay(furnaceId);
                        }, 1000);
                        // Add active class to downtime timer container
                         if (container) container.querySelector('.downtime-timer').classList.add('active');
                    }
                } else if (f.heatingDuration > 0 && f.remainingSheets > 0) { // Also check remaining sheets
                    // Если печь работает
                    if (!f.heatingTimer) {
                        f.heatingTimer = setInterval(() => {
                            updateHeatingTimerDisplay(furnaceId);
                        }, 1000);
                         // Add active class to heating timer container
                         if (container) container.querySelector('.heating-timer').classList.add('active');
                    }
                }
            }
            
            // Ensure inactive state removes animations on load
             if (!f.isProcessStarted || f.remainingSheets === 0 || f.isDowntime) {
                 if (container) container.querySelector('.heating-timer').classList.remove('active');
             }
            if (!f.isDowntime) {
                 if (container) container.querySelector('.downtime-timer').classList.remove('active');
            }

            
            // Обновляем индикатор состояния
            updateFurnaceStatus(furnaceId);
        }
    });
    
    // Обновляем статистику после загрузки состояния
    updateFurnaceStats();
}

// Модифицируем функцию restoreFurnaceUI
function restoreFurnaceUI(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const container = document.getElementById(furnaceId);
    container.querySelector('.sheet-length').value = furnace.sheetLength || 800;
    container.querySelector('.sheet-thickness').value = furnace.sheetThickness || '';
    container.querySelector('.heating-time').value = furnace.heatingTime || '';
    container.querySelector('.sheets-in-furnace').value = furnace.sheetsInFurnace || '';
    container.querySelector('.card-number').value = furnace.cardNumber || '';
    container.querySelector('.sheets-in-card').value = furnace.sheetsInCard || '';
    container.querySelector('.remaining-sheets').value = furnace.remainingSheets || '';

    // Update timer displays based on loaded state
    const heatingTimeLeft = getHeatingTimeLeft(furnaceId);
    container.querySelector('.heating-timer span').textContent =
        heatingTimeLeft > 0 ?
        `${String(Math.floor(heatingTimeLeft/60)).padStart(2,'0')}:${String(heatingTimeLeft%60).padStart(2,'0')}` : '00:00';

    // Downtime timer display needs to be calculated based on downtimeStart
    let downtimeElapsed = 0;
    if (furnace.isDowntime && furnace.downtimeStart) {
        downtimeElapsed = Math.floor((Date.now() - furnace.downtimeStart) / 1000);
    }
    const hours = Math.floor(downtimeElapsed / 3600);
    const minutes = Math.floor((downtimeElapsed % 3600) / 60);
    const seconds = downtimeElapsed % 60;

    container.querySelector('.downtime-timer span').textContent =
        `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;

    // Кнопки и блокировка
    container.querySelectorAll('input').forEach(input => {
        input.disabled = !!furnace.isProcessStarted;
    });
    container.querySelector('.start-process').disabled = furnace.isProcessStarted || !(
        furnace.sheetLength > 0 &&
        furnace.sheetThickness > 0 &&
        furnace.heatingTime > 0 &&
        furnace.sheetsInFurnace > 0 &&
        furnace.cardNumber.trim() !== '' &&
        furnace.sheetsInCard > 0
    );
    container.querySelector('.start-downtime').disabled = !furnace.isProcessStarted || furnace.isDowntime;
    container.querySelector('.end-downtime').disabled = !furnace.isProcessStarted || !furnace.isDowntime;
    updateJournal(furnaceId);
    updateFurnaceStatus(furnaceId);

    // Apply animations based on current state immediately after UI restore
    if (furnace.isProcessStarted && !furnace.isDowntime && getHeatingTimeLeft(furnaceId) > 0) {
        container.querySelector('.heating-timer').classList.add('active');
    } else {
        container.querySelector('.heating-timer').classList.remove('active');
    }

    if (furnace.isDowntime) {
        container.querySelector('.downtime-timer').classList.add('active');
    } else {
        container.querySelector('.downtime-timer').classList.remove('active');
    }

    // Восстанавливаем состояние сигнализации
    if (furnace.isDowntime && furnace.downtimeStart) {
        const downtimeElapsed = Math.floor((Date.now() - furnace.downtimeStart) / 1000);
        console.log('Восстановление состояния печи', furnaceId, ':', {
            downtimeElapsed,
            hasAlarm: furnace.alarmStartTime,
            isSilenced: furnace.alarmSilenced
        });
        
        if (downtimeElapsed >= 60 && !furnace.alarmStartTime && !furnace.alarmSilenced) {
            console.log('Восстановление сигнализации для печи', furnaceId, 'после', downtimeElapsed, 'секунд');
            furnace.alarmStartTime = Date.now();
            startAlarm(furnaceId);
        } else if (furnace.alarmStartTime && !furnace.alarmSilenced) {
            console.log('Восстановление активной сигнализации для печи', furnaceId);
            startAlarm(furnaceId);
        }
    }

    updateEstimatedTempo(furnaceId);
}

// Функция для расчета расчетного времени темпа
function calculateEstimatedTempo(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    if (furnace.sheetThickness > 0 && furnace.heatingTime > 0 && furnace.sheetsInFurnace > 0) {
        const estimatedTime = (furnace.sheetThickness * furnace.heatingTime) / furnace.sheetsInFurnace;
        const minutes = Math.floor(estimatedTime);
        const seconds = Math.round((estimatedTime - minutes) * 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return '--:--';
}

// Функция для обновления отображения расчетного времени
function updateEstimatedTempo(furnaceId) {
    const container = document.getElementById(furnaceId);
    const estimatedTime = calculateEstimatedTempo(furnaceId);
    container.querySelector('.estimated-tempo span').textContent = estimatedTime;
}

// --- ФУНКЦИЯ ПОЛНОГО СБРОСА ДАННЫХ ---
function clearAllUserData() {
    const user = getCurrentUser();
    if (user) {
        localStorage.removeItem(`furnaceData_${user}`);
    }
    // Можно также очистить другие ключи, если нужно
    location.reload();
}

// --- Сброс журнала печи с подтверждением пароля администратора ---
function setupResetJournalButtons() {
    document.querySelectorAll('.furnace-journal .reset-journal').forEach((btn, idx) => {
        btn.onclick = function() {
            const password = prompt('Введите пароль администратора для сброса журнала:');
            if (password === 'asd89619320504777') {
                const furnaceId = ['rp2', 'rp3', 'rp4'][idx];
                state.furnaces[furnaceId].journal = [];
                updateJournal(furnaceId);
                updateReport();
                saveFurnaceState();
                alert('Журнал успешно очищен!');
            } else if (password !== null) {
                alert('Неверный пароль администратора!');
            }
        };
    });
}

// Модифицируем функцию reset-fields
function resetFields(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    const container = document.getElementById(furnaceId);
    
    // Сбрасываем все значения
    furnace.sheetLength = 800;
    furnace.sheetThickness = 0;
    furnace.heatingTime = 0;
    furnace.sheetsInFurnace = 0;
    furnace.cardNumber = '';
    furnace.sheetsInCard = 0;
    furnace.remainingSheets = 0;
    furnace.sheetsManual = false;
    furnace.isProcessStarted = false;
    furnace.isDowntime = false;
    
    // Останавливаем таймеры
    if (furnace.heatingTimer) clearInterval(furnace.heatingTimer);
    if (furnace.downtimeTimer) clearInterval(furnace.downtimeTimer);
    furnace.heatingTimer = null;
    furnace.downtimeTimer = null;
    furnace.heatingTimeLeft = 0;
    furnace.downtimeTimeLeft = 0;
    furnace.heatingStart = null;
    furnace.downtimeStart = null;
    furnace.pauseStart = null;
    furnace.pauseTotal = 0;
    
    // Разблокируем все поля
    container.querySelectorAll('input').forEach(input => {
        input.disabled = false;
    });
    
    // Сбрасываем значения в полях
    container.querySelector('.sheet-length').value = 800;
    container.querySelector('.sheet-thickness').value = '';
    container.querySelector('.heating-time').value = '';
    container.querySelector('.sheets-in-furnace').value = '';
    container.querySelector('.card-number').value = '';
    container.querySelector('.sheets-in-card').value = '';
    container.querySelector('.remaining-sheets').value = '';
    
    // Сбрасываем таймеры на экране
    container.querySelector('.heating-timer span').textContent = '00:00';
    container.querySelector('.downtime-timer span').textContent = '00:00:00';
    container.querySelector('.estimated-tempo span').textContent = '--:--';
    
    // Обновляем состояние кнопок
    container.querySelector('.start-process').disabled = true;
    container.querySelector('.start-downtime').disabled = false;
    container.querySelector('.end-downtime').disabled = true;
    
    updateFurnaceStatus(furnaceId); // Обновляем индикатор на серый
    saveFurnaceState();
}

// Функция подсчета статистики для печи
function calculateFurnaceStats(furnaceId) {
    const furnace = state.furnaces[furnaceId];
    let totalSheets = 0;
    let totalDowntime = 0;
    let currentDowntime = 0;
    
    // Подсчитываем количество листов и время простоя из журнала
    furnace.journal.forEach(entry => {
        if (entry.message === 'Выдан лист') {
            totalSheets++;
        } else if (entry.message === 'Начало простоя') {
            currentDowntime = new Date(entry.timestamp).getTime();
        } else if (entry.message === 'Завершение простоя' && currentDowntime) {
            const endTime = new Date(entry.timestamp).getTime();
            totalDowntime += Math.floor((endTime - currentDowntime) / (1000 * 60)); // конвертируем в минуты
            currentDowntime = 0;
        }
    });
    
    // Если печь сейчас в простое, добавляем текущее время простоя
    if (furnace.isDowntime && furnace.downtimeStart) {
        const currentTime = Date.now();
        totalDowntime += Math.floor((currentTime - furnace.downtimeStart) / (1000 * 60));
    }
    
    return { totalSheets, totalDowntime };
}

// Функция обновления статистики
function updateFurnaceStats() {
    FURNACES.forEach(furnaceId => {
        const stats = calculateFurnaceStats(furnaceId);
        document.getElementById(`${furnaceId}-total-sheets`).textContent = stats.totalSheets;
        document.getElementById(`${furnaceId}-total-downtime`).textContent = stats.totalDowntime;
    });
}

function getCurrentUser() {
    return firebase.auth().currentUser ? firebase.auth().currentUser.email : null;
}

// Функция для запуска сигнализации
function startAlarm(furnaceId) {
    const container = document.getElementById(furnaceId);
    const silenceButton = container.querySelector('.silence-alarm');
    const alarmSound = alarmSounds[furnaceId];
    
    // Показываем кнопку отключения
    silenceButton.style.display = 'flex';
    
    // Устанавливаем громкость
    alarmSound.volume = 0.5;
    
    // Пытаемся воспроизвести звук
    const playPromise = alarmSound.play();
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log('Звук успешно начал воспроизведение для печи', furnaceId);
            })
            .catch(error => {
                console.error('Ошибка воспроизведения звука для печи', furnaceId, ':', error);
                // Пробуем перезагрузить звук
                alarmSound.load();
                // Пробуем воспроизвести снова
                alarmSound.play().catch(e => {
                    console.error('Повторная ошибка воспроизведения для печи', furnaceId, ':', e);
                });
            });
    }
    
    // Добавляем обработчик для кнопки отключения
    silenceButton.onclick = () => stopAlarm(furnaceId);
}

// Функция для остановки сигнализации
function stopAlarm(furnaceId) {
    const container = document.getElementById(furnaceId);
    const silenceButton = container.querySelector('.silence-alarm');
    const furnace = state.furnaces[furnaceId];
    const alarmSound = alarmSounds[furnaceId];
    
    // Останавливаем звук
    alarmSound.pause();
    alarmSound.currentTime = 0;
    
    // Скрываем кнопку отключения
    silenceButton.style.display = 'none';
    
    // Полностью очищаем состояние сигнализации
    furnace.alarmSilenced = true;
    furnace.alarmStartTime = null;
    furnace.alarmInterval = null;
    
    // Сохраняем состояние
    saveFurnaceState();
}

// --- ДОБАВИТЬ КНОПКУ ОЧИСТИТЬ ВСЁ В ИНТЕРФЕЙС (например, рядом с кнопкой выйти) ---
const clearAllBtn = document.getElementById('clear-all-btn');
if (clearAllBtn) {
    clearAllBtn.onclick = clearAllUserData;
} 