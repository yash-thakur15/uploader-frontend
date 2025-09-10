// API service for communicating with the backend
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

/**
 * API client with error handling
 */
class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || `HTTP error! status: ${response.status}`
        );
      }

      return data;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: "GET", ...options });
  }

  async post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    });
  }

  async put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
      ...options,
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: "DELETE", ...options });
  }
}

const apiClient = new ApiClient();

/**
 * Upload API service
 */
export const uploadApi = {
  /**
   * Check API health
   */
  async checkHealth() {
    return apiClient.get("/api/upload/health");
  },

  /**
   * Generate a presigned URL for file upload
   * @param {string} fileName - Original filename
   * @param {string} contentType - MIME type of the file
   * @param {string} userId - User ID (optional)
   * @param {number} fileSize - File size in bytes (optional)
   * @returns {Promise<Object>} - Upload data with presigned URL
   */
  async generatePresignedUrl(
    fileName,
    contentType,
    userId = "anonymous",
    fileSize = null
  ) {
    const payload = {
      fileName,
      contentType,
      userId,
    };

    if (fileSize !== null) {
      payload.fileSize = fileSize;
    }

    return apiClient.post("/api/upload/presigned-url", payload);
  },

  /**
   * Confirm successful upload
   * @param {string} uploadId - Upload ID from presigned URL generation
   * @returns {Promise<Object>} - Upload confirmation data
   */
  async confirmUpload(uploadId) {
    return apiClient.post("/api/upload/confirm", { uploadId });
  },

  /**
   * Get upload status
   * @param {string} uploadId - Upload ID
   * @returns {Promise<Object>} - Upload status data
   */
  async getUploadStatus(uploadId) {
    return apiClient.get(`/api/upload/${uploadId}`);
  },

  /**
   * Delete uploaded file
   * @param {string} uploadId - Upload ID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  async deleteUpload(uploadId) {
    return apiClient.delete(`/api/upload/${uploadId}`);
  },

  /**
   * Generate download URL
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<Object>} - Download URL data
   */
  async generateDownloadUrl(s3Key, expiresIn = 3600) {
    return apiClient.post("/api/upload/download-url", { s3Key, expiresIn });
  },

  /**
   * List uploads (for debugging)
   * @param {string} userId - Filter by user ID
   * @param {string} status - Filter by status
   * @returns {Promise<Object>} - List of uploads
   */
  async listUploads(userId, status) {
    const params = new URLSearchParams();
    if (userId) params.append("userId", userId);
    if (status) params.append("status", status);

    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get(`/api/upload${query}`);
  },

  /**
   * Initiate a multipart upload
   * @param {string} fileName - Original filename
   * @param {string} contentType - MIME type of the file
   * @param {number} fileSize - File size in bytes
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} - Multipart upload data
   */
  async initiateMultipartUpload(
    fileName,
    contentType,
    fileSize,
    userId = "anonymous"
  ) {
    return apiClient.post("/api/upload/multipart/initiate", {
      fileName,
      contentType,
      fileSize,
      userId,
    });
  },

  /**
   * Complete a multipart upload
   * @param {string} uploadId - Upload ID from multipart initiation
   * @param {Array} parts - Array of completed parts with ETag and PartNumber
   * @returns {Promise<Object>} - Upload completion data
   */
  async completeMultipartUpload(uploadId, parts) {
    return apiClient.post("/api/upload/multipart/complete", {
      uploadId,
      parts,
    });
  },

  /**
   * Abort a multipart upload
   * @param {string} uploadId - Upload ID from multipart initiation
   * @returns {Promise<Object>} - Abort confirmation
   */
  async abortMultipartUpload(uploadId) {
    return apiClient.post("/api/upload/multipart/abort", { uploadId });
  },
};

/**
 * Upload a file directly to S3 using presigned URL
 * @param {string} presignedUrl - The presigned URL
 * @param {File} file - The file to upload
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Response>} - Upload response
 */
export const uploadFileToS3 = async (presignedUrl, file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr);
      } else {
        reject(
          new Error(
            `Upload failed with status ${xhr.status}: ${xhr.statusText}`
          )
        );
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed due to network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"));
    });

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
};

/**
 * Upload a file part to S3 using presigned URL
 * @param {string} presignedUrl - The presigned URL for the part
 * @param {Blob} chunk - The file chunk to upload
 * @returns {Promise<string>} - The ETag from the response
 */
export const uploadPartToS3 = async (presignedUrl, chunk) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (etag) {
          resolve(etag);
        } else {
          reject(new Error("No ETag received from S3"));
        }
      } else {
        reject(
          new Error(
            `Part upload failed with status ${xhr.status}: ${xhr.statusText}`
          )
        );
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Part upload failed due to network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Part upload was aborted"));
    });

    xhr.open("PUT", presignedUrl);
    xhr.send(chunk);
  });
};

/**
 * Upload a large file using multipart upload
 * @param {File} file - The file to upload
 * @param {Object} multipartData - Multipart upload data from backend
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} - Array of completed parts
 */
export const uploadMultipartFile = async (file, multipartData, onProgress) => {
  const { partUrls, partSize } = multipartData;
  const completedParts = [];
  let uploadedBytes = 0;

  for (let i = 0; i < partUrls.length; i++) {
    const partUrl = partUrls[i];
    const start = i * partSize;
    const end = Math.min(start + partSize, file.size);
    const chunk = file.slice(start, end);

    try {
      const etag = await uploadPartToS3(partUrl.presignedUrl, chunk);

      completedParts.push({
        PartNumber: partUrl.partNumber,
        ETag: etag,
      });

      uploadedBytes += chunk.size;

      if (onProgress) {
        const progress = Math.round((uploadedBytes / file.size) * 100);
        onProgress(progress);
      }
    } catch (error) {
      console.error(`Failed to upload part ${partUrl.partNumber}:`, error);
      throw new Error(
        `Failed to upload part ${partUrl.partNumber}: ${error.message}`
      );
    }
  }

  return completedParts;
};

export default apiClient;
