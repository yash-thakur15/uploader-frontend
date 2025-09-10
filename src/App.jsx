import "./App.css";
import { useRef, useState } from "react";

function App() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [fileName, setFileName] = useState("");
  const presignedUrl = import.meta.env.VITE_S3_PRESIGNED_URL;
  const fileInputRef = useRef(null);

  const uploadToS3 = (presignedUrl, file) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else reject(new Error("Upload failed with status " + xhr.status));
      };
      xhr.onerror = () => reject(new Error("Network error"));

      xhr.send(file);
    });
  };

  const handleFile = async (file) => {
    if (!file || !presignedUrl) {
      alert("Please enter a presigned URL first.");
      return;
    }
    setFileName(file.name);
    setStatus("uploading");
    try {
      await uploadToS3(presignedUrl, file);
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
