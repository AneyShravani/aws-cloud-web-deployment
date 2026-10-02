# Backend Deployment on AWS EC2

## 1. Create AWS EC2 Instance

* Created an Amazon EC2 instance using Amazon Linux.
* Configured the required security group rules.
* Used SSH to connect to the EC2 instance.

## 2. Upload Backend Project

* Accessed the backend project on the EC2 instance.
* Navigated to the backend directory.
* Installed the required Node.js dependencies using:

```bash
npm install
```

## 3. Configure Environment Variables

* Created the `.env` file on the EC2 server.
* Configured:

  * MongoDB connection
  * Server port
  * JWT secret
  * Required email configuration

> Sensitive credentials are not included in this repository.

## 4. Connect Backend to MongoDB Atlas

* Connected the deployed backend to MongoDB Atlas.
* Configured the MongoDB connection to use the `ai-lab-maintenance` database.
* Verified the connection successfully.

## 5. Configure Backend for Public Access

* Updated the Express server to listen on all network interfaces:

```javascript
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port : http://localhost:${PORT}`);
});
```

* This allowed the backend API to be accessed from outside the EC2 instance.

## 6. Start the Backend

```bash
npm start
```

The backend successfully started on port `5000`.

## 7. Test Backend

* Tested the backend using the EC2 public IPv4 address.
* Verified that the API was publicly reachable.
* Confirmed successful MongoDB connection.

## 8. Frontend Connection

* Configured the React frontend to use the EC2 backend:

```env
VITE_API_URL=http://13.127.216.14:5000/api
```

* Tested login and API requests from the frontend.
* Confirmed successful communication between the frontend, EC2 backend, and MongoDB Atlas.

## Result

The backend is successfully deployed on AWS EC2 and connected to MongoDB Atlas. The React frontend can communicate with the deployed backend through the EC2 public IP.
