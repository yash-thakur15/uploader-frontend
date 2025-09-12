import "./App.css";
import { useRef, useState, useEffect } from "react";
import { uploadApi, uploadFileToS3, uploadMultipartFile } from "./services/api";

function App() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [fileName, setFileName] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [uploadId, setUploadId] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Check backend health on component mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      console.log("Checking backend health...");
      const response = await uploadApi.checkHealth();
      console.log("Backend health response:", response);

      if (response.success && response.data.s3Configured) {
        setBackendStatus("ready");
        console.log("Backend is ready and S3 is configured");
      } else {
        setBackendStatus("s3-not-configured");
        console.log("Backend is running but S3 is not configured");
      }
    } catch (error) {
      console.error("Backend health check failed:", error);
      setBackendStatus("offline");
    }
  };

  const handleFile = async (file) => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    if (backendStatus !== "ready") {
      let message = "Cannot upload: ";
      switch (backendStatus) {
        case "offline":
          message +=
            "Backend server is offline. Please start the backend server.";
          break;
        case "s3-not-configured":
          message +=
            "S3 is not configured on the backend. Please check AWS credentials.";
          break;
        case "checking":
          message += "Still checking backend status. Please wait.";
          break;
        default:
          message += "Backend is not ready.";
      }
      alert(message);
      return;
    }

    // Validate file size (skip validation for video files - no upper limit)
    const isVideoFile = file.type.startsWith("video/");
    if (!isVideoFile) {
      const maxFileSize = 30 * 1024 * 1024 * 1024; // 30GB in bytes for non-video files
      if (file.size > maxFileSize) {
        const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(1);
        alert(
          `File size ${fileSizeGB}GB exceeds the maximum allowed size of 30GB. Please select a smaller file.`
        );
        return;
      }
    }

    setFileName(file.name);
    setStatus("generating-url");
    setUploadProgress(0);
    setUploadId(null);
    setDownloadUrl(null);

    try {
      // Determine if we should use multipart upload (files > 50MB)
      const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
      const useMultipart = file.size > MULTIPART_THRESHOLD;

      console.log(
        `Processing ${useMultipart ? "multipart" : "single"} upload for:`,
        file.name,
        file.type,
        `${(file.size / (1024 * 1024)).toFixed(1)}MB`
      );

      if (useMultipart) {
        // Multipart upload flow
        setStatus("initiating-multipart");

        // Step 1: Initiate multipart upload
        console.log("Initiating multipart upload...");
        const multipartResponse = await uploadApi.initiateMultipartUpload(
          file.name,
          file.type,
          file.size,
          "demo-user"
        );

        console.log("Multipart initiation response:", multipartResponse);

        if (!multipartResponse.success) {
          throw new Error("Failed to initiate multipart upload");
        }

        const {
          uploadId: newUploadId,
          partUrls,
          partSize,
        } = multipartResponse.data;
        setUploadId(newUploadId);
        setStatus("uploading-parts");

        // Step 2: Upload all parts
        console.log(`Uploading ${partUrls.length} parts...`);
        const completedParts = await uploadMultipartFile(
          file,
          { partUrls, partSize },
          (progress) => {
            setUploadProgress(progress);
          }
        );

        console.log("All parts uploaded successfully");
        setStatus("completing-multipart");

        // Step 3: Complete multipart upload
        console.log("Completing multipart upload...");
        const completeResponse = await uploadApi.completeMultipartUpload(
          newUploadId,
          completedParts
        );

        console.log("Multipart completion response:", completeResponse);

        if (completeResponse.success) {
          setStatus("done");
          setDownloadUrl(completeResponse.data.downloadUrl);
          console.log("Multipart upload completed successfully!");
        } else {
          throw new Error("Failed to complete multipart upload");
        }
      } else {
        // Single upload flow (existing logic)
        setStatus("generating-url");

        // Step 1: Generate presigned URL
        console.log("Generating presigned URL...");
        const urlResponse = await uploadApi.generatePresignedUrl(
          file.name,
          file.type,
          "demo-user",
          file.size
        );

        console.log("Presigned URL response:", urlResponse);

        if (!urlResponse.success) {
          throw new Error("Failed to generate presigned URL");
        }

        const { uploadId: newUploadId, presignedUrl } = urlResponse.data;
        setUploadId(newUploadId);
        setStatus("uploading");

        // Step 2: Upload file to S3
        console.log("Uploading file to S3...");
        await uploadFileToS3(presignedUrl, file, (progress) => {
          setUploadProgress(progress);
        });

        console.log("File uploaded successfully");
        setStatus("confirming");

        // Step 3: Confirm upload with backend
        console.log("Confirming upload with backend...");
        const confirmResponse = await uploadApi.confirmUpload(newUploadId);

        console.log("Upload confirmation response:", confirmResponse);

        if (confirmResponse.success) {
          setStatus("done");
          setDownloadUrl(confirmResponse.data.downloadUrl);
          console.log("Upload completed successfully!");
        } else {
          throw new Error("Failed to confirm upload");
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("error");

      // Show user-friendly error message
      let errorMessage = "Upload failed: ";
      if (error.message.includes("403")) {
        errorMessage += "Access denied. Please check AWS permissions.";
      } else if (error.message.includes("network")) {
        errorMessage += "Network error. Please check your connection.";
      } else if (error.message.includes("Invalid file type")) {
        errorMessage += "Invalid file type. Please select a video file.";
      } else {
        errorMessage += error.message;
      }

      alert(errorMessage);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onChoose = (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
  };

  const handleRetry = () => {
    setStatus("idle");
    setUploadProgress(0);
    setFileName("");
    setUploadId(null);
    setDownloadUrl(null);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold mb-4">🎞️ Video Uploader</h1>

        {/* Backend Status Indicator */}
        <div className="mb-4 p-3 rounded-lg border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Backend Status:
            </span>
            <span
              className={`text-sm font-semibold ${
                backendStatus === "ready"
                  ? "text-green-600"
                  : backendStatus === "offline"
                  ? "text-red-600"
                  : backendStatus === "s3-not-configured"
                  ? "text-yellow-600"
                  : "text-blue-600"
              }`}
            >
              {backendStatus === "ready"
                ? "✅ Ready"
                : backendStatus === "offline"
                ? "❌ Offline"
                : backendStatus === "s3-not-configured"
                ? "⚠️ S3 Not Configured"
                : "⏳ Checking..."}
            </span>
          </div>
          {backendStatus === "offline" && (
            <p className="text-xs text-red-600 mt-1">
              Backend server is not running. Please start it with: npm run dev
            </p>
          )}
          {backendStatus === "s3-not-configured" && (
            <p className="text-xs text-yellow-600 mt-1">
              AWS S3 credentials are not configured. Please check your .env
              file.
            </p>
          )}
          {backendStatus === "ready" && (
            <p className="text-xs text-green-600 mt-1">
              Backend is running and S3 is configured. Ready for uploads!
            </p>
          )}
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            backendStatus === "ready"
              ? "border-gray-300 hover:border-gray-400"
              : "border-gray-200 cursor-not-allowed opacity-50"
          }`}
          onClick={() =>
            backendStatus === "ready" && fileInputRef.current.click()
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onChoose}
            disabled={backendStatus !== "ready"}
          />
          <p className="text-gray-600">
            {backendStatus === "ready"
              ? "Drag & drop a video, or click to choose"
              : "Please wait for backend to be ready..."}
          </p>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Status:{" "}
              <span
                className={`${
                  status === "idle"
                    ? "text-blue-600"
                    : status === "error"
                    ? "text-red-600"
                    : status === "done"
                    ? "text-green-600"
                    : "text-yellow-600"
                }`}
              >
                {status === "generating-url"
                  ? "Generating URL..."
                  : status === "initiating-multipart"
                  ? "Initiating multipart upload..."
                  : status === "uploading-parts"
                  ? "Uploading parts..."
                  : status === "completing-multipart"
                  ? "Completing multipart upload..."
                  : status === "confirming"
                  ? "Confirming..."
                  : status}
              </span>
            </span>
            <span className="text-gray-500" title={fileName}>
              File: {fileName || "-"}
            </span>
          </div>
          <div className="mt-3 h-4 bg-gray-100 rounded overflow-hidden">
            <div
              style={{ width: `${uploadProgress}%` }}
              className="h-full bg-blue-500 transition-all"
            />
          </div>
          <div className="mt-2 text-sm text-gray-600">{uploadProgress}%</div>

          {status === "done" && (
            <div className="mt-4 space-y-2">
              <div className="text-green-600">Upload successful!</div>
              {uploadId && (
                <div className="text-xs text-gray-500">
                  Upload ID: {uploadId}
                </div>
              )}
              {downloadUrl && (
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Download File
                </button>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 space-y-2">
              <div className="text-red-600">Upload failed.</div>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
