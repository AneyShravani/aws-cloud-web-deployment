# AWS Cloud Web Deployment

A full-stack web application deployed on AWS using **Amazon S3 for the React frontend** and **Amazon EC2 for the Node.js/Express backend**, with **MongoDB Atlas** as the database and **PM2** for backend process management.

## 🚀 Live Application

**Frontend:** http://aws-cloud-web-frontend-shravani.s3-website.ap-south-1.amazonaws.com

The deployed application has been tested for login, API communication, and application data retrieval.

> Open the frontend URL above and log in to access the dashboard.


## ☁️ Architecture

```text
                    User / Browser
                          │
                          ▼
              ┌─────────────────────┐
              │      Amazon S3       │
              │   React Frontend     │
              │  Static Website      │
              └──────────┬──────────┘
                         │
                    API Requests
                         │
                         ▼
              ┌─────────────────────┐
              │     Amazon EC2       │
              │  Linux / Node.js     │
              │  Express Backend     │
              │       + PM2          │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    MongoDB Atlas     │
              │      Database        │
              └─────────────────────┘
```

---

## 🛠️ Technologies Used

### Cloud & Infrastructure

* **Amazon EC2** — Backend hosting
* **Amazon S3** — React frontend static website hosting
* **Linux** — EC2 server environment
* **MongoDB Atlas** — Cloud database
* **PM2** — Node.js process management

### Application

* React
* Node.js
* Express.js
* MongoDB / Mongoose
* JWT authentication
* REST APIs

### Development & Version Control

* Git
* GitHub
* npm

---

## 📌 Project Overview

The project demonstrates the deployment of a full-stack web application on AWS.

The backend is hosted on an Amazon EC2 Linux instance and exposes REST APIs through a configured public port. MongoDB Atlas is used as the cloud database.

The React frontend is built and deployed as a static website on Amazon S3.

PM2 is used on EC2 to manage the Node.js backend process.

---

## 🔧 Backend Deployment — AWS EC2

The backend deployment includes:

* Creating and configuring an Amazon EC2 instance
* Connecting to the Linux server through SSH
* Installing Node.js and project dependencies
* Configuring environment variables
* Connecting the backend to MongoDB Atlas
* Configuring EC2 security group rules
* Configuring Express to accept external connections
* Testing backend port accessibility
* Testing REST API endpoints
* Running the backend with PM2

### Backend Deployment Documentation

[View Backend AWS Deployment](./Backend%20AWS%20Deployment/backend-deployment.md)

### Backend Evidence

The `Backend AWS Deployment` folder contains screenshots covering:

* EC2 instance
* Security group configuration
* Backend running
* MongoDB Atlas connection
* Port testing
* API testing
* PM2 process management

---

## 🌐 Frontend Deployment — Amazon S3

The frontend deployment includes:

* Configuring the React frontend to use the deployed EC2 backend
* Creating a production frontend build
* Creating an Amazon S3 bucket
* Uploading the frontend build files
* Enabling S3 static website hosting
* Configuring public read access for website objects
* Verifying the deployed website
* Testing frontend-to-backend communication

### Frontend Deployment Documentation

[View Frontend AWS Deployment](./Frontend%20AWS%20Deployment/deployment-steps.md)

### Frontend Evidence

The `Frontend AWS Deployment` folder contains screenshots covering:

* EC2 backend
* Public backend API
* Frontend application
* Frontend-backend communication
* Complete application
* S3 bucket
* S3 static website hosting
* S3 public access configuration
* Uploaded frontend files
* Live S3 website

---

## 🔄 Deployment Flow

```text
1. Develop Application
        ↓
2. Push Source Code to GitHub
        ↓
3. Deploy Backend to EC2
        ↓
4. Connect Backend to MongoDB Atlas
        ↓
5. Configure PM2
        ↓
6. Build React Frontend
        ↓
7. Upload Frontend to S3
        ↓
8. Enable S3 Static Website Hosting
        ↓
9. Connect Frontend → EC2 Backend
        ↓
10. Test Complete Application
```

---

## 🔐 Security

* Sensitive environment variables are stored outside the GitHub repository.
* `.env` files are not committed.
* AWS credentials and private keys are not included in the repository.
* EC2 access is controlled using security group rules.
* MongoDB connection credentials are not exposed in the source code.

---

## 📂 Repository Structure

```text
aws-cloud-web-deployment/
│
├── admin/
│
├── backend/
│
├── docs/
│
├── Backend AWS Deployment/
│   ├── 01-ec2-instance.png
│   ├── 02-security-group.png
│   ├── 03-backend-running.png
│   ├── 04-mongodb-atlas.png
│   ├── 05-port-test.png
│   ├── 06-api-test.png
│   ├── 07-pm2-running.png
│   └── backend-deployment.md
│
├── Frontend AWS Deployment/
│   ├── 01-ec2-instance.png
│   ├── 02-ec2-backend-running.png
│   ├── 03-backend-public-api.png
│   ├── 04-frontend-local.png
│   ├── 05-frontend-backend-connection.png
│   ├── 06-full-application.png
│   ├── 07-s3-bucket.png
│   ├── 08-s3-static-website.png
│   ├── 09-s3-permissions.png
│   ├── 10-s3-frontend-files.png
│   ├── 11-s3-live-website.png
│   └── deployment-steps.md
│
├── PROJECT_ARCHITECTURE.md
└── README.md
```

---

## ✅ Deployment Verification

The deployed application was verified through:

* EC2 instance health checks
* SSH connection
* Backend server execution
* MongoDB Atlas connection
* Public port connectivity
* REST API testing
* PM2 process status
* S3 static website hosting
* Frontend file upload
* Live frontend access
* Frontend-to-backend communication
* Application login and data retrieval

---

## 🎯 Key Learning Outcomes

* AWS EC2 deployment and Linux server management
* Amazon S3 static website hosting
* Security group configuration
* Node.js backend deployment
* MongoDB Atlas integration
* PM2 process management
* REST API deployment and testing
* Frontend-backend integration
* Git and GitHub based deployment workflow
* Basic cloud troubleshooting
