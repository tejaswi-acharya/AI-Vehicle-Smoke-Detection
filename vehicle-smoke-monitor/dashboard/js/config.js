export const CONFIG = {
  API_BASE_URL: '/api',

  // Set to false once the backend has a real /api/auth/login endpoint.
  // While true, login falls back to a clearly labelled demo session if that route is missing.
  DEMO_MODE: true,

  TIMEZONE: 'Asia/Kathmandu',
  SESSION_KEY: 'smokai.session',
  LOCATION_KEY: 'smokai.location',

  LOGO_SRC: '/assets/images/logo.svg',
  LOGIN_URL: '/',
  HOME_URL: '/pages/overview.html',

  LOCATIONS: ['Bhaktapur', 'Koteshwor', 'Kalanki'],

  ENDPOINTS: {
    login: '/auth/login',
    me: '/auth/me',
    logout: '/auth/logout',
    incidents: '/incidents',
    cameras: '/cameras',
    stats: '/stats',
    aiAnalyze: '/ai/analyze',
    media: '/media',
  },
};