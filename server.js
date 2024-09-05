const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const fs = require("fs");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const bcrypt = require("bcryptjs"); // For password hashing
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();

// Import routes
const userRoutes = require("./auth-routes/userRoute");
const dataRoutes = require("./auth-routes/data");

// Initialize the Express app
const app = express();

// Log environment variables (for debugging purposes, remove in production)
console.log(
  process.env.DB_HOST,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  process.env.DB_NAME,
  process.env.SSL_CA
);

// Create a MySQL connection with SSL
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306, // Default MySQL port
  ssl: {
    ca: fs.readFileSync(process.env.SSL_CA), // Ensure this path is correct
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.stack);
    return;
  }
  console.log("Connected to the database as ID " + connection.threadId);
});

// Make the connection globally accessible
global.connection = connection;

// Set up session management
app.use(
  session({
    secret: "your_secret_key", // Replace with a strong secret in production
    resave: false,
    saveUninitialized: true,
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport.js to use Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:3000/auth/google/callback",
    },
    function (accessToken, refreshToken, profile, done) {
      // Check if the user already exists in the database
      connection.query(
        "SELECT * FROM users WHERE google_id = ?",
        [profile.id],
        async (err, results) => {
          if (err) {
            return done(err);
          }

          if (results.length > 0) {
            // User already exists, pass the user to the next middleware
            return done(null, results[0]);
          } else {
            // User doesn't exist, save them to the database
            const newUser = {
              google_id: profile.id,
              displayName: profile.displayName,
              email: profile.emails[0].value, // Google's email
            };

            // Insert the new user into the database
            connection.query(
              "INSERT INTO users (google_id, username, email) VALUES (?, ?, ?)",
              [newUser.google_id, newUser.displayName, newUser.email],
              (err, result) => {
                if (err) {
                  return done(err);
                }
                newUser.id = result.insertId; // Get the new user's ID
                return done(null, newUser);
              }
            );
          }
        }
      );
    }
  )
);

// Serialize user information into the session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user information from the session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Use body-parser middleware to parse incoming requests
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Google OAuth routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/userDashboard");
  }
);


app.get("/userDashboard", (req, res) => {
  if (req.isAuthenticated()) {
    const username =
      req.user.displayName || req.user.username || "{{username}}";

    // Read the HTML file
    fs.readFile(
      path.join(__dirname, "public", "userDashboard.html"),
      "utf8",
      (err, data) => {
        if (err) {
          console.error("Error reading the HTML file:", err);
          return res
            .status(500)
            .send("Server Error: Unable to load the dashboard");
        }

        // Inject the user's name into the HTML
        const modifiedData = data.replace("{{username}}", username);

        // Send the modified HTML as a response
        res.send(modifiedData);
      }
    );
  } else {
    res.redirect("/login");
  }
});

app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).json({ msg: "Server Error: Unable to log out" });
    }
    res.redirect("/login");
  });
});

// Route to serve the signup page
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Route to serve the login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Handle the signup form submission
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ msg: "Server Error: Database query failed" });
        }

        if (results.length > 0) {
          return res.status(400).json({ msg: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const sql =
          "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        connection.query(
          sql,
          [username, email, hashedPassword],
          (err, result) => {
            if (err) {
              console.error("Database insert error:", err);
              return res
                .status(500)
                .json({ msg: "Server Error: Unable to insert user" });
            }

            return res
              .status(200)
              .json({ msg: "Signup successful, redirecting..." });
          }
        );
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({
      msg: `Server Error: Unexpected error occurred - ${err.message}`,
    });
  }
});

// Handle the login form submission
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  try {
    connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return res
            .status(500)
            .json({ msg: "Server Error: Database query failed" });
        }

        if (results.length === 0) {
          return res.status(400).json({ msg: "Invalid email or password" });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).json({ msg: "Invalid email or password" });
        }

        req.login(user, (err) => {
          if (err) {
            console.error("Error during login:", err);
            return res
              .status(500)
              .json({ msg: "Server Error: Unable to log in" });
          }
          return res
            .status(200)
            .json({ msg: "Login successful, redirecting..." });
        });
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({
      msg: `Server Error: Unexpected error occurred - ${err.message}`,
    });
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
