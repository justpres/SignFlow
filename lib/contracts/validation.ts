/**
 * Business logic validations for contract signing and finalization
 */

export interface GovIdValidationResult {
  valid: boolean;
  status?: number;
  error?: string;
}

/**
 * Validates whether the government ID requirements are satisfied for contract finalization
 */
export function validateFinalizeGovId(
  contract: { requiresGovId?: boolean },
  payload: { govIdPhotoBase64?: string | null }
): GovIdValidationResult {
  if (contract.requiresGovId) {
    if (
      !payload.govIdPhotoBase64 ||
      typeof payload.govIdPhotoBase64 !== 'string' ||
      payload.govIdPhotoBase64.trim().length < 20
    ) {
      return {
        valid: false,
        status: 400,
        error: 'Philippine Government ID verification is required to finalize this contract',
      };
    }
  }
  return { valid: true };
}
