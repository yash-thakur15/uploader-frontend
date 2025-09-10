# Video Uploader

A React-based video uploader that uses AWS S3 presigned URLs for secure file uploads.

## Problem Solved

This application addresses the common S3 upload 403 Forbidden error by:

- Validating presigned URL expiration before upload attempts
- Providing clear error messages and status indicators
- Offering guidance on generating new presigned URLs

## Features

- ✅ Drag & drop video upload
- ✅ Presigned URL validation and expiry checking
- ✅ Real-time upload progress tracking
- ✅ Clear error handling and user feedback
- ✅ Responsive design with Tailwind CSS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with your presigned URL:

```bash
VITE_S3_PRESIGNED_URL=your_presigned_url_here
```

3. Start the development server:

```bash
npm run dev
```

## Generating a New Presigned URL

When your presigned URL expires (which caused the 403 error), you need to generate a new one:

### Using AWS CLI

1. **Install AWS CLI** (if not already installed):

```bash
# macOS
brew install awscli

# Windows
# Download from https://aws.amazon.com/cli/

# Linux
sudo apt-get install awscli
```

2. **Configure AWS CLI** with your credentials:

```bash
aws configure
```

Enter your:

- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `ap-south-1`)
- Default output format (e.g., `json`)

3. **Generate a new presigned URL**:

```bash
# For PUT operations (upload)
aws s3 presign s3://hardy-mfg/uploads/client_video.mp4 \
  --expires-in 604800 \
  --region ap-south-1

# For custom expiry (e.g., 24 hours = 86400 seconds)
aws s3 presign s3://hardy-mfg/uploads/client_video.mp4 \
  --expires-in 86400 \
  --region ap-south-1
```

4. **Update your .env file** with the new URL:

```bash
VITE_S3_PRESIGNED_URL=https://s3.ap-south-1.amazonaws.com/hardy-mfg/uploads/client_video.mp4?X-Amz-Algorithm=...
```

5. **Restart your development server** to load the new URL.

### Using AWS SDK (Alternative)

If you prefer to generate presigned URLs programmatically:

```javascript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: "ap-south-1" });

const command = new PutObjectCommand({
  Bucket: "hardy-mfg",
  Key: "uploads/client_video.mp4",
});

const presignedUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 604800, // 7 days
});
```

## Common Issues and Solutions

### 403 Forbidden Error

- **Cause**: Expired presigned URL
- **Solution**: Generate a new presigned URL using the steps above

### CORS Issues

If you encounter CORS errors, ensure your S3 bucket has the correct CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### Bucket Policy

Ensure your S3 bucket policy allows the necessary operations:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPresignedUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::hardy-mfg/uploads/*"
    }
  ]
}
```

## URL Expiry Information

The application automatically checks:

- ✅ URL format validity
- ✅ Expiration status
- ✅ Time remaining until expiry

Current URL details from your `.env`:

- **Bucket**: hardy-mfg
- **Key**: uploads/client_video.mp4
- **Region**: ap-south-1
- **Original Expiry**: 7 days (604800 seconds)

## Development

Built with:

- React 18
- Vite
- Tailwind CSS
- AWS S3 Presigned URLs

## File Structure

```
uploader/
├── src/
│   ├── App.jsx          # Main upload component
│   ├── utils/
│   │   └── s3Utils.js   # S3 utility functions
│   └── ...
├── .env                 # Environment variables
└── README.md           # This file
```
