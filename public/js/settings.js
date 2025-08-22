// public/js/settings.js

document.addEventListener('DOMContentLoaded', () => {
    const pageTitleInput = document.getElementById('pageTitle');
    const redPieceTextColorInput = document.getElementById('redPieceTextColor');
    const blackPieceTextColorInput = document.getElementById('blackPieceTextColor');
    const redPieceBgColorInput = document.getElementById('redPieceBgColor');
    const blackPieceBgColorInput = document.getElementById('blackPieceBgColor');
    const pieceBorderColorInput = document.getElementById('pieceBorderColor');
    const boardBgColorInput = document.getElementById('boardBgColor');
    const boardLineColorInput = document.getElementById('boardLineColor');
    const boardBorderColorInput = document.getElementById('boardBorderColor');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');

    const defaultSettings = {
        title: '实时网页象棋',
        redColor: '#c0392b',
        blackColor: '#2c3e50',
        redBg: '#ffdddd',
        blackBg: '#f0f0f0',
        pieceBorder: '#888888',
        boardBg: '#e6c5a1',
        boardLine: '#6b4724',
        boardBorder: '#8b5a2b'
    };

    // 加载已保存的设置
    function loadSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('chessSettings')) || defaultSettings;
        
        pageTitleInput.value = savedSettings.title || defaultSettings.title;
        document.title = (savedSettings.title || defaultSettings.title) + ' - 设置';

        redPieceTextColorInput.value = savedSettings.redColor || defaultSettings.redColor;
        blackPieceTextColorInput.value = savedSettings.blackColor || defaultSettings.blackColor;
        redPieceBgColorInput.value = savedSettings.redBg || defaultSettings.redBg;
        blackPieceBgColorInput.value = savedSettings.blackBg || defaultSettings.blackBg;
        pieceBorderColorInput.value = savedSettings.pieceBorder || defaultSettings.pieceBorder;
        boardBgColorInput.value = savedSettings.boardBg || defaultSettings.boardBg;
        boardLineColorInput.value = savedSettings.boardLine || defaultSettings.boardLine;
        boardBorderColorInput.value = savedSettings.boardBorder || defaultSettings.boardBorder;
        
        applySettingsToPreview();
    }

    // 将设置应用到页面预览
    function applySettingsToPreview() {
        const settings = JSON.parse(localStorage.getItem('chessSettings')) || defaultSettings;
        document.documentElement.style.setProperty('--red-piece-text', settings.redColor);
        document.documentElement.style.setProperty('--black-piece-text', settings.blackColor);
        document.documentElement.style.setProperty('--red-piece-bg', settings.redBg);
        document.documentElement.style.setProperty('--black-piece-bg', settings.blackBg);
        document.documentElement.style.setProperty('--piece-border', settings.pieceBorder);
        document.documentElement.style.setProperty('--board-bg', settings.boardBg);
        document.documentElement.style.setProperty('--line-color', settings.boardLine);
        document.documentElement.style.setProperty('--border-color', settings.boardBorder);
    }

    // 保存设置
    saveSettingsBtn.addEventListener('click', () => {
        const settings = {
            title: pageTitleInput.value.trim(),
            redColor: redPieceTextColorInput.value,
            blackColor: blackPieceTextColorInput.value,
            redBg: redPieceBgColorInput.value,
            blackBg: blackPieceBgColorInput.value,
            pieceBorder: pieceBorderColorInput.value,
            boardBg: boardBgColorInput.value,
            boardLine: boardLineColorInput.value,
            boardBorder: boardBorderColorInput.value,
        };
        localStorage.setItem('chessSettings', JSON.stringify(settings));
        alert('设置已保存！');
        document.title = (settings.title || defaultSettings.title) + ' - 设置';
        applySettingsToPreview();
    });
    
    // 恢复默认设置
    resetSettingsBtn.addEventListener('click', () => {
        if (confirm('确定要恢复所有设置为默认值吗？')) {
            localStorage.setItem('chessSettings', JSON.stringify(defaultSettings));
            loadSettings();
            alert('已恢复默认设置。');
        }
    });

    loadSettings();
});
