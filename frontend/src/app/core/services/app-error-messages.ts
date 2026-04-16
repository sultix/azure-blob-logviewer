import type { AppI18nService } from '@app/core/i18n/app-i18n.service';
import type { BlobFailureReason, AzureAuthFailureReason } from '@app/features/settings/models/azure.model';

export function getAuthFailureMessage(
  i18n: AppI18nService,
  reason: AzureAuthFailureReason,
): string {
  switch (reason) {
    case 'cli_not_available':
      return i18n.translate('common.errors.azureCliUnavailable');
    case 'not_logged_in':
      return i18n.translate('common.errors.azureCliNotLoggedIn');
    case 'token_request_failed':
      return i18n.translate('common.errors.azureTokenRequestFailed');
    default:
      return i18n.translate('common.errors.authFailed');
  }
}

export function getBlobFailureMessage(
  i18n: AppI18nService,
  reason: BlobFailureReason,
): string {
  switch (reason) {
    case 'not_found':
      return i18n.translate('common.errors.blobNotFound');
    case 'access_denied':
      return i18n.translate('common.errors.blobAccessDenied');
    case 'too_large':
      return i18n.translate('common.errors.blobTooLarge');
    case 'limit_exceeded':
      return i18n.translate('common.errors.blobLimitExceeded');
    default:
      return i18n.translate('common.errors.blobDownloadFailed');
  }
}
