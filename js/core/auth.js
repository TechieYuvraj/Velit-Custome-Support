// Authentication credentials
const CREDENTIALS = {
    username: 'Engage',
    password: 'engage@123'
};

// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem('isLoggedIn') === 'true';
}

// Initialize auth state
function initAuth() {
    const authSection = document.getElementById('authSection');
    const loginModal = document.getElementById('loginModal');

    // Update auth section based on login state
    function updateAuthUI() {
        if (isLoggedIn()) {
            authSection.innerHTML = `
                <div class="admin-info">
                    <div class="admin-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <span>ADMIN</span>
                </div>
                <button class="logout-btn" id="logoutBtn">
                    <i class="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            `;
            document.getElementById('logoutBtn').addEventListener('click', logout);
            loginModal.style.display = 'none';
        } else {
            authSection.innerHTML = `
                <button class="logout-btn" id="showLoginBtn">
                    <i class="fas fa-sign-in-alt"></i>
                    Login
                </button>
            `;
            document.getElementById('showLoginBtn').addEventListener('click', showLogin);
            showLogin();
        }
    }

    // Show login modal
    function showLogin() {
        loginModal.style.display = 'flex';
        document.getElementById('username').focus();
    }

    // Handle login
    function handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginError = document.getElementById('loginError');

        if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
            localStorage.setItem('isLoggedIn', 'true');
            updateAuthUI();
            loginError.style.display = 'none';
            location.reload(); // Refresh to ensure all data is loaded properly
        } else {
            loginError.textContent = 'Invalid username or password';
            loginError.style.display = 'block';
        }
    }

    // Handle logout
    function logout() {
        localStorage.removeItem('isLoggedIn');
        updateAuthUI();
        location.reload(); // Refresh to clear any sensitive data
    }

    // Event listeners
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    
    // Handle Enter key in login form
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });

    // Close modal if clicking outside
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Initial UI update
    updateAuthUI();

    // Protect routes if not logged in
    if (!isLoggedIn()) {
        // Hide main content
        document.querySelector('.primary-nav').style.display = 'none';
        document.querySelector('.views-root').style.display = 'none';
    } else {
        // Show main content
        document.querySelector('.primary-nav').style.display = 'flex';
        document.querySelector('.views-root').style.display = 'block';
    }
}

// Export functions
export { initAuth, isLoggedIn };