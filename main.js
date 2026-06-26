(() => {
  /* ── Config ── */
  const isMobile = window.innerWidth <= 768;
  const START = 0;
  // Load all 196 frames on desktop. On mobile, load every 3rd frame (66 frames total) to prevent memory crashes.
  const TOTAL = isMobile ? 66 : 196;
  const src = (i) => {
    // For mobile, i=1 -> 1, i=2 -> 4, i=3 -> 7, up to 196.
    const actualIndex = isMobile ? ((i - 1) * 3 + 1) : i;
    const frameNum = String(START + actualIndex).padStart(3, '0');
    return `/public/frames/ezgif-frame-${frameNum}.jpg?v=4`;
  };

  /* ── DOM ── */
  const canvas = document.getElementById("canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
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
  let lastWindowWidth = 0;

  /* ── Resize (retina-aware) ── */
  function resize() {
    if (!canvas || !spacer) return;
    
    // On mobile, vertical scrolling triggers resize due to address bar hiding/showing.
    // Avoid clearing the canvas buffer if only the height changed.
    const isWidthChange = window.innerWidth !== lastWindowWidth;
    lastWindowWidth = window.innerWidth;
    
    if (isWidthChange || canvas.width === 0) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      drawn = -1;
    }
    
    cachedSpacerHeight = spacer.offsetHeight;
    cachedSpacerTop = spacer.offsetTop;
    cachedMaxScroll = cachedSpacerHeight - window.innerHeight;
  }

  /* ── Draw one frame (cover-fit, centred — fills full viewport, no grey bars) ── */
  function paint(idx) {
    if (!canvas || !ctx) return;
    
    const img = imgs[idx];
    // If image was purged by mobile browser, its naturalWidth will be 0.
    // We must return before setting `drawn = idx` so it can try again next tick.
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;

    if (idx === drawn) return;
    drawn = idx;

    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;

    // cover: scale so the image fills the canvas entirely (crops if needed)
    // The JPEGs are 1440x2560, but contain massive black bars. The actual video is 1440x812 in the center.
    // We scale based on the actual video height so it fills the screen on mobile devices without black bars.
    const actualVideoHeight = 812;
    const s = Math.max(cw / iw, ch / actualVideoHeight);
    const dw = iw * s, dh = ih * s;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    try {
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch (e) {
      console.error("Canvas draw error:", e);
    }
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
    if (!canvas || !heroOverlay) return;
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
    if (past !== heroOverlay.classList.contains("hidden-canvas")) {
      heroOverlay.classList.toggle("hidden-canvas", past);
    }
  }

  /* ── Fade hero text: fully visible at 0%, gone by 45% ── */
  function updateHeroFade(y) {
    if (!heroOverlay) return;
    const fraction = cachedMaxScroll > 0 ? Math.min(1, Math.max(0, y / cachedMaxScroll)) : 0;

    // Map 0–0.45 → 1–0 opacity (stay visible longer into animation)
    const opacity = fraction < 0.45
      ? 1 - (fraction / 0.45)
      : 0;

    heroOverlay.style.opacity = opacity;
  }

  /* ── Animation loop ── */
  function tick() {
    try {
      // Smoother lerp factor, increased responsiveness
      scrollY += (targetY - scrollY) * 0.15;
      if (Math.abs(targetY - scrollY) < 0.1) scrollY = targetY;

      paint(frameAt(scrollY));
      updateCanvasVisibility();
      updateHeroFade(scrollY);
    } catch (e) {
      console.error("Tick error:", e);
    } finally {
      requestAnimationFrame(tick);
    }
  }

  /* ── Navbar scroll state ── */
  const navbar = document.getElementById("site-navbar");
  function updateNavbar() {
    if (!navbar) return;
    // Turn solid only when the next section (<main>) reaches the top of the viewport
    const threshold = cachedSpacerHeight > 0 ? cachedSpacerHeight : 80;
    if (window.scrollY > threshold) {
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
      const loadImg = (i) => {
        return new Promise((res) => {
          const img = new Image();
          img.decoding = "async";
          img.src = src(i + 1);
          const done = () => {
            loaded++;
            if (pctEl) pctEl.textContent = `${Math.round((loaded / TOTAL) * 100)}%`;
            res(img);
          };
          img.onload = done;
          img.onerror = done;
          imgs[i] = img;
        });
      };

      // Load first frame immediately
      loadImg(0).then(() => {
        // Unblock UI as soon as the first frame is guaranteed to be ready
        resolve();
        
        // Load the remaining frames in the background
        for (let i = 1; i < TOTAL; i++) {
          loadImg(i);
        }
      });
    });
  }

  /* ── Boot ── */
  async function init() {
    if (!canvas) return;
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
        
        // Smart Redirect Logic
        const textMessage = `New Enquiry!\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nMessage: ${message}`;
        const isFunNFood = window.location.pathname.includes('fun-n-food');
        
        if (isFunNFood) {
          const waUrl = `https://wa.me/919479800333?text=${encodeURIComponent(textMessage)}`;
          const mailUrl = `mailto:funandfoodresort@gmail.com?subject=New Enquiry from ${encodeURIComponent(name)}&body=${encodeURIComponent(textMessage)}`;
          // Try opening email in background, redirect main window to WhatsApp
          window.open(mailUrl, '_blank');
          window.location.href = waUrl;
        } else {
          const mailUrl = `mailto:s.kumarcreation@yahoo.com?subject=New Enquiry from ${encodeURIComponent(name)}&body=${encodeURIComponent(textMessage)}`;
          window.location.href = mailUrl;
        }
        
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

      const galleryImages = [];

      data.forEach(record => {
        // 1. Handle Dynamic Media
        const imgEls = document.querySelectorAll(`[data-dynamic-image="${record.key}"]`);
        imgEls.forEach(el => {
          if (record.image_url && el.tagName === 'IMG') {
            el.src = record.image_url;
            if (!el.hasAttribute("loading")) {
              el.setAttribute("loading", "lazy");
            }
          } else if (record.image_url && el.tagName === 'VIDEO') {
            el.src = record.image_url;
            el.load();
          } else if (record.image_url) {
            // Background image replacement
            el.style.backgroundImage = `url('${record.image_url}')`;
          }
        });

        // 2. Handle Dynamic Text
        const txtEls = document.querySelectorAll(`[data-dynamic-text="${record.key}"]`);
        txtEls.forEach(el => {
          if (record.content) {
            // Convert newlines to breaks to preserve paragraphs
            el.innerHTML = record.content.replace(/\n/g, '<br>');
          }
        });

        // 3. Collect Infinite Gallery Images
        if (record.key.startsWith('skcpl_gallery_item_') || record.key.startsWith('resort_gallery_item_') || record.key.startsWith('solar_gallery_item_')) {
          if (record.image_url) {
            galleryImages.push(record);
          }
        }
      });

      // 4. Render Infinite Gallery
      galleryImages.sort((a, b) => b.key.localeCompare(a.key)); // Sort newest first
      
      const galleryContainers = document.querySelectorAll('[data-dynamic-gallery]');
      galleryContainers.forEach(container => {
        const galleryType = container.getAttribute('data-dynamic-gallery'); // 'skcpl' or 'resort'
        const relevantImages = galleryImages.filter(img => img.key.startsWith(`${galleryType}_gallery_item_`));

        if (relevantImages.length > 0) {
          relevantImages.forEach(img => {
            const div = document.createElement('div');
            // A hybrid responsive class that looks good on both pages
            div.className = "group relative rounded-xl overflow-hidden h-48 sm:h-64 cursor-pointer shadow-sm hover:shadow-md transition-shadow";
            div.innerHTML = `
              <img src="${img.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
              <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-400"></div>
            `;
            // Since it's a dedicated page now, we can use appendChild (or prepend, doesn't matter, it starts empty)
            container.appendChild(div);
          });
        }
      });

    } catch (err) {
      console.error("Error loading dynamic content:", err);
    }
  }

  // Load dynamic content right away
  loadDynamicContent();

  /* ── Theme Toggle ── */
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      if (document.documentElement.classList.contains('dark')) {
        localStorage.theme = 'dark';
      } else {
        localStorage.theme = 'light';
      }
    });
  }

  /* ── Stats Counter Animation ── */
  const statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length > 0) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const targetText = el.getAttribute('data-target');
          const targetNum = parseInt(targetText.replace(/[^0-9]/g, ''));
          const suffix = targetText.replace(/[0-9]/g, '');
          
          let startTimestamp = null;
          const duration = 1500;
          
          const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // easeOutQuad for a very smooth and consistent slow down
            const easeProgress = 1 - (1 - progress) * (1 - progress);
            const currentNum = Math.round(easeProgress * targetNum);
            
            el.innerText = currentNum + suffix;
            
            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              el.innerText = targetNum + suffix;
            }
          };
          
          window.requestAnimationFrame(step);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.1 });
    
    statNumbers.forEach(el => {
      const originalText = el.innerText;
      if (originalText && !isNaN(parseInt(originalText))) {
        el.setAttribute('data-target', originalText);
        el.innerText = '0' + originalText.replace(/[0-9]/g, '');
        observer.observe(el);
      }
    });
  }

})();
