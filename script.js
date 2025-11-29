// --- 読み込み確認用ログ ---
console.log("Script Loaded: Auto-Fallback version");

// --- キャラクター設定 ---
const CHARACTERS = [
    {
        id: 'mako',
        name: 'マコ',
        color: '#ff9800', // オレンジ
        avatar: '', // アイコン画像のパス（空なら黒丸）
        // Geminiへのシステムプロンプト
        systemPrompt: `
            あなたは「マコ」という20代前半の女性です。
            ユーザーとは親密な関係（恋人）です。
            性格は天然ですが、少ししっかりした部分もあります。
            今は二人きりでチャットをしており、性的な雰囲気になっています。
            返答は短く、チャットらしい口調で。
            状況に応じて以下のタグを返信の最後に【】で囲んでつけてください。
            画像を表示するためのトリガーになります。
            タグの例: 【normal】, 【shy】(恥じらい), 【excite】(興奮), 【climax】(絶頂)
        `,
        // タグに対応する画像ファイル名 (imageフォルダ内のファイル名)
        images: {
            'normal': '', 
            'shy': '',
            'excite': '',
            'climax': ''
        }
    },
    // 他のキャラクター追加用
    { id: 'rio', name: 'りお', color: '#00bcd4', avatar: '', systemPrompt: '', images: {} }
];

let currentChatId = 'mako';
let chatHistory = []; // 会話履歴

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    renderChatList();
    
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

// --- 画面遷移 ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
}

// --- リスト表示 ---
function renderChatList() {
    const container = document.getElementById('chat-list-container');
    if (!container) return;

    container.innerHTML = '';
    
    CHARACTERS.forEach(char => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => openChat(char.id);
        
        div.innerHTML = `
            <img class="avatar" src="${char.avatar}" style="border-color: ${char.color}" alt="">
            <div class="chat-info">
                <div class="chat-name">${char.name}</div>
            </div>
            <div class="chat-badge"><span class="material-icons" style="font-size:16px;">chat_bubble_outline</span> 12</div>
        `;
        container.appendChild(div);
    });
}

// --- チャット開始 ---
function openChat(charId) {
    currentChatId = charId;
    const char = CHARACTERS.find(c => c.id === charId);
    
    // ヘッダー更新
    document.getElementById('chat-title').innerText = char.name;
    document.getElementById('profile-title').innerText = char.name;
    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) {
        profileAvatar.style.backgroundColor = char.avatar ? 'transparent' : '#000';
    }

    // 履歴リセット
    const msgContainer = document.getElementById('message-container');
    if (msgContainer) {
        msgContainer.innerHTML = '';
    }
    
    // システムプロンプトを履歴の最初にセット
    chatHistory = [
        { role: "user", parts: [{ text: char.systemPrompt }] } 
    ];

    showScreen('screen-chat');
}

// --- メッセージ送信 ---
async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;

    // ユーザーの吹き出し追加
    addMessageBubble(text, 'user');
    input.value = '';

    // 履歴に追加
    chatHistory.push({ role: "user", parts: [{ text: text }] });

    // API呼び出し
    try {
        const responseText = await callGeminiAPI();
        processAIResponse(responseText);
    } catch (e) {
        console.error("All models failed:", e);
        addMessageBubble(`エラー: AIが応答できませんでした。(${e.message})`, 'partner');
    }
}

function sendQuickReply(text) {
    const input = document.getElementById('user-input');
    if (input) {
        input.value = text;
        sendMessage();
    }
}

// --- Gemini API連携 (自動再試行ロジック) ---
async function callGeminiAPI() {
    if (typeof CONFIG === 'undefined' || !CONFIG.GEMINI_API_KEY) {
        throw new Error("APIキー未設定");
    }

    // 試行するモデルのリスト (優先順位順)
    // 1. Flash (最新・高速) -> 2. Pro (安定) -> 3. 1.0 Pro (旧安定版)
    const modelsToTry = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro'
    ];

    let lastError = null;

    // 順番に試していくループ
    for (const modelName of modelsToTry) {
        console.log(`Trying model: ${modelName}...`);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: chatHistory })
            });

            const data = await response.json();

            // エラーなら例外を投げて次のモデルへ
            if (!response.ok) {
                throw new Error(data.error?.message || response.statusText);
            }
            if (!data.candidates || !data.candidates[0].content) {
                throw new Error("No response content");
            }

            // 成功したらテキストを返す
            console.log(`Success with ${modelName}`);
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.warn(`Failed with ${modelName}:`, error);
            lastError = error;
            // ここでループが続き、次のモデルを試します
        }
    }

    // 全モデル失敗した場合
    throw lastError;
}

// --- AIの応答処理と画像表示 ---
function processAIResponse(text) {
    if (!text) return;

    const char = CHARACTERS.find(c => c.id === currentChatId);
    
    let displayText = text;
    let imageToShow = null;

    // 正規表現で【】の中身を探す
    const match = text.match(/【(.*?)】/);
    if (match) {
        const tag = match[1];
        displayText = text.replace(match[0], ''); // タグを本文から消す
        
        // タグに対応する画像があればセット
        if (char.images && char.images[tag]) {
            imageToShow = char.images[tag];
        }
    }

    // 履歴に追加
    chatHistory.push({ role: "model", parts: [{ text: text }] });

    addMessageBubble(displayText, 'partner', imageToShow);
}

// --- 吹き出し追加 ---
function addMessageBubble(text, type, imageSrc = null) {
    const container = document.getElementById('message-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${type}`;

    const char = CHARACTERS.find(c => c.id === currentChatId);
    
    let html = '';
    // パートナーアイコン
    if (type === 'partner') {
        html += `<img class="avatar" src="${char.avatar}" style="width:30px;height:30px;margin-right:5px;">`;
    }

    html += `<div class="bubble-wrapper">`;
    if (text) {
        html += `<div class="bubble">${text}</div>`;
    }
    if (imageSrc) {
        html += `<img src="${imageSrc}" class="image-message">`;
    }
    html += `</div>`;

    div.innerHTML = html;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
