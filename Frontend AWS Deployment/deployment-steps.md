# Frontend Deployment on AWS S3

## 1. Prepare the Frontend

* Used the React frontend from the project repository.
* Configured the frontend to communicate with the deployed backend running on AWS EC2.
* Set the backend API URL through the frontend environment configuration.

Example:

```env
VITE_API_URL=http://<EC2_PUBLIC_IP>:5000/api
```

> The actual EC2 public IP is not included in this documentation because a public IPv4 address can change when an EC2 instance is stopped and started.

## 2. Build the Frontend

Installed the required frontend dependencies:

```bash
npm install
```

Created the production build:

```bash
npm run build
```

The production-ready frontend files were generated in the build output directory.

## 3. Create Amazon S3 Bucket

* Created an Amazon S3 bucket named:

```text
aws-cloud-web-frontend-shravani
```

* Created the bucket in the **Asia Pacific (Mumbai) `ap-south-1`** region.

## 4. Upload Frontend to S3

* Uploaded the production frontend files to the S3 bucket.
* Verified that the frontend files and assets were available inside the bucket.

The deployed bucket contains the files required to serve the React application, including the main HTML file and frontend assets.

## 5. Enable Static Website Hosting

Enabled **Static website hosting** for the S3 bucket.

Configuration:

* Static website hosting: **Enabled**
* Hosting type: **Bucket hosting**

The S3 website endpoint is:

```text
http://aws-cloud-web-frontend-shravani.s3-website.ap-south-1.amazonaws.com
```

## 6. Configure Public Access

Configured the S3 bucket to allow public read access to the frontend objects required for website hosting.

The bucket policy allows:

```text
s3:GetObject
```

for the objects in the frontend bucket.

> Only the frontend deployment bucket is configured for public website access. Sensitive application credentials are not stored in the bucket.

## 7. Connect Frontend to Backend

The deployed React frontend communicates with the Node.js/Express backend running on AWS EC2.

Architecture:

```text
User
  │
  ▼
Amazon S3
React Frontend
  │
  │ API Requests
  ▼
Amazon EC2
Node.js / Express Backend
  │
  ▼
MongoDB Atlas
```

The frontend was tested using the deployed EC2 backend API.

## 8. Verify Frontend-Backend Communication

Verified the deployed application by:

* Opening the S3 website endpoint.
* Loading the React application.
* Testing user login.
* Sending API requests from the frontend.
* Retrieving application data from the backend.
* Confirming communication between S3-hosted frontend, EC2 backend, and MongoDB Atlas.

## 9. Deployment Evidence

The deployment screenshots document the following:

* `01-ec2-instance.png` — EC2 instance used for the backend
* `02-ec2-backend-running.png` — backend running on EC2
* `03-backend-public-api.png` — public backend API
* `04-frontend-local.png` — frontend application before deployment
* `05-frontend-backend-connection.png` — frontend and backend communication
* `06-full-application.png` — complete application
* `07-s3-bucket.png` — S3 bucket creation
* `08-s3-static-website.png` — S3 static website hosting configuration
* `09-s3-permissions.png` — S3 public access configuration
* `10-s3-frontend-files.png` — uploaded frontend files

## Result

The React frontend was successfully deployed to Amazon S3 using static website hosting.

The deployed frontend communicates with the Node.js/Express backend running on AWS EC2, which connects to MongoDB Atlas.

### Live Application

```text
http://aws-cloud-web-frontend-shravani.s3-website.ap-south-1.amazonaws.com/dashboard
```
