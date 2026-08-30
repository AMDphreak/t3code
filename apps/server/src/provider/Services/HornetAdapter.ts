/**
 * HornetAdapter — shape type for the Hornet HTTP provider adapter.
 *
 * @module HornetAdapter
 */
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface HornetAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}
