* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary: #f7d0cb;
    --secondary: #b48b28;
    --dark: #2c2c2c;
    --light: #fef9f8;
    --white: #ffffff;
    --shadow: rgba(0, 0, 0, 0.1);
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: var(--dark);
    overflow-x: hidden;
}

/* Header */
header {
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 20px var(--shadow);
    transition: all 0.3s ease;
}

header.scrolled {
    padding: 10px 0;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 5%;
    max-width: 1400px;
    margin: 0 auto;
}

.logo {
    font-size: 1.8em;
    font-weight: bold;
    color: var(--primary);
    letter-spacing: 2px;
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 30px;
}

.nav-links a {
    text-decoration: none;
    color: var(--dark);
    font-weight: 500;
    transition: color 0.3s;
    position: relative;
}

.nav-links a::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 0;
    width: 0;
    height: 2px;
    background: var(--primary);
    transition: width 0.3s;
}

.nav-links a:hover::after {
    width: 100%;
}

.menu-toggle {
    display: none;
    flex-direction: column;
    cursor: pointer;
}

.menu-toggle span {
    width: 25px;
    height: 3px;
    background: var(--dark);
    margin: 3px 0;
    transition: 0.3s;
}

/* Hero Section */
.hero {
    height: 100vh;
    background: linear-gradient(135deg, rgba(247, 208, 203, 0.9), rgba(180, 139, 40, 0.9)),
                url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect fill="%23fef9f8" width="1200" height="800"/><circle cx="200" cy="200" r="150" fill="%23f7d0cb" opacity="0.1"/><circle cx="1000" cy="600" r="200" fill="%23b48b28" opacity="0.1"/></svg>');
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--white);
    position: relative;
    overflow: hidden;
}

.hero-content {
    z-index: 2;
    animation: fadeInUp 1s ease;
}

.hero h1 {
    font-size: 4em;
    margin-bottom: 20px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.hero p {
    font-size: 1.5em;
    margin-bottom: 30px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
}

.btn {
    display: inline-block;
    padding: 15px 40px;
    background: var(--white);
    color: var(--secondary);
    text-decoration: none;
    border-radius: 50px;
    font-weight: bold;
    transition: all 0.3s;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

.btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
    background: var(--primary);
    color: var(--white);
}

/* Floating elements */
.floating-element {
    position: absolute;
    opacity: 0.3;
    animation: float 6s ease-in-out infinite;
}

.floating-element:nth-child(1) {
    top: 20%;
    left: 10%;
    animation-delay: 0s;
}

.floating-element:nth-child(2) {
    top: 60%;
    right: 10%;
    animation-delay: 2s;
}

.floating-element:nth-child(3) {
    bottom: 20%;
    left: 50%;
    animation-delay: 4s;
}

/* About Section */
.about {
    padding: 100px 5%;
    background: var(--light);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
}

.section-title {
    text-align: center;
    font-size: 2.5em;
    color: var(--secondary);
    margin-bottom: 20px;
}

.section-title.show {
    /* Animación removida para mejor UX */
}

.section-subtitle {
    text-align: center;
    color: var(--primary);
    margin-bottom: 60px;
    font-size: 1.2em;
}

.about-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 50px;
    align-items: center;
}

.about-text {
    /* Animación removida para mejor UX */
}

.about-text.show {
    /* Animación removida para mejor UX */
}

.about-text h3 {
    font-size: 2em;
    margin-bottom: 20px;
    color: var(--secondary);
}

.about-text p {
    margin-bottom: 15px;
    line-height: 1.8;
}

.about-image {
    height: 400px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    font-size: 3em;
    box-shadow: 0 10px 30px var(--shadow);
}

.about-image.show {
    /* Animación removida para mejor UX */
}

/* Services Section */
.services {
    padding: 100px 5%;
    background: var(--white);
}

.services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 30px;
    margin-top: 60px;
}

.service-card {
    background: var(--light);
    padding: 40px;
    border-radius: 15px;
    text-align: center;
    transition: all 0.4s;
    cursor: pointer;
    box-shadow: 0 5px 15px var(--shadow);
}

.service-card.show {
    /* Animación removida para mejor UX */
}

.service-card:hover {
    transform: translateY(-10px);
    box-shadow: 0 15px 30px var(--shadow);
    background: linear-gradient(135deg, var(--light), #fff);
}

.service-icon {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 2em;
    color: var(--white);
    transition: all 0.3s;
}

.service-card:hover .service-icon {
    transform: rotate(360deg) scale(1.1);
}

.service-card h3 {
    font-size: 1.5em;
    margin-bottom: 15px;
    color: var(--secondary);
}

.service-card p {
    color: #666;
    line-height: 1.6;
}

/* Gallery Section */
.gallery {
    padding: 100px 5%;
    background: var(--light);
}

.gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 60px;
}

.gallery-item {
    height: 300px;
    border-radius: 15px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: all 0.5s;
    background: linear-gradient(135deg, #f7d0cb 0%, #e8b4ae 50%, #b48b28 100%);
}

.gallery-item.show {
    /* Animación removida para mejor UX */
}

.gallery-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    transition: opacity 0.3s;
}

.gallery-item:hover::before {
    opacity: 0.1;
}

.gallery-item-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--white);
    text-align: center;
    font-size: 2em;
    font-weight: bold;
    text-shadow: 2px 2px 8px rgba(0,0,0,0.7);
    z-index: 2;
}

/* Footer */
footer {
    background: var(--dark);
    color: var(--white);
    text-align: center;
    padding: 30px 5%;
}

.social-links {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 20px;
}

.social-icon {
    width: 40px;
    height: 40px;
    background: var(--primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: var(--white);
    transition: all 0.3s;
}

.social-icon:hover {
    transform: translateY(-5px);
    background: var(--white);
    color: var(--secondary);
}

/* Login button */
.login-btn {
    background: var(--secondary) !important;
    color: var(--white) !important;
    padding: 10px 25px !important;
    border-radius: 25px !important;
    transition: all 0.3s !important;
}

.login-btn:hover {
    background: var(--primary) !important;
    color: var(--dark) !important;
    transform: scale(1.05);
}

.login-btn::after {
    display: none !important;
}

/* WhatsApp floating button */
.whatsapp-float {
    position: fixed;
    width: 60px;
    height: 60px;
    bottom: 30px;
    right: 30px;
    background-color: #25d366;
    color: #FFF;
    border-radius: 50%;
    text-align: center;
    font-size: 35px;
    box-shadow: 2px 2px 10px rgba(0,0,0,0.3);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: all 0.3s;
    animation: pulse 2s infinite;
}

.whatsapp-float:hover {
    background-color: #128c7e;
    transform: scale(1.1);
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7);
    }
    70% {
        box-shadow: 0 0 0 15px rgba(37, 211, 102, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(37, 211, 102, 0);
    }
}

/* Animations */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes float {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-20px);
    }
}

/* Responsive */
@media (max-width: 768px) {
    .nav-links {
        position: fixed;
        right: -100%;
        top: 70px;
        flex-direction: column;
        background: var(--white);
        width: 100%;
        text-align: center;
        transition: 0.3s;
        box-shadow: 0 10px 27px rgba(0,0,0,0.05);
        padding: 20px 0;
    }

    .nav-links.active {
        right: 0;
    }

    .menu-toggle {
        display: flex;
    }

    .hero h1 {
        font-size: 2.5em;
    }

    .hero p {
        font-size: 1.2em;
    }

    .about-content {
        grid-template-columns: 1fr;
    }

    .service-card {
        margin-bottom: 20px;
    }

    .whatsapp-float {
        width: 50px;
        height: 50px;
        font-size: 28px;
        bottom: 20px;
        right: 20px;
    }
}