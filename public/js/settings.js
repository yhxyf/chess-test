// public/js/settings.js

document.addEventListener('DOMContentLoaded', () => {
    const pageTitleInput = document.getElementById('pageTitle');
    const redPieceColorInput = document.getElementById('redPieceColor');
    const blackPieceColorInput = document.getElementById('blackPieceColor');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // 加载已保存的设置
    function loadSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('chessSettings')) || {};
        if (savedSettings.title) {
            pageTitleInput.value = savedSettings.title;
            document.title = savedSettings.title;
        }
        if (savedSettings.redColor) {
            redPieceColorInput.value = savedSettings.redColor;
        }
        if (savedSettings.blackColor) {
            blackPieceColorInput.value = savedSettings.blackColor;
        }
    }

    // 保存设置
    saveSettingsBtn.addEventListener('click', () => {
        const settings = {
            title: pageTitleInput.value.trim(),
            redColor: redPieceColorInput.value,
            blackColor: blackPieceColorInput.value,
        };
        localStorage.setItem('chessSettings', JSON.stringify(settings));
        alert('设置已保存！');
        document.title = settings.title || '设置 - 实时网页象棋';
    });
    
    loadSettings();
});