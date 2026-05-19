/* eslint-disable */
/**
 * Generated data model types.
 *
 * Bootstrapped by hand so the project type-checks before the first
 * `npx convex dev`; that command regenerates this file. Do not edit manually.
 */
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
} from 'convex/server';
import type { GenericId } from 'convex/values';

import schema from '../schema.js';

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

export type TableNames = TableNamesInDataModel<DataModel>;

export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;

export type Id<TableName extends TableNames> = GenericId<TableName>;
