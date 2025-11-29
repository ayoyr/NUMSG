// --- キャラクター設定 ---
// imageフォルダに画像を入れたら、そのファイル名をここに記述します
// image/mako_normal.png, image/mako_shy.png などを想定
const CHARACTERS = [
    {
        id: 'mako',
        name: 'マコ',
        color: '#ff9800', // オレンジ
        avatar: '', // アイコン画像のパス（空なら黒丸）
        // Geminiへのシステムプロンプト（ここで性格や状況を設定）
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
        // タグに対応する画像ファイル名
        images: {
            'normal': '', 
            'shy': '',
            'excite': '',
            'climax': ''
        }
    },
    // 他のキャラクターもここに追加可能
    { id: 'rio', name: 'りお', color: '#00bcd4', avatar: '', systemPrompt: '', images: {} }
];

let currentChatId = 'mako';
let chatHistory = []; // 会話履歴

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    renderChatList();
    
    // 送信ボタンイベント
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});

// --- 画面遷移 ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// --- リスト表示 ---
function renderChatList() {
    const container = document.getElementById('chat-list-container');
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
    document.getElementById('profile-avatar').style.backgroundColor = char.avatar ? 'transparent' : '#000';
    // 履歴リセット（必要に応じてlocalStorage保存などを実装可）
    document.getElementById('message-container').innerHTML = '';
    chatHistory = [
        { role: "user", parts: [{ text: char.systemPrompt }] } // システムプロンプトを履歴の最初に仕込む
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

    // AIの応答待ち表示（簡易的）
    // loading...

    // Gemini API呼び出し
    try {
        const responseText = await callGeminiAPI();
        processAIResponse(responseText);
    } catch (e) {
        console.error(e);
        addMessageBubble("エラーが発生しました", 'partner');
    }
}

function sendQuickReply(text) {
    document.getElementById('user-input').value = text;
    sendMessage();
}

// --- Gemini API連携 ---
async function callGeminiAPI() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: chatHistory
        })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// --- AIの応答処理と画像表示 ---
function processAIResponse(text) {
    const char = CHARACTERS.find(c => c.id === currentChatId);
    
    // タグ 【tag】 を検出して画像を表示するロジック
    let displayText = text;
    let imageToShow = null;

    // 正規表現で【】の中身を探す
    const match = text.match(/【(.*?)】/);
    if (match) {
        const tag = match[1];
        displayText = text.replace(match[0], ''); // タグを本文から消す
        
        // タグに対応する画像があればセット
        if (char.images[tag]) {
            imageToShow = char.images[tag];
        }
    }

    // 履歴に追加（タグ付きのまま保存するか、タグなしにするかは調整可能。ここではAIが文脈を覚えるためにそのまま）
    chatHistory.push({ role: "model", parts: [{ text: text }] });

    addMessageBubble(displayText, 'partner', imageToShow);
}

// --- 吹き出し追加 ---
function addMessageBubble(text, type, imageSrc = null) {
    const container = document.getElementById('message-container');
    const div = document.createElement('div');
    div.className = `message ${type}`;

    const char = CHARACTERS.find(c => c.id === currentChatId);
    
    let html = '';
    // パートナーの場合、アイコンを表示
    if (type === 'partner') {
        html += `<img class="avatar" src="${char.avatar}" style="width:30px;height:30px;margin-right:5px;">`;
    }

    html += `<div class="bubble-wrapper">`;
    if (text) {
        html += `<div class="bubble">${text}</div>`;
    }
    // 画像がある場合
    if (imageSrc) {
        html += `<img src="${imageSrc}" class="image-message">`;
    }
    html += `</div>`;

    div.innerHTML = html;
    container.appendChild(div);
    
    // スクロール最下部へ
    container.scrollTop = container.scrollHeight;
}
