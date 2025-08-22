// public/js/settings.js

document.addEventListener('DOMContentLoaded', () => {
    const pageTitleInput = document.getElementById('pageTitle');
    const redPieceColorInput = document.getElementById('redPieceColor');
    const blackPieceColorInput = document.getElementById('blackPieceColor');
    const boardBgColorInput = document.getElementById('boardBgColor');
    const boardLineColorInput = document.getElementById('boardLineColor');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');

    const defaultSettings = {
        title: '实时网页象棋',
        redColor: '#c0392b',
        blackColor: '#2c3e50',
        boardBg: '#e6c5a1',
        boardLine: '#6b4724'
    };

    // 加载已保存的设置
    function loadSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('chessSettings')) || defaultSettings;
        
        pageTitleInput.value = savedSettings.title || defaultSettings.title;
        document.title = savedSettings.title ? savedSettings.title + ' - 设置' : defaultSettings.title + ' - 设置';

        redPieceColorInput.value = savedSettings.redColor || defaultSettings.redColor;
        blackPieceColorInput.value = savedSettings.blackColor || defaultSettings.blackColor;
        boardBgColorInput.value = savedSettings.boardBg || defaultSettings.boardBg;
        boardLineColorInput.value = savedSettings.boardLine || defaultSettings.boardLine;
    }

    // 保存设置
    saveSettingsBtn.addEventListener('click', () => {
        const settings = {
            title: pageTitleInput.value.trim(),
            redColor: redPieceColorInput.value,
            blackColor: blackPieceColorInput.value,
            boardBg: boardBgColorInput.value,
            boardLine: boardLineColorInput.value,
        };
        localStorage.setItem('chessSettings', JSON.stringify(settings));
        alert('设置已保存！');
        document.title = settings.title ? settings.title + ' - 设置' : defaultSettings.title + ' - 设置';
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
