package services

import (
	"errors"
	"log"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/aleksandrsultanov/azure-blob-logviewer/backend/models"
)

var errNotAuthenticated = errors.New("not authenticated")

type authFailureError struct {
	reason  authFailureReason
	message string
	cause   error
}

func (e *authFailureError) Error() string {
	return e.message
}

func (e *authFailureError) Unwrap() error {
	return e.cause
}

func newAuthFailureError(reason authFailureReason, message string, cause error) error {
	return &authFailureError{
		reason:  reason,
		message: message,
		cause:   cause,
	}
}

func authFailureReasonFromError(err error) authFailureReason {
	if errors.Is(err, errNotAuthenticated) {
		return authFailureNotLoggedIn
	}

	var failure *authFailureError
	if errors.As(err, &failure) {
		return failure.reason
	}
	normalized := strings.ToLower(err.Error())
	if strings.Contains(normalized, "az login") ||
		strings.Contains(normalized, "login required") ||
		strings.Contains(normalized, "not logged in") ||
		strings.Contains(normalized, "no session") {
		return authFailureNotLoggedIn
	}
	return authFailureTokenRequestFailed
}

type blobFailureError struct {
	reason  models.BlobFailureReason
	message string
	cause   error
}

func (e *blobFailureError) Error() string {
	return e.message
}

func (e *blobFailureError) Unwrap() error {
	return e.cause
}

func newBlobFailureError(reason models.BlobFailureReason, message string, cause error) error {
	return &blobFailureError{
		reason:  reason,
		message: message,
		cause:   cause,
	}
}

func blobFailureReasonFromError(err error) models.BlobFailureReason {
	var failure *blobFailureError
	if errors.As(err, &failure) {
		return failure.reason
	}

	var responseErr *azcore.ResponseError
	if errors.As(err, &responseErr) {
		switch responseErr.StatusCode {
		case 401, 403:
			return models.BlobFailureReasonAccessDenied
		case 404:
			return models.BlobFailureReasonNotFound
		case 409, 429:
			return models.BlobFailureReasonLimitExceeded
		}
	}

	return models.BlobFailureReasonDownloadFailed
}

func blobFailureMessage(reason models.BlobFailureReason) string {
	switch reason {
	case models.BlobFailureReasonNotFound:
		return "The requested blob was not found."
	case models.BlobFailureReasonAccessDenied:
		return "Access to the requested blob was denied."
	case models.BlobFailureReasonTooLarge:
		return "The requested blob exceeds the supported size limit."
	case models.BlobFailureReasonLimitExceeded:
		return "The request exceeds the application's safety limits."
	default:
		return "The blob request could not be completed."
	}
}

func sanitizeBlobError(err error) error {
	reason := blobFailureReasonFromError(err)
	return newBlobFailureError(reason, blobFailureMessage(reason), err)
}

func sanitizeAuthError(err error) error {
	reason := authFailureReasonFromError(err)
	switch reason {
	case authFailureCLINotAvailable:
		return newAuthFailureError(reason, "Azure CLI is not available.", err)
	case authFailureNotLoggedIn:
		return newAuthFailureError(reason, "Azure CLI is not logged in.", err)
	default:
		return newAuthFailureError(authFailureTokenRequestFailed, "Azure authentication failed.", err)
	}
}

func logDetailedError(scope string, err error) {
	if err == nil {
		return
	}

	log.Printf("%s: %v", scope, err)
}
