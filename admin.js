// --- DEBUG LOGGING UTILITY ---
const debugEl = document.getElementById('debug-log');
function logDebug(msg) {
  console.log(msg);
  if(debugEl) {
    const time = new Date().toLocaleTimeString();
    debugEl.innerHTML += `\n[${time}] ${msg}`;
    debugEl.scrollTop = debugEl.scrollHeight;
  }
}

// Catch global errors so user can see them
window.onerror = function(message, source, lineno, colno, error) {
  logDebug(`GLOBAL CRASH: ${message} at line ${lineno}`);
};
window.addEventListener('unhandledrejection', function(event) {
  logDebug(`PROMISE CRASH: ${event.reason}`);
});

// --- SUPABASE INITIALIZATION ---
logDebug("Initializing Supabase...");
const SUPABASE_URL = "https://shemnvgjpwetoljxrkjw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dkdAC8Q-78JEZmWm2B3IEg_frXP3JdH";
let supabase = null;

if (window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  logDebug("Supabase client created successfully.");
} else {
  logDebug("ERROR: window.supabase is undefined. Library failed to load from CDN.");
}

// --- DOM ELEMENTS ---
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const loginBtn = document.getElementById('login-btn');
const userEmailSpan = document.getElementById('user-email');
const statusToast = document.getElementById('status-toast');
const statusMessage = document.getElementById('status-message');
const imageGrid = document.getElementById('image-grid');

// --- IMAGE KEYS DEFINITION ---
const editableImages = [
  { key: "index_about", label: "Main Home Page - About Us Image" },
  { key: "resort_hero", label: "Fun N Food - Top Hero Banner" },
  { key: "resort_about", label: "Fun N Food - About Us Photo" },
  { key: "resort_gallery_1", label: "Resort Gallery Image 1" },
  { key: "resort_gallery_2", label: "Resort Gallery Image 2" },
  { key: "resort_gallery_3", label: "Resort Gallery Image 3" },
  { key: "resort_gallery_4", label: "Resort Gallery Image 4" },
  { key: "resort_gallery_5", label: "Resort Gallery Image 5" },
  { key: "resort_gallery_6", label: "Resort Gallery Image 6" }
];

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'info') {
  if (type === 'error') {
    alert("Notice: " + message);
  }
  statusMessage.textContent = message;
  statusToast.className = `fixed top-4 right-4 max-w-sm w-full p-4 rounded-lg shadow-lg transition-opacity duration-300 z-50 text-white font-medium`;
  
  if (type === 'error') statusToast.classList.add('bg-red-500');
  else if (type === 'success') statusToast.classList.add('bg-green-500');
  else statusToast.classList.add('bg-blue-500');
  
  statusToast.classList.remove('hidden');
  if (type !== 'loading') {
    setTimeout(() => statusToast.classList.add('hidden'), 4000);
  }
}

// --- AUTHENTICATION FLOW ---
async function checkAuth() {
  if (!supabase) return;
  logDebug("Checking current authentication session...");
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (session) {
      logDebug(`Session found for: ${session.user.email}`);
      showDashboard(session.user);
    } else {
      logDebug("No active session. Waiting for user login.");
      showLogin();
    }
  } catch (err) {
    logDebug(`Auth check error: ${err.message}`);
    showLogin();
  }
}

function showLogin() {
  authView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
}

function showDashboard(user) {
  authView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  dashboardView.classList.add('flex');
  if (user && user.email) userEmailSpan.textContent = user.email;
  loadDashboardImages();
}

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    logDebug(`Auth event triggered: ${event}`);
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      showDashboard(session.user);
    } else if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
  checkAuth();
}

async function attemptLogin() {
  logDebug("Login button clicked!");
  if (!supabase) {
    showToast("System error: Supabase is not connected.", "error");
    logDebug("ERROR: Cannot login because supabase is null.");
    return;
  }
  
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    showToast("Please enter both email and password.", "error");
    logDebug("ERROR: Email or password field was empty.");
    return;
  }
  
  logDebug(`Attempting to sign in with email: ${email}`);
  const originalText = loginBtn.innerHTML;
  loginBtn.innerHTML = '<span>Logging in...</span>';
  loginBtn.disabled = true;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      logDebug(`Supabase login rejected: ${error.message}`);
      showToast(error.message, 'error');
    } else {
      logDebug(`Login successful! User ID: ${data.user.id}`);
      showToast('Successfully logged in!', 'success');
      emailInput.value = '';
      passwordInput.value = '';
    }
  } catch (err) {
    logDebug(`Unexpected login exception: ${err.message}`);
    showToast(err.message || "Failed to log in", "error");
  } finally {
    loginBtn.innerHTML = originalText;
    loginBtn.disabled = false;
  }
}

async function attemptLogout() {
  logDebug("Logging out...");
  const { error } = await supabase.auth.signOut();
  if (error) {
    logDebug(`Logout error: ${error.message}`);
    showToast('Error signing out', 'error');
  } else {
    logDebug("Logged out successfully.");
    showToast('Signed out successfully', 'success');
  }
}

// --- DASHBOARD IMAGE MANAGER ---
async function loadDashboardImages() {
  logDebug("Fetching current website images from database...");
  imageGrid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">Loading images...</div>';
  
  try {
    const { data: records, error } = await supabase.from('site_content').select('*');
    if (error) throw error;
    
    const recordMap = {};
    if (records) {
      records.forEach(r => recordMap[r.key] = r);
    }

    imageGrid.innerHTML = '';
    
    editableImages.forEach((imgObj) => {
      const currentRecord = recordMap[imgObj.key];
      const hasImage = currentRecord && currentRecord.image_url;
      const displayUrl = hasImage ? currentRecord.image_url : 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Photo+Yet';
      
      const cardHtml = `
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div class="h-48 w-full bg-gray-100 relative group">
            <img src="${displayUrl}" class="w-full h-full object-cover" alt="${imgObj.label}">
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <button onclick="triggerFileInput('${imgObj.key}')" class="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm shadow-lg hover:bg-gray-50 transition-colors">
                 Replace Photo
               </button>
            </div>
          </div>
          <div class="p-4 border-t border-gray-100 flex-grow flex flex-col justify-between">
            <div>
              <h3 class="font-bold text-gray-800 text-sm mb-1">${imgObj.label}</h3>
              <p class="text-xs text-gray-500 break-all mb-3">ID: ${imgObj.key}</p>
            </div>
            <input type="file" id="file-${imgObj.key}" accept="image/*" class="hidden" onchange="handleImageUpload(event, '${imgObj.key}')">
            <button onclick="triggerFileInput('${imgObj.key}')" class="w-full py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              Upload New Photo
            </button>
          </div>
        </div>
      `;
      imageGrid.innerHTML += cardHtml;
    });

    logDebug("Image gallery rendered successfully.");
  } catch (err) {
    logDebug(`Error loading images: ${err.message}`);
    imageGrid.innerHTML = `<div class="col-span-full text-center py-10 text-red-500 font-semibold">Failed to load images: ${err.message}</div>`;
  }
}

// Ensure triggerFileInput and handleImageUpload are globally accessible for the inline onclick attributes we just built in the template literal above
window.triggerFileInput = function(key) {
  document.getElementById(`file-${key}`).click();
}

window.handleImageUpload = async function(event, key) {
  const file = event.target.files[0];
  if (!file) return;

  logDebug(`Uploading new file for ${key}...`);
  showToast('Uploading new photo...', 'loading');

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${key}_${Date.now()}.${fileExt}`;
    const filePath = `${key}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('website-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('website-images')
      .getPublicUrl(filePath);

    const record = {
      key: key,
      image_url: publicUrl,
      updated_at: new Date().toISOString()
    };

    const { error: dbError } = await supabase
      .from('site_content')
      .upsert(record, { onConflict: 'key' });

    if (dbError) throw dbError;

    showToast('Photo updated successfully!', 'success');
    logDebug(`Successfully updated ${key} with new photo URL.`);
    loadDashboardImages();
  } catch (err) {
    console.error(err);
    logDebug(`Upload Error: ${err.message}`);
    showToast(err.message || 'An error occurred during upload.', 'error');
  }
}

// --- BIND EVENT LISTENERS ---
try {
  document.getElementById('login-btn').addEventListener('click', attemptLogin);
  document.getElementById('logout-btn').addEventListener('click', attemptLogout);
  document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') attemptLogin();
  });
  logDebug("Event listeners attached successfully.");
} catch(err) {
  logDebug(`CRITICAL ERROR attaching listeners: ${err.message}`);
}
