(() => {
  /* ── Config ── */
  const START = 160;
  const TOTAL = 81;
  const src = (i) => `/public/frames/ezgif-frame-${String(START + i)}.jpg`;

  /* ── DOM ── */
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const spacer = document.getElementById("scroll-spacer");
  const preloader = document.getElementById("preloader");
  const pctEl = document.getElementById("loader-percent");

  /* ── State ── */
  const imgs = new Array(TOTAL);
  let loaded = 0;
  let drawn = -1;
  let scrollY = 0;
  let targetY = 0;

  /* ── Cached Layout Metrics (prevent layout thrashing) ── */
  let cachedSpacerHeight = 0;
  let cachedSpacerTop = 0;
  let cachedMaxScroll = 0;

  /* ── Resize (retina-aware) ── */
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    
    cachedSpacerHeight = spacer.offsetHeight;
    cachedSpacerTop = spacer.offsetTop;
    cachedMaxScroll = cachedSpacerHeight - window.innerHeight;
    
    drawn = -1;
  }

  /* ── Draw one frame (cover-fit, centred — fills full viewport, no grey bars) ── */
  function paint(idx) {
    if (idx === drawn) return;
    drawn = idx;

    const img = imgs[idx];
    if (!img || !img.complete) return;

    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;

    // cover: scale so the image fills the canvas entirely (crops if needed)
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ── Scroll → frame index (only within the spacer zone) ── */
  function frameAt(y) {
    const clamped = Math.min(Math.max(y, 0), cachedMaxScroll);
    const t = cachedMaxScroll > 0 ? clamped / cachedMaxScroll : 0;
    return Math.round(t * (TOTAL - 1));
  }

  /* ── Toggle canvas & hero visibility ── */
  const heroOverlay = document.getElementById("hero-overlay");

  function updateCanvasVisibility() {
    const spacerBottom = cachedSpacerTop + cachedSpacerHeight;
    const startFadeY = spacerBottom - window.innerHeight;

    // Smoothly fade out the canvas as the main content slides up over it
    if (scrollY >= startFadeY && startFadeY > 0) {
      const fadeFraction = Math.min(1, (scrollY - startFadeY) / window.innerHeight);
      canvas.style.opacity = 1 - fadeFraction;
    } else {
      canvas.style.opacity = 1;
    }

    const past = window.scrollY >= spacerBottom;
    canvas.classList.toggle("hidden-canvas", past);
    heroOverlay.classList.toggle("hidden-canvas", past);
  }

  /* ── Fade hero text: fully visible at 0%, gone by 45% ── */
  function updateHeroFade(y) {
    const fraction = cachedMaxScroll > 0 ? Math.min(1, Math.max(0, y / cachedMaxScroll)) : 0;

    // Map 0–0.45 → 1–0 opacity (stay visible longer into animation)
    const opacity = fraction < 0.45
      ? 1 - (fraction / 0.45)
      : 0;

    heroOverlay.style.opacity = opacity;
  }

  /* ── Animation loop ── */
  function tick() {
    // Smoother lerp factor, increased responsiveness
    scrollY += (targetY - scrollY) * 0.15;
    if (Math.abs(targetY - scrollY) < 0.1) scrollY = targetY;

    paint(frameAt(scrollY));
    updateCanvasVisibility();
    updateHeroFade(scrollY);
    requestAnimationFrame(tick);
  }

  /* ── Navbar scroll state ── */
  const navbar = document.getElementById("site-navbar");
  function updateNavbar() {
    if (window.scrollY > 80) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  }

  /* ── Listen ── */
  const scrollIndicator = document.getElementById('scroll-indicator');
  let hasScrolled = false;

  window.addEventListener("scroll", () => {
    targetY = window.scrollY;
    updateNavbar();
    // Hide scroll indicator once user starts scrolling
    if (!hasScrolled && window.scrollY > 20 && scrollIndicator) {
      hasScrolled = true;
      scrollIndicator.style.opacity = '0';
      scrollIndicator.style.transition = 'opacity 0.5s ease';
    }
  }, { passive: true });
  window.addEventListener("resize", resize);

  /* ── Preload all frames ── */
  function preload() {
    return new Promise((resolve) => {
      for (let i = 0; i < TOTAL; i++) {
        const img = new Image();
        img.decoding = "async";
        img.src = src(i + 1);

        const done = () => {
          loaded++;
          pctEl.textContent = `${Math.round((loaded / TOTAL) * 100)}%`;
          if (loaded === TOTAL) resolve();
        };
        img.onload = done;
        img.onerror = done;
        imgs[i] = img;
      }
    });
  }

  /* ── Boot ── */
  async function init() {
    resize();
    await preload();

    await Promise.all(
      imgs.filter(i => i && i.complete && i.naturalWidth > 0)
        .map(i => i.decode().catch(() => { }))
    );

    preloader.classList.add("done");

    targetY = window.scrollY;
    scrollY = targetY;
    paint(frameAt(scrollY));
    requestAnimationFrame(tick);
  }

  init();

  /* ── Supabase Integration & Form Handling ── */
  const SUPABASE_URL = "https://shemnvgjpwetoljxrkjw.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_dkdAC8Q-78JEZmWm2B3IEg_frXP3JdH";
  
  let supabase = null;
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const form = document.getElementById("enquiry-form");
  if (form && supabase) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById("submit-btn");
      const btnText = document.getElementById("btn-text");
      const btnSpinner = document.getElementById("btn-spinner");
      const successMsg = document.getElementById("form-success");
      const errorMsg = document.getElementById("form-error");
      
      // Reset UI
      submitBtn.disabled = true;
      btnText.classList.add("hidden");
      btnSpinner.classList.remove("hidden");
      successMsg.classList.add("hidden");
      errorMsg.classList.add("hidden");
      
      // Gather data
      const name = document.getElementById("name").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const email = document.getElementById("email").value.trim();
      const message = document.getElementById("message").value.trim();
      
      try {
        const { error } = await supabase
          .from("enquiries")
          .insert([{ name, phone, email, message }]);
          
        if (error) throw error;
        
        // Success
        successMsg.classList.remove("hidden");
        form.reset();
      } catch (err) {
        console.error("Error submitting form:", err);
        errorMsg.classList.remove("hidden");
      } finally {
        // Restore UI
        submitBtn.disabled = false;
        btnText.classList.remove("hidden");
        btnSpinner.classList.add("hidden");
      }
    });
  }

  /* ── Dynamic Content Fetching ── */
  async function loadDynamicContent() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('site_content').select('key, image_url, content');
      if (error) throw error;
      if (!data) return;

      data.forEach(record => {
        // Find elements that map to this key
        const els = document.querySelectorAll(`[data-dynamic-image="${record.key}"]`);
        els.forEach(el => {
          if (record.image_url && el.tagName === 'IMG') {
            el.src = record.image_url;
          } else if (record.image_url) {
            // Background image replacement for any block element (e.g., DIV, HEADER, SECTION)
            el.style.backgroundImage = `url('${record.image_url}')`;
          }
        });
      });
    } catch (err) {
      console.error("Error loading dynamic content:", err);
    }
  }

  // Load dynamic content right away
  loadDynamicContent();

})();
