import { httpRouter } from 'convex/server';

import { auth } from './auth';

const http = httpRouter();

// Registers the Convex Auth HTTP endpoints (sign-in, token refresh, etc.).
auth.addHttpRoutes(http);

export default http;
