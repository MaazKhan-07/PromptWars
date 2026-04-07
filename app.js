/* ========================================
   FlowSphere — Interactive Application
   ======================================== */

(function () {
  'use strict';

  // ─── Particle Canvas Background ───
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouse = { x: null, y: null };
  let animFrame;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.8 + 0.3;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.hue = Math.random() > 0.5 ? 185 : 260; // cyan or purple
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      // Mouse interaction
      if (mouse.x !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120;
          this.speedX -= (dx / dist) * force * 0.02;
          this.speedY -= (dy / dist) * force * 0.02;
        }
      }

      // Dampen speed
      this.speedX *= 0.999;
      this.speedY *= 0.999;

      // Wrap around
      if (this.x < 0) this.x = canvas.width;
      if (this.x > canvas.width) this.x = 0;
      if (this.y < 0) this.y = canvas.height;
      if (this.y > canvas.height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, 100%, 70%, ${this.opacity})`;
      ctx.fill();
    }
  }

  function initParticles() {
    const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 150);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          const opacity = ((100 - dist) / 100) * 0.12;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 240, 255, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    drawConnections();
    animFrame = requestAnimationFrame(animateParticles);
  }

  resizeCanvas();
  initParticles();
  animateParticles();

  window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  // ─── Navigation Scroll Effects ───
  const nav = document.getElementById('main-nav');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section, #hero');

  function handleScroll() {
    const scrollY = window.scrollY;

    // Nav background on scroll
    if (scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    // Active nav link
    let currentSection = '';
    sections.forEach(section => {
      const top = section.offsetTop - 100;
      const bottom = top + section.offsetHeight;
      if (scrollY >= top && scrollY < bottom) {
        currentSection = section.id;
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-section') === currentSection) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Smooth scroll for nav links
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(link.getAttribute('data-section'));
      if (target) {
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ─── Animated Counters ───
  function animateCounter(el) {
    const target = parseFloat(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    const isDecimal = el.getAttribute('data-decimal') === 'true';
    const duration = 2000;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;

      if (isDecimal) {
        el.textContent = current.toFixed(1) + suffix;
      } else {
        el.textContent = Math.floor(current).toLocaleString() + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // ─── Impact Bar Animation ───
  function animateImpactBars() {
    document.querySelectorAll('.bar-fill').forEach(bar => {
      const width = bar.getAttribute('data-width');
      bar.style.width = width + '%';
    });
  }

  // ─── Scroll Reveal (Intersection Observer) ───
  const revealElements = document.querySelectorAll(
    '.section-header, .summary-grid, .arch-layer, .innovation-card, ' +
    '.dimensions-tabs, .dimensions-content, .roadmap-phase, ' +
    '.impact-card, .moonshot-content, .edge-note, .value-card'
  );

  revealElements.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Staggered delay for grid children
          const parent = entry.target.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.classList.contains('reveal'));
            const index = siblings.indexOf(entry.target);
            entry.target.style.transitionDelay = `${index * 0.08}s`;
          }
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  revealElements.forEach(el => revealObserver.observe(el));

  // ─── Counter Observer ───
  const statNumbers = document.querySelectorAll('.stat-number');
  let countersAnimated = false;

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countersAnimated) {
          countersAnimated = true;
          statNumbers.forEach(el => animateCounter(el));
          counterObserver.disconnect();
        }
      });
    },
    { threshold: 0.5 }
  );

  statNumbers.forEach(el => counterObserver.observe(el));

  // ─── Impact Bars Observer ───
  let barsAnimated = false;
  const impactSection = document.getElementById('impact');
  if (impactSection) {
    const barsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !barsAnimated) {
            barsAnimated = true;
            setTimeout(animateImpactBars, 300);
            barsObserver.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );
    barsObserver.observe(impactSection);
  }

  // ─── Dimension Tabs ───
  const dimTabs = document.querySelectorAll('.dim-tab');
  const dimPanels = document.querySelectorAll('.dim-panel');

  dimTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const dimId = tab.getAttribute('data-dim');

      // Update tabs
      dimTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update panels
      dimPanels.forEach(p => p.classList.remove('active'));
      const targetPanel = document.getElementById(`dim-${dimId}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      // Add a subtle animation to features
      if (targetPanel) {
        const features = targetPanel.querySelectorAll('.dim-feature');
        features.forEach((f, i) => {
          f.style.opacity = '0';
          f.style.transform = 'translateY(20px)';
          setTimeout(() => {
            f.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            f.style.opacity = '1';
            f.style.transform = 'translateY(0)';
          }, i * 100);
        });
      }
    });
  });

  // ─── Architecture Layer Hover Effects ───
  const archLayers = document.querySelectorAll('.arch-layer');
  archLayers.forEach(layer => {
    layer.addEventListener('mouseenter', () => {
      archLayers.forEach(l => {
        if (l !== layer) {
          l.style.opacity = '0.5';
          l.style.transform = 'scale(0.98)';
        }
      });
      layer.style.transform = 'scale(1.01)';
    });

    layer.addEventListener('mouseleave', () => {
      archLayers.forEach(l => {
        l.style.opacity = '1';
        l.style.transform = 'scale(1)';
        l.style.transition = 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      });
    });
  });

  // ─── Innovation Card Hover Number ───
  const innovationCards = document.querySelectorAll('.innovation-card');
  innovationCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      const num = card.querySelector('.innovation-number');
      if (num) num.style.opacity = '0.8';
    });
    card.addEventListener('mouseleave', () => {
      const num = card.querySelector('.innovation-number');
      if (num) num.style.opacity = '0.3';
    });
  });

  // ─── Smooth anchor scrolling for all internal links ───
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const id = anchor.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ─── Parallax-like subtle effect on hero visual ───
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      if (scrollY < window.innerHeight) {
        heroVisual.style.transform = `translateY(${scrollY * 0.15}px)`;
        heroVisual.style.opacity = Math.max(0, 0.15 - scrollY / (window.innerHeight * 4));
      }
    }, { passive: true });
  }

  // ─── Keyboard navigation for dimension tabs ───
  dimTabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (e) => {
      let newIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = (index + 1) % dimTabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = (index - 1 + dimTabs.length) % dimTabs.length;
      }
      if (newIndex !== undefined) {
        dimTabs[newIndex].focus();
        dimTabs[newIndex].click();
      }
    });
  });

  // ─── Spec card subtle hover tilt ───
  document.querySelectorAll('.spec-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(600px) rotateX(0) rotateY(0) translateY(0)';
      card.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
    });
  });

  // ─── Dynamic year in footer (future-proof) ───
  const footerMeta = document.querySelector('.footer-meta');
  if (footerMeta) {
    const year = new Date().getFullYear();
    const span = document.createElement('span');
    span.style.display = 'block';
    span.style.marginTop = '0.5rem';
    span.style.opacity = '0.5';
    span.textContent = `© ${year} VenueIQ — FlowSphere System Design`;
    footerMeta.appendChild(span);
  }

  console.log(
    '%c⚡ FlowSphere System Active',
    'background: linear-gradient(135deg, #00f0ff, #7b61ff); color: #06080f; font-weight: bold; padding: 8px 16px; border-radius: 4px; font-size: 14px;'
  );

})();
