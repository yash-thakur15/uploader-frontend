// Utility functions for S3 operations

/**
 * Check if a presigned URL has expired
 * @param {string} presignedUrl - The presigned URL to check
 * @returns {boolean} - True if expired, false if still valid
 */
export const isPresignedUrlExpired = (presignedUrl) => {
  try {
    const url = new URL(presignedUrl);
    const expiresParam = url.searchParams.get("X-Amz-Expires");
    const dateParam = url.searchParams.get("X-Amz-Date");

    if (!expiresParam || !dateParam) {
      return true; // If we can't determine expiry, assume expired
    }

    // Parse the date from the URL (format: YYYYMMDDTHHMMSSZ)
    const year = parseInt(dateParam.substring(0, 4));
    const month = parseInt(dateParam.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateParam.substring(6, 8));
    const hour = parseInt(dateParam.substring(9, 11));
    const minute = parseInt(dateParam.substring(11, 13));
    const second = parseInt(dateParam.substring(13, 15));

    // Create date in UTC since AWS uses UTC timestamps
    const signedDate = new Date(
      Date.UTC(year, month, day, hour, minute, second)
    );
    const expiryTime = signedDate.getTime() + parseInt(expiresParam) * 1000;
    const now = Date.now();

    return now > expiryTime;
  } catch (error) {
    console.error("Error checking URL expiry:", error);
    return true; // If there's an error, assume expired
  }
};

/**
 * Extract expiry information from a presigned URL
 * @param {string} presignedUrl - The presigned URL
 * @returns {object} - Object with expiry information
 */
export const getUrlExpiryInfo = (presignedUrl) => {
  try {
    const url = new URL(presignedUrl);
    const expiresParam = url.searchParams.get("X-Amz-Expires");
    const dateParam = url.searchParams.get("X-Amz-Date");

    if (!expiresParam || !dateParam) {
      return { valid: false, message: "Invalid presigned URL format" };
    }

    // Parse the date from the URL
    const year = parseInt(dateParam.substring(0, 4));
    const month = parseInt(dateParam.substring(4, 6)) - 1;
    const day = parseInt(dateParam.substring(6, 8));
    const hour = parseInt(dateParam.substring(9, 11));
    const minute = parseInt(dateParam.substring(11, 13));
    const second = parseInt(dateParam.substring(13, 15));

    // Create date in UTC since AWS uses UTC timestamps
    const signedDate = new Date(
      Date.UTC(year, month, day, hour, minute, second)
    );
    const expiryTime = signedDate.getTime() + parseInt(expiresParam) * 1000;
    const expiryDate = new Date(expiryTime);
    const now = Date.now();
    const isExpired = now > expiryTime;

    return {
      valid: true,
      signedDate: signedDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      expiresInSeconds: parseInt(expiresParam),
      isExpired,
      timeUntilExpiry: isExpired ? 0 : Math.floor((expiryTime - now) / 1000),
    };
  } catch (error) {
    return { valid: false, message: "Error parsing URL: " + error.message };
  }
};

/**
 * Generate AWS CLI command to create a new presigned URL
 * @param {string} bucketName - S3 bucket name
 * @param {string} objectKey - S3 object key (file path)
 * @param {number} expiresIn - Expiry time in seconds (default: 7 days)
 * @returns {string} - AWS CLI command
 */
export const generatePresignedUrlCommand = (
  bucketName,
  objectKey,
  expiresIn = 604800
) => {
  return `aws s3 presign s3://${bucketName}/${objectKey} --expires-in ${expiresIn} --region ap-south-1`;
};
