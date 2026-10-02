# Backend Deployment on AWS EC2

## 1. Create AWS EC2 Instance

* Created an Amazon EC2 instance using Amazon Linux.
* Configured the required security group rules for SSH and backend API access.
* Connected to the EC2 instance using SSH.

## 2. Deploy Backend Project

* Cloned the project repository from GitHub onto the EC2 instance.
* Navigated to the backend directory.
* Installed the required Node.js dependencies using:

```bash
npm install
```

## 3. Configure Environment Variables

* Created the `.env` file on the EC2 server.
* Configured the required environment variables for:

  * MongoDB connection
  * Server port
  * JWT secret
  * Email configuration

> Sensitive credentials are stored only on the EC2 instance and are not included in this repository.

## 4. Connect Backend to MongoDB Atlas

* Connected the deployed backend to MongoDB Atlas.
* Configured the MongoDB connection to use the `ai-lab-maintenance` database.
* Verified that the backend successfully connected to MongoDB Atlas.

## 5. Configure Backend for Public Access

Updated the Express server to listen on all network interfaces:

```javascript
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port : http://localhost:${PORT}`);
});
```

This allows the backend API to accept connections from outside the EC2 instance.

The EC2 security group was configured to allow TCP traffic on port `5000`.

## 6. Start and Verify the Backend

The backend was initially tested using:

```bash
npm start
```

The server successfully started on port `5000`.

The backend was then tested using the EC2 public IPv4 address to verify that the API was reachable externally.

## 7. Configure PM2 Process Management

PM2 was configured to manage the Node.js backend process.

Installed PM2 globally:

```bash
npm install -g pm2
```

Started the backend using:

```bash
pm2 start server.js --name ai-lab-backend
```

Verified the running process using:

```bash
pm2 status
```

The `ai-lab-backend` process was successfully shown as `online`.

Saved the current PM2 process list:

```bash
pm2 save
```

This allows PM2 to retain the configured process list.

### PM2 Verification

The `07-pm2-running.png` screenshot shows:

* PM2 process `ai-lab-backend`
* Process status: `online`
* Successful PM2 process-list save

## 8. Test Backend API

* Tested the backend using the EC2 public IPv4 address.
* Verified that port `5000` was externally reachable.
* Tested the deployed API endpoints.
* Confirmed successful communication between the backend and MongoDB Atlas.

## 9. Connect Frontend to Deployed Backend

The React frontend was configured to use the deployed EC2 backend API:

```env
VITE_API_URL=http://<EC2_PUBLIC_IP>:5000/api
```

The actual EC2 public IP is configured in the frontend environment during deployment and is not hard-coded into this documentation because EC2 public IPv4 addresses can change.

The frontend was tested for:

* User login
* API requests
* Data retrieval
* Backend communication

The deployed frontend successfully communicated with the EC2 backend and MongoDB Atlas.

## 10. Deployment Verification

The complete backend deployment was verified through:

1. EC2 instance running successfully
2. SSH access to the Linux server
3. Security group configuration
4. Node.js backend running on port `5000`
5. Successful MongoDB Atlas connection
6. Public port connectivity testing
7. API endpoint testing
8. PM2 process management
9. Frontend-to-backend API communication

## Result

The Node.js/Express backend was successfully deployed on an AWS EC2 instance and connected to MongoDB Atlas.

PM2 is used to manage the backend process on EC2, while the React frontend communicates with the deployed backend through the EC2 public API endpoint.
