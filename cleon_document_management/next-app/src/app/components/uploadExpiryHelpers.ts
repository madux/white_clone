import type { DocumentType } from "../../../lib/types";
import {
  missingUploadMetadata,
  typeRequiresExpiry,
} from "../../../lib/uploadMetadataHelpers";

export { typeRequiresExpiry };

export function missingExpiryDates(
  typeIds: string[],
  expiryDates: string[],
  types: DocumentType[],
): boolean {
  return missingUploadMetadata(typeIds, expiryDates, [], [], types);
}
