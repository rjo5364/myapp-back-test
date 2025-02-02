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

const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
app.use(express.json());

// Important: Add trust proxy setting for Render.com
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST'],
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

// Create session store using existing MongoDB connection
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

// User schema
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

// Google Strategy
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

// const crypto = require('crypto'); // Add this at the top with other imports

// Replace the existing LinkedIn routes with these:

// app.get('/auth/linkedin', async (req, res) => {
//   try {
//     // Generate a more secure state parameter
//     const state = crypto.randomBytes(16).toString('hex');
    
//     // Save state in session
//     req.session.linkedInState = state;
//     console.log('Setting LinkedIn state:', {
//       state,
//       sessionID: req.sessionID,
//     });

//     // Explicitly save session
//     await new Promise((resolve, reject) => {
//       req.session.save((err) => {
//         if (err) {
//           console.error('Session save error:', err);
//           reject(err);
//         } else {
//           console.log('Session saved successfully');
//           resolve();
//         }
//       });
//     });

//     // Verify state was saved
//     const verifySession = await sessionStore.get(req.sessionID);
//     console.log('Verified session state:', {
//       sessionID: req.sessionID,
//       savedState: verifySession?.linkedInState,
//       state: state
//     });

//     const queryParams = new URLSearchParams({
//       response_type: 'code',
//       client_id: process.env.LINKEDIN_CLIENT_ID,
//       redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
//       state: state,
//       scope: 'openid profile email r_liteprofile r_emailaddress'
//     });

//     const authURL = `https://www.linkedin.com/oauth/v2/authorization?${queryParams}`;
//     console.log('LinkedIn Auth URL:', {
//       url: authURL,
//       state: state,
//       redirectUri: process.env.LINKEDIN_REDIRECT_URI
//     });

//     res.redirect(authURL);
//   } catch (err) {
//     console.error('LinkedIn auth initialization error:', err);
//     res.redirect(`${process.env.FRONTEND_URL}?error=auth_init_failed`);
//   }
// });

// app.get('/auth/linkedin/callback', async (req, res) => {
//   try {
//     const { code, state, error, error_description } = req.query;

//     console.log('LinkedIn callback received:', {
//       query: req.query,
//       sessionState: req.session?.linkedInState,
//       sessionID: req.sessionID
//     });

//     // Handle LinkedIn OAuth errors
//     if (error) {
//       console.error('LinkedIn OAuth error:', { error, error_description });
//       return res.redirect(
//         `${process.env.FRONTEND_URL}?error=${error}&description=${encodeURIComponent(error_description || '')}`
//       );
//     }

//     // Verify session exists
//     const verifySession = await sessionStore.get(req.sessionID);
//     if (!verifySession) {
//       console.error('No session found in LinkedIn callback');
//       return res.redirect(`${process.env.FRONTEND_URL}?error=no_session`);
//     }

//     // Verify state parameter to prevent CSRF
//     if (state !== verifySession.linkedInState) {
//       console.error('State mismatch:', {
//         expected: verifySession.linkedInState,
//         received: state,
//         sessionID: req.sessionID
//       });
//       return res.redirect(`${process.env.FRONTEND_URL}?error=invalid_state`);
//     }

//     // Exchange code for access token
//     const tokenResponse = await axios({
//       method: 'POST',
//       url: 'https://www.linkedin.com/oauth/v2/accessToken',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded'
//       },
//       data: new URLSearchParams({
//         grant_type: 'authorization_code',
//         code: code,
//         redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
//         client_id: process.env.LINKEDIN_CLIENT_ID,
//         client_secret: process.env.LINKEDIN_CLIENT_SECRET
//       }).toString()
//     });

//     console.log('LinkedIn token response:', tokenResponse.data);
//     const accessToken = tokenResponse.data.access_token;

//     // Get user info using v2 API
//     const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'X-Restli-Protocol-Version': '2.0.0'
//       }
//     });

//     const profileData = userInfoResponse.data;
//     console.log('LinkedIn user info:', profileData);

//     // Create or update user
//     let user = await User.findOne({
//       socialId: profileData.sub,
//       platform: 'linkedin'
//     });

//     if (!user) {
//       user = new User({
//         socialId: profileData.sub,
//         name: profileData.name,
//         email: profileData.email,
//         platform: 'linkedin',
//         profilePicture: profileData.picture || '',
//         lastLogin: new Date()
//       });
//     } else {
//       user.lastLogin = new Date();
//       user.name = profileData.name;
//       user.email = profileData.email;
//       user.profilePicture = profileData.picture || user.profilePicture;
//     }

//     await user.save();
//     console.log('User saved:', user);

//     // Login and create session
//     req.login(user, (err) => {
//       if (err) {
//         console.error('Login error:', err);
//         return res.redirect(`${process.env.FRONTEND_URL}?error=login_failed`);
//       }

//       req.session.save((err) => {
//         if (err) {
//           console.error('Session save error:', err);
//           return res.redirect(`${process.env.FRONTEND_URL}?error=session_error`);
//         }

//         // Clear the LinkedIn state from session after successful auth
//         delete req.session.linkedInState;
//         console.log('LinkedIn authentication successful');
//         res.redirect(`${process.env.FRONTEND_URL}/profile`);
//       });
//     });

//   } catch (err) {
//     console.error('LinkedIn auth error:', err.response?.data || err);
//     res.redirect(
//       `${process.env.FRONTEND_URL}?error=auth_failed&description=${encodeURIComponent(err.message)}`
//     );
//   }
// });

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

const { router: projectTaskRouter } = require('./projectTaskRoutes');
app.use('/api', projectTaskRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`Base URL: ${process.env.BASE_URL}`);
});