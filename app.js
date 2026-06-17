// ==========================================
// SUPABASE SETUP (Apni keys yahan daalo)
// ==========================================
const SUPABASE_URL = 'https://rqorglbbcaupaskaronb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxb3JnbGJiY2F1cGFza2Fyb25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTQ0MTMsImV4cCI6MjA5Njg5MDQxM30.ViB8Jzu9FNubHcWhrxpnjfvXp8hMjy_zbkPiCtQ6opw';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// PWA SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/OneSignalSDKWorker.js').then(function(registration) {
      console.log('PWA & OneSignal ServiceWorker registered!');
    }).catch(function(err) {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// ==========================================
// ONESIGNAL INITIALIZATION & PERMISSION PROMPT
// ==========================================
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
  await OneSignal.init({
    appId: "0e2347fd-c9d9-41e4-8e16-86862852e147", 
    notifyButton: {
      enable: true,
    },
  });
  
  OneSignal.Slidedown.promptPush();
});

// ==========================================
// CUSTOM TOAST ALERTS
// ==========================================
function showToast(message, type) {
  var toastType = type || "success";
  var container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none";
    document.body.appendChild(container);
  }
  var toast = document.createElement("div");
  var bgColor = toastType === "error" ? "bg-red-500" : "bg-emerald-500";
  var icon = toastType === "error" ? "fa-circle-xmark" : "fa-circle-check";
  toast.className = bgColor + " text-white px-4 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 transform transition-all duration-300 translate-x-full opacity-0";
  toast.innerHTML = '<i class="fa-solid ' + icon + ' text-base"></i> <span>' + message + '</span>';
  container.appendChild(toast);
  requestAnimationFrame(function () { toast.classList.add("toast-enter"); });
  setTimeout(function () {
    toast.classList.remove("toast-enter");
    toast.classList.add("toast-exit");
    setTimeout(function () { toast.remove(); }, 300);
  }, 3000);
}

// ==========================================
// PBAC: FEATURE CHECKER
// ==========================================
function hasFeatureAccess(planType, feature) {
  var PLAN_FEATURES = {
    'Starter': ['basic_entry', 'manual_logs', 'live_logs'],
    'Professional': ['basic_entry', 'manual_logs', 'live_logs', 'csv_export', 'resident_management', 'vvip_pass', 'staff_management'],
    'Enterprise': ['basic_entry', 'manual_logs', 'live_logs', 'csv_export', 'resident_management', 'vvip_pass', 'staff_management', 'unlimited_flats']
  };
  var plan = planType || 'Starter';
  return !!(PLAN_FEATURES[plan] && PLAN_FEATURES[plan].includes(feature));
}

var appRoot = document.getElementById("app-root");

// ==========================================
// 1. PIN SETUP / LOGIN SCREEN (Main Entry Point)
// ==========================================
function showPinSetupScreen() {
  appRoot.innerHTML = [
    '<div class="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">',
      '<div class="absolute top-0 right-0 p-8 opacity-5 text-9xl"><i class="fa-solid fa-lock"></i></div>',
      '<div class="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-700 relative z-10">',
        '<div class="w-16 h-16 bg-slate-900 text-indigo-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 border border-slate-700 shadow-inner">',
          '<i class="fa-solid fa-shield-halved"></i>',
        '</div>',
        '<h2 class="text-2xl font-black text-white mb-2">GateGuard Terminal</h2>',
        '<p class="text-xs font-medium text-slate-400 mb-6">Enter the 6-Digit Setup PIN provided by society admin to link this device.</p>',
        '<input id="guardSetupInput" type="password" maxlength="6" placeholder="••••••" class="w-full text-center tracking-[0.5em] font-black text-3xl px-4 py-4 rounded-xl border border-slate-600 bg-slate-900 text-white mb-6 outline-none focus:border-indigo-500 transition-all">',
        '<button id="verifyGuardSetupBtn" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all outline-none">',
          'Authorize Device',
        '</button>',
      '</div>',
    '</div>'
  ].join('');

  document.getElementById("verifyGuardSetupBtn").addEventListener("click", async function () {
    var inputEl = document.getElementById("guardSetupInput");
    var code = inputEl.value.trim();

    if (code.length !== 6) { showToast("Enter a valid 6-digit PIN", "error"); return; }

    var btn = document.getElementById("verifyGuardSetupBtn");
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';
    btn.disabled = true;

    // maybeSingle() lagaya hua hai error handle karne ke liye
    var result = await supabaseClient.from("societies").select("*").eq("guard_pin", code).maybeSingle();
    var society = result.data;
    var error = result.error;

    if (error || !society) {
      showToast("Invalid PIN. Please ask admin for the correct PIN.", "error");
      inputEl.value = "";
      btn.innerHTML = "Authorize Device";
      btn.disabled = false;
      return;
    }

    var plan = society.plan_type || 'Starter';
    var isMultiAllowed = (plan === 'Enterprise' || plan === 'Custom');
    var newToken = "guard_auth_" + Math.random().toString(36).substr(2);

    if (!isMultiAllowed) {
      await supabaseClient.from("societies").update({ guard_device_token: newToken }).eq("id", society.id);
    }

    localStorage.setItem("guard_society_id", society.id);
    localStorage.setItem("guard_device_token", newToken);

    showToast("Linked to " + society.name + "!", "success");
    showGuardConsole(society.id, newToken);
  });
}

// ==========================================
// 2. MAIN GUARD CONSOLE UI
// ==========================================
async function showGuardConsole(societyId, deviceToken) {
  appRoot.innerHTML = '<div class="min-h-screen flex items-center justify-center font-bold text-slate-500 bg-slate-900">Connecting to Base Station...</div>';

  var societyResult = await supabaseClient.from("societies").select("*").eq("id", societyId).maybeSingle();
  var society = societyResult.data;
  var societyError = societyResult.error;

  if (societyError || !society) {
    localStorage.removeItem("guard_society_id");
    localStorage.removeItem("guard_device_token");
    showToast("Society not found. Please setup again.", "error");
    showPinSetupScreen();
    return;
  }

  var plan = society.plan_type || 'Starter';
  var isMultiAllowed = (plan === 'Enterprise' || plan === 'Custom');

  if (!isMultiAllowed && society.guard_device_token && society.guard_device_token !== deviceToken) {
    localStorage.removeItem("guard_society_id");
    localStorage.removeItem("guard_device_token");
    showToast("Logged out! Another Guard Tablet was signed in.", "error");
    setTimeout(function () { window.location.reload(); }, 2500);
    return;
  }

  appRoot.innerHTML = [
    '<div class="min-h-screen bg-slate-900 text-white font-sans flex flex-col md:flex-row overflow-hidden">',
      '<div class="w-full md:w-[350px] lg:w-[400px] bg-slate-800 border-r border-slate-700 p-6 flex flex-col shrink-0 md:h-screen md:overflow-y-auto">',
        '<div class="mb-8 flex justify-between items-start">',
          '<div>',
            '<h1 id="societyNameTitle" class="text-2xl font-black text-indigo-400 leading-tight">' + society.name + '</h1>',
            '<div id="clockDisplay" class="text-xl font-mono font-bold mt-2 text-slate-300 tracking-wider">00:00:00</div>',
          '</div>',
          '<button id="logoutGuardBtn" class="text-slate-400 hover:text-white px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold transition-all outline-none">',
            '<i class="fa-solid fa-right-from-bracket"></i> Exit',
          '</button>',
        '</div>',

        '<div class="bg-slate-900 p-5 rounded-2xl border border-slate-700 mb-6 shadow-inner">',
          '<h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fa-solid fa-user-plus text-indigo-500"></i> New Visitor Entry</h3>',
          '<select id="guardTowerSelect" class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none mb-3 text-sm font-bold appearance-none cursor-pointer">',
            '<option value="">Select Tower</option>',
          '</select>',
          '<select id="guardFlatSelect" disabled class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 outline-none mb-4 text-sm font-bold appearance-none cursor-not-allowed">',
            '<option value="">Select Tower 1st</option>',
          '</select>',
          '<input id="guardVisitorName" type="text" placeholder="Visitor Name" class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none mb-3 text-sm font-bold">',
          '<input id="guardVisitorMobile" type="tel" maxlength="10" placeholder="Mobile Number" class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none mb-3 text-sm font-bold">',
          '<select id="guardVisitorPurpose" class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none mb-5 text-sm font-bold appearance-none cursor-pointer">',
            '<option value="Guest">Guest / Relative</option>',
            '<option value="Delivery">Delivery / Courier</option>',
            '<option value="Cab">Cab / Taxi</option>',
            '<option value="Service">Service / Repair</option>',
          '</select>',
          '<button id="guardSubmitBtn" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all outline-none flex items-center justify-center gap-2">',
            '<i class="fa-solid fa-check"></i> ALLOW ENTRY',
          '</button>',
        '</div>',

        '<div class="bg-slate-900 p-5 rounded-2xl border border-slate-700">',
          '<h3 class="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fa-solid fa-crown"></i> Scan VVIP / Guest Pass</h3>',
          '<div class="flex gap-2">',
            '<input id="vvipInputCode" type="text" maxlength="6" placeholder="6-Digit Code" class="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none text-sm uppercase text-center font-bold tracking-widest focus:border-amber-500 transition-colors">',
            '<button id="verifyVvipBtn" class="bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-xl font-bold text-white shadow-md transition-all outline-none">Verify</button>',
          '</div>',
        '</div>',
      '</div>',

      '<div class="flex-1 bg-slate-900 p-6 flex flex-col md:h-screen">',
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0 border-b border-slate-800 pb-4">',
          '<div>',
            '<h2 class="text-xl font-black text-white">Live Operations</h2>',
            '<p class="text-xs text-slate-500">Real-time gate activity logs</p>',
          '</div>',
          '<button id="openScannerBtn" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 outline-none transition-all shadow-md">',
            '<i class="fa-solid fa-qrcode"></i> Scan Staff ID',
          '</button>',
        '</div>',
        '<div id="guardRecordsContainer" class="flex-1 overflow-y-auto space-y-2 pr-2">',
          '<div class="text-center py-20 text-slate-600"><i class="fa-solid fa-circle-notch fa-spin text-3xl mb-2"></i><br>Loading records...</div>',
        '</div>',
      '</div>',
    '</div>',

    '<div id="scannerModal" class="hidden fixed inset-0 bg-slate-900/95 z-[9999] flex-col items-center justify-center p-4 backdrop-blur-md">',
      '<div class="w-full max-w-sm bg-slate-800 p-5 rounded-3xl border border-slate-700 shadow-2xl relative">',
        '<div class="flex justify-between items-center mb-4">',
          '<h3 class="text-white font-bold text-lg"><i class="fa-solid fa-expand text-indigo-400 mr-2"></i> Scan Staff QR</h3>',
          '<button id="closeScannerBtn" class="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-white text-lg outline-none transition-colors">&times;</button>',
        '</div>',
        '<div id="qr-reader" class="w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-600 bg-slate-900 min-h-[250px]"></div>',
        '<p class="text-xs text-slate-400 text-center mt-4">Position the staff QR code inside the frame to log IN/OUT time automatically.</p>',
      '</div>',
    '</div>'
  ].join('');

  // Real-time Clock
  setInterval(function () {
    var clock = document.getElementById("clockDisplay");
    if (clock) { 
      clock.innerText = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
      }); 
    }
  }, 1000);

  // Logout Listener
  document.getElementById("logoutGuardBtn").addEventListener("click", function () {
    if (confirm("Logout from Console? You will need the PIN to authorize this device again.")) {
      localStorage.removeItem("guard_society_id");
      localStorage.removeItem("guard_device_token");
      window.location.reload();
    }
  });

  // Dropdown Logic
  var towerSelect = document.getElementById("guardTowerSelect");
  var flatSelect = document.getElementById("guardFlatSelect");

  var flatsResult = await supabaseClient.from("flats").select("*").eq("society_id", society.id).order("flat_number");
  var flats = flatsResult.data;
  var groupedFlats = {};

  if (flats) {
    flats.forEach(function (flat) {
      var parts = flat.flat_number.split("-");
      var tower = parts.length > 1 ? parts[0].trim() : "Ind";
      if (!groupedFlats[tower]) { groupedFlats[tower] = []; }
      groupedFlats[tower].push(flat);
    });

    var towerHtml = '<option value="">Select Tower</option>';
    for (var tower in groupedFlats) {
      towerHtml += '<option value="' + tower + '">' + tower + '</option>';
    }
    towerSelect.innerHTML = towerHtml;

    towerSelect.addEventListener("change", function () {
      var selected = towerSelect.value;
      if (selected && groupedFlats[selected]) {
        flatSelect.disabled = false;
        flatSelect.className = "w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white outline-none mb-4 text-sm font-bold cursor-pointer transition-all";
        var flatHtml = '<option value="">Select Flat</option>';
        groupedFlats[selected].forEach(function (flat) {
          var flatOnly = flat.flat_number.includes("-") ? flat.flat_number.split("-")[1] : flat.flat_number;
          flatHtml += '<option value="' + flat.id + '" data-fullname="' + flat.flat_number + '">' + flatOnly + '</option>';
        });
        flatSelect.innerHTML = flatHtml;
      } else {
        flatSelect.disabled = true;
        flatSelect.className = "w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 outline-none mb-4 text-sm font-bold cursor-not-allowed transition-all";
        flatSelect.innerHTML = '<option value="">Select Tower 1st</option>';
      }
    });
  }

  // Load Records Logic
  var loadGuardRecords = async function () {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var recResult = await supabaseClient.from("visitors").select("*").eq("society_id", society.id).gte("created_at", today.toISOString()).order("created_at", { ascending: false });
    var records = recResult.data;

    var container = document.getElementById("guardRecordsContainer");
    if (!container) { return; }

    if (!records || records.length === 0) {
      container.innerHTML = '<div class="text-center bg-slate-800/50 rounded-2xl border border-slate-700/50 text-slate-500 py-16 text-sm font-bold"><i class="fa-solid fa-mug-hot text-2xl mb-3 opacity-50"></i><br>No entries recorded today yet.</div>';
      return;
    }

    var html = "";
    records.forEach(function (v) {
      var timeStr = new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      var icon = "fa-user";
      if (v.purpose === "Delivery") { icon = "fa-box"; }
      if (v.purpose === "Cab") { icon = "fa-taxi"; }
      if (v.purpose === "Service") { icon = "fa-wrench"; }

      var flatBadge = v.flat_number ? v.flat_number : '<i class="fa-solid ' + icon + '"></i>';

      html += [
        '<div class="bg-slate-800 p-4 rounded-2xl flex justify-between items-center border border-slate-700 mb-2 hover:border-slate-500 transition-colors">',
          '<div class="flex items-center gap-4">',
            '<div class="w-12 h-12 bg-slate-900 text-indigo-400 rounded-xl flex items-center justify-center font-black text-sm border border-slate-700 shadow-inner shrink-0">',
              flatBadge,
            '</div>',
            '<div>',
              '<div class="font-bold text-white text-sm mb-0.5">' + v.name + '</div>',
              '<div class="text-slate-400 text-[10px] font-bold uppercase tracking-widest"><i class="fa-solid ' + icon + ' mr-1"></i> ' + v.purpose + ' • ' + v.mobile + '</div>',
            '</div>',
          '</div>',
          '<div class="text-right text-emerald-400 text-xs font-black bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/20 shrink-0">' + timeStr + '</div>',
        '</div>'
      ].join('');
    });
    container.innerHTML = html;
  };
  loadGuardRecords();

  // Submit New Visitor
  var submitBtn = document.getElementById("guardSubmitBtn");
  submitBtn.addEventListener("click", async function () {
    var flatId = flatSelect.value;
    var name = document.getElementById("guardVisitorName").value.trim();
    var mobile = document.getElementById("guardVisitorMobile").value.trim();
    var purpose = document.getElementById("guardVisitorPurpose").value;

    if (!towerSelect.value || !flatId || !name || !mobile) {
      showToast("Fill all details", "error");
      return;
    }

    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    submitBtn.disabled = true;

    var flatText = flatSelect.options[flatSelect.selectedIndex].getAttribute("data-fullname") || "";
    var insertResult = await supabaseClient.from("visitors").insert({
      society_id: society.id, flat_id: flatId, flat_number: flatText, name: name, mobile: mobile, purpose: purpose
    });

    if (insertResult.error) {
      showToast(insertResult.error.message, "error");
      submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> ALLOW ENTRY';
      submitBtn.disabled = false;
      return;
    }

    // 🔥 SECURE FIRE PREMIUM PUSH NOTIFICATION (Netlify backend call)
    sendPremiumPushNotification(society.plan_type, flatId, name, purpose);

    document.getElementById("guardVisitorName").value = "";
    document.getElementById("guardVisitorMobile").value = "";

    submitBtn.classList.replace("bg-emerald-600", "bg-indigo-600");
    submitBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> SUCCESS';

    setTimeout(function () {
      submitBtn.classList.replace("bg-indigo-600", "bg-emerald-600");
      submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> ALLOW ENTRY';
      submitBtn.disabled = false;
    }, 2000);

    loadGuardRecords();
  });

  // Verify VVIP Pass
  document.getElementById("verifyVvipBtn").addEventListener("click", async function () {
    if (!hasFeatureAccess(society.plan_type, 'vvip_pass')) {
      showToast("VVIP feature locked! Ask Admin to upgrade plan.", "error");
      return;
    }

    var code = document.getElementById("vvipInputCode").value.trim().toUpperCase();
    if (code.length !== 6) { showToast("Enter valid 6-digit code!", "error"); return; }

    var vvipBtn = document.getElementById("verifyVvipBtn");
    vvipBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    vvipBtn.disabled = true;

    // 🔥 FIX: Changed .single() to .maybeSingle() to prevent 406 Error on invalid codes
    var inviteResult = await supabaseClient.from("guest_invites").select("*, flat:flats(flat_number)").eq("invite_code", code).eq("society_id", society.id).maybeSingle();
    
    var invite = inviteResult.data;
    var inviteError = inviteResult.error;

    if (inviteError || !invite) {
      showToast("Invalid Code!", "error");
      vvipBtn.innerText = "Verify";
      vvipBtn.disabled = false;
      return;
    }
    if (invite.is_used) {
      showToast("Code already used!", "error");
      vvipBtn.innerText = "Verify";
      vvipBtn.disabled = false;
      return;
    }

    var todayStr = new Date().toISOString().split('T')[0];
    if (invite.valid_date !== todayStr) {
      showToast("Valid only for " + invite.valid_date, "error");
      vvipBtn.innerText = "Verify";
      vvipBtn.disabled = false;
      return;
    }

    await supabaseClient.from("guest_invites").update({ is_used: true }).eq("id", invite.id);
    
    await supabaseClient.from("visitors").insert({
      society_id: society.id,
      flat_id: invite.flat_id,
      flat_number: invite.flat.flat_number,
      name: invite.guest_name,
      mobile: "VVIP Pass",
      purpose: "Guest",
      vehicle_number: null
    });

    // 🔥 SECURE FIRE PREMIUM PUSH NOTIFICATION (For VVIP Entry)
    sendPremiumPushNotification(society.plan_type, invite.flat_id, invite.guest_name, "VVIP Guest");

    document.getElementById("vvipInputCode").value = "";
    vvipBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    vvipBtn.classList.replace("bg-indigo-600", "bg-emerald-500");

    setTimeout(function () {
      vvipBtn.innerText = "Verify";
      vvipBtn.classList.replace("bg-emerald-500", "bg-indigo-600");
      vvipBtn.disabled = false;
    }, 2000);

    loadGuardRecords();
  });

  // Staff QR Scanner
  var openScannerBtn = document.getElementById("openScannerBtn");
  var closeScannerBtn = document.getElementById("closeScannerBtn");
  var scannerModal = document.getElementById("scannerModal");
  var html5QrcodeScanner = null;

  openScannerBtn.addEventListener("click", function () {
    if (!hasFeatureAccess(society.plan_type, 'staff_management')) {
      showToast("Staff Module locked! Ask Admin to upgrade plan.", "error");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Browser blocking camera access. Use Chrome/Safari.", "error");
      return;
    }

    scannerModal.classList.remove("hidden");
    scannerModal.classList.add("flex");

    var startScanner = function () {
      try {
        if (!html5QrcodeScanner) {
          html5QrcodeScanner = new window.Html5QrcodeScanner(
            "qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false
          );
        }

        html5QrcodeScanner.render(async function (decodedText) {
          if (html5QrcodeScanner) { html5QrcodeScanner.clear(); }
          scannerModal.classList.add("hidden");
          scannerModal.classList.remove("flex");

          showToast("Scanned: Processing...", "success");

          if (decodedText.startsWith("staff-")) {
            var staffResult = await supabaseClient.from("staff").select("*").eq("qr_slug", decodedText).maybeSingle();
            var staffData = staffResult.data;

            if (staffData && staffData.is_active) {
              var todayDate = new Date().toISOString().split('T')[0];
              var openLogResult = await supabaseClient.from("staff_attendance")
                .select("*").eq("staff_id", staffData.id).eq("date", todayDate).is("time_out", null).maybeSingle();
              var openLog = openLogResult.data;

              if (openLog) {
                await supabaseClient.from("staff_attendance").update({ time_out: new Date().toISOString() }).eq("id", openLog.id);
                showToast("OUT Logged: " + staffData.name, "success");
              } else {
                await supabaseClient.from("staff_attendance").insert({
                  staff_id: staffData.id,
                  society_id: society.id,
                  date: todayDate,
                  time_in: new Date().toISOString()
                });
                showToast("IN Logged: " + staffData.name, "success");
              }
            } else {
              showToast("Invalid or Inactive Staff ID", "error");
            }
          } else if (decodedText.startsWith("http")) {
            showToast("Wrong QR! This is an App Link.", "error");
          } else {
            showToast("Unrecognized QR Code Format", "error");
          }
        }, function (errorMessage) {
          if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission denied")) {
            if (html5QrcodeScanner) { html5QrcodeScanner.clear(); }
            scannerModal.classList.add("hidden");
            scannerModal.classList.remove("flex");
            showToast("Camera Permission Denied! Allow access.", "error");
          }
        });
      } catch (err) {
        showToast("Camera initialization failed.", "error");
      }
    };

    if (!window.Html5QrcodeScanner) {
      showToast("Starting Camera Module...", "success");
      var script = document.createElement("script");
      script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.onload = function () { startScanner(); };
      script.onerror = function () { showToast("Failed to load scanner library.", "error"); };
      document.head.appendChild(script);
    } else {
      startScanner();
    }
  });

  closeScannerBtn.addEventListener("click", function () {
    if (html5QrcodeScanner) { html5QrcodeScanner.clear(); }
    scannerModal.classList.add("hidden");
    scannerModal.classList.remove("flex");
  });
}

// ==========================================
// ROUTER INITIALIZATION
// ==========================================
function initApp() {
  var societyId = localStorage.getItem("guard_society_id");
  var deviceToken = localStorage.getItem("guard_device_token");

  if (societyId && deviceToken) {
    showGuardConsole(societyId, deviceToken);
  } else {
    showPinSetupScreen();
  }
}

// ==========================================
// SECURE NETLIFY FUNCTION CALL FOR PUSH
// ==========================================
async function sendPremiumPushNotification(societyPlan, flatId, visitorName, purpose) {
  if (societyPlan === 'Starter') {
    console.log("Starter Plan: Web Push skipped.");
    return;
  }

  try {
    const response = await fetch("/.netlify/functions/sendPush", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        flatId: flatId,
        visitorName: visitorName,
        purpose: purpose
      })
    });

    if (response.ok) {
        console.log("✅ Secure Premium Push Sent via Backend!");
    } else {
        console.error("❌ Backend returned an error", await response.text());
    }
  } catch (error) {
    console.error("❌ Secure Push Request Failed:", error);
  }
}

// START THE APP
initApp();
