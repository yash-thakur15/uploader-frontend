import "./App.css";
import { useRef, useState, useEffect } from "react";
import { getUrlExpiryInfo } from "./utils/s3Utils";

function App() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [fileName, setFileName] = useState("");
  const [urlStatus, setUrlStatus] = useState("checking");
  const presignedUrl = import.meta.env.VITE_S3_PRESIGNED_URL;
  const fileInputRef = useRef(null);

  // Check URL validity on component mount
  useEffect(() => {
    console.log("Checking URL validity...", { presignedUrl });

    if (!presignedUrl) {
      console.log("No presigned URL found");
      setUrlStatus("missing");
      return;
    }

    const urlInfo = getUrlExpiryInfo(presignedUrl);
    console.log("URL Info:", JSON.stringify(urlInfo, null, 2));
    console.log("Current time:", new Date().toISOString());
    console.log("URL signed date:", urlInfo.signedDate);
    console.log("URL expiry date:", urlInfo.expiryDate);
    console.log("Is expired?", urlInfo.isExpired);

    if (!urlInfo.valid) {
      console.log("URL is invalid");
      setUrlStatus("invalid");
      return;
    }

    if (urlInfo.isExpired) {
      console.log("URL is expired");
      setUrlStatus("expired");
      return;
    }

    console.log("URL is valid");
    setUrlStatus("valid");
  }, [presignedUrl]);

  // const uploadToS3 = (file) => {
  //   return new Promise((resolve, reject) => {
  //     const xhr = new XMLHttpRequest();
  //     xhr.open("POST", presignedUrl);
  //     xhr.setRequestHeader("Content-Type", file.type);

  //     xhr.upload.onprogress = (e) => {
  //       if (e.lengthComputable) {
  //         const percent = Math.round((e.loaded / e.total) * 100);
  //         setUploadProgress(percent);
  //       }
  //     };

  //     xhr.onload = () => {
  //       if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
  //       else reject(new Error("Upload failed with status " + xhr.status));
  //     };

  //     xhr.onerror = (err) => {
  //       console.log("ERROR ---->", err);
  //       reject(new Error("Network error"));
  //     };

  //     xhr.send(file);
  //   });
  // };

  // const handleFile = async (file) => {
  //   if (!file || !presignedUrl) {
  //     alert("Please enter a presigned URL first.");
  //     return;
  //   }
  //   setFileName(file.name);
  //   setStatus("uploading");
  //   try {
  //     await uploadToS3(presignedUrl, file);
  //     setStatus("done");
  //   } catch (err) {
  //     console.error(err);
  //     setStatus("error");
  //   }
  // };

  const uploadToS3 = async (file) => {
    try {
      const res = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      console.log("Upload response:", res);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Upload failed:", {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
        });

        if (res.status === 403) {
          throw new Error(
            "Upload forbidden - presigned URL may be expired or invalid"
          );
        }
        throw new Error(
          `Upload failed with status ${res.status}: ${res.statusText}`
        );
      }
      return res;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  const handleFile = async (file) => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    if (!presignedUrl) {
      alert(
        "Presigned URL is missing. Please check your environment configuration."
      );
      return;
    }

    if (urlStatus !== "valid") {
      let message = "Cannot upload: ";
      switch (urlStatus) {
        case "expired":
          message += "Presigned URL has expired. Please generate a new one.";
          break;
        case "invalid":
          message += "Presigned URL is invalid.";
          break;
        case "missing":
          message += "Presigned URL is missing.";
          break;
        default:
          message += "Presigned URL status is unknown.";
      }
      alert(message);
      return;
    }

    setFileName(file.name);
    setStatus("uploading");
    setUploadProgress(0);

    try {
      await uploadToS3(file);
      setUploadProgress(100);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-semibold mb-4">🎞️ Video Uploader</h1>

        {/* URL Status Indicator */}
        <div className="mb-4 p-3 rounded-lg border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Presigned URL Status:
            </span>
            <span
              className={`text-sm font-semibold ${
                urlStatus === "valid"
                  ? "text-green-600"
                  : urlStatus === "expired"
                  ? "text-red-600"
                  : urlStatus === "invalid"
                  ? "text-red-600"
                  : urlStatus === "missing"
                  ? "text-red-600"
                  : "text-yellow-600"
              }`}
            >
              {urlStatus === "valid"
                ? "✅ Valid"
                : urlStatus === "expired"
                ? "❌ Expired"
                : urlStatus === "invalid"
                ? "❌ Invalid"
                : urlStatus === "missing"
                ? "❌ Missing"
                : "⏳ Checking..."}
            </span>
          </div>
          {urlStatus === "expired" && (
            <p className="text-xs text-red-600 mt-1">
              The presigned URL has expired. Please generate a new one using AWS
              CLI.
            </p>
          )}
          {urlStatus === "missing" && (
            <p className="text-xs text-red-600 mt-1">
              No presigned URL found in environment variables. Please set
              VITE_S3_PRESIGNED_URL.
            </p>
          )}
          {urlStatus === "invalid" && (
            <p className="text-xs text-red-600 mt-1">
              The presigned URL format is invalid. Please check the URL.
            </p>
          )}
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400"
          onClick={() => fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onChoose}
          />
          <p className="text-gray-600">
            Drag & drop a video, or click to choose
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
                {status}
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
            <div className="mt-4 text-green-600">Upload successful!</div>
          )}
          {status === "error" && (
            <div className="mt-4 text-red-600">Upload failed.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
