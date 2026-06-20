const CONFIG = {
    SUPABASE_URL: 'https://rqorglbbcaupaskaronb.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxb3JnbGJiY2F1cGFza2Fyb25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTQ0MTMsImV4cCI6MjA5Njg5MDQxM30.ViB8Jzu9FNubHcWhrxpnjfvXp8hMjy_zbkPiCtQ6opw'
};


// GLOBAL ERROR HANDLER 
window.addEventListener('error', function(event) {
    console.error("Caught Global Error:", event.error);
    if(typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast("System Error: " + (event.message || "Something went wrong."), "error");
    }
});

window.addEventListener('unhandledrejection', function(event) {
    console.error("Caught Promise Rejection:", event.reason);
    if(typeof Utils !== 'undefined' && Utils.showToast) {
        let errorMsg = "Network Error: Failed to connect to server.";
        if(event.reason && event.reason.message) {
            errorMsg = event.reason.message;
        }
        Utils.showToast(errorMsg, "error");
    }
});


// 🔥 FIX: Changed 'supabase' to 'supabaseClient'
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const appRoot = document.getElementById("app-root");

const Utils = {
    escapeHTML: (str) => {
        if (!str) return '';
        return str.toString().replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    },
    
    showToast: (message, type = "success") => {
        let container = document.getElementById("toast-container") || (() => {
            const el = document.createElement("div");
            el.id = "toast-container";
            el.className = "fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none";
            document.body.appendChild(el);
            return el;
        })();

        const toast = document.createElement("div");
        const isError = type === "error";
        toast.className = `${isError ? "bg-red-500" : "bg-emerald-500"} text-white px-4 py-3 rounded-xl shadow-lg font-bold flex items-center gap-2 transform transition-all duration-300 translate-x-full opacity-0`;
        toast.innerHTML = `<i class="fa-solid ${isError ? "fa-circle-xmark" : "fa-circle-check"}"></i> <span>${Utils.escapeHTML(message)}</span>`;
        
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.remove("translate-x-full", "opacity-0"));
        
        setTimeout(() => {
            toast.classList.add("translate-x-full", "opacity-0");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    formatTime: (dateString) => {
        return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
};

const API = {
    verifyGuardPin: async (pin) => await supabaseClient.from("societies").select("*").eq("guard_pin", pin).maybeSingle(),
    fetchFlats: async (societyId) => await supabaseClient.from("flats").select("id, flat_number").eq("society_id", societyId).order("flat_number"),
    fetchTodayVisitors: async (societyId) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return await supabaseClient.from("visitors").select("*").eq("society_id", societyId).gte("created_at", today.toISOString()).order("created_at", { ascending: false });
    },
    logVisitor: async (payload) => await supabaseClient.from("visitors").insert([payload]),
    verifyVVIP: async (code, societyId) => await supabaseClient.from("guest_invites").select("*, flat:flats(flat_number)").eq("invite_code", code).eq("society_id", societyId).maybeSingle(),
    markVVIPUsed: async (inviteId) => await supabaseClient.from("guest_invites").update({ is_used: true }).eq("id", inviteId)
};

const GuardApp = {
    society: null,
    groupedFlats: {},

    init: () => {
        const societyId = localStorage.getItem("guard_society_id");
        if (societyId) {
            GuardApp.loadConsole(societyId);
        } else {
            GuardApp.renderPinScreen();
        }
    },

    renderPinScreen: () => {
        appRoot.innerHTML = `
            <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div class="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-700">
                    <div class="w-16 h-16 bg-slate-900 text-indigo-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 border border-slate-700"><i class="fa-solid fa-shield-halved"></i></div>
                    <h2 class="text-2xl font-black text-white mb-2">Terminal Access</h2>
                    <p class="text-xs text-slate-400 mb-6">Enter 6-digit setup PIN.</p>
                    <input id="pinInput" type="password" maxlength="6" class="w-full text-center tracking-[0.5em] font-black text-3xl px-4 py-4 rounded-xl border border-slate-600 bg-slate-900 text-white mb-6 outline-none">
                    <button id="authBtn" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold transition-all">Authorize</button>
                </div>
            </div>`;

        document.getElementById("authBtn").addEventListener("click", async (e) => {
            const pin = document.getElementById("pinInput").value.trim();
            if (pin.length !== 6) return Utils.showToast("Invalid PIN format", "error");

            e.target.disabled = true;
            e.target.textContent = "Verifying...";

            const { data, error } = await API.verifyGuardPin(pin);
            if (error || !data) {
                Utils.showToast("Authentication Failed", "error");
                e.target.disabled = false;
                e.target.textContent = "Authorize";
                return;
            }

            localStorage.setItem("guard_society_id", data.id);
            Utils.showToast(`Connected to ${data.name}`);
            GuardApp.loadConsole(data.id);
        });
    },

    loadConsole: async (societyId) => {
        appRoot.innerHTML = '<div class="min-h-screen flex items-center justify-center text-slate-500 bg-slate-900 font-bold">Initializing Base Station...</div>';
        
        const { data: society } = await supabaseClient.from("societies").select("*").eq("id", societyId).maybeSingle();
        if (!society) {
            localStorage.clear();
            GuardApp.renderPinScreen();
            return;
        }
        
        GuardApp.society = society;
        await GuardApp.setupConsoleUI();
        await GuardApp.fetchAndBindFlats();
        GuardApp.refreshLiveLogs();
    },

    setupConsoleUI: async () => {
        appRoot.innerHTML = `
            <div class="min-h-screen bg-slate-900 text-white font-sans flex flex-col md:flex-row">
                <div class="w-full md:w-[380px] bg-slate-800 border-r border-slate-700 p-6 flex flex-col md:h-screen md:overflow-y-auto">
                    <div class="flex justify-between items-start mb-8">
                        <div>
                            <h1 class="text-xl font-black text-indigo-400">${Utils.escapeHTML(GuardApp.society.name)}</h1>
                            <div class="text-slate-400 text-sm mt-1" id="clockDisplay">00:00</div>
                        </div>
                        <button id="logoutBtn" class="text-slate-400 hover:text-white px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold"><i class="fa-solid fa-right-from-bracket"></i></button>
                    </div>

                    <div class="bg-slate-900 p-5 rounded-2xl border border-slate-700 mb-6">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4"><i class="fa-solid fa-user-plus text-indigo-500 mr-2"></i> Manual Entry</h3>
                        <div class="flex gap-2 mb-3">
                            <select id="towerSelect" class="w-1/2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold outline-none"><option value="">Tower</option></select>
                            <select id="flatSelect" disabled class="w-1/2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold outline-none opacity-50"><option value="">Flat</option></select>
                        </div>
                        <input id="vName" type="text" placeholder="Visitor Name" class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold mb-3 outline-none">
                        <input id="vMobile" type="tel" maxlength="10" placeholder="Mobile Number" class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold mb-3 outline-none">
                        <select id="vPurpose" class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-bold mb-5 outline-none">
                            <option value="Guest">Guest / Relative</option>
                            <option value="Delivery">Delivery / Courier</option>
                            <option value="Cab">Cab / Taxi</option>
                            <option value="Service">Service / Repair</option>
                        </select>
                        <button id="submitEntryBtn" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold transition-all">Grant Access</button>
                    </div>

                    <div class="bg-slate-900 p-5 rounded-2xl border border-slate-700">
                        <h3 class="text-xs font-bold text-amber-500 uppercase tracking-widest mb-4"><i class="fa-solid fa-crown mr-2"></i> VVIP Pass Verify</h3>
                        <div class="flex gap-2">
                            <input id="vvipCode" type="text" maxlength="6" placeholder="6-DIGIT CODE" class="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm uppercase text-center font-bold outline-none">
                            <button id="verifyVvipBtn" class="bg-indigo-600 px-5 py-3 rounded-xl font-bold transition-all">Verify</button>
                        </div>
                    </div>
                </div>

                <div class="flex-1 bg-slate-900 p-6 flex flex-col md:h-screen">
                    <div class="border-b border-slate-800 pb-4 mb-4">
                        <h2 class="text-xl font-black">Live Operations Log</h2>
                    </div>
                    <div id="logsContainer" class="flex-1 overflow-y-auto pr-2 space-y-2"></div>
                </div>
            </div>`;

        setInterval(() => {
            const clock = document.getElementById("clockDisplay");
            if(clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }, 1000);

        document.getElementById("logoutBtn").addEventListener("click", () => {
            localStorage.clear();
            location.reload();
        });

        document.getElementById("submitEntryBtn").addEventListener("click", GuardApp.handleManualEntry);
        document.getElementById("verifyVvipBtn").addEventListener("click", GuardApp.handleVVIPVerify);
    },

    fetchAndBindFlats: async () => {
        const { data: flats } = await API.fetchFlats(GuardApp.society.id);
        if (!flats) return;

        flats.forEach(flat => {
            const tower = flat.flat_number.includes("-") ? flat.flat_number.split("-")[0].trim() : "Main";
            if (!GuardApp.groupedFlats[tower]) GuardApp.groupedFlats[tower] = [];
            GuardApp.groupedFlats[tower].push(flat);
        });

        const towerSelect = document.getElementById("towerSelect");
        const flatSelect = document.getElementById("flatSelect");

        towerSelect.innerHTML = '<option value="">Tower</option>' + Object.keys(GuardApp.groupedFlats).map(t => `<option value="${t}">${t}</option>`).join("");

        towerSelect.addEventListener("change", (e) => {
            const t = e.target.value;
            if (t) {
                flatSelect.disabled = false;
                flatSelect.classList.remove("opacity-50");
                flatSelect.innerHTML = '<option value="">Flat</option>' + GuardApp.groupedFlats[t].map(f => `<option value="${f.id}" data-num="${f.flat_number}">${f.flat_number.split("-").pop()}</option>`).join("");
            } else {
                flatSelect.disabled = true;
                flatSelect.classList.add("opacity-50");
                flatSelect.innerHTML = '<option value="">Flat</option>';
            }
        });
    },

    refreshLiveLogs: async () => {
        const { data: records } = await API.fetchTodayVisitors(GuardApp.society.id);
        const container = document.getElementById("logsContainer");
        
        if (!records || records.length === 0) {
            container.innerHTML = '<div class="text-center py-10 text-slate-600 font-bold">No entries today.</div>';
            return;
        }

        container.innerHTML = records.map(v => {
            const icon = { "Delivery": "fa-box", "Cab": "fa-taxi", "Service": "fa-wrench" }[v.purpose] || "fa-user";
            return `
            <div class="bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-slate-900 text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs border border-slate-700 shrink-0">
                        ${Utils.escapeHTML(v.flat_number || '')}
                    </div>
                    <div>
                        <div class="font-bold text-sm text-white">${Utils.escapeHTML(v.name)}</div>
                        <div class="text-slate-400 text-[10px] font-bold uppercase tracking-wider"><i class="fa-solid ${icon} mr-1"></i> ${Utils.escapeHTML(v.purpose)} • ${Utils.escapeHTML(v.mobile)}</div>
                    </div>
                </div>
                <div class="text-emerald-400 text-xs font-bold bg-emerald-400/10 px-3 py-1 rounded-md">${Utils.formatTime(v.created_at)}</div>
            </div>`;
        }).join("");
    },

    handleManualEntry: async (e) => {
        const btn = e.target;
        const flatId = document.getElementById("flatSelect").value;
        const flatOpt = document.getElementById("flatSelect").selectedOptions[0];
        const name = document.getElementById("vName").value.trim();
        const mobile = document.getElementById("vMobile").value.trim();
        const purpose = document.getElementById("vPurpose").value;

        if (!flatId || !name || !mobile) return Utils.showToast("Fill required details", "error");

        btn.disabled = true;
        btn.textContent = "Processing...";

        const payload = {
            society_id: GuardApp.society.id,
            flat_id: flatId,
            flat_number: flatOpt ? flatOpt.getAttribute("data-num") : '',
            name, mobile, purpose
        };

        const { error } = await API.logVisitor(payload);
        
        if (error) {
            Utils.showToast("Failed to log entry", "error");
        } else {
            Utils.showToast("Access Granted");
            document.getElementById("vName").value = "";
            document.getElementById("vMobile").value = "";
            GuardApp.refreshLiveLogs();
        }

        btn.disabled = false;
        btn.textContent = "Grant Access";
    },

    handleVVIPVerify: async (e) => {
        const btn = e.target;
        const code = document.getElementById("vvipCode").value.trim().toUpperCase();
        if (code.length !== 6) return Utils.showToast("Invalid code format", "error");

        btn.disabled = true;
        const { data: invite, error } = await API.verifyVVIP(code, GuardApp.society.id);

        if (error || !invite) {
            Utils.showToast("Invalid or Expired Code", "error");
        } else if (invite.is_used) {
            Utils.showToast("Pass already consumed", "error");
        } else if (invite.valid_date !== new Date().toISOString().split('T')[0]) {
            Utils.showToast("Pass not valid today", "error");
        } else {
            await API.markVVIPUsed(invite.id);
            await API.logVisitor({
                society_id: GuardApp.society.id,
                flat_id: invite.flat_id,
                flat_number: invite.flat.flat_number,
                name: invite.guest_name,
                mobile: "VVIP PASS",
                purpose: "Guest"
            });
            Utils.showToast("VVIP Verified successfully");
            document.getElementById("vvipCode").value = "";
            GuardApp.refreshLiveLogs();
        }
        btn.disabled = false;
    }
};

GuardApp.init();
