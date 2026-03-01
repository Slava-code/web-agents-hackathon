/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actionLogs from "../actionLogs.js";
import type * as commands from "../commands.js";
import type * as coordination from "../coordination.js";
import type * as deviceMutations from "../deviceMutations.js";
import type * as devices from "../devices.js";
import type * as discovery from "../discovery.js";
import type * as http from "../http.js";
import type * as roomQueries from "../roomQueries.js";
import type * as rooms from "../rooms.js";
import type * as scenarios from "../scenarios.js";
import type * as seed from "../seed.js";
import type * as taskGraph from "../taskGraph.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actionLogs: typeof actionLogs;
  commands: typeof commands;
  coordination: typeof coordination;
  deviceMutations: typeof deviceMutations;
  devices: typeof devices;
  discovery: typeof discovery;
  http: typeof http;
  roomQueries: typeof roomQueries;
  rooms: typeof rooms;
  scenarios: typeof scenarios;
  seed: typeof seed;
  taskGraph: typeof taskGraph;
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
