jest.mock('passport', () => ({
    initialize: () => (req, res, next) => {
      req.user = {
        _id: process.env.USER_ID || MOCK_USER_ID,
        name: process.env.MOCK_NAME || 'Test User',
        email: process.env.MOCK_EMAIL || 'test@example.com',
      };
      req.isAuthenticated = () => true;
      next();
    },
    session: () => (req, res, next) => next(),
    authenticate: () => (req, res, next) => next(),
    use: jest.fn(),
    serializeUser: jest.fn(),
    deserializeUser: jest.fn()
  }));