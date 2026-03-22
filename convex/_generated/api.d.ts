/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as invites from "../invites.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_serverTypes from "../lib/serverTypes.js";
import type * as playlists from "../playlists.js";
import type * as spotify from "../spotify.js";
import type * as tracks from "../tracks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  invites: typeof invites;
  "lib/auth": typeof lib_auth;
  "lib/helpers": typeof lib_helpers;
  "lib/serverTypes": typeof lib_serverTypes;
  playlists: typeof playlists;
  spotify: typeof spotify;
  tracks: typeof tracks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
