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

export default apiClient;
