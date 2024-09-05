// Dummy user data for demonstration
let users = [{ username: 'user', password: 'password' }];

// Function to handle login
function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  const user = users.find(user => user.username === username && user.password === password);
  
  if (user) {
    alert('Login successful!');
    showDashboard();
  } else {
    alert('Invalid username or password.');
  }
}

// Function to handle signup
function signup() {
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;

  if (username && password) {
    users.push({ username, password });
    alert('Signup successful! You can now log in.');
    showLogin();
  } else {
    alert('Please fill in all fields.');
  }
}

// Function to show signup form
function showSignup() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('signup-form').style.display = 'block';
}

// Function to show login form
function showLogin() {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
}

// Function to show dashboard
function showDashboard() {
  document.getElementById('form-container').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}

// Function to logout
function logout() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('form-container').style.display = 'block';
}
