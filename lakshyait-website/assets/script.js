// assets/script.js

function toggleMenu() {
    const nav = document.getElementById('nav-mobile');
    if (nav) {
        nav.classList.toggle('open');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mobileLinks = document.querySelectorAll('.nav-mobile a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('nav-mobile').classList.remove('open');
        });
    });
});