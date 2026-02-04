window.APP_CONFIG = {
  // REST API created by `Api` in your template
  apiBaseUrl: "https://o7e18622e2.execute-api.us-east-1.amazonaws.com/prod",

  newsEndpoint: "/news",
  priceEndpoint: "/prices",
  bookingEndpoint: "/book",
  portsEndpoint: "/ports",
  bookingEndpoint: "/book",

  assetsBase: "",
  defaultCountryCode: "IN"
};

// ---- Global site config ----
window.AWS_REGION = "us-east-1";

// Track / Rent / Sell are now behind the same CloudFront + APIs:
// - HttpApi       → https://4rejtp274h.execute-api.us-east-1.amazonaws.com
// - REST (prod)   → https://o7e18622e2.execute-api.us-east-1.amazonaws.com/prod

// TRACK uses HttpApi (/api/*)
window.TRACK_API_BASE = "https://4rejtp274h.execute-api.us-east-1.amazonaws.com/api";

// RENT API (REST API stage)
window.RENT_API_BASE  = "https://e3qah7gaug.execute-api.us-east-1.amazonaws.com/prod";

// SELL API (REST API stage)
window.SELL_API_BASE  = "https://lzk030msf7.execute-api.us-east-1.amazonaws.com/prod";

// // Cognito Hosted UI (KEEP ap-south-1 unless you move user pools)
// window.COGNITO_DOMAIN    = "https://sell.auth.us-east-1.amazoncognito.com";
// window.COGNITO_CLIENT_ID = "4bgnqs4o1svb0rlsgp80sc1g93";

// Cognito Hosted UI (KEEP ap-south-1 unless you move user pools)
window.COGNITO_DOMAIN    = "https://us-east-1a8xx2cueb.auth.us-east-1.amazoncognito.com";
window.COGNITO_CLIENT_ID = "28i9pasdun194hbov13vkd4o6n";

// CloudFront redirect URLs (update to new CF)
// window.COGNITO_REDIRECT_URI_RENT = "https://d361mbydx9z7jq.cloudfront.net/rent/new.html";
// window.COGNITO_REDIRECT_URI_SELL = "https://d361mbydx9z7jq.cloudfront.net/sell/new.html";

if (window.COGNITO_REDIRECT_URI_RENT) {
  window.COGNITO_REDIRECT_URI = window.COGNITO_REDIRECT_URI_RENT;
}

// blog section
window.BLOG_API_BASE = "https://o7e18622e2.execute-api.us-east-1.amazonaws.com/prod";
window.BLOG_S3_UPLOAD_URL = "https://containers-club-dev-blog-media.s3.amazonaws.com/blog/";



// Manually created Cognito for Rent

// ===============================
// AWS COGNITO CONFIGURATION - RENT
// ===============================

window.RENT_COGNITO_DOMAIN =
  "https://rent-club-auth.auth.us-east-1.amazoncognito.com";

window.RENT_COGNITO_CLIENT_ID =
  "5tde7c3ddupmvr9c90417devc3";

// Manually created Cognito for Sell

// ===============================
// AWS COGNITO CONFIGURATION - SELL
// ===============================

window.SELL_COGNITO_DOMAIN =
  "https://sell-club-auth.auth.us-east-1.amazoncognito.com";

window.SELL_COGNITO_CLIENT_ID =
  "3264ar1beegeb84aodivq3poeh";

// Default to Rent config (can be overridden per page)
window.COGNITO_DOMAIN = window.RENT_COGNITO_DOMAIN;
window.COGNITO_CLIENT_ID = window.RENT_COGNITO_CLIENT_ID;

// Redirect after successful login for sell (code flow)
window.COGNITO_REDIRECT_URI_SELL =
  "https://containersclub.com/sell/new.html";

// Redirect after successful login for rent (implicit flow)
window.COGNITO_REDIRECT_URI_RENT =
  "https://containersclub.com/rent/new.html";

// Redirect after logout
window.COGNITO_LOGOUT_REDIRECT =
  "https://containersclub.com/auth/logout-success.html";

// OAuth scopes (as configured in Cognito)
window.COGNITO_SCOPES = "openid email";
