/* eslint-disable */
/**
 * Generated server utilities.
 *
 * Bootstrapped by hand so the project type-checks before the first
 * `npx convex dev`; that command regenerates this file. Do not edit manually.
 */
import type {
  ActionBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server';

import type { DataModel } from './dataModel.js';

export declare const query: QueryBuilder<DataModel, 'public'>;
export declare const internalQuery: QueryBuilder<DataModel, 'internal'>;
export declare const mutation: MutationBuilder<DataModel, 'public'>;
export declare const internalMutation: MutationBuilder<DataModel, 'internal'>;
export declare const action: ActionBuilder<DataModel, 'public'>;
export declare const internalAction: ActionBuilder<DataModel, 'internal'>;
export declare const httpAction: HttpActionBuilder;

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
