/**
 * Auth provider configuration consumed by the Convex deployment.
 * `CONVEX_SITE_URL` is set automatically on the deployment by Convex.
 */
export default {
  providers: [
    {
      domain: process.env['CONVEX_SITE_URL'],
      applicationID: 'convex',
    },
  ],
};
