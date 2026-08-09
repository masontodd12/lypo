/**
 * Things that are built but deliberately not switched on yet.
 *
 * Turned off rather than deleted, so turning them back on is a flag rather
 * than a rebuild.
 */

/**
 * Taking money: the Stripe connection, the payments switch on a project, and
 * pay buttons on published sites.
 *
 * Off until after launch. Set NEXT_PUBLIC_PAYMENTS_ENABLED=true to bring it
 * back. NEXT_PUBLIC_ because both the browser and the server need to agree,
 * and there is nothing secret about whether a feature is visible.
 *
 * While this is off the generator is told plainly that the site cannot take
 * money, so it never renders a donate or checkout button that would go
 * nowhere.
 */
export const PAYMENTS_ENABLED =
  process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
