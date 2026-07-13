// 1. SUPABASE INITIALIZE KAREIN
const supabaseUrl = 'https://otbyobzvuomysphfgmym.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YnlvYnp2dW9teXNwaGZnbXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Nzk5MTMsImV4cCI6MjA5OTI1NTkxM30.UKLCLo3TrlTNAVv2-dl_m8w8YdudALZO05_R5iEKd64';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
    
    // --- 2. AUTO-LOGIN LOGIC (Website 1 se aane par) ---
    const urlParams = new URLSearchParams(window.location.search);
    const urlAccessToken = urlParams.get('access_token');
    const urlRefreshToken = urlParams.get('refresh_token');

    if (urlAccessToken && urlRefreshToken) {
        // Token se session set karo
        const { data, error } = await supabase.auth.setSession({
            access_token: urlAccessToken,
            refresh_token: urlRefreshToken
        });
        if (!error) {
            // URL clean kar do taaki token dikhe na
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Check karo current user kaun hai
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
        // Agar login nahi hai, toh Website 1 par wapas bhej do
        window.location.href = "https://omnix-ui.github.io/OMNIX/";
        return;
    }
    currentUser = authData.user;

    // --- 3. PAGE ROUTING (Check karo hum kis page par hain) ---
    const usersListContainer = document.getElementById('usersListContainer');
    const chatMessagesContainer = document.getElementById('chatMessages');

    if (usersListContainer) {
        // HUM PAGE 1 (index.html) PAR HAIN
        loadChatUsers();
    } else if (chatMessagesContainer) {
        // HUM PAGE 2 (chat.html) PAR HAIN
        setupChatInterface();
    }
});


// ==========================================
// PAGE 1: INDEX.HTML FUNCTIONS (User List & Profile)
// ==========================================
async function loadChatUsers() {
    // ----------------------------------------------------
    // NEW: Logged-in User ki Profile aur Settings ka logic
    // ----------------------------------------------------
    const myName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.username || "User";
    const myInitial = myName.charAt(0).toUpperCase();

    // A. Header mein Avatar set karna
    const myAvatarText = document.getElementById('myAvatarText');
    if (myAvatarText) {
        myAvatarText.textContent = myInitial;
    }

    // B. Settings Panel Setup
    const settingsBtn = document.getElementById('settingsBtn');
    const myProfileBtn = document.getElementById('myProfileBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettings = document.getElementById('closeSettings');
    const logoutBtn = document.getElementById('logoutBtn');

    if (settingsPanel) {
        const openSettings = () => {
            // Panel me user detail daalna
            document.getElementById('mySettingsName').textContent = myName;
            document.getElementById('myLargeAvatar').textContent = myInitial;
            document.getElementById('mySettingsEmail').textContent = currentUser.email || "";
            settingsPanel.classList.add('active'); // Panel open
        };

        if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
        if (myProfileBtn) myProfileBtn.addEventListener('click', openSettings);
        
        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                settingsPanel.classList.remove('active'); // Panel close
            });
        }

        // C. Logout Button Logic
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const { error } = await supabase.auth.signOut();
                if (!error) {
                    window.location.href = "https://omnix-ui.github.io/OMNIX/"; // Wapas Website 1 par
                }
            });
        }
    }
    // ----------------------------------------------------

    // --- Purana Chat Users laane ka code ---
    const container = document.getElementById('usersListContainer');
    
    // Profiles table se sabhi users laao (Khud ko chhod kar)
    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUser.id); // Apni ID match nahi karni

    if (error) {
        console.error("Users laane mein error:", error);
        return;
    }

    container.innerHTML = ''; // Khali karo

    users.forEach(user => {
        const name = user.full_name || user.username || "User";
        const initial = name.charAt(0).toUpperCase();

        const userHTML = `
            <a href="chat.html?userId=${user.id}" class="user-card">
                <div class="avatar-wrapper">
                    <div class="avatar-text">${initial}</div>
                </div>
                <div class="user-info">
                    <div class="name-row">
                        <h2>${name}</h2>
                    </div>
                    <div class="msg-row">
                        <p>Click to chat...</p>
                    </div>
                </div>
            </a>
        `;
        container.innerHTML += userHTML;
    });
}

// ==========================================
// PAGE 2: CHAT.HTML FUNCTIONS (Messaging)
// ==========================================
async function setupChatInterface() {
    const urlParams = new URLSearchParams(window.location.search);
    const receiverId = urlParams.get('userId');

    if (!receiverId) {
        alert("Koi user select nahi kiya!");
        window.location.href = "index.html";
        return;
    }

    // 1. Receiver ki detail fetch karke UI me dalo (Header & Profile Panel)
    const { data: receiverProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', receiverId)
        .single();

    if (receiverProfile) {
        const name = receiverProfile.full_name || receiverProfile.username;
        const initial = name.charAt(0).toUpperCase();
        
        document.getElementById('chatHeaderName').textContent = name;
        document.getElementById('chatHeaderAvatar').textContent = initial;
        
        // Profile Sidebar Details
        const profilePanel = document.getElementById('profilePanel');
        if (profilePanel) {
            document.getElementById('profileName').textContent = name;
            document.getElementById('profileLargeAvatar').textContent = initial;
            
            // Sidebar toggle logic
            document.getElementById('toggleProfile').addEventListener('click', () => profilePanel.classList.add('active'));
            document.getElementById('closeProfile').addEventListener('click', () => profilePanel.classList.remove('active'));
        }
    }

    // 2. Purane Messages Load Karo
    loadMessages(receiverId);

    // 3. Naya Message Send Karne ka logic
    const sendBtn = document.getElementById("sendBtn");
    const messageInput = document.getElementById("messageInput");

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            messageInput.value = ""; // Input clear kar do instantly
            
            const { error } = await supabase
                .from('messages')
                .insert({
                    sender_id: currentUser.id,
                    receiver_id: receiverId,
                    content: text
                });
                
            if (error) console.error("Message bhejne mein error:", error);
        }
    }

    sendBtn.addEventListener("click", sendMessage);
    messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    // 4. REAL-TIME LISTENER (Jaise hi naya message aaye, screen par dikhao)
    supabase
        .channel('public:messages')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            // Condition: Jo messages current chat se related hain wahi dikhao
            filter: `receiver_id=eq.${currentUser.id}` 
        }, (payload) => {
            if (payload.new.sender_id === receiverId) {
                renderSingleMessage(payload.new, false); // Receive hua
            }
        })
        .subscribe();
}

function loadMessages(receiverId) {
    // Humare aur saamne wale ke beech ke saare messages laao
    supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })
        .then(({ data: messages, error }) => {
            if (error) {
                console.error("Error loading messages:", error);
                return;
            }
            
            const chatContainer = document.getElementById('chatMessages');
            chatContainer.innerHTML = ''; // Pehle khali karo
            
            messages.forEach(msg => {
                const isSentByMe = msg.sender_id === currentUser.id;
                renderSingleMessage(msg, isSentByMe);
            });
        });
}

function renderSingleMessage(msg, isSentByMe) {
    const chatContainer = document.getElementById('chatMessages');
    const msgDiv = document.createElement("div");
    msgDiv.className = isSentByMe ? "message sent" : "message received";
    
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgDiv.innerHTML = `
        <div class="msg-content">${msg.content}</div>
        <span class="msg-time">${time} ${isSentByMe ? '<i class="fas fa-check read"></i>' : ''}</span>
    `;
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); // Scroll to bottom
}
