const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
//dependency for google oauth
const GoogleStrategy = require('passport-google-oauth20').Strategy;
//dependency for github oauth
const GitHubStrategy = require('passport-github2').Strategy;

const app = express();
app.use(express.json());

// proxy setting for Render.com
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Failed to connect to MongoDB Atlas:', err));

mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
});

// Creates session store using existing MongoDB connection
const sessionStore = MongoStore.create({
  client: mongoose.connection.getClient(),
  collectionName: 'sessions',
  ttl: 24 * 60 * 60,
  autoRemove: 'native',
  touchAfter: 24 * 3600
});

// Session store event listeners
sessionStore.on('create', (sessionId) => {
  console.log('Session created:', sessionId);
});

sessionStore.on('touch', (sessionId) => {
  console.log('Session touched:', sessionId);
});

sessionStore.on('update', (sessionId) => {
  console.log('Session updated:', sessionId);
});

sessionStore.on('set', (sessionId) => {
  console.log('Session set:', sessionId);
});

sessionStore.on('destroy', (sessionId) => {
  console.log('Session destroyed:', sessionId);
});

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    proxy: true,
    store: sessionStore,
    name: 'sessionId',
    cookie: { 
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
      // domain: process.env.COOKIE_DOMAIN,
      // path: '/'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Enhanced session debugging middleware
app.use((req, res, next) => {
  console.log('Session Debug:', {
    sessionID: req.sessionID,
    hasSession: !!req.session,
    isAuthenticated: req.isAuthenticated?.(),
    user: req.user,
    cookie: req.session?.cookie,
    store: req.session?.store?.constructor.name,
    linkedInState: req.session?.linkedInState
  });
  next();
});

// Test session route
app.get('/test-session', (req, res) => {
  req.session.testData = 'test';
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Session save failed' });
    }
    res.json({ 
      sessionID: req.sessionID,
      sessionData: req.session,
      store: req.session.store?.constructor.name
    });
  });
});

// User schema for MongoDB Atlas
const userSchema = new mongoose.Schema({
  socialId: String,
  name: String,
  email: String,
  platform: String,
  profilePicture: String,
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
});

const User = mongoose.model('User', userSchema);

// Google OAuth 2.0 Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google profile:', profile);
        let user = await User.findOne({ socialId: profile.id });
        if (!user) {
          user = new User({
            socialId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            platform: 'google',
            profilePicture: profile.photos[0]?.value || '',
            lastLogin: new Date()
          });
        } else {
          user.lastLogin = new Date();
        }
        await user.save();
        return done(null, user);
      } catch (err) {
        console.error('Error saving user:', err);
        return done(err, null);
      }
    }
  )
);

// GitHub Oauth 2.0 Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/auth/github/callback`,
      scope: ['user:email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('GitHub profile:', profile);
        let user = await User.findOne({ socialId: profile.id });
        if (!user) {
          user = new User({
            socialId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            platform: 'github',
            profilePicture: profile.photos[0]?.value || '',
            lastLogin: new Date()
          });
        } else {
          user.lastLogin = new Date();
        }
        await user.save();
        return done(null, user);
      } catch (err) {
        console.error('Error saving user:', err);
        return done(err, null);
      }
    }
  )
);

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    console.log('Deserialized user:', user);
    done(null, user);
  } catch (err) {
    console.error('Deserialize error:', err);
    done(err, null);
  }
});

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Google Routes
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/',
    failureMessage: true 
  }),
  (req, res) => {
    console.log('Google authentication successful');
    console.log('Session after auth:', req.session);
    console.log('User after auth:', req.user);
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}?error=session_error`);
      }
      res.redirect(`${process.env.FRONTEND_URL}/profile`);
    });
  }
);

// GitHub Routes
app.get(
  '/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

app.get(
  '/auth/github/callback',
  passport.authenticate('github', { 
    failureRedirect: '/',
    failureMessage: true 
  }),
  (req, res) => {
    console.log('GitHub authentication successful');
    console.log('Session after auth:', req.session);
    console.log('User after auth:', req.user);
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}?error=session_error`);
      }
      res.redirect(`${process.env.FRONTEND_URL}/profile`);
    });
  }
);

app.get('/profile', (req, res) => {
  console.log('Profile request received. Authenticated:', req.isAuthenticated());
  console.log('User:', req.user);
  
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({
    name: req.user.name,
    email: req.user.email,
    profilePicture: req.user.profilePicture,
    platform: req.user.platform,
    lastLogin: req.user.lastLogin
  });
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).json({ error: 'Logout error' });
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Error destroying session:', destroyErr);
        return res.status(500).json({ error: 'Session destroy error' });
      }
      res.clearCookie('sessionId', { 
        path: '/',
        domain: process.env.COOKIE_DOMAIN,
        secure: true,
        sameSite: 'none'
      });
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
});
//API routes
const projectTaskRouter = require('./projectTaskRoutes');
app.use('/api', projectTaskRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`Base URL: ${process.env.BASE_URL}`);
});